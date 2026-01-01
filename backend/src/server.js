// Import required modules
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Load environment variables from .env file
require("dotenv").config();

// 🔍 Environment check
console.log("🔍 Environment check:");
console.log("- MONGO_URI:", process.env.MONGO_URI ? "✅ Set" : "❌ Missing");
console.log("- PORT:", process.env.PORT || "5001 (Default)");

// Import database connection function
const { connectDB } = require("./config/db");

// Import socket event handlers
const { registerChatHandlers } = require("./socket");

// Import users routes (for user search)
const { setupUsersRoutes } = require("./routes/users");

/**
 * Initializes and starts the Express + Socket.IO server
 */
async function startServer() {
  // Create Express application
  const app = express();

  // Create HTTP server using Express app
  const server = http.createServer(app);

  /**
   * ✅ FIXED Socket.IO: Complete CORS + transports + path config
   */
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173", "http://localhost:3000"], // Allow Vite & CRA
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Content-Type"],
    },
    transports: ['websocket', 'polling'],  // WebSocket first, polling fallback
    path: '/socket.io/',  // Match frontend default
    pingTimeout: 60000,   // 60s heartbeat
    pingInterval: 25000,  // 25s ping
  });

  // Enable Cross-Origin Resource Sharing for REST API
  app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true
  }));

  // Enable JSON body parsing for API requests
  app.use(express.json());

  /**
   * Basic API route to verify server is running
   */
  app.get("/", (req, res) => {
    res.send("CodTech Chat API running ✅");
  });

  /**
   * Socket.IO health check endpoint
   */
  app.get("/socket.io/health", (req, res) => {
    res.json({ 
      socketio: "healthy", 
      transports: io.engine.transports,
      clients: io.engine.clientsCount 
    });
  });

  /**
   * 🔧 Connect to MongoDB with timeout & better error handling
   */
  try {
    console.log("🚀 Starting server...");
    console.log("📡 Connecting to MongoDB...");
    
    const db = await Promise.race([
      connectDB(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Database connection timeout (10s)")), 10000)
      )
    ]);

    console.log("✅ MongoDB connected successfully");

    // Register socket handlers and routes AFTER database connection
    registerChatHandlers(io, db);
    setupUsersRoutes(app, db);

    // ✅ UPDATED: Default to 5001 to match your logs and frontend
    const PORT = process.env.PORT || 5001;

    /**
     * Start listening for incoming requests and socket connections
     */
    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📱 Frontend: http://localhost:5173`);
      console.log(`🔌 Socket.IO ready: ws://localhost:${PORT}/socket.io/`);
      console.log(`💡 Anonymous chat enabled - no authentication required`);
    });

  } catch (err) {
    console.error("💥 Server startup FAILED:", err.message);
    console.error("💡 FIX:");
    console.error("   1. Create .env with MONGO_URI=mongodb://localhost:27017/codtech_chat_app");
    console.error("   2. Start MongoDB: net start MongoDB (Windows)");
    console.error("   3. Or use Docker: docker run -p 27017:27017 mongo");
    process.exit(1);
  }
}

// Start the server and handle startup errors
startServer().catch((err) => {
  console.error("💥 Fatal startup error:", err);
  process.exit(1);
});
