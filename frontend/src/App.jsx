import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import logo from "./assets/logo.png";
import hero from "./assets/hero.png";

function App() {
  // 🔧 Socket state
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef();

  // User state - always exist (anonymous user)
  const [username, setUsername] = useState(() => {
    const saved = localStorage.getItem("ct_chat_username");
    if (saved) return saved;
    return "User-" + Math.floor(Math.random() * 1000);
  });

  const [avatar, setAvatar] = useState(() => {
    const saved = localStorage.getItem("ct_chat_avatar");
    return saved || "👨‍💻";
  });

  const [room, setRoom] = useState("global");
  const [joined, setJoined] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("ct_chat_theme") || "dark";
  });

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);

  const [roomInfo] = useState({
    description: "Global room for everyone to hang out and test the chat.",
    rules: [
      "Be respectful.",
      "No spam or advertising.",
      "Use English or Hindi so everyone can follow.",
    ],
    pinned: "Welcome to CodTech Chat! ",
  });

  // 🔧 Connect socket immediately (no auth check needed)
  useEffect(() => {
    if (!socket) {
      console.log("🔌 Creating socket connection");
      
      // ✅ FIXED: Connecting to port 5001 (matching your backend)
      const newSocket = io("http://localhost:5001", {
        transports: ["websocket", "polling"],
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        path: "/socket.io",
      });

      socketRef.current = newSocket;
      
      newSocket.on("connect", () => {
        console.log("✅ Socket CONNECTED:", newSocket.id);
        setSocketConnected(true);
      });
      
      newSocket.on("connect_error", (err) => {
        console.error("❌ Socket ERROR:", err);
        setSocketConnected(false);
      });
      
      newSocket.on("disconnect", (reason) => {
        console.log("🔌 Socket DISCONNECTED:", reason);
        setSocketConnected(false);
      });

      setSocket(newSocket);
    }

    return () => {
      // Cleanup on unmount only
    };
  }, [socket]);

  // ✅ NEW: Heartbeat to keep user active (every 25s)
  useEffect(() => {
    if (!socket || !joined) return;

    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit("user_activity");
        console.log("💓 Heartbeat sent");
      }
    }, 25000); // 25 seconds

    return () => clearInterval(heartbeatInterval);
  }, [socket, joined]);

  // 🔧 Socket event handlers - CALLED AFTER ALL OTHER HOOKS
  useEffect(() => {
    if (!joined || !socket) return;

    console.log("📡 Joining room:", room, "as", username);

    socket.emit("join_room", { room, username });
    socket.emit("get_messages", room);
    socket.emit("get_room_users", room);

    socket.on("chat_history", (history) => {
      setMessages(history);
    });

    socket.on("receive_message", (msg) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => String(m._id) === String(msg._id));
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = msg;
          return copy;
        }
        return [...prev, msg];
      });
    });

    socket.on("room_users", (list) => {
      console.log("👥 Room users updated:", list.length);
      setUsers(list);
    });

    socket.on("user_typing", ({ username: who, flag }) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.username === who ? { ...u, isTyping: flag } : u
        )
      );
    });

    socket.on("chat_cleared", ({ room: clearedRoom }) => {
      if (clearedRoom === room) {
        setMessages([]);
      }
    });

    socket.on("message_deleted", ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => String(m._id) !== String(messageId)));
    });

    socket.on("room_joined", ({ room: joinedRoom, users: userCount }) => {
      console.log("✅ Joined room:", joinedRoom, "with", userCount, "users");
    });

    return () => {
      socket.off("chat_history");
      socket.off("receive_message");
      socket.off("room_users");
      socket.off("user_typing");
      socket.off("chat_cleared");
      socket.off("message_deleted");
      socket.off("room_joined");
    };
  }, [joined, room, socket, username]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!username.trim() || !room.trim() || !socket) return;
    localStorage.setItem("ct_chat_username", username);
    localStorage.setItem("ct_chat_avatar", avatar);
    setJoined(true);
  };

  const handleChangeMessage = (e) => {
    const value = e.target.value;
    setMessage(value);
    const typing = value.trim().length > 0;

    if (typing !== isTyping && socket) {
      setIsTyping(typing);
      socket.emit("typing", { room, username, flag: typing });
    }
  };

  const handleMessageKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;

    socket.emit("send_message", {
      room,
      user: username,
      message,
    });

    setMessage("");
    setIsTyping(false);
    socket.emit("typing", { room, username, flag: false });
  };

  const handleLeave = () => {
    setJoined(false);
    setMessages([]);
    setMessage("");
    setUsers([]);
    setIsTyping(false);
    if (socket) {
      socket.emit("typing", { room, username, flag: false });
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("ct_chat_theme", newTheme);
  };

  const handleDeleteMessage = (messageId) => {
    if (window.confirm("Are you sure you want to delete this message?") && socket) {
      socket.emit("delete_message", {
        messageId,
        room,
        user: username,
      });
    }
  };

  const handleAddReaction = (messageId, emoji, reactions = []) => {
    if (!socket) return;
    
    const currentReaction = reactions.length > 0 ? reactions[0] : null;
    
    if (currentReaction && currentReaction.emoji === emoji) {
      socket.emit("remove_reaction", {
        messageId: String(messageId),
        room,
        user: username,
        emoji,
      });
    } else {
      socket.emit("add_reaction", {
        messageId: String(messageId),
        room,
        user: username,
        emoji,
      });
    }
  };

  const handleEmojiSelect = (emojiObject, messageId, reactions) => {
    const emoji = emojiObject.emoji;
    if (!emoji) return;
    
    handleAddReaction(messageId, emoji, reactions);
    setShowEmojiPicker(null);
  };

  const getSingleReaction = (reactions = []) => {
    return reactions.length > 0 ? reactions[0].emoji : null;
  };

  const formatTimestamp = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

    if (isToday) return `Today ${timeStr}`;
    if (isYesterday) return `Yesterday ${timeStr}`;
    return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const filteredMessages = messages.filter((m) => {
    const query = searchQuery.toLowerCase();
    return m.user.toLowerCase().includes(query) || m.message.toLowerCase().includes(query);
  });

  const getUserAvatar = (user) => {
    return user === username ? avatar : "👤";
  };

  // 🔧 RENDERING LOGIC - All hooks must be called BEFORE this point
  
  // Show loading screen while socket is connecting
  if (!socket) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif"
      }}>
        <div style={{
          textAlign: "center"
        }}>
          <h1 style={{ fontSize: "32px", marginBottom: "20px" }}>CodTech Chat</h1>
          <p style={{ fontSize: "18px", marginBottom: "30px" }}>Connecting...</p>
          <div style={{
            display: "inline-block",
            width: "50px",
            height: "50px",
            border: "4px solid rgba(255,255,255,0.3)",
            borderTop: "4px solid white",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}></div>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // JOIN SCREEN
  if (!joined) {
    const bgColor = theme === "dark" ? "bg-dark" : "bg-light";
    const textColor = theme === "dark" ? "text-light" : "text-dark";
    const cardBg = theme === "dark" ? "bg-dark" : "bg-white";
    const inputBg = theme === "dark" ? "bg-black text-light border-secondary" : "bg-light text-dark border-secondary";
    const labelColor = theme === "dark" ? "text-secondary" : "text-dark";

    return (
      <div className={`min-vh-100 ${bgColor}`}>
        <div className="container-fluid h-100 px-0">
          <div className="row h-100 align-items-center g-0 mx-0">
            <div className="col-lg-5 col-md-6 px-4 px-md-5 py-4">
              <div className="card shadow-lg border-0 w-100">
                <div className={`card-body p-4 ${cardBg} ${textColor} rounded-4`}>
                  <div className="d-flex align-items-center mb-3">
                    <img
                      src={logo}
                      alt="CodTech Chat"
                      style={{ width: 32, marginRight: 8 }}
                    />
                    <h2 className="fw-bold mb-0">CodTech Chat</h2>
                  </div>
                  <p className="text-secondary mb-4">
                    Join a room and start chatting in real time.
                  </p>

                  <form onSubmit={handleJoin}>
                    <div className="mb-3">
                      <label className={`form-label small ${labelColor}`}>
                        Display name
                      </label>
                      <input
                        className={`form-control form-control-sm ${inputBg}`}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>

                    <div className="mb-2">
                      <label className={`form-label small ${labelColor}`}>
                        Room
                      </label>
                      <input
                        className={`form-control form-control-sm ${inputBg}`}
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        placeholder="global / team / friends..."
                      />
                    </div>

                    <div className="mb-3">
                      <span className="small text-secondary me-2">
                        Quick rooms:
                      </span>
                      {["global", "study", "friends"].map((r) => (
                        <button
                          type="button"
                          key={r}
                          className={`btn btn-sm me-2 mb-1 ${
                            room === r
                              ? "btn-outline-light"
                              : "btn-outline-secondary"
                          }`}
                          onClick={() => setRoom(r)}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    <div className="mb-3">
                      <label className={`form-label small ${labelColor}`}>
                        Pick your avatar:
                      </label>
                      <div className="d-flex flex-wrap gap-2">
                        {["👨‍💻", "👩‍💻", "👨‍🎓", "👩‍🎓", "🧑‍🚀", "👨‍🎨", "🧑‍💼", "👩‍⚕️"].map((av) => (
                          <button
                            key={av}
                            type="button"
                            className={`btn btn-lg p-2 ${
                              avatar === av ? "btn-primary" : "btn-outline-secondary"
                            }`}
                            style={{ fontSize: "1.5rem" }}
                            onClick={() => setAvatar(av)}
                            title={`Select avatar ${av}`}
                          >
                            {av}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary w-100 mt-1"
                      style={{
                        background: "linear-gradient(90deg,#6366f1,#8b5cf6)",
                        border: "none",
                        borderRadius: "999px",
                      }}
                    >
                      Enter chat
                    </button>

                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="btn btn-sm btn-outline-secondary w-100 mt-2"
                    >
                      {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <div className="col-lg-7 col-md-6 d-none d-md-block px-0">
              <img
                src={hero}
                alt="Chat illustration"
                className="img-fluid w-100 h-100"
                style={{ objectFit: "cover", display: "block" }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CHAT SCREEN
  const bgColor = theme === "dark" ? "bg-dark" : "bg-light";
  const textColor = theme === "dark" ? "text-light" : "text-dark";
  const cardBg = theme === "dark" ? "bg-black" : "bg-white";
  const borderColor = theme === "dark" ? "border-secondary" : "border-light";
  const inputBg = theme === "dark" ? "bg-black text-light" : "bg-white text-dark";
  const messageBubbleBg = (mine) =>
    mine ? "#4f46e5" : theme === "dark" ? "#111827" : "#e5e7eb";
  const messageBubbleText = (mine) =>
    mine ? "#e5e7eb" : theme === "dark" ? "#e5e7eb" : "#111827";

  return (
    <div className={`min-vh-100 ${bgColor}`}>
      <div className="container-fluid h-100 px-0">
        <div className="row h-100 g-0 mx-0 align-items-stretch">
          {/* LEFT */}
          <div className="col-md-3 px-3 py-4">
            <div className={`card ${cardBg} ${textColor} h-100 border-0 rounded-4`}>
              <div className="card-body">
                <div className="d-flex align-items-center mb-4">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center me-3"
                    style={{
                      width: 40,
                      height: 40,
                      background:
                        "linear-gradient(135deg,#6366f1,#8b5cf6)",
                      fontWeight: 700,
                      fontSize: "1.5rem",
                    }}
                  >
                    {avatar}
                  </div>
                  <div>
                    <div className="fw-semibold">{username}</div>
                    <div className="small text-success">
                      <span className="badge bg-success me-1 rounded-pill">
                        ● 
                      </span>
                      {socketConnected ? "Online" : "Connecting..."}
                    </div>
                  </div>
                </div>

                <hr className="border-secondary" />

                <p className="text-uppercase text-secondary small mb-1">
                  Room
                </p>
                <span className="badge rounded-pill bg-secondary-subtle text-light mb-2">
                  {room}
                </span>

                <p className="small text-secondary mb-1">
                  Messages in this room:{" "}
                  <span className="badge bg-secondary">
                    {messages.length}
                  </span>
                </p>

              </div>
            </div>
          </div>

          {/* MIDDLE */}
          <div className="col-md-6 px-3 py-4">
            <div className={`card ${cardBg} ${textColor} h-100 border-0 rounded-4`}>
              <div className={`card-header bg-transparent ${borderColor} d-flex justify-content-between align-items-center`}>
                <div>
                  <h5 className="mb-0">Room: {room}</h5>
                  <span className="badge rounded-pill bg-success-subtle text-success mt-1">
                    Live
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleLeave}
                >
                  Leave room
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-2 border-bottom" style={{ borderColor: theme === "dark" ? "#333" : "#ddd" }}>
                <input
                  type="text"
                  className={`form-control form-control-sm ${inputBg}`}
                  placeholder="🔍 Search messages by user or text..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <small className="text-secondary d-block mt-1">
                    Found {filteredMessages.length} of {messages.length} messages
                  </small>
                )}
              </div>

              <div
                className="card-body d-flex flex-column"
                style={{ height: "70vh" }}
              >
                <div
                  className={`flex-grow-1 mb-3 p-2 rounded-3 border ${borderColor}`}
                  style={{ overflowY: "auto", backgroundColor: theme === "dark" ? "#020617" : "#f5f5f5" }}
                >
                  {filteredMessages.map((m) => {
                    const mine = m.user === username;
                    const singleReaction = getSingleReaction(m.reactions);

                    return (
                      <div
                        key={m._id || m.createdAt}
                        className={`mb-2 ${
                          mine ? "text-end" : "text-start"
                        }`}
                      >
                        <div
                          className={`d-flex ${
                            mine
                              ? "justify-content-end"
                              : "justify-content-start"
                          }`}
                        >
                          <div
                            className="p-2 rounded-3"
                            style={{
                              maxWidth: "75%",
                              backgroundColor: messageBubbleBg(mine),
                              color: messageBubbleText(mine),
                            }}
                          >
                            <div className="d-flex justify-content-between small mb-1 align-items-center">
                              <span className="fw-semibold">
                                {m.user}
                              </span>
                              <div className="d-flex gap-2 align-items-center">
                                <span className="opacity-75">
                                  {formatTimestamp(m.createdAt)}
                                </span>
                                {mine && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger p-0 px-1"
                                    onClick={() => handleDeleteMessage(m._id)}
                                    title="Delete message"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>
                            <div>{m.message}</div>

                            {/* Reaction display - single emoji only */}
                            {singleReaction && (
                              <div className="mt-1 small">
                                <span
                                  className="badge rounded-pill bg-dark border border-secondary"
                                >
                                  {singleReaction}
                                </span>
                              </div>
                            )}

                            {/* Emoji Picker Button */}
                            <div className="mt-1 position-relative">
                              <button
                                type="button"
                                className={`btn btn-sm border-0 p-0 px-1 ${
                                  theme === "dark" ? "btn-dark" : "btn-light border"
                                }`}
                                onClick={() =>
                                  setShowEmojiPicker(
                                    showEmojiPicker === m._id ? null : m._id
                                  )
                                }
                                title="Add reaction"
                              >
                                😊
                              </button>
                              {showEmojiPicker === m._id && (
                                <div
                                  style={{
                                    position: "fixed",
                                    zIndex: 10000,
                                    bottom: "100px",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                  }}
                                >
                                  <EmojiPicker
                                    onEmojiClick={(emojiObject) =>
                                      handleEmojiSelect(emojiObject, m._id, m.reactions)
                                    }
                                    theme={theme}
                                    skinTonesDisabled
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={handleSend} className="d-flex gap-2">
                  <input
                    className={`form-control ${inputBg} ${borderColor}`}
                    placeholder="Type a message and press Enter… (Ctrl+Enter to send)"
                    value={message}
                    onChange={handleChangeMessage}
                    onKeyDown={handleMessageKeyDown}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{
                      background: "linear-gradient(90deg,#6366f1,#8b5cf6)",
                      border: "none",
                    }}
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* RIGHT (always visible) */}
          <div className="col-md-3 px-3 py-4">
            <div className={`card ${cardBg} ${textColor} h-100 border-0 rounded-4`}>
              <div className="card-body d-flex flex-column">
                {/* Active users */}
                <div className="mb-4">
                  <h6 className="text-uppercase text-secondary small mb-2">
                    Active users ({users.length})
                  </h6>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {users.map((u) => (
                      <div
                        key={u.id}
                        className="d-flex align-items-center mb-2 p-2 rounded-3"
                        style={{ backgroundColor: theme === "dark" ? "#020617" : "#e8e8e8" }}
                      >
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center me-2"
                          style={{
                            width: 28,
                            height: 28,
                            background:
                              "linear-gradient(135deg,#6366f1,#8b5cf6)",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "white",
                          }}
                        >
                          {u.username === username ? avatar : "👤"}
                        </div>
                        <div className="flex-grow-1">
                          <div
                            className={`small fw-semibold text-truncate ${textColor}`}
                            title={u.username}
                          >
                            {u.username}
                            {u.username === username && " (you)"}
                          </div>
                          <div className="d-flex align-items-center small">
                            <span
                              className="badge rounded-pill me-1"
                              style={{
                                backgroundColor: u.isOnline
                                  ? "#16a34a"
                                  : "#4b5563",
                              }}
                            >
                              ●
                            </span>
                            <span className={`me-1 ${theme === "dark" ? "text-secondary" : "text-dark"}`}>
                              {u.isOnline ? "Online" : "Offline"}
                            </span>
                            {u.isTyping && (
                              <span className="text-info">typing…</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {users.length === 0 && (
                      <div className="small text-secondary">
                        No other users in this room yet.
                      </div>
                    )}
                  </div>
                </div>

                <hr className="border-secondary" />

                {/* Room info */}
                <div className="mb-3">
                  <h6 className="text-uppercase text-secondary small mb-2">
                    About this room
                  </h6>
                  <p className="small text-secondary mb-2">
                    {roomInfo.description}
                  </p>
                  <p className="small mb-2">
                    <span className="text-secondary">Pinned: </span>
                    {roomInfo.pinned}
                  </p>
                  <ul className="small text-secondary mb-0">
                    {roomInfo.rules.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                <hr className="border-secondary" />

                {/* Quick actions */}
                <div className="mt-auto">
                  <h6 className="text-uppercase text-secondary small mb-2">
                    Quick actions
                  </h6>
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        socket.emit("clear_messages", { room });
                        setMessages([]);
                      }}
                    >
                      Clear chat
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={handleLeave}
                    >
                      Change room
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() =>
                        navigator.clipboard.writeText(window.location.href)
                      }
                    >
                      Copy invite link
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={toggleTheme}
                    >
                      {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* END right column */}
        </div>
      </div>
    </div>
  );
}

export default App;
