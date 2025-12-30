const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/codtech_chat_app";
console.log("🔍 MongoDB URI:", uri ? "✅ Loaded" : "❌ Missing");

const client = new MongoClient(uri);
let db;

async function connectDB() {
  if (db) return db;

  try {
    console.log("📡 Connecting to MongoDB...");
    await client.connect();
    db = client.db("codtech_chat_app"); // Ensures correct DB even if not in URI
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
