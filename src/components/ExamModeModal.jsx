import { useState, useEffect, useMemo } from "react";

export default function ExamModeModal({
  isOpen = false,
  onClose,
  isTeacher = false,
  trustScore = 80,
  canSubmitExam = true,
  activeExam = null,
  submissions = [],
  mySubmission = null,
  onPublishExam,
  onSubmitExam,
  onCloseExam,
  onOpenStepUp,
  onTabSwitchViolation
}) {
  // Navigation Tabs for Teacher: 'create' | 'submissions'
  const [teacherTab, setTeacherTab] = useState(submissions && submissions.length > 0 ? "submissions" : "create");
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState(null);

  // Teacher Exam Creation State
  const [examTitle, setExamTitle] = useState("Classroom Proctored Assessment");
  const [examDescription, setExamDescription] = useState("Proctored exam with Continuous Trust telemetry & anti-cheating tracking");
  const [examDuration, setExamDuration] = useState(15); // minutes
  const [examMinTrust, setExamMinTrust] = useState(70);
  const [questions, setQuestions] = useState([
    {
      id: "q_1",
      text: "1. In Zero-Trust architecture, what is Continuous Trust verification?",
      options: [
        { key: "A", text: "One-time credential check at initial login" },
        { key: "B", text: "Real-time, dynamic scoring based on ongoing telemetry and device behavior" },
        { key: "C", text: "A manual attendance roll-call by the instructor" },
        { key: "D", text: "Statically assigned privilege per user group" }
      ],
      correctOption: "B",
      points: 1
    },
    {
      id: "q_2",
      text: "2. What happens to a student's trust score when repeated tab-switching is detected during an exam?",
      options: [
        { key: "A", text: "The score increases as a reward" },
        { key: "B", text: "Nothing happens" },
        { key: "C", text: "Continuous Trust penalty is applied, potentially blocking exam submission" },
        { key: "D", text: "The computer immediately powers off" }
      ],
      correctOption: "C",
      points: 1
    },
    {
      id: "q_3",
      text: "3. What capability does a student unlock when their trust score is 75 or higher?",
      options: [
        { key: "A", text: "Classroom File & Resource Downloads" },
        { key: "B", text: "Host Administration Control" },
        { key: "C", text: "Ability to kick other students" },
        { key: "D", text: "Muting the instructor" }
      ],
      correctOption: "A",
      points: 1
    }
  ]);

  // New Question Form Input State
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newOptA, setNewOptA] = useState("");
  const [newOptB, setNewOptB] = useState("");
  const [newOptC, setNewOptC] = useState("");
  const [newOptD, setNewOptD] = useState("");
  const [newCorrectOpt, setNewCorrectOpt] = useState("A");
  const [showAddQuestionForm, setShowAddQuestionForm] = useState(false);

  // Student Taking Exam State
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [violationsCount, setViolationsCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  // Update timer based on active exam duration
  useEffect(() => {
    if (activeExam?.durationMinutes) {
      setTimeLeft(activeExam.durationMinutes * 60);
    }
  }, [activeExam]);

  // Anti-cheating proctoring for Students while exam is open
  useEffect(() => {
    if (!isOpen || isTeacher || mySubmission) return;

    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}

    const handleVisibilityChange = () => {
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

    const handleWindowBlur = () => {
      setViolationsCount((prev) => {
        const next = prev + 1;
        if (onTabSwitchViolation) {
          onTabSwitchViolation("WINDOW_BLUR_EXAM", { violationIndex: next });
        }
        return next;
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      clearInterval(timer);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [isOpen, isTeacher, mySubmission, onTabSwitchViolation]);

  if (!isOpen) return null;

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Preset Template loader for Teachers
  const handleLoadTemplate = (type) => {
    if (type === "security") {
      setExamTitle("Network Security & Zero-Trust Exam");
      setExamDuration(10);
      setExamMinTrust(70);
      setQuestions([
        {
          id: "q_sec_1",
          text: "1. What is the fundamental principle of Zero-Trust architecture?",
          options: [
            { key: "A", text: "Trust everything inside the local private network" },
            { key: "B", text: "Never trust, always verify every access request continuously" },
            { key: "C", text: "Only check passwords once a year" },
            { key: "D", text: "Disable firewalls for maximum speed" }
          ],
          correctOption: "B",
          points: 1
        },
        {
          id: "q_sec_2",
          text: "2. Which WebAuthn credential type provides phishing-resistant biometric authentication?",
          options: [
            { key: "A", text: "FIDO2 / Passkey Public Key Cryptography" },
            { key: "B", text: "Plain text SMS 4-digit code" },
            { key: "C", text: "Shared sticky note passwords" },
            { key: "D", text: "Mother's maiden name security question" }
          ],
          correctOption: "A",
          points: 1
        },
        {
          id: "q_sec_3",
          text: "3. In Layer 4B Privacy Protection, what information is strictly EXCLUDED from audit logs?",
          options: [
            { key: "A", text: "Event timestamp" },
            { key: "B", text: "User role identifier" },
            { key: "C", text: "Raw chat message text and webcam video pixels" },
            { key: "D", text: "Session ID" }
          ],
          correctOption: "C",
          points: 1
        },
        {
          id: "q_sec_4",
          text: "4. What capability is revoked if a student's Continuous Trust score falls below 50?",
          options: [
            { key: "A", text: "Microphone and Camera transmission" },
            { key: "B", text: "Power supply to display" },
            { key: "C", text: "All internet access" },
            { key: "D", text: "Browser window closes automatically" }
          ],
          correctOption: "A",
          points: 1
        }
      ]);
    } else if (type === "math") {
      setExamTitle("Computer Science & Logic Foundations");
      setExamDuration(15);
      setExamMinTrust(60);
      setQuestions([
        {
          id: "q_math_1",
          text: "1. What is the time complexity of searching an element in a balanced Binary Search Tree (BST)?",
          options: [
            { key: "A", text: "O(1)" },
            { key: "B", text: "O(n^2)" },
            { key: "C", text: "O(log n)" },
            { key: "D", text: "O(n!)" }
          ],
          correctOption: "C",
          points: 1
        },
        {
          id: "q_math_2",
          text: "2. Which cryptographic hash algorithm produces a 256-bit hash digest?",
          options: [
            { key: "A", text: "MD5" },
            { key: "B", text: "SHA-256" },
            { key: "C", text: "Base64" },
            { key: "D", text: "ROT13" }
          ],
          correctOption: "B",
          points: 1
        }
      ]);
    }
  };

  const handleAddNewQuestion = (e) => {
    e.preventDefault();
    if (!newQuestionText.trim() || !newOptA.trim() || !newOptB.trim()) return;

    const newQ = {
      id: "q_" + Date.now(),
      text: `${questions.length + 1}. ${newQuestionText.trim()}`,
      options: [
        { key: "A", text: newOptA.trim() },
        { key: "B", text: newOptB.trim() },
        { key: "C", text: newOptC.trim() || "Option C" },
        { key: "D", text: newOptD.trim() || "Option D" }
      ],
      correctOption: newCorrectOpt,
      points: 1
    };

    setQuestions([...questions, newQ]);
    setNewQuestionText("");
    setNewOptA("");
    setNewOptB("");
    setNewOptC("");
    setNewOptD("");
    setNewCorrectOpt("A");
    setShowAddQuestionForm(false);
  };

  const handleRemoveQuestion = (id) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleTeacherPublish = () => {
    if (questions.length === 0) {
      alert("Please add at least one question before publishing the exam.");
      return;
    }

    const payload = {
      id: "exam_" + Date.now(),
      title: examTitle.trim() || "Classroom Examination",
      description: examDescription.trim(),
      durationMinutes: Number(examDuration) || 15,
      minTrustScore: Number(examMinTrust) || 70,
      questions
    };

    if (onPublishExam) {
      onPublishExam(payload);
    }
    setTeacherTab("submissions");
  };

  const handleSelectAnswer = (qId, optionKey) => {
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optionKey }));
  };

  const handleStudentSubmit = () => {
    const requiredThreshold = activeExam?.minTrustScore || 70;
    if (trustScore < requiredThreshold) {
      setSubmitFeedback({
        type: "error",
        msg: `Submission Blocked: Your Continuous Trust score (${trustScore}) is below required ${requiredThreshold} threshold due to focus / tab switches. Please click 'Step-Up' to boost your score.`
      });
      return;
    }

    setIsSubmitting(true);
    if (onSubmitExam) {
      onSubmitExam({
        examId: activeExam?.id || "exam_current",
        answers: selectedAnswers,
        trustScore,
        violationsCount
      });
    }

    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitFeedback({
        type: "success",
        msg: `✓ Exam submitted successfully to your Instructor! Verified and logged in Audit Ledger.`
      });
    }, 800);
  };

  // CSV Export for Teacher Results
  const handleExportCSV = () => {
    if (!submissions || submissions.length === 0) return;
    const headers = "Student Name,Email,Score,Total Possible,Percentage,Result,Trust Score,Violations,Submitted At\n";
    const rows = submissions.map((s) => (
      `"${s.studentName || 'Student'}","${s.studentEmail || ''}",${s.score},${s.totalPossible},${s.percentage}%,${s.passed ? 'PASSED' : 'FAILED'},${s.trustScore || 80},${s.violationsCount || 0},"${new Date(s.submittedAt).toLocaleString()}"`
    )).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exam_results_${activeExam?.title || 'classroom'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentQuestions = isTeacher ? questions : (activeExam?.questions || []);
  const currentTotal = currentQuestions.length;

  return (
    <div className="classroom-modal-backdrop" onClick={onClose}>
      <div className="exam-proctored-container" onClick={(e) => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="exam-header-bar">
          <div className="exam-header-left">
            <span className="exam-active-indicator" />
            <div>
              <h3>
                {isTeacher ? "📝 Exam & Assessment Studio" : (activeExam?.title || "Classroom Examination")}
              </h3>
              <span>
                {isTeacher
                  ? "Instructor Exam Creator & Live Submission Analytics"
                  : `Proctored Session • Continuous Trust Anti-Cheating Telemetry Active`}
              </span>
            </div>
          </div>

          <div className="exam-header-right">
            {!isTeacher && !mySubmission && activeExam && (
              <div className="exam-timer-pill">
                ⏱️ <strong>{formatTimer(timeLeft)}</strong>
              </div>
            )}

            {!isTeacher && (
              <div
                className="exam-trust-pill"
                style={{
                  borderColor: trustScore >= (activeExam?.minTrustScore || 70) ? "rgba(16, 185, 129, 0.4)" : "rgba(244, 63, 94, 0.4)"
                }}
              >
                <span>Trust:</span>
                <strong style={{ color: trustScore >= (activeExam?.minTrustScore || 70) ? "#10b981" : "#f43f5e" }}>
                  {trustScore}/{activeExam?.minTrustScore || 70}
                </strong>
              </div>
            )}

            <button type="button" onClick={onClose} className="exam-exit-btn" title="Exit Exam View">
              ✕ Close
            </button>
          </div>
        </div>

        {/* Violations Warning Bar for Students */}
        {!isTeacher && violationsCount > 0 && !mySubmission && (
          <div className="exam-violation-warning">
            ⚠️ <strong>{violationsCount} Focus / Tab-Switch Violations Detected!</strong>
            <span>Continuous Trust penalty recorded. Maintain trust &ge; {activeExam?.minTrustScore || 70} to submit.</span>
          </div>
        )}

        {/* ========================================================
            TEACHER INTERFACE: CREATE EXAM OR VIEW STUDENT RESULTS
            ======================================================== */}
        {isTeacher ? (
          <div className="teacher-exam-studio">
            {/* Tab navigation */}
            <div className="teacher-exam-tabs">
              <button
                type="button"
                onClick={() => setTeacherTab("create")}
                className={`studio-tab-btn ${teacherTab === "create" ? "active" : ""}`}
              >
                ✏️ Exam Designer & Questions ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setTeacherTab("submissions")}
                className={`studio-tab-btn ${teacherTab === "submissions" ? "active" : ""}`}
              >
                📊 Student Results & Submissions {submissions.length > 0 && (
                  <span className="submissions-count-badge">{submissions.length}</span>
                )}
              </button>
            </div>

            {/* TAB 1: CREATE / EDIT EXAM */}
            {teacherTab === "create" && (
              <div className="exam-builder-scroll">
                {/* Active Exam Status Banner if currently launched */}
                {activeExam?.isOpen && (
                  <div className="active-exam-banner">
                    <div>
                      <strong>🟢 Live Exam Currently In Progress:</strong> "{activeExam.title}"
                      <span style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        {activeExam.questions?.length} Questions • {activeExam.durationMinutes} Mins • Submissions so far: {submissions.length}
                      </span>
                    </div>
                    {onCloseExam && (
                      <button type="button" onClick={onCloseExam} className="close-exam-btn">
                        🛑 Conclude Exam Session
                      </button>
                    )}
                  </div>
                )}

                {/* Quick Templates */}
                <div className="template-picker-row">
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", alignSelf: "center" }}>
                    Quick Pre-fill Templates:
                  </span>
                  <button type="button" onClick={() => handleLoadTemplate("security")} className="template-btn">
                    ⚡ Zero-Trust & Web Security (4 Qs)
                  </button>
                  <button type="button" onClick={() => handleLoadTemplate("math")} className="template-btn">
                    ⚡ Computer Science & Logic (2 Qs)
                  </button>
                </div>

                {/* Exam Settings */}
                <div className="exam-settings-grid">
                  <div className="setting-input-group">
                    <label>Exam Title:</label>
                    <input
                      type="text"
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      placeholder="e.g. Midterm Examination"
                      className="studio-input"
                    />
                  </div>

                  <div className="setting-input-group">
                    <label>Time Duration (Minutes):</label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={examDuration}
                      onChange={(e) => setExamDuration(e.target.value)}
                      className="studio-input"
                    />
                  </div>

                  <div className="setting-input-group">
                    <label>Min Trust Score to Submit:</label>
                    <select
                      value={examMinTrust}
                      onChange={(e) => setExamMinTrust(Number(e.target.value))}
                      className="studio-select"
                    >
                      <option value={50}>50 (Relaxed)</option>
                      <option value={70}>70 (Standard)</option>
                      <option value={85}>85 (Strict Anti-Cheating)</option>
                    </select>
                  </div>
                </div>

                {/* Questions List */}
                <div className="questions-manager-section">
                  <div className="questions-section-header">
                    <h4>Exam Questions ({questions.length})</h4>
                    <button
                      type="button"
                      onClick={() => setShowAddQuestionForm(!showAddQuestionForm)}
                      className="add-q-toggle-btn"
                    >
                      {showAddQuestionForm ? "✕ Cancel" : "+ Add New Question"}
                    </button>
                  </div>

                  {/* Add New Question Drawer */}
                  {showAddQuestionForm && (
                    <form onSubmit={handleAddNewQuestion} className="new-question-card">
                      <h5>Create Multiple Choice Question</h5>
                      <div className="setting-input-group" style={{ marginBottom: "10px" }}>
                        <label>Question Text:</label>
                        <input
                          type="text"
                          placeholder="e.g. What is the time complexity of binary search?"
                          value={newQuestionText}
                          onChange={(e) => setNewQuestionText(e.target.value)}
                          required
                          className="studio-input"
                        />
                      </div>

                      <div className="options-input-grid">
                        <div>
                          <label>Option A:</label>
                          <input
                            type="text"
                            value={newOptA}
                            onChange={(e) => setNewOptA(e.target.value)}
                            placeholder="Option A text"
                            required
                            className="studio-input"
                          />
                        </div>
                        <div>
                          <label>Option B:</label>
                          <input
                            type="text"
                            value={newOptB}
                            onChange={(e) => setNewOptB(e.target.value)}
                            placeholder="Option B text"
                            required
                            className="studio-input"
                          />
                        </div>
                        <div>
                          <label>Option C:</label>
                          <input
                            type="text"
                            value={newOptC}
                            onChange={(e) => setNewOptC(e.target.value)}
                            placeholder="Option C text"
                            className="studio-input"
                          />
                        </div>
                        <div>
                          <label>Option D:</label>
                          <input
                            type="text"
                            value={newOptD}
                            onChange={(e) => setNewOptD(e.target.value)}
                            placeholder="Option D text"
                            className="studio-input"
                          />
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "12px", flexWrap: "wrap" }}>
                        <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Correct Option:</label>
                        <select
                          value={newCorrectOpt}
                          onChange={(e) => setNewCorrectOpt(e.target.value)}
                          className="studio-select"
                          style={{ width: "120px" }}
                        >
                          <option value="A">Option A</option>
                          <option value="B">Option B</option>
                          <option value="C">Option C</option>
                          <option value="D">Option D</option>
                        </select>

                        <button type="submit" className="save-q-btn">
                          ✓ Save Question
                        </button>
                      </div>
                    </form>
                  )}

                  {/* List of current questions */}
                  <div className="questions-cards-stack">
                    {questions.map((q, qIdx) => (
                      <div key={q.id} className="teacher-q-card">
                        <div className="q-card-top">
                          <span className="q-number-pill">Q{qIdx + 1}</span>
                          <span className="q-text-body">{q.text}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(q.id)}
                            className="q-delete-btn"
                            title="Delete Question"
                          >
                            🗑️
                          </button>
                        </div>

                        <div className="q-options-preview">
                          {q.options.map((opt) => (
                            <div
                              key={opt.key}
                              className={`opt-pill-preview ${opt.key === q.correctOption ? "is-correct" : ""}`}
                            >
                              <strong>{opt.key}:</strong> {opt.text}
                              {opt.key === q.correctOption && <span className="correct-tag">✓ Correct</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Publish Action Button */}
                <div className="studio-bottom-actions">
                  <button
                    type="button"
                    onClick={handleTeacherPublish}
                    className="publish-exam-btn"
                  >
                    🚀 Launch & Publish Exam to Classroom ({questions.length} Questions)
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: LIVE SUBMISSIONS & SCORES TABLE */}
            {teacherTab === "submissions" && (
              <div className="submissions-view-scroll">
                <div className="submissions-stats-strip">
                  <div className="stat-pill-box">
                    <span>Total Submissions</span>
                    <strong>{submissions.length}</strong>
                  </div>
                  <div className="stat-pill-box">
                    <span>Passing Rate</span>
                    <strong style={{ color: "#10b981" }}>
                      {submissions.length > 0
                        ? `${Math.round((submissions.filter((s) => s.passed).length / submissions.length) * 100)}%`
                        : "0%"}
                    </strong>
                  </div>
                  <div className="stat-pill-box">
                    <span>Average Score</span>
                    <strong style={{ color: "#818cf8" }}>
                      {submissions.length > 0
                        ? `${Math.round(submissions.reduce((acc, s) => acc + (s.percentage || 0), 0) / submissions.length)}%`
                        : "N/A"}
                    </strong>
                  </div>
                  {submissions.length > 0 && (
                    <button type="button" onClick={handleExportCSV} className="export-csv-btn">
                      📥 Export CSV
                    </button>
                  )}
                </div>

                {submissions.length === 0 ? (
                  <div className="no-submissions-slate">
                    <span style={{ fontSize: "32px" }}>🧑‍🎓</span>
                    <h4>No Submissions Received Yet</h4>
                    <p>
                      When admitted students submit their exam, their scores, trust integrity,
                      and answer breakdowns will immediately stream here in real-time.
                    </p>
                  </div>
                ) : (
                  <div className="submissions-table-wrap">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Score</th>
                          <th>Percentage</th>
                          <th>Status</th>
                          <th>Trust Score</th>
                          <th>Tab Violations</th>
                          <th>Submitted</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.map((sub) => (
                          <tr key={sub.submissionId || sub.studentSocketId}>
                            <td>
                              <strong>{sub.studentName || "Student"}</strong>
                              <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                                {sub.studentEmail || "In-Session"}
                              </span>
                            </td>
                            <td>
                              <strong>{sub.score} / {sub.totalPossible}</strong>
                            </td>
                            <td>
                              <span className={`percent-badge ${sub.passed ? "passed" : "failed"}`}>
                                {sub.percentage}%
                              </span>
                            </td>
                            <td>
                              <span className={`status-pill ${sub.passed ? "pass" : "fail"}`}>
                                {sub.passed ? "✓ Passed" : "✕ Under Review"}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: sub.trustScore >= 70 ? "#10b981" : "#f43f5e", fontWeight: "700" }}>
                                {sub.trustScore || 80}/100
                              </span>
                            </td>
                            <td>
                              {sub.violationsCount > 0 ? (
                                <span style={{ color: "#f43f5e", fontWeight: "600" }}>
                                  ⚠️ {sub.violationsCount} switches
                                </span>
                              ) : (
                                <span style={{ color: "#10b981" }}>0 Clean</span>
                              )}
                            </td>
                            <td style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              {new Date(sub.submittedAt).toLocaleTimeString()}
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => setSelectedStudentForDetails(sub)}
                                className="inspect-answers-btn"
                              >
                                View Answers
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Detailed Student Answer Modal */}
                {selectedStudentForDetails && (
                  <div className="student-details-overlay" onClick={() => setSelectedStudentForDetails(null)}>
                    <div className="student-details-card" onClick={(e) => e.stopPropagation()}>
                      <div className="details-header">
                        <div>
                          <h4>Student Answer Sheet: {selectedStudentForDetails.studentName}</h4>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            Score: {selectedStudentForDetails.score}/{selectedStudentForDetails.totalPossible} ({selectedStudentForDetails.percentage}%) • Trust: {selectedStudentForDetails.trustScore}/100
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForDetails(null)}
                          className="chat-close-btn"
                        >
                          &times;
                        </button>
                      </div>

                      <div className="answers-review-scroll">
                        {selectedStudentForDetails.answerBreakdown?.map((item, idx) => (
                          <div key={idx} className={`answer-review-card ${item.isCorrect ? "correct" : "incorrect"}`}>
                            <div className="review-q-title">
                              <strong>Q{idx + 1}:</strong> {item.questionText}
                            </div>
                            <div className="review-comparison">
                              <div>
                                <span className="label">Student Choice:</span>
                                <strong style={{ color: item.isCorrect ? "#10b981" : "#f43f5e" }}>
                                  Option {item.chosen} {item.isCorrect ? "✓ (Correct)" : "✕ (Wrong)"}
                                </strong>
                              </div>
                              <div>
                                <span className="label">Correct Answer:</span>
                                <strong style={{ color: "#10b981" }}>Option {item.correct}</strong>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================
             STUDENT INTERFACE: TAKE EXAM OR VIEW SUBMISSION
             ======================================================== */
          <div className="student-exam-interface">
            {mySubmission ? (
              /* ALREADY SUBMITTED VIEW */
              <div className="student-scorecard-container">
                <div className="scorecard-hero">
                  <div className="scorecard-icon">🎓</div>
                  <h3>Exam Completed & Verified</h3>
                  <p>Your examination was committed to the instructor's live ledger.</p>

                  <div className="score-big-display">
                    <span className="big-score">{mySubmission.score} / {mySubmission.totalPossible}</span>
                    <span className={`big-percentage ${mySubmission.passed ? "passed" : "failed"}`}>
                      {mySubmission.percentage}% {mySubmission.passed ? "• Passed" : "• Needs Review"}
                    </span>
                  </div>

                  <div className="scorecard-meta-grid">
                    <div className="meta-box">
                      <span>Continuous Trust</span>
                      <strong>{mySubmission.trustScore || trustScore}/100</strong>
                    </div>
                    <div className="meta-box">
                      <span>Focus Integrity</span>
                      <strong>{mySubmission.violationsCount === 0 ? "100% Focused" : `${mySubmission.violationsCount} Tab Switches`}</strong>
                    </div>
                    <div className="meta-box">
                      <span>Status</span>
                      <strong style={{ color: "#10b981" }}>Delivered to Teacher ✓</strong>
                    </div>
                  </div>

                  <button type="button" onClick={onClose} className="scorecard-done-btn">
                    Return to Live Classroom
                  </button>
                </div>
              </div>
            ) : !activeExam ? (
              /* NO ACTIVE EXAM VIEW */
              <div className="no-exam-waiting-slate">
                <span style={{ fontSize: "36px" }}>⏳</span>
                <h3>No Active Exam At This Moment</h3>
                <p>
                  The teacher has not launched an exam for this session yet.
                  Keep attending the live lecture; when the instructor publishes an exam,
                  it will immediately appear here.
                </p>
                <button type="button" onClick={onClose} className="exam-back-btn">
                  Back to Classroom Stage
                </button>
              </div>
            ) : (
              /* LIVE PROCTORED EXAM TAKING VIEW */
              <div className="student-active-exam-view">
                {/* Progress bar */}
                <div className="exam-progress-bar-container">
                  <div className="progress-info-row">
                    <span>
                      Answered: {Object.keys(selectedAnswers).length} of {currentTotal} questions
                    </span>
                    <span>⏱️ Time Remaining: <strong>{formatTimer(timeLeft)}</strong></span>
                  </div>
                  <div className="exam-progress-track">
                    <div
                      className="exam-progress-fill"
                      style={{
                        width: `${currentTotal > 0 ? (Object.keys(selectedAnswers).length / currentTotal) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>

                {/* Questions Scroll */}
                <div className="exam-questions-scroll">
                  {currentQuestions.map((q, idx) => (
                    <div key={q.id} className="exam-question-card">
                      <div className="exam-q-header">
                        <span className="exam-q-num">Question {idx + 1}</span>
                        <span className="exam-q-pts">1 Point</span>
                      </div>
                      <p className="exam-q-text">{q.text}</p>

                      <div className="exam-options-grid">
                        {q.options.map((opt) => {
                          const isSelected = selectedAnswers[q.id] === opt.key;
                          return (
                            <label
                              key={opt.key}
                              onClick={() => handleSelectAnswer(q.id, opt.key)}
                              className={`exam-option-item ${isSelected ? "selected" : ""}`}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                checked={isSelected}
                                onChange={() => handleSelectAnswer(q.id, opt.key)}
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
                    {trustScore >= (activeExam?.minTrustScore || 70) ? (
                      <span style={{ color: "#10b981", fontSize: "13px" }}>
                        ✓ Continuous Trust meets the {activeExam?.minTrustScore || 70} threshold for exam submission.
                      </span>
                    ) : (
                      <span style={{ color: "#f43f5e", fontSize: "13px" }}>
                        ⚠️ Trust score deficit: {(activeExam?.minTrustScore || 70) - trustScore} points needed to submit.
                      </span>
                    )}
                  </div>

                  <div className="exam-footer-btns">
                    {trustScore < (activeExam?.minTrustScore || 70) && onOpenStepUp && (
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
                      onClick={handleStudentSubmit}
                      disabled={isSubmitting || Object.keys(selectedAnswers).length === 0}
                      className="exam-submit-btn"
                    >
                      {isSubmitting
                        ? "Verifying Ledger..."
                        : `Submit Examination (${Object.keys(selectedAnswers).length}/${currentTotal})`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
