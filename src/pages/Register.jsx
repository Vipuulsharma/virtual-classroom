import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import BiometricSecurityModal from "../components/BiometricSecurityModal";
import { API_BASE_URL } from "../utils/apiConfig";

function Register() {
  const navigate = useNavigate();

  // Step 1: Input details | Step 2: Verify Email & Mobile OTP
  const [step, setStep] = useState(1);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");

  // OTP State
  const [emailOtp, setEmailOtp] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [devOtps, setDevOtps] = useState(null);

  // Biometric / Device Security Modal State
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Step 1: Request OTPs
  const handleSendOtps = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (!phone || phone.trim().length < 8) {
      setError("Please enter a valid mobile number with at least 8 digits");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/send-register-otp`, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        role
      });

      if (response.data.success) {
        setDevOtps({
          emailOtp: response.data.devEmailOtp,
          mobileOtp: response.data.devMobileOtp
        });
        setSuccessMsg(response.data.message || "OTPs sent to your email and phone!");
        setStep(2);
      }
    } catch (err) {
      console.error("Send OTP error:", err);
      setError(
        err.response?.data?.message ||
        "Failed to send verification OTPs. Please check your details."
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTPs -> Triggers Step 3 Biometric Security Verification
  const handleVerifyRegister = (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!emailOtp.trim() || !mobileOtp.trim()) {
      setError("Please enter both Email OTP and Mobile OTP");
      return;
    }

    // Advance to Biometric & Device Password Verification
    setShowBiometricModal(true);
  };

  // Step 3: Complete Registration after Fingerprint or Device Password confirmation
  const handleFinalizeRegistration = async ({ method }) => {
    setShowBiometricModal(false);
    setLoading(true);
    setError("");

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/verify-register`, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        role,
        emailOtp: emailOtp.trim(),
        mobileOtp: mobileOtp.trim(),
        biometricVerified: true,
        authMethod: method
      });

      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
      }

      if (response.data.user) {
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }

      const userRole = response.data.user?.role || role;
      if (userRole === "teacher") {
        navigate("/teacher-dashboard");
      } else {
        navigate("/student-dashboard");
      }
    } catch (err) {
      console.error("Registration verification error:", err);
      setError(
        err.response?.data?.message ||
        "Registration failed. Please check the OTP codes and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Fast auto-fill for testing
  const handleAutoFill = () => {
    if (devOtps) {
      setEmailOtp(devOtps.emailOtp || "");
      setMobileOtp(devOtps.mobileOtp || "");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: "480px" }}>
        <div className="auth-logo">
          Virtual<span>Classroom</span>
        </div>

        <h1>{step === 1 ? "Create Account" : "High Security Verification"}</h1>

        <p className="auth-subtitle">
          {step === 1
            ? "Sign up with mandatory two-way OTP verification"
            : `Enter the 6-digit OTPs sent to ${email} and ${phone}`}
        </p>

        {/* Security Badge */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          justifyContent: "center",
          margin: "-10px auto 20px auto",
          fontSize: "12px",
          color: "var(--accent-cyan)",
          background: "rgba(6, 182, 212, 0.1)",
          padding: "6px 14px",
          borderRadius: "9999px",
          border: "1px solid rgba(6, 182, 212, 0.3)"
        }}>
          <span>🔒 2-Factor High Security Active</span>
        </div>

        {error && <div className="auth-alert-error">{error}</div>}
        {successMsg && (
          <div className="profile-alert-success" style={{ marginBottom: "18px" }}>
            <span>✓ {successMsg}</span>
          </div>
        )}

        {/* STEP 1: REGISTRATION DETAILS */}
        {step === 1 && (
          <form onSubmit={handleSendOtps}>
            <label>Full Name</label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />

            <label>Email Address (For Email OTP)</label>
            <input
              type="email"
              placeholder="e.g. user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />

            <label>Mobile Number (For SMS OTP)</label>
            <input
              type="tel"
              placeholder="e.g. +91 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={loading}
            />

            <label>Password</label>
            <input
              type="password"
              placeholder="Create a password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />

            <label>I am a</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
            >
              <option value="student">Student Account</option>
              <option value="teacher">Teacher Account (Host)</option>
            </select>

            <button
              type="submit"
              className="auth-button"
              disabled={loading}
              style={{ marginTop: "10px" }}
            >
              {loading ? "Generating Security OTPs..." : "Verify Identity & Send OTPs →"}
            </button>
          </form>
        )}

        {/* STEP 2: DUAL OTP VERIFICATION (EMAIL + MOBILE) */}
        {step === 2 && (
          <form onSubmit={handleVerifyRegister}>
            {devOtps && (
              <div style={{
                background: "rgba(99, 102, 241, 0.12)",
                border: "1px dashed rgba(99, 102, 241, 0.4)",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "16px",
                fontSize: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "var(--primary-light)" }}>🧪 Dev Simulation OTPs:</strong>
                  <button
                    type="button"
                    onClick={handleAutoFill}
                    style={{
                      background: "rgba(99, 102, 241, 0.3)",
                      color: "#fff",
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "4px"
                    }}
                  >
                    Auto-Fill OTPs
                  </button>
                </div>
                <span>📧 Email OTP: <strong>{devOtps.emailOtp}</strong></span>
                <span>📲 Mobile OTP: <strong>{devOtps.mobileOtp}</strong></span>
              </div>
            )}

            <label>Enter 6-Digit Email OTP *</label>
            <input
              type="text"
              maxLength="6"
              placeholder="e.g. 123456"
              value={emailOtp}
              onChange={(e) => setEmailOtp(e.target.value)}
              required
              disabled={loading}
              style={{ letterSpacing: "3px", textAlign: "center", fontSize: "18px", fontWeight: "700" }}
            />

            <label>Enter 6-Digit Mobile SMS OTP *</label>
            <input
              type="text"
              maxLength="6"
              placeholder="e.g. 654321"
              value={mobileOtp}
              onChange={(e) => setMobileOtp(e.target.value)}
              required
              disabled={loading}
              style={{ letterSpacing: "3px", textAlign: "center", fontSize: "18px", fontWeight: "700" }}
            />

            <button
              type="submit"
              className="auth-button"
              disabled={loading}
              style={{ marginTop: "14px" }}
            >
              {loading ? "Verifying Codes..." : "Verify & Complete Registration ✓"}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                width: "100%",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: "13px",
                marginTop: "12px",
                textDecoration: "underline"
              }}
            >
              ← Edit details or change phone number
            </button>
          </form>
        )}

        <p className="switch-auth">
          Already have an account?{" "}
          <Link to="/login">
            Login
          </Link>
        </p>
      </div>

      {/* BIOMETRIC & DEVICE PASSWORD SECURITY MODAL */}
      {showBiometricModal && (
        <BiometricSecurityModal
          isOpen={showBiometricModal}
          mode="register"
          userName={name}
          userEmail={email}
          initialPassword={password}
          onSuccess={handleFinalizeRegistration}
          onCancel={() => setShowBiometricModal(false)}
        />
      )}
    </div>
  );
}

export default Register;