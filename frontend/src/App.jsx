import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import logo from "./assets/logo.png";
import hero from "./assets/hero.png";

const socket = io("http://localhost:5000", {
  transports: ["websocket"],
});

// emojis allowed for reactions
const REACTION_EMOJIS = ["👍", "❤️", "😂", "🔥"];

function App() {
  const [username, setUsername] = useState(() => {
    const saved = localStorage.getItem("ct_chat_username");
    if (saved) return saved;
    return "User-" + Math.floor(Math.random() * 1000);
  });

  const [room, setRoom] = useState("global");
  const [joined, setJoined] = useState(false);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  const [users, setUsers] = useState([]);

  const [roomInfo] = useState({
    description: "Global room for everyone to hang out and test the chat.",
    rules: [
      "Be respectful.",
      "No spam or advertising.",
      "Use English or Hindi so everyone can follow.",
    ],
    pinned: "Welcome to CodTech Chat! ",
  });

  useEffect(() => {
    if (!joined) return;

    socket.emit("join_room", { room, username });
    socket.emit("get_messages", room);
    socket.emit("get_room_users", room);

    socket.on("chat_history", (history) => {
      setMessages(history);
    });

    socket.on("receive_message", (msg) => {
      // update message with new reactions
      setMessages((prev) => {
        const idx = prev.findIndex(
          (m) => String(m._id) === String(msg._id)
        );
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = msg;
          return copy;
        }
        return [...prev, msg];
      });
    });

    socket.on("room_users", (list) => {
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
      // Clear messages if we're in the same room
      if (clearedRoom === room) {
        setMessages([]);
      }
    });

    return () => {
      socket.off("chat_history");
      socket.off("receive_message");
      socket.off("room_users");
      socket.off("user_typing");
      socket.off("chat_cleared");
    };
  }, [joined, room, username]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!username.trim() || !room.trim()) return;
    localStorage.setItem("ct_chat_username", username);
    setJoined(true);
  };

  const handleChangeMessage = (e) => {
    const value = e.target.value;
    setMessage(value);
    const typing = value.trim().length > 0;

    if (typing !== isTyping) {
      setIsTyping(typing);
      socket.emit("typing", { room, username, flag: typing });
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

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
    socket.emit("typing", { room, username, flag: false });
  };

  // ADD/REMOVE REACTION (toggle)
  const handleAddReaction = (messageId, emoji, reactions = []) => {
    // Check if current user already has this emoji reaction
    const userHasThisEmoji = reactions.some(
      (r) => r.user === username && r.emoji === emoji
    );

    if (userHasThisEmoji) {
      // Remove the reaction (toggle off)
      socket.emit(
        "remove_reaction",
        {
          messageId,
          room,
          user: username,
          emoji,
        },
        (ack) => {
          console.log("Reaction removed");
        }
      );
    } else {
      // Add the reaction (toggle on)
      socket.emit(
        "add_reaction",
        {
          messageId,
          room,
          user: username,
          emoji,
        },
        (ack) => {
          console.log("Reaction added");
        }
      );
    }
  };

  // build summary like { "👍": 2, "❤️": 1 }
  const getReactionSummary = (reactions = []) => {
    const counts = {};
    reactions.forEach((r) => {
      if (!r.emoji) return;
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    });
    return counts;
  };

  // JOIN SCREEN
  if (!joined) {
    return (
      <div className="min-vh-100 bg-dark">
        <div className="container-fluid h-100 px-0">
          <div className="row h-100 align-items-center g-0 mx-0">
            <div className="col-lg-5 col-md-6 px-4 px-md-5 py-4">
              <div className="card shadow-lg border-0 w-100">
                <div className="card-body p-4 bg-dark text-light rounded-4">
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
                      <label className="form-label small text-secondary">
                        Display name
                      </label>
                      <input
                        className="form-control form-control-sm bg-black text-light border-secondary"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>

                    <div className="mb-2">
                      <label className="form-label small text-secondary">
                        Room
                      </label>
                      <input
                        className="form-control form-control-sm bg-black text-light border-secondary"
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
  return (
    <div className="min-vh-100 bg-dark">
      <div className="container-fluid h-100 px-0">
        <div className="row h-100 g-0 mx-0 align-items-stretch">
          {/* LEFT */}
          <div className="col-md-3 px-3 py-4">
            <div className="card bg-black text-light h-100 border-0 rounded-4">
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
                    }}
                  >
                    {username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="fw-semibold">{username}</div>
                    <div className="small text-success">
                      <span className="badge bg-success me-1 rounded-pill">
                        ● 
                      </span>
                      Online
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
            <div className="card bg-black text-light h-100 border-0 rounded-4">
              <div className="card-header bg-transparent border-secondary d-flex justify-content-between align-items-center">
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

              <div
                className="card-body d-flex flex-column"
                style={{ height: "70vh" }}
              >
                <div
                  className="flex-grow-1 mb-3 p-2 rounded-3 border border-secondary"
                  style={{ overflowY: "auto", backgroundColor: "#020617" }}
                >
                  {messages.map((m) => {
                    const mine = m.user === username;
                    const reactionSummary = getReactionSummary(
                      m.reactions
                    );

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
                              backgroundColor: mine
                                ? "#4f46e5"
                                : "#111827",
                              color: "#e5e7eb",
                            }}
                          >
                            <div className="d-flex justify-content-between small mb-1">
                              <span className="fw-semibold">
                                {m.user}
                              </span>
                              <span className="opacity-75">
                                {new Date(
                                  m.createdAt
                                ).toLocaleTimeString()}
                              </span>
                            </div>
                            <div>{m.message}</div>

                            {/* Reactions summary */}
                            {Object.keys(reactionSummary).length > 0 && (
                              <div className="mt-1 d-flex flex-wrap gap-1 small">
                                {Object.entries(
                                  reactionSummary
                                ).map(([emoji, count]) => (
                                  <span
                                    key={emoji}
                                    className="badge rounded-pill bg-dark border border-secondary"
                                  >
                                    {emoji} {count}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Reaction buttons */}
                            <div className="mt-1 d-flex gap-1 small">
                              {REACTION_EMOJIS.map((emoji) => {
                                // Check if current user has this specific emoji
                                const userHasThisEmoji = m.reactions?.some(
                                  (r) => r.user === username && r.emoji === emoji
                                );

                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className={`btn btn-sm border-0 p-0 px-1 ${
                                      userHasThisEmoji
                                        ? "btn-primary"
                                        : "btn-dark"
                                    }`}
                                    style={{
                                      cursor: "pointer",
                                    }}
                                    onClick={() =>
                                      handleAddReaction(m._id, emoji, m.reactions)
                                    }
                                    title={
                                      userHasThisEmoji
                                        ? "Click to remove your reaction"
                                        : "Click to add your reaction"
                                    }
                                  >
                                    {emoji}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={handleSend} className="d-flex gap-2">
                  <input
                    className="form-control bg-black text-light border-secondary"
                    placeholder="Type a message and press Enter…"
                    value={message}
                    onChange={handleChangeMessage}
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
            <div className="card bg-black text-light h-100 border-0 rounded-4">
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
                        style={{ backgroundColor: "#020617" }}
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
                          }}
                        >
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-grow-1">
                          <div
                            className="small fw-semibold text-truncate"
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
                            <span className="text-secondary me-1">
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
