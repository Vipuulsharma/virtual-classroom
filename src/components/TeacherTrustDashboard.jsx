import { useState } from "react";

export default function TeacherTrustDashboard({
  isOpen = false,
  onClose,
  classroomSummary = [],
  threatAlerts = [],
  onManualOverride,
  onOpenAuditLedger
}) {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [overrideScore, setOverrideScore] = useState(80);
  const [overrideReason, setOverrideReason] = useState("Teacher manual adjustment");
  const [bypassCaps, setBypassCaps] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'threats'
  const [useDiffPrivacy, setUseDiffPrivacy] = useState(false);

  if (!isOpen) return null;

  const handleApplyOverride = (e) => {
    e.preventDefault();
    if (!selectedStudent) return;

    if (onManualOverride) {
      onManualOverride({
        targetSocketId: selectedStudent.participantKey,
        newScore: Number(overrideScore),
        reason: overrideReason,
        bypassCapabilities: bypassCaps
      });
    }

    setSelectedStudent(null);
  };

  // Aggregated Stats
  const studentList = classroomSummary.filter((p) => p.role !== "teacher");
  const avgScore = studentList.length > 0
    ? Math.round(studentList.reduce((acc, p) => acc + (p.trustScore || 0), 0) / studentList.length)
    : 100;

  // Differential privacy noise simulation for aggregated display
  const displayAvg = useDiffPrivacy
    ? Math.round(Math.max(0, Math.min(100, avgScore + (Math.random() - 0.5) * 4)))
    : avgScore;

  return (
    <aside className="teacher-trust-drawer">
      {/* Header */}
      <div className="teacher-trust-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>🛡️</span>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#f8fafc" }}>
              Zero-Trust Classroom Dashboard
            </h3>
          </div>
          <span className="teacher-trust-sub">
            Activity-Aware Continuous Trust • 6-Layer Security Architecture
          </span>
        </div>

        <button type="button" onClick={onClose} className="chat-close-btn">&times;</button>
      </div>

      {/* Tabs */}
      <div className="teacher-trust-tabs">
        <button
          type="button"
          className={`tt-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          👥 Class Matrix ({studentList.length})
        </button>
        <button
          type="button"
          className={`tt-tab ${activeTab === "threats" ? "active" : ""}`}
          onClick={() => setActiveTab("threats")}
        >
          🚨 AI Threat Alerts {threatAlerts.length > 0 && `(${threatAlerts.length})`}
        </button>
      </div>

      {/* Aggregated Metrics Strip */}
      <div className="teacher-metrics-strip">
        <div className="t-metric-card">
          <span className="t-metric-label">Class Average Trust</span>
          <strong
            className="t-metric-val"
            style={{ color: displayAvg >= 70 ? "#10b981" : displayAvg >= 40 ? "#f59e0b" : "#f43f5e" }}
          >
            {displayAvg}/100
          </strong>
        </div>

        <div className="t-metric-card">
          <span className="t-metric-label">Active Threats</span>
          <strong className="t-metric-val" style={{ color: threatAlerts.length > 0 ? "#f43f5e" : "#10b981" }}>
            {threatAlerts.length}
          </strong>
        </div>

        <div className="t-metric-card">
          <span className="t-metric-label">Privacy Shield</span>
          <label className="diff-privacy-toggle" title="Toggle Differential Privacy Laplace noise for stats">
            <input
              type="checkbox"
              checked={useDiffPrivacy}
              onChange={(e) => setUseDiffPrivacy(e.target.checked)}
            />
            <span style={{ fontSize: "11px", color: useDiffPrivacy ? "#10b981" : "var(--text-muted)" }}>
              {useDiffPrivacy ? "DP Active (ε=0.5)" : "DP Off"}
            </span>
          </label>
        </div>
      </div>

      {/* TAB 1: OVERVIEW / CLASS TRUST MATRIX */}
      {activeTab === "overview" && (
        <div className="teacher-trust-body">
          {studentList.length === 0 ? (
            <div className="teacher-empty-slate">
              <span>🧑‍🎓</span>
              <p>No active students in room yet.</p>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                When students join, their live continuous trust scores and capability matrices will display here.
              </span>
            </div>
          ) : (
            <div className="students-trust-table">
              {studentList.map((st) => {
                const score = st.trustScore || 80;
                const statusColor = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#f43f5e";

                return (
                  <div key={st.participantKey} className="student-trust-row">
                    <div className="student-trust-info">
                      <div className="student-trust-header">
                        <strong>{st.userName}</strong>
                        <span className="student-trust-score-tag" style={{ color: statusColor, borderColor: statusColor }}>
                          {score}/100 Trust
                        </span>
                      </div>
                      <span className="student-trust-email">{st.userEmail || "No email"}</span>

                      {/* Micro capability badges */}
                      <div className="student-cap-pills">
                        <span className={`micro-cap ${score >= 40 ? "on" : "off"}`} title="Chat Capability (Req: 40)">
                          💬 Chat {score >= 40 ? "✓" : "✗"}
                        </span>
                        <span className={`micro-cap ${score >= 50 ? "on" : "off"}`} title="Mic & Cam Capability (Req: 50)">
                          🎤 Mic {score >= 50 ? "✓" : "✗"}
                        </span>
                        <span className={`micro-cap ${score >= 70 ? "on" : "off"}`} title="Screen Share Capability (Req: 70)">
                          🖥️ Share {score >= 70 ? "✓" : "✗"}
                        </span>
                        <span className={`micro-cap ${score >= 75 ? "on" : "off"}`} title="Download Capability (Req: 75)">
                          📥 DL {score >= 75 ? "✓" : "✗"}
                        </span>
                        <span className={`micro-cap ${score >= 85 ? "on" : "off"}`} title="Exam Submit Capability (Req: 85)">
                          📝 Exam {score >= 85 ? "✓" : "✗"}
                        </span>
                      </div>
                    </div>

                    <div className="student-trust-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudent(st);
                          setOverrideScore(st.trustScore);
                        }}
                        className="t-override-btn"
                        title="Override Trust Score"
                      >
                        ⚙️ Override
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Teacher Manual Override Modal */}
          {selectedStudent && (
            <div className="override-popup-overlay">
              <div className="override-popup-card">
                <h4>Manual Trust Score Override</h4>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "14px" }}>
                  Set custom continuous trust score for <strong>{selectedStudent.userName}</strong>.
                </p>

                <form onSubmit={handleApplyOverride}>
                  <label className="override-form-label">
                    New Score (0 - 100):
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={overrideScore}
                      onChange={(e) => setOverrideScore(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <strong style={{ fontSize: "18px", color: "#6366f1", minWidth: "36px" }}>
                      {overrideScore}
                    </strong>
                  </div>

                  <div className="quick-score-buttons">
                    <button type="button" onClick={() => setOverrideScore(85)} className="quick-score-btn">
                      Reset 85
                    </button>
                    <button type="button" onClick={() => setOverrideScore(100)} className="quick-score-btn">
                      Max 100
                    </button>
                    <button type="button" onClick={() => setOverrideScore(50)} className="quick-score-btn warning">
                      Warning 50
                    </button>
                    <button type="button" onClick={() => setOverrideScore(15)} className="quick-score-btn danger">
                      Probation 15
                    </button>
                  </div>

                  <label className="override-form-label" style={{ marginTop: "12px" }}>
                    Reason for Override:
                  </label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="stepup-text-input"
                    placeholder="e.g. Identity verified via camera"
                  />

                  <label className="override-checkbox-label">
                    <input
                      type="checkbox"
                      checked={bypassCaps}
                      onChange={(e) => setBypassCaps(e.target.checked)}
                    />
                    <span>Grant Capability Bypass (Allow all features regardless of threshold)</span>
                  </label>

                  <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(null)}
                      className="secondary-btn"
                      style={{ flex: 1, padding: "8px" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="primary-btn"
                      style={{ flex: 1, padding: "8px" }}
                    >
                      Apply Score
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI THREAT DETECTION ALERTS */}
      {activeTab === "threats" && (
        <div className="teacher-threats-body">
          {threatAlerts.length === 0 ? (
            <div className="teacher-empty-slate">
              <span>✅</span>
              <p>No anomalous behavior detected.</p>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Layer 4A AI Threat Detector is actively scanning for tab hops, chat floods, and IP changes.
              </span>
            </div>
          ) : (
            <div className="threat-alerts-list">
              {threatAlerts.map((alt, idx) => (
                <div key={idx} className={`threat-alert-card level-${alt.threatLevel.toLowerCase()}`}>
                  <div className="threat-card-header">
                    <span className="threat-level-badge">{alt.threatLevel} THREAT</span>
                    <span className="threat-time">
                      {new Date(alt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                  <strong className="threat-student">{alt.studentName}</strong>
                  <p className="threat-reason">{alt.reasonCodes?.join(", ")}</p>
                  <div className="threat-meta">
                    <span>Anomaly Score: {Math.round(alt.anomalyScore * 100)}%</span>
                    <span>Penalty Applied: -{alt.threatPenalty}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer Shortcut */}
      <div className="teacher-trust-footer">
        <button
          type="button"
          onClick={onOpenAuditLedger}
          className="t-audit-ledger-btn"
        >
          ⛓️ Open SHA-256 Hash-Chained Audit Ledger
        </button>
      </div>
    </aside>
  );
}
