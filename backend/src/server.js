// Import required modules
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Load environment variables from .env file
require("dotenv").config();

// Import database connection function
const { connectDB } = require("./config/db");

// Import socket event handlers
const { registerChatHandlers } = require("./socket");

/**
 * Initializes and starts the Express + Socket.IO server
 */
async function startServer() {

  // Create Express application
  const app = express();

  // Create HTTP server using Express app
  const server = http.createServer(app);

  /**
   * Initialize Socket.IO server
   * Enables real-time, bidirectional communication
   */
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173", // React development server URL
      methods: ["GET", "POST"],
    },
  });

  // Enable Cross-Origin Resource Sharing
  app.use(cors());

  // Enable JSON body parsing for API requests
  app.use(express.json());

  /**
   * Basic API route to verify server is running
   */
  app.get("/", (req, res) => {
    res.send("CodTech Chat API running");
  });

  /**
   * Connect to MongoDB database
   * After successful connection, register socket event handlers
   */
  const db = await connectDB();
  registerChatHandlers(io, db);

  // Define server port (from environment or default)
  const PORT = process.env.PORT || 5000;

  /**
   * Start listening for incoming requests and socket connections
   */
  server.listen(PORT, () =>
    console.log(`Server running on port ${PORT}`)
  );
}

// Start the server and handle startup errors
startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
