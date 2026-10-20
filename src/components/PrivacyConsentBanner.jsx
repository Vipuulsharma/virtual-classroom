import { useState, useEffect } from "react";

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
          <div className="privacy-banner-icon">🛡️</div>
          <div className="privacy-banner-text">
            <strong>Layer 4B Privacy Protection Notice: Yeh events track hote hain</strong>
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
              <span className="detail-tag allowed">✓ Monitored</span>
              <span>Window focus changes, event timestamps, rate limiting, cryptographic hashes</span>
            </div>
            <div className="privacy-detail-row">
              <span className="detail-tag protected">🔒 Private & Minimised</span>
              <span>Private conversations, audio frames, desktop content, facial video pixels</span>
            </div>
            <div className="privacy-detail-row">
              <span className="detail-tag protected">🔒 Cryptography</span>
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
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
}
