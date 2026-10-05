import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../utils/apiConfig";

function ResetPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("student");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your registered email address");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
        email: email.trim(),
        role,
        newPassword
      });

      setMessage(response.data?.message || "Password has been successfully reset! Redirecting to login...");
      setTimeout(() => {
        navigate("/login");
      }, 2500);
    } catch (err) {
      console.error("Reset password error:", err);
      setError(
        err.response?.data?.message ||
        "Could not reset password. Please check your email and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          Virtual<span>Classroom</span>
        </div>

        <h1>Reset Password</h1>
        <p className="auth-subtitle">
          Enter your registered email to set a new password
        </p>

        {error && <div className="auth-alert-error">{error}</div>}
        {message && (
          <div className="profile-alert-success" style={{ marginBottom: "18px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleResetPassword}>
          <label>Account Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={loading}
          >
            <option value="student">Student Account</option>
            <option value="teacher">Teacher Account</option>
          </select>

          <label>Registered Email Address</label>
          <input
            type="email"
            placeholder="e.g. user@classroom.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />

          <label>New Password (min 6 chars)</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
              style={{ width: "100%", paddingRight: "45px" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: "12px",
                padding: "4px"
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <label>Confirm New Password</label>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
          />

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
            style={{ marginTop: "12px" }}
          >
            {loading ? "Resetting Password..." : "Set New Password"}
          </button>
        </form>

        <p className="switch-auth">
          Remember your password?{" "}
          <Link to="/login">
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ResetPassword;
