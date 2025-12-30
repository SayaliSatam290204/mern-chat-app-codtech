# MERN Chat App - Frontend

A real-time chat application built with React and Socket.IO. Features anonymous user chat with multiple rooms, typing indicators, and emoji support.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- npm or yarn
- Backend server running on `http://localhost:5000`

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Production Build

```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
src/
├── App.jsx              # Main chat component (818 lines)
├── App.css              # Component styling
├── main.jsx             # React entry point
├── index.css            # Global styles
└── assets/              # Images and icons
```

## ✨ Features

- **Real-time Messaging**: Instant message delivery via Socket.IO
- **Multiple Rooms**: Switch between different chat rooms
- **Typing Indicators**: See when others are typing
- **User Presence**: View who's online in each room
- **Emoji Picker**: Rich emoji selection for messages
- **Dark/Light Theme**: Toggle between themes (persistent)
- **User Profiles**: Customize username and avatar
- **Message History**: Load previous messages
- **Responsive Design**: Works on desktop and mobile

## 🔌 Socket.IO Events

### Emit (Client → Server)
- `join_room` - Join a chat room
- `send_message` - Send a message
- `typing` - Notify typing status
- `leave_room` - Leave current room
- `get_messages` - Fetch message history

### Listen (Server → Client)
- `receive_message` - New message received
- `room_users` - User list update
- `user_typing` - Someone is typing
- `chat_history` - Message history
- `disconnect` - Socket disconnected

## 🎨 Configuration

### Backend Connection

Update the Socket.IO connection URL in `App.jsx`:

```javascript
const socket = io("http://localhost:5000", {
  transports: ["websocket", "polling"],
});
```

### Theme

Dark mode is default. Toggle in the UI or set in localStorage:

```javascript
localStorage.setItem("ct_chat_theme", "light");
```

## 📦 Dependencies

- **react** (^18.0) - UI framework
- **socket.io-client** (^4.0) - Real-time communication
- **emoji-picker-react** (^4.0) - Emoji selection
- **bootstrap** (^5.0) - CSS framework
- **vite** (^5.0) - Build tool

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## 📝 Component Details

### App.jsx (818 lines)

Main component handling:
- Socket connection and event management
- User state (username, avatar, room)
- Message display and input
- Room management
- Theme switching
- Emoji picker integration
- Typing indicators
- User search

**Key State Variables**:
- `socket` - Socket.IO instance
- `username` - Current user's name
- `room` - Current chat room
- `messages` - Message array
- `users` - Users in current room
- `theme` - Dark/Light mode

## 🌐 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 🔒 Security Notes

- No authentication required (anonymous users)
- Messages are stored in MongoDB
- User data is validated server-side
- CORS is configured for localhost

## 🐛 Troubleshooting

### Socket not connecting?
1. Ensure backend is running on port 5000
2. Check CORS settings in backend
3. Open DevTools → Network → WS tab

### Messages not sending?
1. Check socket connection status
2. Verify room name is correct
3. Check backend console for errors

### Emoji picker not working?
1. Ensure emoji-picker-react is installed
2. Check browser console for errors
3. Try refreshing the page

## 📚 Documentation

For more information, see:
- [DOCUMENTATION.md](../DOCUMENTATION.md) - Technical reference
- [COMMENTS_REVIEW.md](../COMMENTS_REVIEW.md) - Code quality report
- [INDEX.md](../INDEX.md) - Documentation index

## 📝 License

MIT

## 👥 Support

For issues or questions, check the main project documentation or contact the development team.
