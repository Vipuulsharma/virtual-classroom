import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import BackendConfigModal from "./BackendConfigModal";
import { checkBackendHealth } from "../utils/apiConfig";

function DashboardNavbar({ title = "Dashboard", role = "student" }) {
  const navigate = useNavigate();
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [isServerOnline, setIsServerOnline] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const rawUser = localStorage.getItem("user");
  let user = null;
  try {
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch (e) {
    user = null;
  }

  const isTeacher = (user?.role || role) === "teacher";
  const userInitials = (user?.name || (isTeacher ? "Teacher" : "Student"))
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  useEffect(() => {
    let mounted = true;
    checkBackendHealth().then((res) => {
      if (mounted) setIsServerOnline(res.online);
    });
    return () => { mounted = false; };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <>
      <nav className="dashboard-nav-bar">
        <div className="nav-brand-section">
          <Link to="/" className="vc-logo">
            <div className="vc-logo-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <div className="vc-logo-text">
              Virtual<span>Classroom</span>
            </div>
          </Link>
          <span className="nav-breadcrumb-divider">/</span>
          <span className="nav-breadcrumb-title">{title}</span>
        </div>

        {/* Mobile Toggle Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="nav-mobile-toggle"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>

        {/* Navigation Action Buttons */}
        <div className={`nav-user-actions ${mobileMenuOpen ? "mobile-expanded" : ""}`}>
          {/* Server Status Pill Button */}
          <button
            type="button"
            onClick={() => {
              setIsServerModalOpen(true);
              setMobileMenuOpen(false);
            }}
            title="Configure Live Backend Server"
            className="nav-server-pill"
            style={{
              background: isServerOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
              border: `1px solid ${isServerOnline ? "rgba(16, 185, 129, 0.4)" : "rgba(245, 158, 11, 0.4)"}`,
              color: isServerOnline ? "#6ee7b7" : "#fcd34d"
            }}
          >
            <span>{isServerOnline ? "🟢" : "🟡"}</span>
            <span>{isServerOnline ? "Server Live" : "Server Config"}</span>
          </button>

          {isTeacher ? (
            <Link
              to="/create-classroom"
              className="nav-create-btn"
              onClick={() => setMobileMenuOpen(false)}
            >
              + Create Class
            </Link>
          ) : (
            <Link
              to="/join-classroom"
              className="nav-join-btn"
              onClick={() => setMobileMenuOpen(false)}
            >
              + Join Class
            </Link>
          )}

          {/* Profile Link with Avatar */}
          <Link
            to="/profile"
            className="nav-profile-link"
            id="nav-profile-btn"
            title="View & Edit Profile"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className={`nav-avatar ${isTeacher ? "nav-avatar-teacher" : "nav-avatar-student"}`}>
              {user?.avatar ? user.avatar : userInitials}
            </div>
            <div className="nav-user-info">
              <span className="nav-user-name">{user?.name || "My Account"}</span>
              <span className={`nav-user-role ${isTeacher ? "role-badge-teacher" : "role-badge-student"}`}>
                {isTeacher ? "Teacher" : "Student"} • Profile
              </span>
            </div>
          </Link>

          {/* Logout Button */}
          <button onClick={handleLogout} className="nav-logout-btn" title="Sign Out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="logout-text-mobile">Logout</span>
          </button>
        </div>
      </nav>

      <BackendConfigModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        onServerUpdated={() => {
          checkBackendHealth().then((res) => setIsServerOnline(res.online));
        }}
      />
    </>
  );
}

export default DashboardNavbar;
