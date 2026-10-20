import { useState } from "react";

export default function ClassroomFilePanel({
  isOpen = false,
  onClose,
  trustScore = 80,
  downloadAllowed = true,
  onOpenStepUp,
  onTriggerDownload
}) {
  const [downloadingId, setDownloadingId] = useState(null);

  if (!isOpen) return null;

  const sampleFiles = [
    {
      id: "file_001",
      name: "Lecture-04-Zero-Trust-Architecture.pdf",
      size: "2.8 MB",
      uploader: "Instructor",
      type: "pdf"
    },
    {
      id: "file_002",
      name: "Continuous-Trust-Algorithm-Notes.docx",
      size: "1.4 MB",
      uploader: "Instructor",
      type: "doc"
    },
    {
      id: "file_003",
      name: "Assignment-3-Security-Code-Starter.zip",
      size: "5.2 MB",
      uploader: "Teaching Assistant",
      type: "zip"
    }
  ];

  const handleDownload = (file) => {
    if (!downloadAllowed) {
      if (onOpenStepUp) onOpenStepUp("download");
      return;
    }

    setDownloadingId(file.id);
    if (onTriggerDownload) {
      onTriggerDownload(file);
    }

    // Simulate instant secure client download
    setTimeout(() => {
      const blob = new Blob([`Virtual Classroom Secure File Download\nFile: ${file.name}\nContinuous Trust Verification: PASSED\nTimestamp: ${new Date().toISOString()}`], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadingId(null);
    }, 800);
  };

  return (
    <aside className="classroom-files-panel">
      <div className="files-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>📁</span>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "#f8fafc" }}>
            Classroom Resources
          </h3>
          <span className="files-threshold-tag">Req: 75 Trust</span>
        </div>
        <button type="button" onClick={onClose} className="chat-close-btn">&times;</button>
      </div>

      <div className="files-body">
        <p className="files-hint">
          Download capability is protected by Zero-Trust Risk Engine. Trust score must be &ge; 75 to export session materials.
        </p>

        <div className="files-list">
          {sampleFiles.map((f) => (
            <div key={f.id} className="file-item-card">
              <div className="file-icon-box">
                {f.type === "pdf" ? "📕" : f.type === "doc" ? "📘" : "🗂️"}
              </div>
              <div className="file-info-col">
                <span className="file-name">{f.name}</span>
                <span className="file-meta">{f.size} • Uploaded by {f.uploader}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(f)}
                disabled={downloadingId === f.id}
                className={`file-dl-btn ${downloadAllowed ? "allowed" : "locked"}`}
                title={downloadAllowed ? "Download File" : "Trust score below 75 - Click to Step-Up"}
              >
                {downloadingId === f.id
                  ? "Saving..."
                  : downloadAllowed
                  ? "⬇ Download"
                  : "🔒 Req 75"}
              </button>
            </div>
          ))}
        </div>

        {!downloadAllowed && (
          <div className="files-locked-banner">
            <span className="files-lock-icon">⚠️</span>
            <div>
              <strong>Downloads Restricted (Trust: {trustScore}/75)</strong>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                Boost your score by +20 with step-up verification.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenStepUp("download")}
              className="files-stepup-cta"
            >
              Step-Up (+20)
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
