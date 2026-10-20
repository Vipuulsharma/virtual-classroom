import { useState } from "react";
import { Link } from "react-router-dom";
import DashboardNavbar from "../components/DashboardNavbar";
import AuditTrailModal from "../components/AuditTrailModal";

function StudentDashboard() {
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
      <DashboardNavbar title="Student Portal" role="student" />

      <div className="dashboard-header" style={{ marginTop: "24px" }}>
        <div>
          <h1>Welcome, {user?.name || "Student"}!</h1>
          <p>
            Attend classes protected by Continuous Trust Zero-Trust Security
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setIsAuditOpen(true)}
            className="secondary-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            ⛓️ View Audit Ledger
          </button>
          <Link to="/profile">
            <button className="secondary-btn" id="student-profile-shortcut">
              👤 My Profile & Passkey
            </button>
          </Link>
          <Link to="/join-classroom">
            <button className="primary-btn">
              + Join Classroom
            </button>
          </Link>
        </div>
      </div>

      {/* Zero-Trust Baseline Strip */}
      <div style={{
        margin: "20px 0",
        padding: "16px 20px",
        background: "rgba(15, 23, 42, 0.75)",
        border: "1px solid rgba(16, 185, 129, 0.3)",
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
            background: "rgba(16, 185, 129, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px"
          }}>
            🛡️
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "15px", color: "#f8fafc" }}>
              Continuous Trust Zero-Trust Active
            </h4>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Initial Trust T0 = 80 (Passkey) / 55 (OTP) • In-Class Step-Up (+20 Boost) • Data Minimization
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
            ✓ Privacy-Safe Logging
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
            ⚡ Dynamic Capability Permissions
          </span>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="dashboard-stat">
          <strong style={{ color: "#34d399" }}>80</strong>
          <span>Initial Trust Baseline (T0)</span>
        </div>

        <div className="dashboard-stat">
          <strong style={{ color: "#818cf8" }}>+20</strong>
          <span>Step-Up Boost Allowance</span>
        </div>

        <div className="dashboard-stat">
          <strong style={{ color: "#fcd34d" }}>100%</strong>
          <span>Privacy Protection</span>
        </div>
      </div>

      <div className="empty-classrooms">
        <h2>Enter a Live Class</h2>
        <p>
          Enter your teacher's 6-character classroom code to join. Continuous trust will adjust
          dynamically to grant mic, camera, screen share, and exam submit permissions.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/join-classroom">
            <button className="primary-btn">
              Join Classroom by Code
            </button>
          </Link>
          <Link to="/profile">
            <button className="secondary-btn">
              Customize Biometric Security
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

export default StudentDashboard;