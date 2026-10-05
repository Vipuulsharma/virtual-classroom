import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import BiometricSecurityModal from "../components/BiometricSecurityModal";
import { API_BASE_URL } from "../utils/apiConfig";

function JoinClassroom() {
  const navigate = useNavigate();

  const rawUser = localStorage.getItem("user");
  let currentUser = null;
  try {
    currentUser = rawUser ? JSON.parse(rawUser) : null;
  } catch (e) {
    currentUser = null;
  }

  const [classroomId, setClassroomId] = useState("");
  const [name, setName] = useState(currentUser?.name || "");
  const [email, setEmail] = useState(currentUser?.email || "");

  // OTP Verification Step: 1 -> Send OTP, 2 -> Verify OTP
  const [step, setStep] = useState(1);
  const [joinOtp, setJoinOtp] = useState("");
  const [devOtp, setDevOtp] = useState(null);

  // Step 3: Biometric / Device Security Modal State
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSendJoinOtp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!classroomId.trim()) {
      setError("Please enter the classroom code");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your registered email address");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/send-join-otp`, {
        classroomId: classroomId.trim().toUpperCase(),
        email: email.trim(),
        phone: currentUser?.phone || "",
        name: name.trim() || "Student"
      });

      if (response.data.success) {
        setDevOtp(response.data.devJoinOtp);
        setSuccessMsg("Security verification code sent to your email!");
        setStep(2);
      }
    } catch (err) {
      console.error("Send join OTP error:", err);
      setError(err.response?.data?.message || "Failed to dispatch entry OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyJoinOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/verify-join-otp`, {
        classroomId: classroomId.trim().toUpperCase(),
        email: email.trim(),
        otp: joinOtp.trim()
      });

      if (response.data.success) {
        // Require Step 3: Biometric / Device Security Lock Verification
        setShowBiometricModal(true);
      }
    } catch (err) {
      console.error("Verify join OTP error:", err);
      setError(err.response?.data?.message || "Incorrect Join OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricJoinSuccess = () => {
    setShowBiometricModal(false);
    navigate(`/classroom/${classroomId.trim().toUpperCase()}`, {
      state: {
        role: "student",
        userName: name.trim() || "Student",
        userEmail: email.trim(),
        userId: currentUser?.id || currentUser?._id || "",
        avatar: currentUser?.avatar || "",
        verifiedByOtp: true,
        verifiedByBiometrics: true
      }
    });
  };

  return (
    <div className="dashboard-page">
      <div className="classroom-form-card" style={{ maxWidth: "480px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <span style={{
            fontSize: "11px",
            color: "var(--accent-cyan)",
            background: "rgba(6, 182, 212, 0.1)",
            padding: "4px 10px",
            borderRadius: "9999px",
            border: "1px solid rgba(6, 182, 212, 0.3)"
          }}>
            🔒 High Security Entry Check
          </span>
          <Link to="/student-dashboard" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            ← Back
          </Link>
        </div>

        <h1>Join Classroom</h1>
        <p>
          {step === 1
            ? "Enter your room code and verify your student identity via OTP."
            : `Enter the 6-digit entry code sent to ${email}`}
        </p>

        {error && <div className="auth-alert-error" style={{ marginBottom: "16px" }}>{error}</div>}
        {successMsg && <div className="profile-alert-success" style={{ marginBottom: "16px" }}>✓ {successMsg}</div>}

        {step === 1 && (
          <form onSubmit={handleSendJoinOtp}>
            <label>Classroom Code *</label>
            <input
              type="text"
              placeholder="e.g. A7K92P"
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value.toUpperCase())}
              required
              disabled={loading}
              style={{ textTransform: "uppercase", letterSpacing: "2px", fontWeight: "700" }}
            />

            <label>Your Name *</label>
            <input
              type="text"
              placeholder="e.g. Rohan Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />

            <label>Registered Email Address *</label>
            <input
              type="email"
              placeholder="e.g. student@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />

            <button
              type="submit"
              className="auth-button"
              disabled={loading}
              style={{ marginTop: "12px" }}
            >
              {loading ? "Generating Entry OTP..." : "Verify Identity & Join Room →"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyJoinOtp}>
            {devOtp && (
              <div style={{
                background: "rgba(99, 102, 241, 0.12)",
                border: "1px dashed rgba(99, 102, 241, 0.4)",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "16px",
                fontSize: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span>🔑 Dev Entry OTP: <strong>{devOtp}</strong></span>
                <button
                  type="button"
                  onClick={() => setJoinOtp(devOtp)}
                  style={{
                    background: "rgba(99, 102, 241, 0.3)",
                    color: "#fff",
                    fontSize: "11px",
                    padding: "4px 8px",
                    borderRadius: "4px"
                  }}
                >
                  Auto-Fill
                </button>
              </div>
            )}

            <label>Enter 6-Digit Classroom Entry OTP *</label>
            <input
              type="text"
              maxLength="6"
              placeholder="e.g. 123456"
              value={joinOtp}
              onChange={(e) => setJoinOtp(e.target.value)}
              required
              disabled={loading}
              style={{ letterSpacing: "3px", textAlign: "center", fontSize: "20px", fontWeight: "700" }}
            />

            <button
              type="submit"
              className="auth-button"
              disabled={loading}
              style={{ marginTop: "14px" }}
            >
              {loading ? "Verifying Access..." : "Confirm OTP & Enter Classroom ✓"}
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
              ← Change Room Code or Email
            </button>
          </form>
        )}
      </div>

      {/* BIOMETRIC & DEVICE PASSWORD SECURITY MODAL */}
      {showBiometricModal && (
        <BiometricSecurityModal
          isOpen={showBiometricModal}
          mode="join"
          userName={name.trim() || "Student"}
          userEmail={email.trim()}
          userId={currentUser?.id || currentUser?._id || ""}
          initialPassword={currentUser?.password || "123456"}
          classroomId={classroomId.trim().toUpperCase()}
          onSuccess={handleBiometricJoinSuccess}
          onCancel={() => setShowBiometricModal(false)}
        />
      )}
    </div>
  );
}

export default JoinClassroom;