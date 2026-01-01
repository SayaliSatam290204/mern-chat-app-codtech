const { ObjectId } = require("mongodb");

/**
 * Registers all Socket.IO chat-related event handlers
 * @param {Object} io - Socket.IO server instance
 * @param {Object} db - MongoDB database instance
 * Anonymous users join by username only - no authentication required
 */
function registerChatHandlers(io, db) {
  const messagesCollection = db.collection("messages");

  // index for faster queries by room and time
  messagesCollection.createIndex({ room: 1, createdAt: 1 });

  // ✅ FIXED: In-memory map of users per room with TTL cleanup
  const roomUsers = {};

  /**
   * ✅ NEW: Heartbeat cleanup - remove inactive users every 30s
   */
  setInterval(() => {
    const now = Date.now();
    Object.entries(roomUsers).forEach(([room, users]) => {
      Object.entries(users).forEach(([socketId, data]) => {
        if (now - (data.lastSeen || 0) > 60000) { // 60s inactive
          delete roomUsers[room][socketId];
        }
      });
      // Clean empty rooms
      if (Object.keys(users).length === 0) {
        delete roomUsers[room];
      }
    });
  }, 30000);

  /**
   * Helper: send current user list for a room to all sockets in that room
   * Removes duplicate usernames - shows each unique username only once
   */
  function emitRoomUsers(room) {
    const usersObj = roomUsers[room] || {};
    const list = Object.entries(usersObj).map(([socketId, data]) => ({
      id: socketId,
      username: data.username || "Anonymous",
      isOnline: true,
      isTyping: !!data.isTyping,
    }));
    
    // Remove duplicate usernames - keep only the first occurrence
    const seenUsernames = new Set();
    const uniqueUsers = list.filter((user) => {
      if (seenUsernames.has(user.username)) {
        return false; // Skip duplicate
      }
      seenUsernames.add(user.username);
      return true;
    });
    
    io.to(room).emit("room_users", uniqueUsers);
  }

  io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    // store username and room on socket
    let currentRoom = "global";
    let currentUsername = "Anonymous";

    /**
     * ✅ NEW: User activity heartbeat - keeps user active
     */
    socket.on("user_activity", () => {
      if (roomUsers[currentRoom] && roomUsers[currentRoom][socket.id]) {
        roomUsers[currentRoom][socket.id].lastSeen = Date.now();
        emitRoomUsers(currentRoom);
      }
    });

    /**
     * Event: join_room
     * Payload: { room, username }
     */
    socket.on("join_room", ({ room, username }) => {
      const r = room || "global";
      const name = username && username.trim() ? username.trim() : "Anonymous";

      console.log(`📡 ${name} joining room: ${r}`);

      // leave previous room if needed
      if (currentRoom && currentRoom !== r) {
        socket.leave(currentRoom);
        if (roomUsers[currentRoom]) {
          delete roomUsers[currentRoom][socket.id];
          emitRoomUsers(currentRoom);
        }
      }

      currentRoom = r;
      currentUsername = name;

      socket.join(currentRoom);

      // register in roomUsers - allow multiple users with same username
      if (!roomUsers[currentRoom]) {
        roomUsers[currentRoom] = {};
      }

      roomUsers[currentRoom][socket.id] = {
        username: currentUsername,
        isTyping: false,
        lastSeen: Date.now(),  // ✅ Track activity time
      };

      emitRoomUsers(currentRoom);
      socket.emit("room_joined", { 
        room: currentRoom, 
        users: Object.keys(roomUsers[currentRoom]).length 
      });
    });

    /**
     * Event: get_messages
     * Fetch previous messages for a room
     */
    socket.on("get_messages", async (room) => {
      const r = room || currentRoom || "global";
      try {
        const messages = await messagesCollection
          .find({ room: r })
          .sort({ createdAt: 1 })
          .toArray();

        socket.emit("chat_history", messages);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    });

    /**
     * Event: typing
     * Payload: { room, username, flag }
     */
    socket.on("typing", ({ room, username, flag }) => {
      const r = room || currentRoom || "global";
      const name = username || currentUsername;

      if (roomUsers[r] && roomUsers[r][socket.id]) {
        roomUsers[r][socket.id].isTyping = !!flag;
        roomUsers[r][socket.id].lastSeen = Date.now();  // ✅ Update activity
        emitRoomUsers(r);
      }

      socket.broadcast.to(r).emit("user_typing", {
        username: name,
        flag: !!flag,
      });
    });

    /**
     * Event: send_message
     * Payload: { room, user, message }
     */
    socket.on(
      "send_message",
      async ({ room = "global", user = "Anonymous", message }) => {
        if (!message || !message.trim()) return;
        if (message.length > 500) return;

        const doc = {
          room,
          user,
          message,
          socketId: socket.id,
          createdAt: new Date(),
          reactions: [],
        };

        try {
          const result = await messagesCollection.insertOne(doc);

          io.to(room).emit("receive_message", {
            _id: result.insertedId,
            ...doc,
          });
        } catch (err) {
          console.error("Error saving message:", err);
        }
      }
    );

    /**
     * Event: add_reaction
     * Payload: { messageId, room, user, emoji }
     */
    socket.on("add_reaction", async (data, callback) => {
      console.log("add_reaction event received with data:", data);
      
      try {
        const { messageId, room = "global", user = "Anonymous", emoji } = data || {};
        
        if (!messageId || !emoji) {
          console.log("Missing messageId or emoji", { messageId, emoji });
          if (typeof callback === "function") callback({ ok: false, error: "missing_fields" });
          return;
        }

        console.log("Processing add_reaction:", { messageId, room, user, emoji });

        let _id;
        try {
          _id = new ObjectId(messageId);
        } catch (err) {
          console.error("Invalid ObjectId:", messageId);
          if (typeof callback === "function") callback({ ok: false, error: "invalid_id" });
          return;
        }

        const message = await messagesCollection.findOne({ _id });
        if (!message) {
          console.log("Message not found:", messageId);
          if (typeof callback === "function") callback({ ok: false, error: "not_found" });
          return;
        }

        // Remove all existing reactions for this message first (only 1 emoji allowed per message)
        const result1 = await messagesCollection.updateOne(
          { _id },
          { $set: { reactions: [] } }
        );

        // Then add the new reaction
        const result = await messagesCollection.updateOne(
          { _id },
          { $push: { reactions: { user, emoji, at: new Date() } } }
        );

        console.log("DB updateOne result:", result.modifiedCount, "documents modified");

        const updated = await messagesCollection.findOne({ _id });
        if (!updated) {
          console.log("Could not fetch updated message");
          if (typeof callback === "function") callback({ ok: false, error: "fetch_failed" });
          return;
        }

        console.log("Broadcasting receive_message to room:", updated.room || room);
        io.to(updated.room || room).emit("receive_message", updated);

        if (typeof callback === "function") callback({ ok: true, count: updated.reactions.length });
      } catch (err) {
        console.error("Error in add_reaction:", err.message);
        if (typeof callback === "function") callback({ ok: false, error: err.message });
      }
    });

    /**
     * Event: remove_reaction
     * Payload: { messageId, room, user, emoji }
     */
    socket.on("remove_reaction", async (data, callback) => {
      console.log("remove_reaction event received with data:", data);
      
      try {
        const { messageId, room = "global", user = "Anonymous", emoji } = data || {};
        
        if (!messageId || !emoji) {
          console.log("Missing messageId or emoji", { messageId, emoji });
          if (typeof callback === "function") callback({ ok: false, error: "missing_fields" });
          return;
        }

        console.log("Processing remove_reaction:", { messageId, room, user, emoji });

        let _id;
        try {
          _id = new ObjectId(messageId);
        } catch (err) {
          console.error("Invalid ObjectId:", messageId);
          if (typeof callback === "function") callback({ ok: false, error: "invalid_id" });
          return;
        }

        const message = await messagesCollection.findOne({ _id });
        if (!message) {
          console.log("Message not found:", messageId);
          if (typeof callback === "function") callback({ ok: false, error: "not_found" });
          return;
        }

        const result = await messagesCollection.updateOne(
          { _id },
          { $pull: { reactions: { user, emoji } } }
        );

        console.log("DB updateOne result:", result.modifiedCount, "documents modified");

        const updated = await messagesCollection.findOne({ _id });
        if (!updated) {
          console.log("Could not fetch updated message");
          if (typeof callback === "function") callback({ ok: false, error: "fetch_failed" });
          return;
        }

        console.log("Broadcasting receive_message to room:", updated.room || room);
        io.to(updated.room || room).emit("receive_message", updated);

        if (typeof callback === "function") callback({ ok: true, count: updated.reactions.length });
      } catch (err) {
        console.error("Error in remove_reaction:", err.message);
        if (typeof callback === "function") callback({ ok: false, error: err.message });
      }
    });

    /**
     * Event: get_room_users
     */
    socket.on("get_room_users", (room) => {
      const r = room || currentRoom || "global";
      emitRoomUsers(r);
    });

    /**
     * Event: clear_messages
     * Payload: { room }
     * Permanently delete all messages in the room from database
     */
    socket.on("clear_messages", async ({ room = "global" }) => {
      try {
        const r = room || currentRoom || "global";
        console.log("Clearing all messages from room:", r);

        const result = await messagesCollection.deleteMany({ room: r });
        console.log("Deleted messages count:", result.deletedCount);

        // Broadcast empty chat history to all users in the room
        io.to(r).emit("chat_cleared", { room: r });
      } catch (err) {
        console.error("Error clearing messages:", err);
      }
    });

    /**
     * Event: delete_message
     * Payload: { messageId, room, user }
     * Delete a specific message (only if user is the sender)
     */
    socket.on("delete_message", async (data, callback) => {
      try {
        const { messageId, room = "global", user = "Anonymous" } = data || {};

        if (!messageId) {
          if (typeof callback === "function") callback({ ok: false, error: "missing_messageId" });
          return;
        }

        let _id;
        try {
          _id = new ObjectId(messageId);
        } catch (err) {
          if (typeof callback === "function") callback({ ok: false, error: "invalid_id" });
          return;
        }

        const message = await messagesCollection.findOne({ _id });
        if (!message) {
          if (typeof callback === "function") callback({ ok: false, error: "not_found" });
          return;
        }

        // Only allow user who sent the message to delete it
        if (message.user !== user) {
          if (typeof callback === "function") callback({ ok: false, error: "unauthorized" });
          return;
        }

        // Delete the message
        await messagesCollection.deleteOne({ _id });
        console.log("Message deleted:", messageId);

        // Broadcast deletion to all users in the room
        io.to(message.room || room).emit("message_deleted", { messageId: String(_id) });

        if (typeof callback === "function") callback({ ok: true });
      } catch (err) {
        console.error("Error deleting message:", err);
        if (typeof callback === "function") callback({ ok: false, error: err.message });
      }
    });

    /**
     * Event: edit_message
     * Payload: { messageId, room, user, newMessage }
     * Edit a specific message (only if user is the sender)
     */
    socket.on("edit_message", async (data, callback) => {
      try {
        const { messageId, room = "global", user = "Anonymous", newMessage } = data || {};

        if (!messageId || !newMessage || !newMessage.trim()) {
          if (typeof callback === "function") callback({ ok: false, error: "missing_fields" });
          return;
        }

        let _id;
        try {
          _id = new ObjectId(messageId);
        } catch (err) {
          if (typeof callback === "function") callback({ ok: false, error: "invalid_id" });
          return;
        }

        const message = await messagesCollection.findOne({ _id });
        if (!message) {
          if (typeof callback === "function") callback({ ok: false, error: "not_found" });
          return;
        }

        // Only allow user who sent the message to edit it
        if (message.user !== user) {
          if (typeof callback === "function") callback({ ok: false, error: "unauthorized" });
          return;
        }

        // Update the message
        await messagesCollection.updateOne(
          { _id },
          {
            $set: {
              message: newMessage.trim(),
              editedAt: new Date(),
            },
          }
        );

        const updated = await messagesCollection.findOne({ _id });
        console.log("Message edited:", messageId);

        // Broadcast updated message to all users in the room
        io.to(message.room || room).emit("receive_message", updated);

        if (typeof callback === "function") callback({ ok: true });
      } catch (err) {
        console.error("Error editing message:", err);
        if (typeof callback === "function") callback({ ok: false, error: err.message });
      }
    });

    /**
     * ✅ FIXED: Event: disconnect with proper cleanup
     */
    socket.on("disconnect", (reason) => {
      console.log("❌ User disconnected:", socket.id, reason);
      
      if (currentRoom && roomUsers[currentRoom]) {
        delete roomUsers[currentRoom][socket.id];
        emitRoomUsers(currentRoom);
      }
    });

    /**
     * Direct Message Events
     */

    /**
     * Event: get_dm_conversations
     * Get list of DM conversations for current user
     */
    socket.on("get_dm_conversations", async (data, callback) => {
      try {
        const usersCollection = db.collection("users");
        const dmsCollection = db.collection("direct_messages");

        // This is a simplified approach - in production you might want to track DMs differently
        // For now, return empty array as placeholder
        if (typeof callback === "function") {
          callback([]);
        }
      } catch (err) {
        console.error("Error getting DM conversations:", err);
        if (typeof callback === "function") callback({ error: err.message });
      }
    });

    /**
     * Event: start_dm
     * Start or get existing DM conversation
     */
    socket.on("start_dm", async (data, callback) => {
      try {
        const { recipientId } = data;
        const usersCollection = db.collection("users");
        const dmsCollection = db.collection("direct_messages");

        if (!recipientId) {
          if (typeof callback === "function")
            callback({ error: "recipientId required" });
          return;
        }

        // Create DM room ID from both users (sorted for consistency)
        const dmRoomId = [socket.id, recipientId].sort().join("-");

        // Join socket to DM room
        socket.join(dmRoomId);

        // Return DM room info
        const dmRoom = {
          _id: dmRoomId,
          type: "dm",
          otherUserId: recipientId,
        };

        if (typeof callback === "function") callback(dmRoom);
      } catch (err) {
        console.error("Error starting DM:", err);
        if (typeof callback === "function") callback({ error: err.message });
      }
    });

    /**
     * Event: send_dm
     * Send a direct message
     */
    socket.on("send_dm", async (data) => {
      try {
        const { dmRoomId, text, senderUsername, senderId } = data;

        if (!dmRoomId || !text || !text.trim()) return;

        const dmsCollection = db.collection("direct_messages");

        const dmDoc = {
          dmRoomId,
          senderId,
          senderUsername,
          text,
          createdAt: new Date(),
          read: false,
        };

        await dmsCollection.insertOne(dmDoc);

        // Broadcast to both users in DM room
        io.to(dmRoomId).emit("receive_dm", dmDoc);
      } catch (err) {
        console.error("Error sending DM:", err);
      }
    });
  });
}

module.exports = { registerChatHandlers };
