import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import BiometricSecurityModal from "../components/BiometricSecurityModal";
import { sendRegisterOtp, verifyRegister } from "../utils/authService";
import {
  IconArrowRight,
  IconZap,
  IconRefresh,
  IconCheck
} from "../components/ModernIcons";

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
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds

  // Biometric / Device Security Modal State
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Countdown timer for active OTP session
  useEffect(() => {
    let timer = null;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, countdown]);

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Step 1: Request OTPs
  const handleSendOtps = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!name.trim()) {
      setError("Please enter your full name");
      return;
    }

    if (!email.trim()) {
      setError("Please enter a valid email address");
      return;
    }

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
      const result = await sendRegisterOtp({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        role
      });

      if (result.success) {
        setDevOtps({
          emailOtp: result.devEmailOtp,
          mobileOtp: result.devMobileOtp
        });
        setCountdown(600); // reset 10 mins
        setSuccessMsg(result.message || "High-security OTPs dispatched to your Email and Mobile!");
        setStep(2);
      }
    } catch (err) {
      console.error("Send OTP error:", err);
      setError(err.message || "Failed to send verification OTPs. Please check your details.");
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
      setError("Please enter both Email OTP and Mobile SMS OTP");
      return;
    }

    if (countdown === 0) {
      setError("OTPs have expired. Please click Resend Codes to generate fresh OTPs.");
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
      const result = await verifyRegister({
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

      if (result.success) {
        const userRole = result.user?.role || role;
        if (userRole === "teacher") {
          navigate("/teacher-dashboard");
        } else {
          navigate("/student-dashboard");
        }
      }
    } catch (err) {
      console.error("Registration verification error:", err);
      setError(err.message || "Registration failed. Please check the OTP codes and try again.");
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
        <div
          style={{
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
          }}
        >
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
              style={{ marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <span>{loading ? "Generating Security OTPs..." : "Verify Identity & Send OTPs"}</span>
              {!loading && <IconArrowRight size={16} />}
            </button>
          </form>
        )}

        {/* STEP 2: DUAL OTP VERIFICATION (EMAIL + MOBILE) */}
        {step === 2 && (
          <form onSubmit={handleVerifyRegister}>
            {devOtps && (
              <div
                style={{
                  background: "rgba(99, 102, 241, 0.12)",
                  border: "1px dashed rgba(99, 102, 241, 0.4)",
                  padding: "12px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  fontSize: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "var(--primary-light)" }}>Active Verification OTPs:</strong>
                  <button
                    type="button"
                    onClick={handleAutoFill}
                    style={{
                      background: "rgba(99, 102, 241, 0.4)",
                      color: "#fff",
                      fontSize: "11px",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      border: "1px solid rgba(99, 102, 241, 0.5)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px"
                    }}
                  >
                    <IconZap size={13} />
                    <span>Auto-Fill OTPs</span>
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Email OTP: <strong>{devOtps.emailOtp}</strong></span>
                  <span>Mobile OTP: <strong>{devOtps.mobileOtp}</strong></span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Code valid for: <strong style={{ color: countdown < 60 ? "#ef4444" : "var(--accent-cyan)" }}>{formatTimer(countdown)}</strong></span>
                  <button
                    type="button"
                    onClick={handleSendOtps}
                    disabled={loading}
                    style={{
                      background: "transparent",
                      color: "var(--primary-light)",
                      fontSize: "11px",
                      padding: 0,
                      cursor: "pointer",
                      border: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      textDecoration: "underline"
                    }}
                  >
                    <IconRefresh size={12} />
                    <span>Resend Codes</span>
                  </button>
                </div>
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
              disabled={loading || countdown === 0}
              style={{ marginTop: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              {loading ? (
                <span>Verifying Codes...</span>
              ) : (
                <>
                  <IconCheck size={18} />
                  <span>Verify & Complete Registration</span>
                </>
              )}
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
                cursor: "pointer",
                border: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              <IconArrowRight size={13} style={{ transform: "rotate(180deg)" }} />
              <span>Edit details or change phone number</span>
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