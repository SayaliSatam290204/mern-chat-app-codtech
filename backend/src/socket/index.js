const { ObjectId } = require("mongodb");

/**
 * Registers all Socket.IO chat-related event handlers
 * @param {Object} io - Socket.IO server instance
 * @param {Object} db - MongoDB database instance
 */
function registerChatHandlers(io, db) {
  const messagesCollection = db.collection("messages");

  // index for faster queries by room and time
  messagesCollection.createIndex({ room: 1, createdAt: 1 });

  // In-memory map of users per room: { [room]: { [socketId]: { username } } }
  const roomUsers = {};

  /**
   * Helper: send current user list for a room to all sockets in that room
   */
  function emitRoomUsers(room) {
    const usersObj = roomUsers[room] || {};
    const list = Object.entries(usersObj).map(([socketId, data]) => ({
      id: socketId,
      username: data.username || "Anonymous",
      isOnline: true,
      isTyping: !!data.isTyping,
    }));
    io.to(room).emit("room_users", list);
  }

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // store username and room on socket
    let currentRoom = "global";
    let currentUsername = "Anonymous";

    /**
     * Event: join_room
     * Payload: { room, username }
     */
    socket.on("join_room", ({ room, username }) => {
      const r = room || "global";
      const name = username && username.trim() ? username.trim() : "Anonymous";

      // leave previous room if needed
      if (currentRoom) {
        socket.leave(currentRoom);
        if (roomUsers[currentRoom]) {
          delete roomUsers[currentRoom][socket.id];
          emitRoomUsers(currentRoom);
        }
      }

      currentRoom = r;
      currentUsername = name;

      socket.join(currentRoom);

      // register in roomUsers - remove any duplicate usernames in the room first
      if (!roomUsers[currentRoom]) {
        roomUsers[currentRoom] = {};
      }
      
      // Remove any existing entries with the same username to prevent duplicates
      Object.keys(roomUsers[currentRoom]).forEach((id) => {
        if (id !== socket.id && roomUsers[currentRoom][id].username === name) {
          delete roomUsers[currentRoom][id];
        }
      });

      roomUsers[currentRoom][socket.id] = {
        username: currentUsername,
        isTyping: false,
      };

      emitRoomUsers(currentRoom);
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
     * NEW: Event add_reaction
     * Payload: { messageId, room, user, emoji }
     * Allows users to add multiple different emojis (toggle)
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

        const reactions = message.reactions || [];
        const userHasThisEmoji = reactions.some((r) => r.user === user && r.emoji === emoji);
        
        if (userHasThisEmoji) {
          console.log("User already has this emoji");
          if (typeof callback === "function") callback({ ok: false, error: "already_exists" });
          return;
        }

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
     * NEW: Event remove_reaction
     * Payload: { messageId, room, user, emoji }
     * Allows users to remove a specific emoji reaction
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
     * Event: disconnect
     */
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);

      if (currentRoom && roomUsers[currentRoom]) {
        delete roomUsers[currentRoom][socket.id];
        emitRoomUsers(currentRoom);
      }
    });
  });
}

module.exports = { registerChatHandlers };
