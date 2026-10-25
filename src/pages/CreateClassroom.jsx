import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { IconPlus, IconArrowRight, IconHome } from "../components/ModernIcons";

function CreateClassroom() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");

  const handleCreate = (e) => {
    e.preventDefault();

    // Temporary classroom ID
    const classroomId =
      Math.random().toString(36).substring(2, 8).toUpperCase();

    navigate(`/classroom/${classroomId}`, {
      state: {
        title,
        subject,
        role: "teacher"
      }
    });
  };

  return (
    <div className="dashboard-page">
      <div className="classroom-form-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <Link to="/teacher-dashboard" className="back-link-btn">
            <IconHome size={15} />
            <span>Dashboard</span>
          </Link>
          <span className="exam-mode-badge-tag">
            Host Controls Active
          </span>
        </div>

        <h1>Create Classroom</h1>

        <p>
          Create a new virtual classroom with Continuous Trust monitoring and Exam Mode.
        </p>

        <form onSubmit={handleCreate}>
          <label>Classroom Name *</label>
          <input
            type="text"
            placeholder="e.g. Artificial Intelligence"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <label>Subject / Topic *</label>
          <input
            type="text"
            placeholder="e.g. Machine Learning & Ethics"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />

          <button
            type="submit"
            className="auth-button"
            style={{ marginTop: "14px" }}
          >
            <IconPlus size={16} />
            <span>Create & Launch Classroom</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateClassroom;