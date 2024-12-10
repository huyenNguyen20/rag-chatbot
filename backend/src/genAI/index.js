const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { BedrockEmbeddings } = require("@langchain/aws");

const AWS_REGION = "us-east-1";
const LLM_MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0";

async function loadAndProcessPDF(pdfUrl) {
  const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });

  const loader = new PDFLoader(pdfUrl, { splitPages: false });
  const docs = await loader.load();
  const textContent = docs[0].pageContent;

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 100,
    chunkOverlap: 0,
    separators: ["\n\n", "\n", " ", ""],
  });

  const texts = await textSplitter.createDocuments([textContent]);

  const embeddings = new BedrockEmbeddings({
    client: bedrockClient,
  });

  const vectorstore = await MemoryVectorStore.fromDocuments(texts, embeddings);

  return {
    vectorDB: vectorstore.asRetriever(10),
    bedrockClient,
  };
}

async function handleUserQuery(userPrompt, bedrockClient, vectorDB) {
  const retrievedDocuments = await vectorDB.invoke(userPrompt);

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Answer concisely the following question based on the context provided. If the answer is not in the context, say "I don't know".\n\nQuestion: ${userPrompt}`,
          },
          ...retrievedDocuments.map((document) => ({
            type: "text",
            text: document.pageContent,
          })),
        ],
      },
    ],
  };

  const command = new InvokeModelCommand({
    contentType: "application/json",
    body: JSON.stringify(payload),
    modelId: LLM_MODEL_ID,
  });

  const apiResponse = await bedrockClient.send(command);

  const decodedResponseBody = new TextDecoder().decode(apiResponse.body);
  const responseBody = JSON.parse(decodedResponseBody);

  return responseBody.content[0].text;
}

module.exports = {
  loadAndProcessPDF,
  handleUserQuery,
};
