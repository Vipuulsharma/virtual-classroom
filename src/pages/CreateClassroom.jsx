import { useState } from "react";
import { useNavigate } from "react-router-dom";

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

        <h1>Create Classroom</h1>

        <p>
          Create a new virtual classroom for your students.
        </p>

        <form onSubmit={handleCreate}>

          <label>Classroom Name</label>

          <input
            type="text"
            placeholder="e.g. Artificial Intelligence"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <label>Subject</label>

          <input
            type="text"
            placeholder="e.g. Machine Learning"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />

          <button
            type="submit"
            className="auth-button"
          >
            Create Classroom
          </button>

        </form>

      </div>

    </div>
  );
}

export default CreateClassroom;