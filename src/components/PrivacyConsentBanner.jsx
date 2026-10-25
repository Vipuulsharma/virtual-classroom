import { useState, useEffect } from "react";
import { IconShield, IconCheck, IconLock } from "./ModernIcons";

export default function PrivacyConsentBanner({ onConsentAccepted }) {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const hasConsented = localStorage.getItem("vc_continuous_trust_consent");
    if (!hasConsented) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("vc_continuous_trust_consent", "accepted_" + Date.now());
    setVisible(false);
    if (onConsentAccepted) onConsentAccepted();
  };

  if (!visible) return null;

  return (
    <div className="privacy-banner-container">
      <div className="privacy-banner-card">
        <div className="privacy-banner-main">
          <div className="privacy-banner-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconShield size={24} color="#6366f1" />
          </div>
          <div className="privacy-banner-text">
            <strong>Layer 4B Privacy Protection Notice: Continuous Trust & Integrity</strong>
            <p>
              To maintain academic integrity, this classroom monitors activity-aware Continuous Trust
              (tab switches, network connection stability, rapid rate limits).
              In strict adherence to <em>Data Minimization</em>:
              <strong> Chat message contents, video audio, and personal files are NEVER logged or stored.</strong>
            </p>
          </div>
        </div>

        {showDetails && (
          <div className="privacy-details-box">
            <div className="privacy-detail-row">
              <span className="detail-tag allowed" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <IconCheck size={12} /> Monitored
              </span>
              <span>Window focus changes, event timestamps, rate limiting, cryptographic hashes</span>
            </div>
            <div className="privacy-detail-row">
              <span className="detail-tag protected" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <IconLock size={12} /> Private & Minimised
              </span>
              <span>Private conversations, audio frames, desktop content, facial video pixels</span>
            </div>
            <div className="privacy-detail-row">
              <span className="detail-tag protected" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <IconLock size={12} /> Cryptography
              </span>
              <span>TLS 1.3 in-transit, AES-256 at rest, SHA-256 tamper-evident hash chaining</span>
            </div>
          </div>
        )}

        <div className="privacy-banner-actions">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="privacy-btn-secondary"
          >
            {showDetails ? "Hide Privacy Details" : "Learn What Is Tracked"}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="privacy-btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <IconCheck size={16} />
            <span>I Understand & Agree</span>
          </button>
        </div>
      </div>
    </div>
  );
}
