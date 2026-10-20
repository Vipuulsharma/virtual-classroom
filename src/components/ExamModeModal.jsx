import { useState, useEffect } from "react";

export default function ExamModeModal({
  isOpen = false,
  onClose,
  trustScore = 80,
  canSubmitExam = false,
  onSubmitExam,
  onOpenStepUp,
  onTabSwitchViolation
}) {
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [violationsCount, setViolationsCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(1200); // 20 minutes
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState(null);

  // 1. Full-screen request & Tab-Switch / Blur Detection during Exam Mode
  useEffect(() => {
    if (!isOpen) return;

    // Attempt browser full screen
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}

    const handleExamVisibilityChange = () => {
      if (document.hidden) {
        setViolationsCount((prev) => {
          const next = prev + 1;
          if (onTabSwitchViolation) {
            onTabSwitchViolation("EXAM_TAB_SWITCH", { violationIndex: next });
          }
          return next;
        });
      }
    };

    const handleExamWindowBlur = () => {
      setViolationsCount((prev) => {
        const next = prev + 1;
        if (onTabSwitchViolation) {
          onTabSwitchViolation("WINDOW_BLUR_EXAM", { violationIndex: next });
        }
        return next;
      });
    };

    document.addEventListener("visibilitychange", handleExamVisibilityChange);
    window.addEventListener("blur", handleExamWindowBlur);

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      document.removeEventListener("visibilitychange", handleExamVisibilityChange);
      window.removeEventListener("blur", handleExamWindowBlur);
      clearInterval(timer);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [isOpen, onTabSwitchViolation]);

  if (!isOpen) return null;

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const questions = [
    {
      id: "q1",
      text: "1. In a Zero-Trust Continuous Trust architecture, when is trust score calculated?",
      options: [
        { key: "A", text: "Only once during initial login" },
        { key: "B", text: "Continuously adjusted based on real-time activity and behavioral telemetry" },
        { key: "C", text: "Fixed per user role statically" },
        { key: "D", text: "Only when teacher manually enters it" }
      ],
      correct: "B"
    },
    {
      id: "q2",
      text: "2. What is the capability threshold required to submit an online exam?",
      options: [
        { key: "A", text: "40 Trust" },
        { key: "B", text: "50 Trust" },
        { key: "C", text: "70 Trust" },
        { key: "D", text: "85 Trust" }
      ],
      correct: "D"
    },
    {
      id: "q3",
      text: "3. How does Layer 4B Privacy Protection adhere to Data Minimization?",
      options: [
        { key: "A", text: "It records every webcam frame in the database" },
        { key: "B", text: "It saves all chat message texts in plain text" },
        { key: "C", text: "It stores only event types and timestamps, strictly excluding chat text and video pixels" },
        { key: "D", text: "It disables all network encryption" }
      ],
      correct: "C"
    }
  ];

  const handleSelect = (qId, optionKey) => {
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optionKey }));
  };

  const handleFinalSubmit = () => {
    if (!canSubmitExam && trustScore < 85) {
      setSubmitFeedback({
        type: "error",
        msg: `Submission Blocked: Trust score (${trustScore}) is below required 85 threshold due to tab switches. Please click 'Step-Up' to verify your identity.`
      });
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitFeedback({
        type: "success",
        msg: `✓ Exam successfully verified and committed with Continuous Trust score ${trustScore}! Hash-chained in Audit Ledger.`
      });
      if (onSubmitExam) {
        onSubmitExam(selectedAnswers);
      }
    }, 1000);
  };

  return (
    <div className="modal-backdrop">
      <div className="exam-modal-container">
        {/* Header Bar */}
        <div className="exam-header-bar">
          <div className="exam-header-left">
            <span className="exam-active-indicator" />
            <div>
              <h3>Secure Proctored Exam Mode</h3>
              <span>Continuous Trust Anti-Cheating Telemetry Active</span>
            </div>
          </div>

          <div className="exam-header-right">
            <div className="exam-timer-pill">
              ⏱️ Time Left: <strong>{formatTimer(timeLeft)}</strong>
            </div>

            <div
              className="exam-trust-pill"
              style={{
                borderColor: trustScore >= 85 ? "rgba(16, 185, 129, 0.4)" : "rgba(244, 63, 94, 0.4)"
              }}
            >
              <span>Trust:</span>
              <strong style={{ color: trustScore >= 85 ? "#10b981" : "#f43f5e" }}>
                {trustScore}/85
              </strong>
            </div>

            <button type="button" onClick={onClose} className="exam-exit-btn" title="Exit Exam Mode">
              ✕ Exit
            </button>
          </div>
        </div>

        {/* Violations Warning Bar */}
        {violationsCount > 0 && (
          <div className="exam-violation-warning">
            ⚠️ <strong>Tab Switch / Focus Violations Detected: {violationsCount}</strong>
            <span>Continuous Trust penalty applied. Trust score must remain &ge; 85 to submit.</span>
          </div>
        )}

        {/* Questions Body */}
        <div className="exam-questions-scroll">
          {questions.map((q) => (
            <div key={q.id} className="exam-question-card">
              <p className="exam-q-text">{q.text}</p>
              <div className="exam-options-grid">
                {q.options.map((opt) => {
                  const isSelected = selectedAnswers[q.id] === opt.key;
                  return (
                    <label
                      key={opt.key}
                      onClick={() => handleSelect(q.id, opt.key)}
                      className={`exam-option-item ${isSelected ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={isSelected}
                        onChange={() => handleSelect(q.id, opt.key)}
                      />
                      <span className="option-key">{opt.key}</span>
                      <span className="option-text">{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Feedback Alert */}
        {submitFeedback && (
          <div className={`exam-submit-alert ${submitFeedback.type}`}>
            {submitFeedback.msg}
          </div>
        )}

        {/* Footer Actions */}
        <div className="exam-footer-bar">
          <div className="exam-footer-status">
            {trustScore >= 85 ? (
              <span style={{ color: "#10b981", fontSize: "13px" }}>
                ✓ Trust score meets the 85 threshold for exam submission.
              </span>
            ) : (
              <span style={{ color: "#f43f5e", fontSize: "13px" }}>
                ⚠️ Trust score deficit: {85 - trustScore} points needed to submit.
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            {trustScore < 85 && (
              <button
                type="button"
                onClick={() => onOpenStepUp("exam_submit")}
                className="exam-stepup-btn"
              >
                ⚡ Step-Up (+20 Trust)
              </button>
            )}

            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="exam-submit-btn"
            >
              {isSubmitting ? "Verifying Ledger..." : "Submit Examination"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
