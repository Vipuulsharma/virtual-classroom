import { useState, useRef, useEffect } from "react";
import {
  IconChat,
  IconDownload,
  IconFileText,
  IconX,
  IconSend,
  IconLock,
  IconZap,
  IconPlus
} from "./ModernIcons";

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
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [lightboxImg, setLightboxImg] = useState(null);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError("");
    // Max 8 MB size limit
    const MAX_SIZE = 8 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setFileError("File too large. Maximum allowed size is 8MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: reader.result
      });
    };
    reader.onerror = () => {
      setFileError("Failed to read file.");
    };
    reader.readAsDataURL(file);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setFileError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const hasText = Boolean(text.trim());
    const hasFile = Boolean(selectedFile);

    if (!hasText && !hasFile) return;
    if (!chatAllowed) return;

    onSendMessage(text.trim(), selectedFile);
    setText("");
    removeSelectedFile();
  };

  if (!isOpen) return null;

  return (
    <aside className="classroom-chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <IconChat size={18} className="text-indigo-400" />
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#f8fafc" }}>
            Classroom Chat
          </h3>
          <span className="chat-threshold-tag">Live</span>
        </div>
        <button type="button" onClick={onClose} className="chat-close-btn" title="Close Chat">
          <IconX size={16} />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="chat-messages-container">
        {messages.length === 0 ? (
          <div className="chat-empty-slate">
            <div style={{ marginBottom: "8px", opacity: 0.6 }}>
              <IconChat size={32} />
            </div>
            <p>No messages yet in this session.</p>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Share notes, questions, and media with the class!
            </span>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderName === userName || m.senderId === currentUserId;
            const isTeacher = m.senderRole === "teacher";
            const isImage = m.file && m.file.type && m.file.type.startsWith("image/");

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

                {/* File / Image Attachment */}
                {m.file && (
                  <div className="chat-bubble-attachment">
                    {isImage ? (
                      <div className="chat-img-wrapper">
                        <img
                          src={m.file.dataUrl}
                          alt={m.file.name || "Attachment"}
                          className="chat-attachment-img"
                          onClick={() => setLightboxImg(m.file.dataUrl)}
                          title="Click to view full image"
                        />
                        <div className="chat-attachment-meta-row">
                          <span className="chat-attachment-name" title={m.file.name}>{m.file.name}</span>
                          <a
                            href={m.file.dataUrl}
                            download={m.file.name || "image.png"}
                            className="chat-download-btn"
                            title="Download image"
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <IconDownload size={13} />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="chat-doc-card">
                        <span className="chat-doc-icon">
                          <IconFileText size={20} />
                        </span>
                        <div className="chat-doc-details">
                          <span className="chat-doc-name" title={m.file.name}>{m.file.name}</span>
                          <span className="chat-doc-size">{formatFileSize(m.file.size)}</span>
                        </div>
                        <a
                          href={m.file.dataUrl}
                          download={m.file.name || "file"}
                          className="chat-download-btn"
                          title="Download file"
                          style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <IconDownload size={13} />
                          <span>Save</span>
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Text Content */}
                {m.text && <div className="chat-message-text">{m.text}</div>}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selected File Preview Pill Bar */}
      {selectedFile && (
        <div className="chat-staged-attachment-bar">
          <div className="chat-staged-info">
            {selectedFile.type.startsWith("image/") ? (
              <img src={selectedFile.dataUrl} alt="Preview" className="chat-staged-thumb" />
            ) : (
              <span className="chat-staged-icon">
                <IconFileText size={16} />
              </span>
            )}
            <div className="chat-staged-text">
              <span className="chat-staged-name">{selectedFile.name}</span>
              <span className="chat-staged-size">{formatFileSize(selectedFile.size)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={removeSelectedFile}
            className="chat-staged-remove-btn"
            title="Remove attachment"
          >
            <IconX size={14} />
          </button>
        </div>
      )}

      {/* File Size Error Alert */}
      {fileError && (
        <div className="chat-file-error-bar">
          <span>{fileError}</span>
          <button type="button" onClick={() => setFileError("")}><IconX size={14} /></button>
        </div>
      )}

      {/* Input or Locked Overlay */}
      {chatAllowed ? (
        <form onSubmit={handleSubmit} className="chat-input-area">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: "none" }}
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.zip,.rar,.json"
          />

          {/* Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="chat-attach-btn"
            title="Attach image or file to share"
          >
            <IconPlus size={16} />
          </button>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={selectedFile ? "Add a message (optional)..." : "Type a message or share a file..."}
            maxLength={500}
            className="chat-input"
          />

          <button
            type="submit"
            disabled={!text.trim() && !selectedFile}
            className="chat-send-btn"
            title="Send Message"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <IconSend size={14} />
            <span>Send</span>
          </button>
        </form>
      ) : (
        <div className="chat-locked-box">
          <div className="chat-lock-icon">
            <IconLock size={22} className="text-rose-400" />
          </div>
          <div className="chat-lock-info">
            <strong>Chat Restricted (Trust &lt; 40)</strong>
            <span>Your current score is {trustScore}. Threshold 40 required.</span>
          </div>
          <button
            type="button"
            onClick={onOpenStepUp}
            className="chat-unlock-stepup-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <IconZap size={14} />
            <span>Step-Up (+20)</span>
          </button>
        </div>
      )}


      {/* Lightbox Modal for Full Image Viewing */}
      {lightboxImg && (
        <div className="chat-lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <div className="chat-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImg} alt="Enlarged preview" className="chat-lightbox-img" />
            <button
              type="button"
              onClick={() => setLightboxImg(null)}
              className="chat-lightbox-close"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
