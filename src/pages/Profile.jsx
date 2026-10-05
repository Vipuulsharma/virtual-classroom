import { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../utils/apiConfig";

const AVATAR_OPTIONS = [
  { id: "grad", icon: "🎓", label: "Graduate" },
  { id: "teacher_m", icon: "👨‍🏫", label: "Teacher Male" },
  { id: "teacher_f", icon: "👩‍🏫", label: "Teacher Female" },
  { id: "tech", icon: "🧑‍💻", label: "Coder" },
  { id: "scientist", icon: "🔬", label: "Scientist" },
  { id: "books", icon: "📚", label: "Scholar" },
  { id: "rocket", icon: "🚀", label: "Innovator" },
  { id: "bulb", icon: "💡", label: "Thinker" },
  { id: "brain", icon: "🧠", label: "Genius" },
  { id: "art", icon: "🎨", label: "Creative" }
];

function Profile() {
  const navigate = useNavigate();

  // Active Tab: 'details' | 'security' | 'overview'
  const [activeTab, setActiveTab] = useState("details");

  // User State
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Profile Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [institution, setInstitution] = useState("");
  const [subjectOrGrade, setSubjectOrGrade] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Quick Direct Reset State
  const [showQuickReset, setShowQuickReset] = useState(false);
  const [quickResetPassword, setQuickResetPassword] = useState("");
  const [quickResetConfirm, setQuickResetConfirm] = useState("");
  const [quickResetting, setQuickResetting] = useState(false);

  // Feedback Alerts
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const token = localStorage.getItem("token");

  // Fetch Current User on Mount
  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    const fetchUserProfile = async () => {
      try {
        setLoadingUser(true);
        const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const userData = response.data.user;
        setUser(userData);
        setName(userData.name || "");
        setEmail(userData.email || "");
        setPhone(userData.phone || "");
        setInstitution(userData.institution || "");
        setSubjectOrGrade(userData.subjectOrGrade || "");
        setBio(userData.bio || "");
        setAvatar(userData.avatar || "");

        // Keep localStorage updated
        localStorage.setItem("user", JSON.stringify(userData));
      } catch (err) {
        console.error("Failed to load user profile:", err);
        // Fallback to local storage if offline/error
        const cachedUser = localStorage.getItem("user");
        if (cachedUser) {
          try {
            const parsed = JSON.parse(cachedUser);
            setUser(parsed);
            setName(parsed.name || "");
            setEmail(parsed.email || "");
            setPhone(parsed.phone || "");
            setInstitution(parsed.institution || "");
            setSubjectOrGrade(parsed.subjectOrGrade || "");
            setBio(parsed.bio || "");
            setAvatar(parsed.avatar || "");
          } catch (e) {
            console.error(e);
          }
        } else {
          setErrorMessage("Failed to load user session. Please log in again.");
        }
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserProfile();
  }, [token, navigate]);

  // Clear alerts after 5 seconds
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
        setErrorMessage("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  // Handle Profile Details Update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("Full name cannot be empty");
      return;
    }

    if (!email.trim()) {
      setErrorMessage("Email address cannot be empty");
      return;
    }

    setSavingProfile(true);

    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/auth/profile`,
        {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          institution: institution.trim(),
          subjectOrGrade: subjectOrGrade.trim(),
          bio: bio.trim(),
          avatar
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const updatedUser = response.data.user;
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
      }

      setSuccessMessage(response.data.message || "Profile details updated successfully!");
    } catch (err) {
      console.error("Profile update failed:", err);
      setErrorMessage(
        err.response?.data?.message || "Failed to update profile. Please try again."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    if (!currentPassword) {
      setErrorMessage("Please enter your current password");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirmation do not match");
      return;
    }

    setUpdatingPassword(true);

    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/auth/change-password`,
        {
          currentPassword,
          newPassword
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setSuccessMessage(response.data.message || "Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Change password error:", err);
      setErrorMessage(
        err.response?.data?.message || "Failed to change password. Please check your current password."
      );
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Handle Direct Reset (without current password)
  const handleDirectReset = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    if (quickResetPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters long");
      return;
    }

    if (quickResetPassword !== quickResetConfirm) {
      setErrorMessage("New passwords do not match");
      return;
    }

    setQuickResetting(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
        email: user.email,
        role: user.role,
        newPassword: quickResetPassword
      });

      setSuccessMessage(response.data.message || "Password reset successfully!");
      setQuickResetPassword("");
      setQuickResetConfirm("");
      setShowQuickReset(false);
    } catch (err) {
      console.error("Reset password error:", err);
      setErrorMessage(
        err.response?.data?.message || "Failed to reset password. Please try again."
      );
    } finally {
      setQuickResetting(false);
    }
  };

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // Helper for password strength calculation
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, text: "None", color: "var(--text-muted)" };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 20, text: "Weak", color: "#f43f5e" };
    if (score === 2) return { score: 45, text: "Fair", color: "#f59e0b" };
    if (score === 3 || score === 4) return { score: 75, text: "Good", color: "#06b6d4" };
    return { score: 100, text: "Strong", color: "#10b981" };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const getDashboardLink = () => {
    return user?.role === "teacher" ? "/teacher-dashboard" : "/student-dashboard";
  };

  if (loadingUser && !user) {
    return (
      <div className="profile-page" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div className="profile-loader">
          <div className="profile-spinner" />
          <p>Loading your profile details...</p>
        </div>
      </div>
    );
  }

  const userInitials = (user?.name || "User")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const isTeacher = user?.role === "teacher";

  return (
    <div className="profile-page">
      <div className="vc-grid-overlay" style={{ opacity: 0.6 }} />

      {/* Top Navbar */}
      <header className="profile-navbar">
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

        <div className="profile-nav-actions">
          <Link to={getDashboardLink()} className="profile-nav-btn secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Back to Dashboard</span>
          </Link>

          <button onClick={handleLogout} className="profile-nav-btn danger">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </header>

      <main className="profile-container">
        {/* Alerts */}
        {successMessage && (
          <div className="profile-alert profile-alert-success">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage("")} className="alert-close-btn">&times;</button>
          </div>
        )}

        {errorMessage && (
          <div className="profile-alert profile-alert-error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage("")} className="alert-close-btn">&times;</button>
          </div>
        )}

        {/* Hero Card with User Summary */}
        <section className="profile-hero-card">
          <div className="profile-hero-content">
            <div className="profile-avatar-wrapper">
              <div className={`profile-avatar ${isTeacher ? "avatar-teacher" : "avatar-student"}`}>
                {avatar ? (
                  <span className="profile-avatar-emoji">{avatar}</span>
                ) : (
                  <span className="profile-avatar-text">{userInitials}</span>
                )}
              </div>
              <span className={`profile-role-badge ${isTeacher ? "badge-teacher" : "badge-student"}`}>
                {isTeacher ? "Teacher" : "Student"}
              </span>
            </div>

            <div className="profile-hero-meta">
              <div className="profile-name-row">
                <h1>{user?.name || "User Name"}</h1>
                <span className="profile-verified-badge" title="Verified Account">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Verified
                </span>
              </div>

              <p className="profile-email-line">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>{user?.email}</span>
                {user?.institution && <span className="profile-meta-dot">•</span>}
                {user?.institution && <span className="profile-institution">{user.institution}</span>}
              </p>

              {user?.bio && (
                <p className="profile-bio-snippet">
                  "{user.bio}"
                </p>
              )}
            </div>
          </div>

          <div className="profile-hero-quickstats">
            <div className="profile-quickstat">
              <span className="stat-label">Role Privilege</span>
              <strong className="stat-value">{isTeacher ? "Classroom Host / Instructor" : "Learner / Participant"}</strong>
            </div>
            <div className="profile-quickstat">
              <span className="stat-label">Member Since</span>
              <strong className="stat-value">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                  : "Recently"}
              </strong>
            </div>
          </div>
        </section>

        {/* Tab Controls */}
        <div className="profile-tabs">
          <button
            onClick={() => setActiveTab("details")}
            className={`profile-tab-btn ${activeTab === "details" ? "active" : ""}`}
            id="tab-details-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Personal Details</span>
          </button>

          <button
            onClick={() => setActiveTab("security")}
            className={`profile-tab-btn ${activeTab === "security" ? "active" : ""}`}
            id="tab-security-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Email & Password Reset</span>
          </button>

          <button
            onClick={() => setActiveTab("overview")}
            className={`profile-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            id="tab-overview-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>Account Overview</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: PERSONAL DETAILS (EDIT PROFILE) */}
        {/* ============================================================== */}
        {activeTab === "details" && (
          <section className="profile-section-card">
            <div className="section-card-header">
              <div>
                <h2>Profile Information</h2>
                <p>Update your personal details and public profile info</p>
              </div>
            </div>

            {/* Avatar Picker */}
            <div className="profile-avatar-picker-section">
              <label className="field-label">Choose Avatar Emoji</label>
              <div className="avatar-options-grid">
                <button
                  type="button"
                  onClick={() => setAvatar("")}
                  className={`avatar-option-btn ${avatar === "" ? "selected" : ""}`}
                  title="Default Initials"
                >
                  <span className="avatar-default-label">{userInitials}</span>
                </button>
                {AVATAR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAvatar(opt.icon)}
                    className={`avatar-option-btn ${avatar === opt.icon ? "selected" : ""}`}
                    title={opt.label}
                  >
                    <span>{opt.icon}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="profile-form">
              <div className="form-grid-2">
                <div className="form-field">
                  <label className="field-label">Full Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    disabled={savingProfile}
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">
                    Email Address *
                    <span className="field-hint">Used for sign in & password recovery</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={savingProfile}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label className="field-label">
                    Role
                    <span className="field-hint">Designated on account registration</span>
                  </label>
                  <input
                    type="text"
                    value={isTeacher ? "Teacher (Classroom Creator & Host)" : "Student (Classroom Participant)"}
                    disabled
                    className="input-disabled"
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    disabled={savingProfile}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label className="field-label">
                    Institution / University / School
                  </label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g. Stanford University / Delhi Public School"
                    disabled={savingProfile}
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">
                    {isTeacher ? "Subject / Department" : "Grade / Semester / Course"}
                  </label>
                  <input
                    type="text"
                    value={subjectOrGrade}
                    onChange={(e) => setSubjectOrGrade(e.target.value)}
                    placeholder={isTeacher ? "e.g. Computer Science, AI, Physics" : "e.g. 4th Semester / 12th Grade"}
                    disabled={savingProfile}
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="field-label">Bio / About Me</label>
                <textarea
                  rows="3"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={
                    isTeacher
                      ? "Brief introduction about your teaching experience, research interests, or office hours..."
                      : "Brief note about your learning interests, subjects you enjoy, or goals..."
                  }
                  disabled={savingProfile}
                />
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="profile-save-btn"
                  id="save-profile-btn"
                >
                  {savingProfile ? (
                    <>
                      <div className="btn-spinner" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Save Profile Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ============================================================== */}
        {/* TAB 2: EMAIL & PASSWORD RESET */}
        {/* ============================================================== */}
        {activeTab === "security" && (
          <div className="profile-security-stack">
            {/* Email Checking & Verification Status */}
            <div className="profile-section-card">
              <div className="section-card-header">
                <div>
                  <h2>Email Verification & Status</h2>
                  <p>Check your registered email address and credentials</p>
                </div>
              </div>

              <div className="email-status-card">
                <div className="email-status-info">
                  <div className="email-status-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <div>
                    <strong>{user?.email}</strong>
                    <span className="email-status-tag">Primary Account Email</span>
                  </div>
                </div>

                <div className="email-status-action">
                  <span className="security-active-pill">
                    <span className="live-dot" />
                    Active & Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Change Password Form */}
            <div className="profile-section-card">
              <div className="section-card-header">
                <div>
                  <h2>Change Password</h2>
                  <p>Update your password to keep your classroom account secure</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="profile-form">
                <div className="form-field">
                  <label className="field-label">Current Password *</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      required
                      disabled={updatingPassword}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="field-label">New Password (min 6 characters) *</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        disabled={updatingPassword}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? "Hide" : "Show"}
                      </button>
                    </div>

                    {/* Password Strength Meter */}
                    {newPassword && (
                      <div className="password-strength-container">
                        <div className="strength-bar-bg">
                          <div
                            className="strength-bar-fill"
                            style={{
                              width: `${passwordStrength.score}%`,
                              backgroundColor: passwordStrength.color
                            }}
                          />
                        </div>
                        <span className="strength-text" style={{ color: passwordStrength.color }}>
                          Strength: {passwordStrength.text}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="form-field">
                    <label className="field-label">Confirm New Password *</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        disabled={updatingPassword}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setShowQuickReset(!showQuickReset)}
                    className="text-toggle-btn"
                  >
                    {showQuickReset ? "← Cancel Direct Reset" : "Forgot current password? Reset directly"}
                  </button>

                  <button
                    type="submit"
                    disabled={updatingPassword}
                    className="profile-save-btn"
                    id="update-password-btn"
                  >
                    {updatingPassword ? (
                      <>
                        <div className="btn-spinner" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                        </svg>
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Direct Password Reset Accordion / Section */}
            {showQuickReset && (
              <div className="profile-section-card reset-card-accent">
                <div className="section-card-header">
                  <div>
                    <h2>Direct Password Reset</h2>
                    <p>Reset your password immediately using your verified email ({user?.email})</p>
                  </div>
                </div>

                <form onSubmit={handleDirectReset} className="profile-form">
                  <div className="form-grid-2">
                    <div className="form-field">
                      <label className="field-label">New Password *</label>
                      <input
                        type="password"
                        value={quickResetPassword}
                        onChange={(e) => setQuickResetPassword(e.target.value)}
                        placeholder="Enter new password (min 6 chars)"
                        required
                        disabled={quickResetting}
                      />
                    </div>

                    <div className="form-field">
                      <label className="field-label">Confirm New Password *</label>
                      <input
                        type="password"
                        value={quickResetConfirm}
                        onChange={(e) => setQuickResetConfirm(e.target.value)}
                        placeholder="Re-enter new password"
                        required
                        disabled={quickResetting}
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      disabled={quickResetting}
                      className="profile-save-btn"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #ea580c)" }}
                    >
                      {quickResetting ? "Resetting Password..." : "Confirm & Reset Password"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: ACCOUNT OVERVIEW */}
        {/* ============================================================== */}
        {activeTab === "overview" && (
          <section className="profile-section-card">
            <div className="section-card-header">
              <div>
                <h2>Account Overview & Security Health</h2>
                <p>Summary of your Virtual Classroom account status</p>
              </div>
            </div>

            <div className="overview-grid">
              <div className="overview-card">
                <span className="overview-label">Account Type</span>
                <strong className="overview-val">{isTeacher ? "Teacher / Instructor" : "Student / Learner"}</strong>
                <span className="overview-sub">{isTeacher ? "Can create rooms & broadcast audio/video" : "Can join sessions & collaborate"}</span>
              </div>

              <div className="overview-card">
                <span className="overview-label">Unique User ID</span>
                <strong className="overview-val" style={{ fontSize: "14px", fontFamily: "monospace" }}>
                  {user?.id || user?._id || "VC-USER"}
                </strong>
                <span className="overview-sub">Database reference identifier</span>
              </div>

              <div className="overview-card">
                <span className="overview-label">Email Address</span>
                <strong className="overview-val" style={{ fontSize: "15px" }}>{user?.email}</strong>
                <span className="overview-sub" style={{ color: "var(--accent-emerald)" }}>✓ Verified & Active</span>
              </div>

              <div className="overview-card">
                <span className="overview-label">Security Encryption</span>
                <strong className="overview-val" style={{ color: "var(--accent-cyan)" }}>Bcrypt + JWT (256-bit)</strong>
                <span className="overview-sub">End-to-End Secure Token Session</span>
              </div>
            </div>

            <div className="overview-actions-bar">
              <h3>Quick Actions</h3>
              <div className="overview-buttons">
                {isTeacher ? (
                  <Link to="/create-classroom" className="overview-action-btn primary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Create a Classroom</span>
                  </Link>
                ) : (
                  <Link to="/join-classroom" className="overview-action-btn primary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Join Classroom by Code</span>
                  </Link>
                )}

                <Link to={getDashboardLink()} className="overview-action-btn secondary">
                  <span>Go to My Dashboard</span>
                </Link>

                <button onClick={handleLogout} className="overview-action-btn danger">
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default Profile;
