import {
  BrowserRouter,
  Routes,
  Route,
  Link
} from "react-router-dom";
import { useState } from "react";

import Login from "./pages/Login";
import Register from "./pages/Register";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import CreateClassroom from "./pages/CreateClassroom";
import JoinClassroom from "./pages/JoinClassroom";
import Classroom from "./pages/Classroom";
import Profile from "./pages/Profile";
import ResetPassword from "./pages/ResetPassword";
import './App.css';

function Home() {
  const [activeReaction, setActiveReaction] = useState(null);
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);

  const token = localStorage.getItem("token");
  const rawUser = localStorage.getItem("user");
  let user = null;
  try {
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch (e) {
    user = null;
  }
  const isTeacher = user?.role === "teacher";

  const triggerReaction = (emoji) => {
    setActiveReaction(emoji);
    setTimeout(() => setActiveReaction(null), 1800);
  };

  return (
    <div className="vc-page">
      <div className="vc-grid-overlay" />

      {/* Navigation Bar */}
      <nav className="vc-navbar">
        <Link to="/" className="vc-logo" id="brand-logo">
          <div className="vc-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <div className="vc-logo-text">
            Virtual<span>Classroom</span>
          </div>
        </Link>

        <div className="vc-nav-menu">
          <a href="#features" className="vc-nav-link">Features</a>
          <a href="#showcase" className="vc-nav-link">Interactive Stage</a>
          <a href="#roles" className="vc-nav-link">Roles</a>
          <Link to="/join-classroom" className="vc-nav-link">Join by Code</Link>
        </div>

        <div className="vc-nav-actions">
          {token ? (
            <>
              <Link to={isTeacher ? "/teacher-dashboard" : "/student-dashboard"} id="nav-dashboard-btn">
                <button className="vc-btn-login">
                  <span>Dashboard</span>
                </button>
              </Link>

              <Link to="/profile" id="nav-profile-btn">
                <button className="vc-btn-register">
                  <span>👤 Profile</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" id="nav-login-btn">
                <button className="vc-btn-login">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Login
                </button>
              </Link>

              <Link to="/register" id="nav-register-btn">
                <button className="vc-btn-register">
                  <span>Get Started</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="vc-hero">
        <div className="vc-pill-badge">
          <span className="vc-live-pulse" />
          <span>Next-Gen Collaborative Learning • Live v2.0</span>
        </div>

        <h1 className="vc-hero-title">
          Where Knowledge Meets <br />
          <span className="vc-gradient-text">Seamless Collaboration</span>
        </h1>

        <p className="vc-hero-desc">
          Experience ultra-low latency interactive lectures, real-time shared whiteboards, 
          and privacy-preserving virtual spaces designed for students and educators worldwide.
        </p>

        <div className="vc-hero-actions">
          <Link to="/register" id="hero-register-btn">
            <button className="vc-btn-hero-primary">
              <span>Register for Free</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </Link>

          <Link to="/login" id="hero-login-btn">
            <button className="vc-btn-hero-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Sign In to Classroom</span>
            </button>
          </Link>

          <Link to="/join-classroom" id="hero-join-btn">
            <button className="vc-btn-hero-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Quick Code</span>
            </button>
          </Link>
        </div>

        {/* Hero Stats */}
        <div className="vc-stats-strip">
          <div className="vc-stat-item">
            <span className="vc-stat-value">99.99%</span>
            <span className="vc-stat-label">Uptime SLA</span>
          </div>
          <div className="vc-stat-divider" />
          <div className="vc-stat-item">
            <span className="vc-stat-value">&lt; 45ms</span>
            <span className="vc-stat-label">Ultra-Low Latency</span>
          </div>
          <div className="vc-stat-divider" />
          <div className="vc-stat-item">
            <span className="vc-stat-value">256-bit</span>
            <span className="vc-stat-label">E2E Encryption</span>
          </div>
          <div className="vc-stat-divider" />
          <div className="vc-stat-item">
            <span className="vc-stat-value">50,000+</span>
            <span className="vc-stat-label">Active Rooms</span>
          </div>
        </div>
      </section>

      {/* Classroom Preview Showcase (Interactive Stage) */}
      <section id="showcase" className="vc-showcase-container">
        <div className="vc-window">
          {/* Top Bar */}
          <div className="vc-window-topbar">
            <div className="vc-window-dots">
              <div className="vc-dot vc-dot-red" />
              <div className="vc-dot vc-dot-yellow" />
              <div className="vc-dot vc-dot-green" />
            </div>

            <div className="vc-window-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>Physics 401: Quantum Mechanics & Optics • Room #824-A</span>
            </div>

            <div className="vc-window-status">
              <span className="vc-badge-rec">
                <span className="vc-rec-dot" /> REC
              </span>
              <span className="vc-badge-users">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                24 Present
              </span>
            </div>
          </div>

          {/* Stage Body */}
          <div className="vc-stage-content">
            {/* Whiteboard / Presentation Area */}
            <div className="vc-stage-main">
              <div className="vc-whiteboard-preview">
                <div className="vc-board-header">
                  <span className="vc-board-tag">LIVE INTERACTIVE CANVAS</span>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>Syncing 60fps</span>
                </div>

                <div className="vc-board-cursor">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#ec4899">
                    <polygon points="3 3 10 21 14 14 21 10 3 3" />
                  </svg>
                  <span className="vc-board-cursor-badge">Dr. Vance (Writing)</span>
                </div>

                <div className="vc-board-diagram">
                  <h4>Photonic Wave Equations & Phase Shift</h4>
                  <p>
                    Ψ(x,t) = Ae^(i(kx - ωt)) + Be^(-i(kx + ωt))
                  </p>
                  <div className="vc-diagram-graphic">
                    <div className="vc-diagram-node">Laser Source</div>
                    <span className="vc-diagram-arrow">→</span>
                    <div className="vc-diagram-node" style={{ borderColor: "#38bdf8", color: "#38bdf8" }}>Beam Splitter</div>
                    <span className="vc-diagram-arrow">→</span>
                    <div className="vc-diagram-node" style={{ borderColor: "#10b981", color: "#10b981" }}>Interferometer</div>
                  </div>
                </div>

                {activeReaction && (
                  <div style={{
                    position: "absolute",
                    bottom: "60px",
                    right: "40px",
                    fontSize: "36px",
                    animation: "vc-pulse 1s infinite"
                  }}>
                    {activeReaction}
                  </div>
                )}
              </div>

              {/* Speaker Overlay */}
              <div className="vc-stage-overlay-speaker">
                <div className="vc-speaker-avatar">DV</div>
                <span className="vc-speaker-name">Dr. David Vance (Host)</span>
                <div className="vc-sound-wave">
                  <div className="vc-wave-bar" />
                  <div className="vc-wave-bar" />
                  <div className="vc-wave-bar" />
                </div>
              </div>
            </div>

            {/* Sidebar Video Tiles */}
            <div className="vc-stage-sidebar">
              {/* Host Tile */}
              <div className="vc-video-tile active-speaker">
                <div className="vc-tile-avatar" style={{ background: "linear-gradient(135deg, #4f46e5, #06b6d4)" }}>
                  DV
                </div>
                <div className="vc-tile-info">
                  <span className="vc-tile-name">Dr. Vance</span>
                  <span className="vc-tile-badge vc-badge-host">Host</span>
                </div>
              </div>

              {/* Student Tile 1 */}
              <div className="vc-video-tile">
                <div className="vc-tile-avatar" style={{ background: "linear-gradient(135deg, #ec4899, #8b5cf6)" }}>
                  SC
                </div>
                <div className="vc-tile-info">
                  <span className="vc-tile-name">Sarah Chen</span>
                  <span className="vc-tile-badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10b981" }}>Mic On</span>
                </div>
              </div>

              {/* Student Tile 2 */}
              <div className="vc-video-tile">
                <div className="vc-tile-avatar" style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)" }}>
                  MR
                </div>
                <div className="vc-tile-info">
                  <span className="vc-tile-name">Marcus Reed</span>
                  <span className="vc-tile-badge vc-badge-hand">✋ Hand Raised</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Controls Dock */}
          <div className="vc-stage-controls">
            <button 
              className={`vc-ctrl-btn ${micActive ? 'active' : ''}`}
              onClick={() => setMicActive(!micActive)}
              title="Toggle Microphone"
              id="ctrl-mic-toggle"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>

            <button 
              className={`vc-ctrl-btn ${camActive ? 'active' : ''}`}
              onClick={() => setCamActive(!camActive)}
              title="Toggle Camera"
              id="ctrl-cam-toggle"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </button>

            <button 
              className="vc-ctrl-btn"
              onClick={() => triggerReaction("💡")}
              title="Send Lightbulb Idea"
              id="ctrl-reaction-idea"
            >
              💡
            </button>

            <button 
              className="vc-ctrl-btn"
              onClick={() => triggerReaction("👏")}
              title="Send Applause"
              id="ctrl-reaction-applause"
            >
              👏
            </button>

            <button 
              className="vc-ctrl-btn"
              onClick={() => triggerReaction("✋")}
              title="Raise Hand"
              id="ctrl-reaction-hand"
            >
              ✋
            </button>

            <Link to="/classroom/demo-824">
              <button className="vc-ctrl-btn vc-ctrl-leave" id="ctrl-leave-btn">
                <span>Enter Live Demo</span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section id="features" className="vc-features-section">
        <div className="vc-section-header">
          <span className="vc-section-tag">ENGINEERED FOR EXCELLENCE</span>
          <h2 className="vc-section-title">Everything Needed for Modern Virtual Education</h2>
          <p className="vc-section-desc">
            Built from the ground up for high-fidelity engagement, real-time collaboration, and bulletproof security.
          </p>
        </div>

        <div className="vc-features-grid">
          <div className="vc-feature-card">
            <div className="vc-feature-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h3>Ultra-Low Latency</h3>
            <p>
              Sub-50ms glass-to-glass latency with adaptive WebRTC streaming ensures natural conversational pacing during discussions.
            </p>
          </div>

          <div className="vc-feature-card">
            <div className="vc-feature-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            </div>
            <h3>Collaborative Whiteboard</h3>
            <p>
              Real-time vector canvas with instant syncing, mathematical shape recognition, and multi-user concurrent annotations.
            </p>
          </div>

          <div className="vc-feature-card">
            <div className="vc-feature-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3>Privacy-Preserving & Encrypted</h3>
            <p>
              Military-grade AES-256 end-to-end encryption guarantees that student identities, recordings, and conversations remain secure.
            </p>
          </div>
        </div>
      </section>

      {/* Role Quick Access Section */}
      <section id="roles" className="vc-roles-section">
        <div className="vc-roles-grid">
          {/* For Teachers */}
          <div className="vc-role-card">
            <div className="vc-role-header">
              <span className="vc-role-badge teacher">For Educators & Instructors</span>
              <h3>Lead Inspiring Classes</h3>
              <p>
                Create structured lecture rooms in seconds, track student participation, conduct live quizzes, and maintain full moderation control.
              </p>
            </div>
            <div className="vc-role-actions">
              <Link to="/register" className="vc-role-btn-primary" id="teacher-register-btn">
                <span>Register as Teacher</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <Link to="/login" className="vc-role-btn-ghost" id="teacher-login-btn">
                <span>Teacher Login</span>
              </Link>
            </div>
          </div>

          {/* For Students */}
          <div className="vc-role-card">
            <div className="vc-role-header">
              <span className="vc-role-badge student">For Students & Learners</span>
              <h3>Engage & Excel Together</h3>
              <p>
                Join with a simple class code or student account, ask real-time questions, interact on the shared whiteboard, and review saved sessions.
              </p>
            </div>
            <div className="vc-role-actions">
              <Link to="/register" className="vc-role-btn-primary" id="student-register-btn" style={{ background: "linear-gradient(135deg, #0284c7, #06b6d4)" }}>
                <span>Register as Student</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <Link to="/join-classroom" className="vc-role-btn-ghost" id="student-join-btn">
                <span>Enter Room Code</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="vc-footer">
        <div className="vc-footer-brand">
          <div className="vc-logo-icon" style={{ width: "28px", height: "28px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            </svg>
          </div>
          <span>&copy; {new Date().getFullYear()} Virtual Classroom. Built for privacy-first education.</span>
        </div>

        <div className="vc-footer-links">
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
          <Link to="/join-classroom">Join Classroom</Link>
          <a href="#features">Features</a>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route path="/create-classroom" element={<CreateClassroom />} />
        <Route path="/join-classroom" element={<JoinClassroom />} />
        <Route path="/classroom/:classroomId" element={<Classroom />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;