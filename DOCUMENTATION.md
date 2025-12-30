# MERN Chat App - Technical Documentation

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Backend Setup](#backend-setup)
6. [Frontend Setup](#frontend-setup)
7. [Key Features](#key-features)
8. [API Endpoints](#api-endpoints)
9. [Socket.IO Events](#socketio-events)
10. [Configuration](#configuration)
11. [Code Standards & Comments](#code-standards--comments)

---

## 📌 Project Overview

**MERN Chat App** is a real-time chat application built with MongoDB, Express, React, and Node.js. It features:
- Anonymous user chat (no authentication required)
- Real-time messaging with Socket.IO
- Multiple chat rooms
- User presence tracking
- Typing indicators
- Emoji picker support
- Dark/Light theme toggle
- User search functionality

---

## 🏗️ Architecture

### Backend Architecture
- **Server**: Express.js with Socket.IO
- **Database**: MongoDB (local or cloud via URI)
- **Pattern**: Singleton pattern for DB connections
- **Communication**: WebSocket (primary) with long-polling fallback

### Frontend Architecture
- **Framework**: React with Vite
- **State Management**: React Hooks (useState, useRef, useEffect)
- **Real-time**: Socket.IO client library
- **Styling**: Bootstrap + Custom CSS
- **UI Components**: Custom React components

---

## 🛠️ Tech Stack

### Backend
- Node.js
- Express.js
- Socket.IO
- MongoDB
- dotenv (environment configuration)
- CORS

### Frontend
- React 18
- Vite (build tool)
- Socket.IO Client
- Emoji Picker React
- Bootstrap 5
- CSS3

---

## 📁 Project Structure

```
mern-chat-app-codtech/
├── backend/
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── server.js           # Main server entry point
│       ├── config/
│       │   └── db.js           # MongoDB connection handler
│       ├── models/
│       │   └── User.js         # User helper utilities
│       ├── routes/
│       │   └── users.js        # User API endpoints
│       └── socket/
│           └── index.js        # Socket.IO event handlers
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── eslint.config.js
│   └── src/
│       ├── main.jsx            # React entry point
│       ├── App.jsx             # Main app component
│       ├── App.css             # App styles
│       ├── index.css           # Global styles
│       └── assets/
│           └── (images & icons)
│
└── README.md
```

---

## 🚀 Backend Setup

### Installation
```bash
cd backend
npm install
```

### Environment Variables (.env)
```
MONGO_URI=mongodb://127.0.0.1:27017/codtech_chat_app
PORT=5000
```

### Database Connection
**File**: `src/config/db.js`
- Uses singleton pattern for cached DB instance
- Automatically falls back to local MongoDB if `MONGO_URI` is not set
- Logs connection status with emojis for visual feedback

```javascript
const { connectDB } = require("./config/db");
const db = await connectDB();
```

### Running the Backend
```bash
npm start
# Server runs on http://localhost:5000
```

---

## 🎨 Frontend Setup

### Installation
```bash
cd frontend
npm install
```

### Running the Frontend
```bash
npm run dev
# Server runs on http://localhost:5173
```

### Build for Production
```bash
npm run build
```

---

## ✨ Key Features

### 1. **Real-time Messaging**
- Messages persist in MongoDB
- Instant delivery via Socket.IO
- Message history loading

### 2. **Anonymous Users**
- No authentication required
- Username stored in localStorage
- Avatar emoji customization

### 3. **Multiple Chat Rooms**
- Switch between different rooms
- Room-specific user lists
- Room-specific message history

### 4. **User Presence**
- Online status tracking
- User list per room
- Duplicate username filtering

### 5. **Typing Indicators**
- Real-time typing notification
- Automatically hides after 3 seconds

### 6. **Theme Support**
- Dark mode (default)
- Light mode
- Theme persists in localStorage

### 7. **Search Functionality**
- Search users by username
- Minimum 2 characters for search
- Real-time search results

---

## 🔌 API Endpoints

### Users API

#### Get User by ID
```
GET /api/users/:userId
```
**Response**:
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
GET /api/users/search?q=<query>
```
**Parameters**:
- `q` (string): Search query (minimum 2 characters)

**Response**:
```json
[
  {
    "_id": "ObjectId",
    "username": "string",
    "avatar": "string"
  }
]
```

---

## 🔄 Socket.IO Events

### Client → Server Events

#### `join_room`
**Description**: User joins a chat room
**Payload**:
```json
{
  "room": "string",
  "username": "string",
  "avatar": "string"
}
```

#### `send_message`
**Description**: Send a message to the room
**Payload**:
```json
{
  "text": "string",
  "room": "string"
}
```

#### `typing`
**Description**: User is typing
**Payload**:
```json
{
  "room": "string",
  "username": "string"
}
```

#### `stop_typing`
**Description**: User stopped typing
**Payload**:
```json
{
  "room": "string"
}
```

#### `leave_room`
**Description**: User leaves a room
**Payload**:
```json
{
  "room": "string"
}
```

### Server → Client Events

#### `room_users`
**Description**: Current list of users in the room
**Payload**:
```json
[
  {
    "id": "socketId",
    "username": "string",
    "isOnline": boolean,
    "isTyping": boolean
  }
]
```

#### `receive_message`
**Description**: New message received
**Payload**:
```json
{
  "_id": "ObjectId",
  "room": "string",
  "username": "string",
  "avatar": "string",
  "text": "string",
  "createdAt": "ISO 8601"
}
```

#### `user_typing`
**Description**: Someone is typing
**Payload**:
```json
{
  "username": "string"
}
```

#### `connect`
**Description**: Socket connection established

#### `disconnect`
**Description**: Socket disconnected

---

## ⚙️ Configuration

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

### MongoDB Indexes
- `messages`: Index on `room` and `createdAt` for faster queries
- `users`: Default indexes on `_id`

---

## 📝 Code Standards & Comments

### Backend Code Comments ✅

#### src/server.js
- ✅ Module imports documented
- ✅ Function purpose explained
- ✅ Configuration rationale noted
- ✅ Environment checks logged

#### src/config/db.js
- ✅ Connection helper well-documented
- ✅ Singleton pattern explained
- ✅ Fallback logic documented
- ✅ Connection status tracked

#### src/models/User.js
- ✅ All functions documented with JSDoc
- ✅ Parameter types specified
- ✅ Return values documented
- ✅ Future enhancement notes included

#### src/routes/users.js
- ✅ Route endpoints documented
- ✅ Error handling explained
- ✅ Query parameters documented
- ✅ Response format specified

#### src/socket/index.js
- ✅ Event handlers documented
- ✅ Helper functions explained
- ✅ Room state management documented
- ✅ Anonymous user flow explained

### Frontend Code Comments ✅

#### src/main.jsx
- ✅ Entry point purpose explained
- ✅ Minimal code principle noted

#### src/App.jsx
- ✅ Component structure documented
- ✅ State hooks explained
- ✅ Socket connections documented
- ✅ Event handlers commented
- ✅ Complex logic has inline comments

---

## 🔐 Security Considerations

1. **CORS**: Limited to localhost for development
2. **Anonymous Users**: No secrets in user documents
3. **Input Validation**: Username search minimum length (2 chars)
4. **Error Handling**: Generic error messages to prevent info leakage
5. **Socket Auth**: No authentication required (by design)

---

## 🐛 Debugging Tips

### Check MongoDB Connection
```javascript
const { connectDB } = require("./config/db");
const db = await connectDB();
console.log(db.name); // Should print your database name
```

### Check Socket Connection
Look for `✅ Loaded` messages in backend console

### Check Frontend Socket
Open browser DevTools → Network → WS (WebSocket connections)

---

## 📦 Dependencies Management

### Backend
- express: Web framework
- socket.io: Real-time communication
- mongodb: Database driver
- cors: Cross-origin requests
- dotenv: Environment variables

### Frontend
- react: UI framework
- vite: Build tool
- socket.io-client: WebSocket client
- emoji-picker-react: Emoji selection
- bootstrap: UI components

---

## 🚦 Running the Application

### Start Both Servers
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Access the App
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

---

## 📞 Support & Maintenance

For issues or feature requests:
1. Check the README.md
2. Review Socket.IO and Express documentation
3. Check MongoDB connection logs
4. Review browser console for frontend errors

---

**Last Updated**: December 30, 2025
**Status**: Production Ready
