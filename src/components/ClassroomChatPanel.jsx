import { useState, useRef, useEffect } from "react";

export default function ClassroomChatPanel({
  isOpen = false,
  onClose,
  messages = [],
  onSendMessage,
  trustScore = 80,
  chatAllowed = true,
  onOpenStepUp,
  currentUserId = "",
  userName = "Student"
}) {
  const [text, setText] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (!chatAllowed) return;

    onSendMessage(text.trim());
    setText("");
  };

  if (!isOpen) return null;

  return (
    <aside className="classroom-chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>💬</span>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#f8fafc" }}>
            Classroom Chat
          </h3>
          <span className="chat-threshold-tag">Req: 40 Trust</span>
        </div>
        <button type="button" onClick={onClose} className="chat-close-btn">&times;</button>
      </div>

      {/* Messages Scroll Area */}
      <div className="chat-messages-container">
        {messages.length === 0 ? (
          <div className="chat-empty-slate">
            <span style={{ fontSize: "28px", opacity: 0.6 }}>💬</span>
            <p>No messages yet in this session.</p>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Messages are ephemeral and never logged to audit trails.
            </span>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderName === userName || m.senderId === currentUserId;
            const isTeacher = m.senderRole === "teacher";

            return (
              <div key={m.id} className={`chat-message-bubble ${isMe ? "outgoing" : "incoming"}`}>
                <div className="chat-message-meta">
                  <span className="chat-sender-name">
                    {m.senderName} {isTeacher && <span className="teacher-chat-tag">Teacher</span>}
                  </span>
                  <span className="chat-timestamp">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="chat-message-text">{m.text}</div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input or Locked Overlay */}
      {chatAllowed ? (
        <form onSubmit={handleSubmit} className="chat-input-area">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message to class..."
            maxLength={300}
            className="chat-input"
          />
          <button type="submit" disabled={!text.trim()} className="chat-send-btn">
            Send
          </button>
        </form>
      ) : (
        <div className="chat-locked-box">
          <div className="chat-lock-icon">🔒</div>
          <div className="chat-lock-info">
            <strong>Chat Restricted (Trust &lt; 40)</strong>
            <span>Your current score is {trustScore}. Threshold 40 required.</span>
          </div>
          <button
            type="button"
            onClick={onOpenStepUp}
            className="chat-unlock-stepup-btn"
          >
            ⚡ Step-Up (+20)
          </button>
        </div>
      )}
    </aside>
  );
}
