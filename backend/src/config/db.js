// Import MongoDB client from mongodb package
const { MongoClient } = require("mongodb");

// MongoDB connection URI loaded from environment variables
// Example: mongodb://localhost:27017
const uri = process.env.MONGO_URI;

// Create a new MongoDB client instance
const client = new MongoClient(uri);

// Variable to store database instance (singleton pattern)
let db;

/**
 * Connects to MongoDB database
 * Ensures a single connection is reused across the application
 * @returns {Object} MongoDB database instance
 */
async function connectDB() {

  // If database is already connected, return existing instance
  if (db) return db;

  try {
    // Establish connection with MongoDB server
    await client.connect();

    // Select database by name
    db = client.db("codtech_chat_app");

    console.log("MongoDB connected");

    // Return connected database instance
    return db;
  } catch (err) {
    // Log error if connection fails
    console.error("MongoDB connection error:", err);

    // Exit process if database connection fails
    process.exit(1);
  }
}

// Export the connectDB function for use in server startup
module.exports = { connectDB };
