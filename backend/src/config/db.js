/**
 * MongoDB connection helper
 * - Uses `process.env.MONGO_URI` if provided, otherwise falls back to
 *   a local MongoDB URI for development.
 * - Exports `connectDB()` which returns a cached `db` instance after
 *   the first successful connection (singleton pattern).
 */
const { MongoClient } = require("mongodb");

// Connection URI: prefer environment variable for production/CI
const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/codtech_chat_app";
console.log("🔍 MongoDB URI:", uri ? "✅ Loaded" : "❌ Missing");

// Create a single MongoClient that will be reused across the app
const client = new MongoClient(uri);
let db;

/**
 * Connect to MongoDB and return a `db` instance.
 * - Uses an internal cache so repeated calls return the same DB object.
 * - On fatal connection errors the process exits with an explanatory message.
 */
async function connectDB() {
  if (db) return db; // return cached instance

  try {
    console.log("📡 Connecting to MongoDB...");
    await client.connect();

    // Ensure we are using the intended database name even if the URI
    // omits it. This keeps reads/writes consistent across environments.
    db = client.db("codtech_chat_app");
    console.log("✅ MongoDB connected to 'codtech_chat_app'");
    return db;
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    console.error("💡 1) Update .env: MONGO_URI=mongodb://127.0.0.1:27017/codtech_chat_app");
    console.error("💡 2) Start MongoDB: net start MongoDB");
    process.exit(1);
  }
}

module.exports = { connectDB };
