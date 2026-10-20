import { useState } from "react";

export default function TrustStatusBadge({
  trustScore = 80,
  capabilities = {},
  latestReason = "",
  threatLevel = "NORMAL",
  anomalyScore = 0,
  onOpenStepUp,
  onOpenAuditLogs,
  isTeacher = false
}) {
  const [showMatrix, setShowMatrix] = useState(false);

  // Status color & label
  let statusColor = "var(--accent-emerald, #10b981)";
  let statusBg = "rgba(16, 185, 129, 0.15)";
  let statusBorder = "rgba(16, 185, 129, 0.35)";
  let statusLabel = "High Trust";

  if (trustScore < 20) {
    statusColor = "var(--accent-rose, #f43f5e)";
    statusBg = "rgba(244, 63, 94, 0.2)";
    statusBorder = "rgba(244, 63, 94, 0.5)";
    statusLabel = "Probation / Restricted";
  } else if (trustScore < 40) {
    statusColor = "var(--accent-rose, #f43f5e)";
    statusBg = "rgba(244, 63, 94, 0.15)";
    statusBorder = "rgba(244, 63, 94, 0.4)";
    statusLabel = "Low Trust";
  } else if (trustScore < 70) {
    statusColor = "var(--accent-amber, #f59e0b)";
    statusBg = "rgba(245, 158, 11, 0.15)";
    statusBorder = "rgba(245, 158, 11, 0.4)";
    statusLabel = "Moderate Trust";
  }

  const capList = [
    { key: "lecture", name: "Lecture View", threshold: 20, icon: "📖" },
    { key: "chat", name: "Classroom Chat", threshold: 40, icon: "💬" },
    { key: "mic_camera", name: "Mic & Camera", threshold: 50, icon: "🎤" },
    { key: "screen_share", name: "Screen Share", threshold: 70, icon: "🖥️" },
    { key: "download", name: "File Download", threshold: 75, icon: "📥" },
    { key: "exam_submit", name: "Exam Submit", threshold: 85, icon: "📝" }
  ];

  return (
    <div className="trust-status-container">
      <div className="trust-pill-wrapper">
        {/* Main Trust Pill */}
        <div
          className="trust-score-pill"
          onClick={() => setShowMatrix(!showMatrix)}
          title="Click to view Capability Permissions Matrix"
          style={{
            background: statusBg,
            borderColor: statusBorder
          }}
        >
          <div className="trust-score-badge" style={{ background: statusColor }}>
            {trustScore}
          </div>

          <div className="trust-score-info">
            <div className="trust-score-header">
              <span className="trust-score-label" style={{ color: statusColor }}>
                {statusLabel}
              </span>
              <span className="trust-matrix-toggle">
                {showMatrix ? "▲" : "▼"}
              </span>
            </div>
            <span className="trust-score-sub">
              {latestReason ? latestReason.slice(0, 32) : "Continuous Zero-Trust Active"}
            </span>
          </div>
        </div>

        {/* Step-Up Quick Trigger Button (Students Only) */}
        {!isTeacher && (
          <button
            type="button"
            onClick={onOpenStepUp}
            className="trust-stepup-quick-btn"
            title="Perform Step-Up Biometric / Passkey Verification to gain +20 Trust"
          >
            ⚡ Step-Up (+20)
          </button>
        )}

        {/* Audit Logs Shortcut */}
        <button
          type="button"
          onClick={onOpenAuditLogs}
          className="trust-audit-shortcut-btn"
          title="Inspect SHA-256 Hash-Chained Audit Trail"
        >
          ⛓️ Ledger
        </button>
      </div>

      {/* Expanded Capability Matrix Dropdown */}
      {showMatrix && (
        <div className="trust-matrix-dropdown">
          <div className="trust-matrix-header">
            <h4>Continuous Capability Permissions</h4>
            <span className="trust-matrix-tag">Layer 5 Policy</span>
          </div>

          <p className="trust-matrix-desc">
            Permissions automatically adjust with your live behavioral trust score:
          </p>

          <div className="trust-matrix-grid">
            {capList.map((cap) => {
              const capData = capabilities[cap.key];
              const isAllowed = capData ? capData.allowed : trustScore >= cap.threshold;
              const isNear = !isAllowed && trustScore >= cap.threshold - 15;

              return (
                <div
                  key={cap.key}
                  className={`trust-matrix-card ${isAllowed ? "allowed" : isNear ? "warning" : "blocked"}`}
                >
                  <div className="trust-matrix-card-top">
                    <span className="cap-icon">{cap.icon}</span>
                    <span className="cap-title">{cap.name}</span>
                    <span className="cap-badge">
                      {isAllowed ? "✓ Active" : isNear ? "⚠️ Step-Up Req" : "🚫 Locked"}
                    </span>
                  </div>

                  <div className="cap-meter-track">
                    <div
                      className="cap-meter-fill"
                      style={{
                        width: `${Math.min(100, (trustScore / cap.threshold) * 100)}%`,
                        background: isAllowed ? "#10b981" : isNear ? "#f59e0b" : "#f43f5e"
                      }}
                    />
                  </div>

                  <div className="cap-threshold-text">
                    <span>Threshold: {cap.threshold}</span>
                    <span>Current: {trustScore}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {threatLevel !== "NORMAL" && (
            <div className="trust-threat-alert-box">
              <span>⚠️ AI Threat Anomaly: {threatLevel} ({Math.round(anomalyScore * 100)}% risk index)</span>
            </div>
          )}

          <div className="trust-matrix-footer">
            <span>Formula: T(t+1) = clamp(T(t) × λ + reward - penalty, 0, 100)</span>
            {!isTeacher && (
              <button onClick={onOpenStepUp} className="matrix-stepup-cta">
                Verify Identity Now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
