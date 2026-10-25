import { Link } from "react-router-dom";
import DashboardNavbar from "../components/DashboardNavbar";

function StudentDashboard() {
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
            Attend classes protected by Continuous Trust Zero-Trust Security & Proctored Exams
          </p>
        </div>

        <div className="dashboard-header-actions">
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
      <div className="security-banner-strip">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="security-icon-circle student">
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

        <div className="security-banner-tags">
          <span className="badge-tag-emerald">
            ✓ Privacy-Safe Logging
          </span>
          <span className="badge-tag-indigo">
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

      {/* STUDENT EXAM MODE & ASSESSMENT INFO */}
      <div className="dashboard-feature-card">
        <div className="feature-card-header">
          <div className="feature-card-icon">📝</div>
          <div>
            <h3>Secure Proctored Exam Mode</h3>
            <p>
              When your instructor launches an exam in class, you can take it directly from your device.
              Continuous trust anti-cheating tracking verifies focus integrity and delivers your score instantly to the teacher.
            </p>
          </div>
        </div>

        <div className="feature-card-bullets">
          <div className="feature-bullet">
            <span>✓</span> Responsive multiple-choice answering designed for phones and desktop
          </div>
          <div className="feature-bullet">
            <span>✓</span> Live countdown timer and question progress tracking
          </div>
          <div className="feature-bullet">
            <span>✓</span> Instant score verification and cryptographic audit confirmation
          </div>
          <div className="feature-bullet">
            <span>✓</span> Download classroom materials uploaded by the instructor (Trust &ge; 75)
          </div>
        </div>

        <div className="feature-card-actions">
          <Link to="/join-classroom">
            <button className="primary-btn">
              Join Classroom to Take Exam &rarr;
            </button>
          </Link>
        </div>
      </div>

      <div className="empty-classrooms" style={{ marginTop: "24px" }}>
        <h2>Enter a Live Class</h2>
        <p>
          Enter your teacher's 6-character classroom code to join. Continuous trust will adjust
          dynamically to grant mic, camera, screen share, resource download, and exam submit permissions.
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
    </div>
  );
}

export default StudentDashboard;