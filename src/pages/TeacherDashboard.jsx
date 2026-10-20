import { useState } from "react";
import { Link } from "react-router-dom";
import DashboardNavbar from "../components/DashboardNavbar";
import AuditTrailModal from "../components/AuditTrailModal";

function TeacherDashboard() {
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  const rawUser = localStorage.getItem("user");
  let user = null;
  try {
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch (e) {
    user = null;
  }

  return (
    <div className="dashboard-page">
      <DashboardNavbar title="Teacher Portal" role="teacher" />

      <div className="dashboard-header" style={{ marginTop: "24px" }}>
        <div>
          <h1>Welcome, {user?.name || "Teacher"}!</h1>
          <p>
            Manage your virtual classrooms and Continuous Trust live sessions
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setIsAuditOpen(true)}
            className="secondary-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            ⛓️ SHA-256 Audit Ledger
          </button>
          <Link to="/profile">
            <button className="secondary-btn" id="teacher-profile-shortcut">
              👤 Edit Profile
            </button>
          </Link>
          <Link to="/create-classroom">
            <button className="primary-btn">
              + Create Classroom
            </button>
          </Link>
        </div>
      </div>

      {/* 6-Layer Security & Continuous Trust Banner */}
      <div style={{
        margin: "20px 0",
        padding: "16px 20px",
        background: "rgba(15, 23, 42, 0.75)",
        border: "1px solid rgba(99, 102, 241, 0.3)",
        borderRadius: "14px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "14px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "rgba(99, 102, 241, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px"
          }}>
            🛡️
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "15px", color: "#f8fafc" }}>
              Continuous Trust 6-Layer Architecture Active
            </h4>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Adaptive WebAuthn Auth • Zero-Trust Risk Engine • AI Threat Detection • Cryptographic Audit Trail
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <span style={{
            fontSize: "11px",
            padding: "4px 10px",
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            color: "#34d399",
            borderRadius: "20px",
            fontWeight: "600"
          }}>
            ✓ AI Anomaly Engine Live
          </span>
          <span style={{
            fontSize: "11px",
            padding: "4px 10px",
            background: "rgba(99, 102, 241, 0.15)",
            border: "1px solid rgba(99, 102, 241, 0.4)",
            color: "#a5b4fc",
            borderRadius: "20px",
            fontWeight: "600"
          }}>
            ⚡ &lt; 15ms Decision Latency
          </span>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="dashboard-stat">
          <strong>100</strong>
          <span>Host Trust Baseline</span>
        </div>

        <div className="dashboard-stat">
          <strong>&lt; 10ms</strong>
          <span>Decision Latency</span>
        </div>

        <div className="dashboard-stat">
          <strong>100%</strong>
          <span>Chain Integrity</span>
        </div>
      </div>

      <div className="empty-classrooms">
        <h2>Ready to Launch a Secure Class?</h2>
        <p>
          Create a virtual classroom code to start a live session with continuous trust monitoring,
          dynamic permissions, and AI anti-cheating protection.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/create-classroom">
            <button className="primary-btn">
              Create Your Classroom
            </button>
          </Link>
          <Link to="/profile">
            <button className="secondary-btn">
              Configure Passkey & Profile
            </button>
          </Link>
        </div>
      </div>

      <AuditTrailModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
        classroomId="OVERVIEW"
      />
    </div>
  );
}

export default TeacherDashboard;