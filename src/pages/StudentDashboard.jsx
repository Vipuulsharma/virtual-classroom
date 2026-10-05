import { Link } from "react-router-dom";
import DashboardNavbar from "../components/DashboardNavbar";

function StudentDashboard() {
  const rawUser = localStorage.getItem("user");
  let user = null;
  try {
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch (e) {
    user = null;
  }

  return (
    <div className="dashboard-page">
      <DashboardNavbar title="Student Portal" role="student" />

      <div className="dashboard-header" style={{ marginTop: "24px" }}>
        <div>
          <h1>Welcome, {user?.name || "Student"}!</h1>
          <p>
            Join and attend your live virtual classes
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <Link to="/profile">
            <button className="secondary-btn" id="student-profile-shortcut">
              👤 My Profile
            </button>
          </Link>
          <Link to="/join-classroom">
            <button className="primary-btn">
              + Join Classroom
            </button>
          </Link>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="dashboard-stat">
          <strong>0</strong>
          <span>Enrolled Classes</span>
        </div>

        <div className="dashboard-stat">
          <strong>0</strong>
          <span>Completed Sessions</span>
        </div>

        <div className="dashboard-stat">
          <strong>100%</strong>
          <span>Attendance Rate</span>
        </div>
      </div>

      <div className="empty-classrooms">
        <h2>No Classes Joined Yet</h2>
        <p>
          Enter your teacher's 6-character classroom code to join or update your student profile.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <Link to="/join-classroom">
            <button className="primary-btn">
              Join Classroom by Code
            </button>
          </Link>
          <Link to="/profile">
            <button className="secondary-btn">
              Customize Profile
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;