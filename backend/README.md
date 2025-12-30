# MERN Chat App - Backend

A Node.js + Express server providing real-time chat functionality with MongoDB persistence and Socket.IO for WebSocket communication.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- npm or yarn
- MongoDB (local or cloud)

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file in the backend directory:

```env
MONGO_URI=mongodb://127.0.0.1:27017/codtech_chat_app
PORT=5000
NODE_ENV=development
```

### Start Server

```bash
npm start
```

Server will run on `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── src/
│   ├── server.js              # Main server entry point (110 lines)
│   ├── config/
│   │   └── db.js              # MongoDB connection (44 lines)
│   ├── models/
│   │   └── User.js            # User helpers (45 lines)
│   ├── routes/
│   │   └── users.js           # User API endpoints (72 lines)
│   └── socket/
│       └── index.js           # Socket.IO event handlers (519 lines)
├── package.json
├── .env
└── README.md
```

## ✨ Features

- **Real-time Messaging**: WebSocket communication via Socket.IO
- **Message Persistence**: MongoDB storage
- **Multiple Chat Rooms**: Create and switch between rooms
- **User Management**: Anonymous user creation and search
- **Typing Indicators**: Real-time typing notifications
- **Message History**: Load previous messages per room
- **Online Status**: Track user presence
- **Error Handling**: Comprehensive error management
- **CORS Support**: Cross-origin requests enabled

## 🔌 Socket.IO Events

### Server Events (Listen)

```javascript
// Join a room
socket.on("join_room", ({ room, username, avatar }) => {
  // Handle room join
});

// Send message
socket.on("send_message", ({ room, user, message }) => {
  // Save message and broadcast
});

// Typing indicator
socket.on("typing", ({ room, username, flag }) => {
  // Broadcast typing status
});

// Get message history
socket.on("get_messages", (room) => {
  // Return message history
});

// Leave room
socket.on("leave_room", () => {
  // Handle room leave
});
```

### Server Emits (Send)

```javascript
// Broadcast to room
io.to(room).emit("receive_message", messageData);

// User list update
io.to(room).emit("room_users", userList);

// Typing notification
io.to(room).emit("user_typing", { username, flag });

// Message history
socket.emit("chat_history", messages);
```

## 🔌 REST API Endpoints

### Users

#### Get User by ID
```
GET /api/users/:userId
```

