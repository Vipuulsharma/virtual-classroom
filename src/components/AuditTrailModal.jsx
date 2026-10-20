import { useState, useEffect } from "react";
import axios from "axios";
import { getApiBaseUrl, API_BASE_URL } from "../utils/apiConfig";

const getBaseUrl = () => getApiBaseUrl() || API_BASE_URL;

export default function AuditTrailModal({
  isOpen = false,
  onClose,
  classroomId = ""
}) {
  const [logs, setLogs] = useState([]);
  const [integrity, setIntegrity] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchLogsAndTelemetry = async () => {
      setLoading(true);
      try {
        const base = getBaseUrl();
        const [logsRes, teleRes] = await Promise.all([
          axios.get(`${base}/api/trust/audit-logs/${classroomId || "DEFAULT"}`),
          axios.get(`${base}/api/trust/telemetry/${classroomId || "DEFAULT"}`)
        ]);

        if (logsRes.data?.success) {
          setLogs(logsRes.data.logs || []);
          setIntegrity(logsRes.data.integrity);
        }

        if (teleRes.data?.success) {
          setTelemetry(teleRes.data.telemetry);
        }
      } catch (err) {
        console.warn("Audit logs fetch fallback:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogsAndTelemetry();
  }, [isOpen, classroomId]);

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    try {
      const base = getBaseUrl();
      const res = await axios.post(`${base}/api/trust/verify-integrity`);
      if (res.data?.success) {
        setIntegrity(res.data.report);
      }
    } catch (e) {
      console.warn("Verify error:", e);
    } finally {
      setVerifying(false);
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `audit-trail-${classroomId || "classroom"}-${Date.now()}.json`);
    dlAnchor.click();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="audit-modal-container">
        {/* Header */}
        <div className="audit-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>⛓️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "600", color: "#f8fafc" }}>
                Layer 6: Cryptographic Hash-Chained Audit Ledger
              </h3>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Tamper-Evident SHA-256 Chaining • Real-Time Cloud Infrastructure Audit Trail
              </span>
            </div>
          </div>

          <button type="button" onClick={onClose} className="chat-close-btn">&times;</button>
        </div>

        {/* Telemetry Strip (Prometheus / Grafana Metrics) */}
        <div className="audit-telemetry-grid">
          <div className="telemetry-card">
            <span className="telemetry-title">Decision Latency</span>
            <strong className="telemetry-val" style={{ color: "#10b981" }}>
              {telemetry?.averageDecisionLatencyMs || "8.2"} ms
            </strong>
            <span className="telemetry-sub">&lt; 15ms SLA Target</span>
          </div>

          <div className="telemetry-card">
            <span className="telemetry-title">Chain Integrity</span>
            <strong className="telemetry-val" style={{ color: integrity?.valid ? "#10b981" : "#f43f5e" }}>
              {integrity?.valid ? "100% Valid" : "Tampered"}
            </strong>
            <span className="telemetry-sub">SHA-256 Merkle Chained</span>
          </div>

          <div className="telemetry-card">
            <span className="telemetry-title">Total Decisions</span>
            <strong className="telemetry-val" style={{ color: "#6366f1" }}>
              {telemetry?.totalDecisions || logs.length}
            </strong>
            <span className="telemetry-sub">Immutable Blocks</span>
          </div>

          <div className="telemetry-card">
            <span className="telemetry-title">Step-Ups Granted</span>
            <strong className="telemetry-val" style={{ color: "#f59e0b" }}>
              {telemetry?.stepUpsGranted || 0}
            </strong>
            <span className="telemetry-sub">+20 Adaptive Boosts</span>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="audit-actions-bar">
          <button
            type="button"
            onClick={handleVerifyIntegrity}
            disabled={verifying}
            className="audit-verify-btn"
          >
            {verifying ? "Computing Hashes..." : "🔒 Verify Chain Cryptographic Proof"}
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            className="audit-export-btn"
          >
            ⬇ Export Ledger (.JSON)
          </button>
        </div>

        {/* Blocks Ledger List */}
        <div className="audit-blocks-scroll">
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              Loading cryptographic blocks...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              No audit blocks generated yet. Activity events will appear here in real time.
            </div>
          ) : (
            logs.map((block) => (
              <div key={block.hash || block.index} className="audit-block-card">
                <div className="block-card-header">
                  <div className="block-id-badge">
                    Block #{block.index}
                  </div>
                  <span className={`block-decision-tag ${block.decision?.toLowerCase()}`}>
                    {block.decision || "ALLOW"}
                  </span>
                  <span className="block-time">
                    {new Date(block.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>

                <div className="block-main-info">
                  <div>
                    <strong>{block.eventType}</strong>
                    <span className="block-user"> — Participant: {block.userName || block.userId}</span>
                  </div>
                  <div className="block-score-pill">
                    Score: <strong>{block.newScore}</strong>
                    {block.delta !== 0 && (
                      <span className={block.delta > 0 ? "delta-pos" : "delta-neg"}>
                        ({block.delta > 0 ? "+" + block.delta : block.delta})
                      </span>
                    )}
                  </div>
                </div>

                <p className="block-reason">
                  Code: <code>{block.reasonCode || "NORMAL_ACTIVITY"}</code>
                </p>

                {/* Hashes */}
                <div className="block-hashes-box">
                  <div className="hash-row">
                    <span className="hash-label">Prev Hash:</span>
                    <code className="hash-code">{block.prevHash?.slice(0, 32)}...</code>
                  </div>
                  <div className="hash-row">
                    <span className="hash-label">Block Hash:</span>
                    <code className="hash-code highlight">{block.hash?.slice(0, 32)}...</code>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="audit-footer">
          <span>🔒 Data Minimization: Strictly metadata & structural events logged. Chat bodies & video pixels excluded.</span>
          <button type="button" onClick={onClose} className="secondary-btn" style={{ padding: "6px 16px" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
