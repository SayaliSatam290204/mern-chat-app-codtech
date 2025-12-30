const express = require("express");
const { ObjectId } = require("mongodb");
const { userToResponse } = require("../models/User");

/**
 * Setup users routes (no authentication required)
 */
function setupUsersRoutes(app, db) {
  const router = express.Router();

  /**
   * Get user by ID
   * GET /api/users/:userId
   */
  router.get("/:userId", async (req, res) => {
    try {
      const usersCollection = db.collection("users");
      let userId;

      try {
        userId = new ObjectId(req.params.userId);
      } catch {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const user = await usersCollection.findOne({ _id: userId });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(userToResponse(user));
    } catch (err) {
      console.error("Get user error:", err);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  /**
   * Search users by username
   * GET /api/users/search?q=username
   */
  router.get("/search", async (req, res) => {
    try {
      const { q } = req.query;

      if (!q || q.length < 2) {
        return res.json([]);
      }

      const usersCollection = db.collection("users");
      const users = await usersCollection
        .find({
          username: { $regex: q, $options: "i" },
        })
        .limit(10)
        .toArray();

      res.json(users.map(userToResponse));
    } catch (err) {
      console.error("Search users error:", err);
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.use("/api/users", router);
}

module.exports = {
  setupUsersRoutes,
};
