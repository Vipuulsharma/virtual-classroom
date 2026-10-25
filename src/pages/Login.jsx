import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import BiometricSecurityModal from "../components/BiometricSecurityModal";
import { login, verifyLogin2FA } from "../utils/authService";
import {
  IconArrowRight,
  IconZap,
  IconRefresh,
  IconCheck,
  IconShield
} from "../components/ModernIcons";

function Login() {
  const navigate = useNavigate();

  // Step 1: Credentials | Step 2: 2FA OTP Verification
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 2FA state
  const [userId, setUserId] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [devOtps, setDevOtps] = useState(null);
  const [countdown, setCountdown] = useState(600); // 10 minutes

  // Biometric / Device Security Modal State
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [pendingLoginData, setPendingLoginData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Countdown timer for 2FA OTP session
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

  // Step 1: Login credentials check & trigger 2FA
  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!email.trim() || !password) {
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);

    try {
      const data = await login({
        email: email.trim(),
        password
      });

      if (data.requires2FA) {
        setUserId(data.userId);
        setUserPhone(data.phone || "");
        setDevOtps({
          emailOtp: data.devEmailOtp,
          mobileOtp: data.devMobileOtp
        });
        setCountdown(600); // reset 10 mins
        setSuccessMsg(data.message || "Security 2FA verification code sent to your registered email and phone!");
        setStep(2);
      } else {
        // Direct login fallback if 2FA not required
        completeLogin(data);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify 2FA OTPs
  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!emailOtp.trim()) {
      setError("Please enter the Email OTP");
      return;
    }

    if (countdown === 0) {
      setError("Security code has expired. Please click Resend Code to receive a fresh OTP.");
      return;
    }

    setLoading(true);

    try {
      const result = await verifyLogin2FA({
        userId,
        emailOtp: emailOtp.trim(),
        mobileOtp: mobileOtp.trim()
      });

      // Save verified login payload and require device biometric / screen lock confirmation
      setPendingLoginData(result);
      setShowBiometricModal(true);
    } catch (err) {
      console.error("2FA verification error:", err);
      setError(err.message || "Security code verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLoginSuccess = () => {
    setShowBiometricModal(false);
    if (pendingLoginData) {
      completeLogin(pendingLoginData);
    }
  };

  const completeLogin = (data) => {
    if (data.token) {
      localStorage.setItem("token", data.token);
    }

    if (data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    const userRole = data.user?.role;
    if (userRole === "teacher") {
      navigate("/teacher-dashboard");
    } else {
      navigate("/student-dashboard");
    }
  };

  // Fast auto-fill for testing
  const handleAutoFill = () => {
    if (devOtps) {
      setEmailOtp(devOtps.emailOtp || "");
      if (devOtps.mobileOtp) {
        setMobileOtp(devOtps.mobileOtp || "");
      }
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: "460px" }}>
        <div className="auth-logo">
          Virtual<span>Classroom</span>
        </div>

        <h1>{step === 1 ? "Welcome Back" : "Security 2FA Verification"}</h1>

        <p className="auth-subtitle">
          {step === 1
            ? "Sign in with password and two-factor identity verification"
            : `Enter the security verification code sent to ${email}`}
        </p>

        {/* Security Indicator */}
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
            border: "1px solid rgba(6, 182, 212, 0.3)",
            display: "inline-flex",
            alignItems: "center",
            gap: "7px"
          }}
        >
          <IconShield size={14} color="#06b6d4" />
          <span>256-bit Encrypted Session Verification</span>
        </div>

        {error && <div className="auth-alert-error">{error}</div>}
        {successMsg && (
          <div className="profile-alert-success" style={{ marginBottom: "18px" }}>
            <span>✓ {successMsg}</span>
          </div>
        )}

        {/* STEP 1: EMAIL & PASSWORD */}
        {step === 1 && (
          <form onSubmit={handleLoginSubmit}>
            <label>Email Address</label>
            <input
              type="email"
              placeholder="Enter your registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />

            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />

            <div className="forgot">
              <Link to="/reset-password">Forgot password?</Link>
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={loading}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <span>{loading ? "Checking Credentials..." : "Proceed to 2FA Login"}</span>
              {!loading && <IconArrowRight size={16} />}
            </button>
          </form>
        )}

        {/* STEP 2: 2-FACTOR OTP VERIFICATION */}
        {step === 2 && (
          <form onSubmit={handleVerify2FA}>
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
                  <strong style={{ color: "var(--primary-light)" }}>Active 2FA Codes:</strong>
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
                    <span>Auto-Fill Codes</span>
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Email OTP: <strong>{devOtps.emailOtp}</strong></span>
                  {devOtps.mobileOtp && <span>Mobile OTP: <strong>{devOtps.mobileOtp}</strong></span>}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Code valid for: <strong style={{ color: countdown < 60 ? "#ef4444" : "var(--accent-cyan)" }}>{formatTimer(countdown)}</strong></span>
                  <button
                    type="button"
                    onClick={handleLoginSubmit}
                    disabled={loading}
                    style={{
                      background: "transparent",
                      color: "var(--primary-light)",
                      fontSize: "11px",
                      padding: 0,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      border: "none",
                      textDecoration: "underline"
                    }}
                  >
                    <IconRefresh size={12} />
                    <span>Resend Code</span>
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

            {userPhone && (
              <>
                <label>Enter 6-Digit Mobile SMS OTP (Optional)</label>
                <input
                  type="text"
                  maxLength="6"
                  placeholder="e.g. 654321"
                  value={mobileOtp}
                  onChange={(e) => setMobileOtp(e.target.value)}
                  disabled={loading}
                  style={{ letterSpacing: "3px", textAlign: "center", fontSize: "18px", fontWeight: "700" }}
                />
              </>
            )}

            <button
              type="submit"
              className="auth-button"
              disabled={loading || countdown === 0}
              style={{ marginTop: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              {loading ? (
                <span>Verifying 2FA Security...</span>
              ) : (
                <>
                  <IconCheck size={18} />
                  <span>Authorize & Sign In</span>
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
              <span>Back to password login</span>
            </button>
          </form>
        )}

        <p className="switch-auth">
          Don't have an account?{" "}
          <Link to="/register">
            Create Account
          </Link>
        </p>
      </div>

      {/* BIOMETRIC & DEVICE PASSWORD SECURITY MODAL */}
      {showBiometricModal && (
        <BiometricSecurityModal
          isOpen={showBiometricModal}
          mode="login"
          userName={pendingLoginData?.user?.name || ""}
          userEmail={email}
          userId={userId}
          initialPassword={password}
          onSuccess={handleBiometricLoginSuccess}
          onCancel={() => setShowBiometricModal(false)}
        />
      )}
    </div>
  );
}

export default Login;