import React, { useState } from "react";

const ChatBotApp = () => {
  const [userInput, setUserInput] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Function to handle file selection
  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
    setError("");
    setSuccess("");
  };

  // Function to handle file upload
  const handleFileUpload = async () => {
    if (!file) {
      setError("Please select a file before uploading.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("http://localhost:4000/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess("File uploaded and processed successfully.");
      } else {
        setError(result.error || "Failed to upload the file.");
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred while uploading the file.");
    } finally {
      setUploading(false);
    }
  };

  // Function to handle sending user input
  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    setChatLog([...chatLog, { type: "user", message: userInput }]);
    setUserInput("");

    try {
      const response = await fetch("http://localhost:4000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: userInput }),
      });

      const result = await response.json();

      if (response.ok) {
        setChatLog((prevChatLog) => [
          ...prevChatLog,
          { type: "bot", message: result.answer },
        ]);
      } else {
        setChatLog((prevChatLog) => [
          ...prevChatLog,
          { type: "bot", message: result.error || "Failed to fetch response." },
        ]);
      }
    } catch (err) {
      console.error(err);
      setChatLog((prevChatLog) => [
        ...prevChatLog,
        {
          type: "bot",
          message: "An error occurred while processing your request.",
        },
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-6 px-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Gen AI Chatbot</h1>

      {/* File Upload Section */}
      <div className="w-full max-w-md mb-6">
        <h2 className="text-lg font-semibold mb-3">Upload PDF File</h2>
        <div className="flex items-center space-x-2">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 border border-gray-300 rounded-md shadow-sm"
          />
          <button
            onClick={handleFileUpload}
            disabled={uploading}
            className={`px-4 py-2 text-sm text-white rounded-md ${
              uploading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
      </div>

      {/* Chat Section */}
      <div className="w-full max-w-md flex flex-col space-y-4">
        <div className="bg-white shadow-md rounded-md p-4 h-96 overflow-y-auto">
          {chatLog.length > 0 ? (
            chatLog.map((chat, index) => (
              <div
                key={index}
                className={`flex ${
                  chat.type === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`px-4 py-2 rounded-lg max-w-xs ${
                    chat.type === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {chat.message}
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500">
              No messages yet. Start the conversation!
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Ask a question..."
            className="flex-grow border border-gray-300 rounded-md px-4 py-2 shadow-sm focus:outline-none focus:ring focus:ring-blue-200"
          />
          <button
            onClick={handleSendMessage}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBotApp;
