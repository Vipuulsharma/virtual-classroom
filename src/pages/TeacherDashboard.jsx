import { Link } from "react-router-dom";
import DashboardNavbar from "../components/DashboardNavbar";

function TeacherDashboard() {
  const rawUser = localStorage.getItem("user");
  let user = null;
  try {
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch (e) {
    user = null;
  }

  return (
    <div className="dashboard-page">
      <DashboardNavbar title="Teacher Portal" role="teacher" />

      <div className="dashboard-header" style={{ marginTop: "24px" }}>
        <div>
          <h1>Welcome, {user?.name || "Teacher"}!</h1>
          <p>
            Manage your virtual classrooms and teaching sessions
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <Link to="/profile">
            <button className="secondary-btn" id="teacher-profile-shortcut">
              👤 Edit Profile
            </button>
          </Link>
          <Link to="/create-classroom">
            <button className="primary-btn">
              + Create Classroom
            </button>
          </Link>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="dashboard-stat">
          <strong>0</strong>
          <span>Active Classrooms</span>
        </div>

        <div className="dashboard-stat">
          <strong>0</strong>
          <span>Enrolled Students</span>
        </div>

        <div className="dashboard-stat">
          <strong>0</strong>
          <span>Live Sessions</span>
        </div>
      </div>

      <div className="empty-classrooms">
        <h2>No Classrooms Yet</h2>
        <p>
          Create your first virtual classroom or customize your profile details.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <Link to="/create-classroom">
            <button className="primary-btn">
              Create Your First Classroom
            </button>
          </Link>
          <Link to="/profile">
            <button className="secondary-btn">
              View & Edit Profile
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default TeacherDashboard;