**Response (200)**:
```json
{
  "_id": "ObjectId",
  "username": "string",
  "avatar": "string",
  "bio": "string",
  "status": "online|offline",
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

#### Search Users
```
GET /api/users/search?q=query
```

**Parameters**:
- `q` (string, required): Search query (min 2 chars)

**Response (200)**:
```json
[
  {
    "_id": "ObjectId",
    "username": "string",
    "avatar": "string"
  }
]
```

## ⚙️ Configuration

### Database Connection

**File**: `src/config/db.js`

Uses singleton pattern for database connection:
- Falls back to local MongoDB if `MONGO_URI` not set
- Caches connection instance
- Automatic reconnection on failure

```javascript
const { connectDB } = require("./config/db");
const db = await connectDB();
```

### CORS Configuration

**File**: `src/server.js`

```javascript
cors: {
  origin: ["http://localhost:5173", "http://localhost:3000"],
  methods: ["GET", "POST"],
  credentials: true,
  transports: ['websocket', 'polling']
}
```

### Socket.IO Configuration

- **Primary Transport**: WebSocket
- **Fallback**: Long-polling
- **CORS**: Enabled with credentials
- **Origins**: Localhost (development)

## 📊 Database Schema

### Messages Collection

```json
{
  "_id": "ObjectId",
  "room": "string",
  "user": "string",
  "message": "string",
  "socketId": "string",
  "createdAt": "Date",
  "reactions": [
    {
      "user": "string",
      "emoji": "string",
      "at": "Date"
    }
  ]
}
```

**Indexes**:
- `{ room: 1, createdAt: 1 }` - Query optimization

### Users Collection

```json
{
  "_id": "ObjectId",
  "username": "string",
  "avatar": "string",
  "bio": "string",
  "status": "online|offline",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

## 🔐 Security

✅ **Implemented**:
- CORS validation
- Input validation (username, messages)
- Error handling (no sensitive data leak)
- ObjectId validation
- Message length limits (500 chars max)
- No authentication (anonymous by design)

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.18 | Web framework |
| socket.io | ^4.5 | WebSocket server |
| mongodb | ^5.0 | Database driver |
| cors | ^2.8 | CORS middleware |
| dotenv | ^16.0 | Environment variables |

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start with nodemon (if installed) |
| `npm test` | Run tests (if configured) |

## 🚀 Deployment

### Environment Variables (Production)

```env
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/codtech_chat_app
PORT=5000
NODE_ENV=production
```

### Deploy Steps

1. Update `MONGO_URI` to production MongoDB
2. Update CORS origins for production domain
3. Set `NODE_ENV=production`
4. Run `npm install --production`
5. Start with `npm start`

### Docker Deployment

```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src/ ./src/
EXPOSE 5000
CMD ["npm", "start"]
```

## 📝 Code Organization

### server.js (110 lines)
- Express app initialization
- HTTP + Socket.IO server setup
- CORS configuration
- Database connection
- Route registration
- Error handling
- Server startup

### config/db.js (44 lines)
- MongoDB connection function
- Singleton pattern implementation
- Connection caching
- Error handling
- Fallback to local MongoDB

### models/User.js (45 lines)
- User creation helper
- User response sanitization
- Future auth support preparation

### routes/users.js (72 lines)
- GET /api/users/:userId - Get user
- GET /api/users/search?q=query - Search users
- Input validation
- Error handling

### socket/index.js (519 lines)
- Socket connection handler
- join_room event
- send_message event
- typing event
- get_messages event
- Helper functions
- Room user management
- Message broadcasting

## 🐛 Troubleshooting

### MongoDB Connection Fails

**Error**: `MongoDB connection timeout`

**Solutions**:
1. Check `MONGO_URI` in `.env`
2. Ensure MongoDB is running: `net start MongoDB` (Windows)
3. Or use Docker: `docker run -p 27017:27017 mongo`

### Socket.IO Won't Connect

**Error**: `Socket connection refused`

**Solutions**:
1. Verify backend is running on port 5000
2. Check CORS origins match frontend URL
3. Check firewall settings

### Messages Not Persisting

**Error**: Messages appear but disappear on refresh

**Solutions**:
1. Verify MongoDB is connected
2. Check database name matches
3. Check messages collection exists

## 📚 Documentation

For more information, see:
- [DOCUMENTATION.md](../DOCUMENTATION.md) - Complete technical reference
- [COMMENTS_REVIEW.md](../COMMENTS_REVIEW.md) - Code quality report
- [INDEX.md](../INDEX.md) - Documentation index

## 📊 Performance

### Optimization Tips

1. **Message Queries**: Use indexed room + createdAt fields
2. **User List**: In-memory cache per room (roomUsers object)
3. **Typing Indicator**: 3-second timeout to prevent spam
4. **Message Limit**: Max 500 characters per message
5. **Connection Pool**: MongoDB connection pooling enabled

### Expected Performance

- **Message Latency**: < 100ms (local)
- **Room Users Update**: < 50ms
- **Database Queries**: < 200ms (with indexes)

## 🔄 API Response Examples

### Join Room

**Request**:
```json
{
  "room": "global",
  "username": "John",
  "avatar": "👨‍💻"
}
```

**Response**:
```json
{
  "id": "socket-id",
  "username": "John",
  "isOnline": true,
  "isTyping": false
}
```

### Send Message

**Request**:
```json
{
  "room": "global",
  "user": "John",
  "message": "Hello everyone!"
}
```

**Response**:
```json
{
  "_id": "ObjectId",
  "room": "global",
  "user": "John",
  "message": "Hello everyone!",
  "createdAt": "2025-12-30T10:30:00Z",
  "reactions": []
}
```

## 📝 License

MIT

## 👥 Support

For issues or questions, refer to the documentation or contact the development team.

---

**Status**: ✅ Production Ready  
**Last Updated**: December 30, 2025
