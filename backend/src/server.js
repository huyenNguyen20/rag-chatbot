const fastify = require("fastify")({ logger: true });
const path = require("path");
const cors = require("@fastify/cors");
const { loadAndProcessPDF, handleUserQuery } = require("./genAI/index");
const multipart = require("@fastify/multipart");
const fs = require("fs");
const { BedrockRuntimeClient } = require("@aws-sdk/client-bedrock-runtime");

const AWS_REGION = "us-east-1";
const UPLOADS_DIR = path.join(__dirname, "uploads");

// Ensure the uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Initialize Bedrock client and vectorDB globally
let bedrockClient;
let vectorDB;

(async () => {
  try {
    // initialize bedrock
    bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });

    const defaultPDFPath = path.join(__dirname, "uploads/default.pdf");
    vectorDB = await loadAndProcessPDF(defaultPDFPath, bedrockClient);

    fastify.decorate("vectorDB", vectorDB);
    fastify.decorate("bedrockClient", bedrockClient);

    await fastify.register(cors, {
      origin: "*", // Allow all origins for CORS
    });

    // Register multipart plugin for file uploads
    await fastify.register(multipart);

    // Define API endpoint
    // Endpoint to upload a PDF file
    fastify.post("/upload", async (request, reply) => {
      const data = await request.file();

      if (!data || data.mimetype !== "application/pdf") {
        return reply.status(400).send({ error: "Only PDF files are allowed" });
      }

      // Save the uploaded file
      const filePath = path.join(UPLOADS_DIR, data.filename);
      await fs.promises.writeFile(filePath, await data.toBuffer());

      // Process the uploaded PDF
      try {
        const { vectorDB: updatedVectorDB } = await loadAndProcessPDF(filePath);
        vectorDB = updatedVectorDB;

        return reply.send({
          message: "PDF uploaded and processed successfully",
        });
      } catch (error) {
        console.error("Error processing uploaded PDF:", error);
        return reply.status(500).send({ error: "Failed to process PDF" });
      }
    });

    fastify.post("/ask", async (request, reply) => {
      try {
        const { prompt } = request.body;
        if (!prompt) {
          return reply.status(400).send({ error: "Prompt is required" });
        }

        if (!vectorDB || !bedrockClient) {
          return reply
            .status(400)
            .send({ error: "Please upload a PDF before asking questions" });
        }

        const response = await handleUserQuery(prompt, bedrockClient, vectorDB);
        return reply.send({ answer: response });
      } catch (error) {
        fastify.log.error("Error handling prompt:", error);
        return reply.status(500).send({ error: "Internal Server Error" });
      }
    });

    // Start the server
    fastify.listen({ port: 4000 }, (err, address) => {
      if (err) {
        fastify.log.error(err);
        process.exit(1);
      }
      console.log(`Server running at ${address}`);
    });
  } catch (error) {
    console.error("Error initializing services:", error);
    process.exit(1);
  }
})();
