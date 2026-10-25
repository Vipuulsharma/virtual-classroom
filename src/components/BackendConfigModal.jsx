import { useState, useEffect } from "react";
import {
  getApiBaseUrl,
  setCustomBackendUrl,
  checkBackendHealth,
  DEFAULT_RENDER_BACKEND
} from "../utils/apiConfig";
import {
  IconServer,
  IconX,
  IconZap,
  IconRefresh,
  IconCheck
} from "./ModernIcons";

function BackendConfigModal({ isOpen, onClose, onServerUpdated }) {
  const [url, setUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUrl(getApiBaseUrl() || "");
      setTestResult(null);
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setSavedSuccess(false);

    const result = await checkBackendHealth(url.trim());
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = () => {
    const trimmed = url.trim();
    setCustomBackendUrl(trimmed);
    setSavedSuccess(true);
    if (onServerUpdated) {
      onServerUpdated(trimmed);
    }
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleReset = () => {
    setCustomBackendUrl("");
    setUrl(getApiBaseUrl() || "");
    setTestResult(null);
    setSavedSuccess(true);
    if (onServerUpdated) {
      onServerUpdated(getApiBaseUrl());
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(10, 15, 30, 0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px"
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#131b2e",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
          color: "#f8fafc",
          position: "relative"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ display: "inline-flex", color: "#6366f1" }}><IconServer size={22} /></span>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>Live Backend Server Settings</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Settings"
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "6px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "16px", lineHeight: "1.5" }}>
          For real-time classroom joining, waiting room admission, and live video streaming across different devices,
          the app communicates with the Node.js Socket.IO server. You can configure or test your live backend URL below.
        </p>

        <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#cbd5e1", marginBottom: "6px" }}>
          Backend Server API & Socket URL:
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setTestResult(null);
            setSavedSuccess(false);
          }}
          placeholder="e.g. https://virtual-classroom-backend.onrender.com"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid rgba(99, 102, 241, 0.4)",
            borderRadius: "8px",
            color: "#f8fafc",
            fontSize: "14px",
            marginBottom: "10px",
            outline: "none"
          }}
        />

        {/* Quick Presets */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", color: "#64748b", alignSelf: "center" }}>Quick fill:</span>
          <button
            type="button"
            onClick={() => {
              setUrl(DEFAULT_RENDER_BACKEND);
              setTestResult(null);
            }}
            style={{
              background: "rgba(99, 102, 241, 0.15)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              color: "#c7d2fe",
              fontSize: "11px",
              padding: "4px 8px",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Render Default
          </button>
          <button
            type="button"
            onClick={() => {
              setUrl("http://localhost:5000");
              setTestResult(null);
            }}
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#a7f3d0",
              fontSize: "11px",
              padding: "4px 8px",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Localhost (5000)
          </button>
        </div>

        {/* Health Test Result Banner */}
        {testing && (
          <div
            style={{
              background: "rgba(99, 102, 241, 0.15)",
              border: "1px solid rgba(99, 102, 241, 0.4)",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "12px",
              marginBottom: "16px",
              color: "#c7d2fe",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <span style={{ display: "inline-flex", animation: "spin 1s linear infinite" }}>
              <IconRefresh size={16} />
            </span>
            Testing connection to server (waking up if asleep)...
          </div>
        )}

        {testResult && !testing && (
          <div
            style={{
              background: testResult.online ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              border: `1px solid ${testResult.online ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "12px",
              marginBottom: "16px",
              color: testResult.online ? "#6ee7b7" : "#fca5a5"
            }}
          >
            {testResult.online ? (
              <div>
                <strong>✓ Server is Online & Reachable!</strong>
                <span style={{ display: "block", fontSize: "11px", marginTop: "2px", opacity: 0.9 }}>
                  Response time: {testResult.latency}ms • Real-time join requests will sync seamlessly.
                </span>
              </div>
            ) : (
              <div>
                <strong>✕ Server Unreachable: {testResult.error}</strong>
                <span style={{ display: "block", fontSize: "11px", marginTop: "4px", opacity: 0.9 }}>
                  {url.includes("localhost") || url.includes("127.0.0.1")
                    ? "Local backend server is not responding. Run 'npm run server' or 'npm run dev:all' in your terminal to start Node.js on port 5000."
                    : "If deploying on Render, verify your Web Service is deployed and active in the Render dashboard. Note: Render free tier takes 45-60s to wake up on initial request."}
                </span>
                {(!url.includes("localhost") && !url.includes("127.0.0.1")) && (
                  <button
                    type="button"
                    onClick={() => {
                      setUrl("http://localhost:5000");
                      setTestResult(null);
                    }}
                    style={{
                      marginTop: "8px",
                      background: "rgba(16, 185, 129, 0.2)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      color: "#6ee7b7",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      cursor: "pointer"
                    }}
                  >
                    Switch to Localhost (5000)
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {savedSuccess && (
          <div
            style={{
              background: "rgba(16, 185, 129, 0.2)",
              border: "1px solid #10b981",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "12px",
              color: "#34d399",
              marginBottom: "16px"
            }}
          >
            ✓ Server configuration saved successfully!
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !url.trim()}
            style={{
              background: "rgba(99, 102, 241, 0.2)",
              border: "1px solid rgba(99, 102, 241, 0.4)",
              color: "#c7d2fe",
              borderRadius: "8px",
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px"
            }}
          >
            <IconZap size={15} />
            <span>{testing ? "Testing..." : "Test Connection"}</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            style={{
              background: "transparent",
              border: "1px solid #475569",
              color: "#94a3b8",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <IconRefresh size={14} />
            <span>Reset Default</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              border: "none",
              color: "#ffffff",
              borderRadius: "8px",
              padding: "10px 18px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px"
            }}
          >
            <IconCheck size={15} />
            <span>Save & Connect</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default BackendConfigModal;
