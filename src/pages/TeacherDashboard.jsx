import { Link } from "react-router-dom";
import DashboardNavbar from "../components/DashboardNavbar";

function TeacherDashboard() {
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
            Manage your virtual classrooms, exams, and Continuous Trust live sessions
          </p>
        </div>

        <div className="dashboard-header-actions">
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
      <div className="security-banner-strip">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="security-icon-circle">
            🛡️
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "15px", color: "#f8fafc" }}>
              Continuous Trust 6-Layer Architecture Active
            </h4>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Adaptive WebAuthn Auth • Zero-Trust Risk Engine • AI Anti-Cheating Telemetry • Cryptographic Ledger
            </span>
          </div>
        </div>

        <div className="security-banner-tags">
          <span className="badge-tag-emerald">
            ✓ AI Anomaly Engine Live
          </span>
          <span className="badge-tag-indigo">
            ⚡ &lt; 15ms Decision Latency
          </span>
        </div>
      </div>

      {/* Stat Cards */}
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

      {/* EXAM & ASSESSMENT SECTION FOR TEACHERS */}
      <div className="dashboard-feature-card">
        <div className="feature-card-header">
          <div className="feature-card-icon">📝</div>
          <div>
            <h3>Proctored Exam & Quiz Studio</h3>
            <p>
              Build customized multi-choice exams with anti-cheating tracking.
              Students submit live in session, and results stream directly to your teacher ledger.
            </p>
          </div>
        </div>

        <div className="feature-card-bullets">
          <div className="feature-bullet">
            <span>✓</span> Add unlimited questions with options A, B, C, D & correct answers
          </div>
          <div className="feature-bullet">
            <span>✓</span> Set time limits (e.g. 5, 10, 15 mins) and Continuous Trust thresholds
          </div>
          <div className="feature-bullet">
            <span>✓</span> Real-time score verification, focus/tab-switch violation detection
          </div>
          <div className="feature-bullet">
            <span>✓</span> Export student marks sheet to CSV with detailed answer breakdowns
          </div>
        </div>

        <div className="feature-card-actions">
          <Link to="/create-classroom">
            <button className="primary-btn">
              Launch Classroom with Exam Mode &rarr;
            </button>
          </Link>
        </div>
      </div>

      {/* TEACHER-ONLY RESOURCE UPLOAD SHOWCASE */}
      <div className="dashboard-feature-card" style={{ marginTop: "20px" }}>
        <div className="feature-card-header">
          <div className="feature-card-icon">📁</div>
          <div>
            <h3>Teacher-Exclusive Learning Materials</h3>
            <p>
              Upload documents, lecture notes, lab starter code, and assignments from Desktop or Mobile phones.
              Students receive files instantly in the live classroom with Zero-Trust download protections.
            </p>
          </div>
        </div>

        <div className="feature-card-actions">
          <Link to="/create-classroom">
            <button className="secondary-btn">
              Start Session & Upload Materials &rarr;
            </button>
          </Link>
        </div>
      </div>

      <div className="empty-classrooms" style={{ marginTop: "24px" }}>
        <h2>Ready to Launch a Secure Class?</h2>
        <p>
          Create a virtual classroom code to start a live session with continuous trust monitoring,
          dynamic permissions, and proctored examination mode.
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
    </div>
  );
}

export default TeacherDashboard;