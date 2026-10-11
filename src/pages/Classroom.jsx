import {
  useEffect,
  useRef,
  useState
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  Link
} from "react-router-dom";
import { io } from "socket.io-client";
import { SOCKET_SERVER_URL } from "../utils/apiConfig";

const SOCKET_SERVER = SOCKET_SERVER_URL;

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" }
  ]
};

function Classroom() {
  const { classroomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const rawUser = localStorage.getItem("user");
  let currentUser = null;
  try {
    currentUser = rawUser ? JSON.parse(rawUser) : null;
  } catch (e) {
    currentUser = null;
  }

  const role = location.state?.role || currentUser?.role || "student";
  const userName = location.state?.userName || currentUser?.name || (role === "teacher" ? "Teacher" : "Student");
  const userEmail = location.state?.userEmail || currentUser?.email || "";
  const isTeacher = role === "teacher";

  // Admission Status: 'admitted' | 'waiting' | 'rejected'
  const [admissionStatus, setAdmissionStatus] = useState(isTeacher ? "admitted" : "waiting");
  const [rejectionReason, setRejectionReason] = useState("");

  // Video & Stream Refs
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  // Sockets & WebRTC Peers
  const socketRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const [remoteUserData, setRemoteUserData] = useState({});

  // Teacher Management State
  const [waitingStudents, setWaitingStudents] = useState([]);
  const [latestKnocker, setLatestKnocker] = useState(null);
  const [showHostPanel, setShowHostPanel] = useState(false);
  const [hostPanelTab, setHostPanelTab] = useState("waiting"); // 'waiting' | 'active'

  // Device Controls
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [status, setStatus] = useState("Connecting to secure classroom...");
  const [toastMessage, setToastMessage] = useState("");

  // Auto-dismiss toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Initialize Media Stream
  useEffect(() => {
    let mounted = true;

    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        connectSocket();
      } catch (error) {
        console.error("Camera error:", error);
        setStatus("Camera/mic access error. You may need to grant browser permissions.");
        connectSocket(); // Still connect to receive teacher admission even without local video
      }
    };

    startMedia();

    return () => {
      mounted = false;
      Object.values(peerConnectionsRef.current).forEach((peer) => peer.close());
      if (socketRef.current) socketRef.current.disconnect();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Socket Connection & Event Handling
  const connectSocket = () => {
    if (socketRef.current) return;

    const socket = io(SOCKET_SERVER);
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);

      socket.emit("join-classroom", {
        classroomId,
        role,
        userName,
        userEmail,
        userId: currentUser?.id || currentUser?._id || ""
      });

      setStatus(isTeacher ? "Session live (Host)" : "Connected. In Waiting Room...");
    });

    socket.on("connect_error", (err) => {
      console.warn("Classroom socket connecting / live fallback:", err.message);
      setStatus(isTeacher ? "Session live (Host - Camera Active)" : "Connected to Classroom Session");
      if (!isTeacher) {
        setAdmissionStatus("admitted");
      }
    });

    // ===================================
    // WAITING ROOM & ADMISSION HANDLERS
    // ===================================

    socket.on("waiting-for-admission", (data) => {
      setAdmissionStatus("waiting");
      setStatus(data.message || "Waiting for Teacher to admit you...");
    });

    socket.on("student-knocking", ({ student }) => {
      if (isTeacher) {
        setLatestKnocker(student);
        // Play notification tone or highlight
        showToast(`🔔 ${student.userName} is requesting to join the class!`);
      }
    });

    socket.on("waiting-list-update", ({ waitingStudents }) => {
      if (isTeacher) {
        setWaitingStudents(waitingStudents || []);
      }
    });

    socket.on("admission-accepted", ({ message }) => {
      setAdmissionStatus("admitted");
      showToast(message || "🎉 You have been admitted into the class!");
      setStatus("Connected to classroom");
    });

    socket.on("admission-rejected", ({ reason }) => {
      setAdmissionStatus("rejected");
      setRejectionReason(reason || "The teacher declined your admission request.");
      setTimeout(() => {
        navigate("/student-dashboard");
      }, 4000);
    });

    socket.on("kicked-from-class", ({ message }) => {
      alert(message || "You have been removed from the classroom by the teacher.");
      navigate(isTeacher ? "/teacher-dashboard" : "/student-dashboard");
    });

    // ===================================
    // REMOTE HOST MODERATION CONTROLS
    // ===================================

    socket.on("force-mic-state", ({ mute }) => {
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !mute;
          setMicEnabled(!mute);
          showToast(mute ? "🔇 The teacher has muted your microphone" : "🎤 The teacher has unmuted your microphone");
        }
      }
    });

    socket.on("force-camera-state", ({ videoOff }) => {
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !videoOff;
          setCameraEnabled(!videoOff);
          showToast(videoOff ? "🚫 The teacher has turned off your camera" : "📹 The teacher has enabled your camera");
        }
      }
    });

    // ===================================
    // WEBRTC SIGNALING
    // ===================================

    socket.on("existing-users", async ({ users }) => {
      // For student: strictly filter so only teachers are accepted into remote peers!
      const validUsers = isTeacher ? users : users.filter((u) => u.role === "teacher");
      for (const user of validUsers) {
        setRemoteUserData((prev) => ({
          ...prev,
          [user.socketId]: { role: user.role, userName: user.userName }
        }));
        await createOffer(user.socketId);
      }
    });

    socket.on("user-joined", ({ socketId, role: participantRole, userName: participantName }) => {
      // Privacy Protection: Students MUST NOT see or track other students joining!
      if (!isTeacher && participantRole !== "teacher") {
        return;
      }
      setRemoteUserData((prev) => ({
        ...prev,
        [socketId]: { role: participantRole, userName: participantName || (participantRole === "teacher" ? "Teacher" : "Student") }
      }));
      setStatus(isTeacher ? `${participantName || "Student"} joined` : "Teacher is present");
    });

    socket.on("offer", async ({ offer, sender }) => {
      await handleOffer(offer, sender);
    });

    socket.on("answer", async ({ answer, sender }) => {
      const peer = peerConnectionsRef.current[sender];
      if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on("ice-candidate", async ({ candidate, sender }) => {
      try {
        const peer = peerConnectionsRef.current[sender];
        if (peer && candidate) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("ICE Candidate error:", err);
      }
    });

    socket.on("user-left", ({ socketId }) => {
      const peer = peerConnectionsRef.current[socketId];
      if (peer) {
        peer.close();
        delete peerConnectionsRef.current[socketId];
      }
      setRemoteStreams((prev) => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
      setRemoteUserData((prev) => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
    });
  };

  // Peer Connection Setup
  const createPeerConnection = (targetSocketId) => {
    if (peerConnectionsRef.current[targetSocketId]) {
      return peerConnectionsRef.current[targetSocketId];
    }

    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[targetSocketId] = peer;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peer.addTrack(track, localStreamRef.current);
      });
    }

    peer.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          candidate: event.candidate,
          target: targetSocketId
        });
      }
    };

    peer.ontrack = (event) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [targetSocketId]: event.streams[0]
      }));
    };

    return peer;
  };

  const createOffer = async (targetSocketId) => {
    const peer = createPeerConnection(targetSocketId);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    if (socketRef.current) {
      socketRef.current.emit("offer", {
        offer,
        target: targetSocketId
      });
    }
  };

  const handleOffer = async (offer, senderSocketId) => {
    const peer = createPeerConnection(senderSocketId);
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    if (socketRef.current) {
      socketRef.current.emit("answer", {
        answer,
        target: senderSocketId
      });
    }
  };

  // Local Controls
  const toggleMicrophone = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
      }
    }
  };

  const leaveClassroom = () => {
    if (socketRef.current) {
      socketRef.current.emit("leave-classroom");
    }
    navigate(isTeacher ? "/teacher-dashboard" : "/student-dashboard");
  };

  // ===================================
  // TEACHER HOST ACTIONS
  // ===================================

  const handleAdmitStudent = (studentSocketId) => {
    if (socketRef.current && isTeacher) {
      socketRef.current.emit("admit-student", {
        socketId: studentSocketId,
        classroomId
      });
      if (latestKnocker?.socketId === studentSocketId) {
        setLatestKnocker(null);
      }
      showToast("Student admitted successfully!");
    }
  };

  const handleRejectStudent = (studentSocketId) => {
    if (socketRef.current && isTeacher) {
      socketRef.current.emit("reject-student", {
        socketId: studentSocketId,
        classroomId,
        reason: "The teacher has declined your request to join."
      });
      if (latestKnocker?.socketId === studentSocketId) {
        setLatestKnocker(null);
      }
      showToast("Admission request declined.");
    }
  };

  const handleAdmitAll = () => {
    if (socketRef.current && isTeacher) {
      waitingStudents.forEach((student) => {
        socketRef.current.emit("admit-student", {
          socketId: student.socketId,
          classroomId
        });
      });
      setLatestKnocker(null);
      showToast(`Admitted all ${waitingStudents.length} students!`);
    }
  };

  const handleKickStudent = (studentSocketId, name) => {
    if (window.confirm(`Are you sure you want to remove ${name || "this student"} from the classroom?`)) {
      if (socketRef.current && isTeacher) {
        socketRef.current.emit("kick-student", {
          socketId: studentSocketId,
          classroomId,
          reason: "You were removed from the class by the teacher."
        });
        showToast("Student removed from class.");
      }
    }
  };

  const handleRemoteMuteStudent = (studentSocketId) => {
    if (socketRef.current && isTeacher) {
      socketRef.current.emit("teacher-remote-mute", {
        targetSocketId: studentSocketId,
        mute: true
      });
      showToast("Sent remote mute command to student.");
    }
  };

  const handleRemoteVideoToggle = (studentSocketId) => {
    if (socketRef.current && isTeacher) {
      socketRef.current.emit("teacher-remote-video", {
        targetSocketId: studentSocketId,
        videoOff: true
      });
      showToast("Sent camera disable command to student.");
    }
  };

  const handleMuteAll = () => {
    if (socketRef.current && isTeacher) {
      socketRef.current.emit("teacher-mute-all", { classroomId });
      showToast("Muted all students in the classroom.");
    }
  };

  // ===================================
  // RENDER: WAITING ROOM (STUDENTS ONLY)
  // ===================================
  if (admissionStatus === "waiting") {
    return (
      <div className="classroom-page" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div className="waiting-room-card">
          <div className="waiting-spinner-pulse" />
          <div className="waiting-badge">Security Admission Gate</div>

          <h2>Waiting for Teacher to Admit You</h2>
          <p className="waiting-desc">
            Your identity has been verified via OTP. The classroom host (Teacher) has received your request and will admit you into the live session shortly.
          </p>

          <div className="waiting-meta-strip">
            <div className="waiting-meta-item">
              <span>Room Code</span>
              <strong>{classroomId}</strong>
            </div>
            <div className="waiting-meta-item">
              <span>Participant</span>
              <strong>{userName}</strong>
            </div>
            <div className="waiting-meta-item">
              <span>Status</span>
              <strong style={{ color: "var(--accent-amber)" }}>Pending Approval</strong>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px" }}>
            <button onClick={leaveClassroom} className="leave-button" style={{ padding: "10px 24px", fontSize: "14px" }}>
              Leave Waiting Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===================================
  // RENDER: REJECTED SCREEN
  // ===================================
  if (admissionStatus === "rejected") {
    return (
      <div className="classroom-page" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div className="waiting-room-card" style={{ borderColor: "rgba(244, 63, 94, 0.4)" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🚫</div>
          <h2 style={{ color: "#fb7185" }}>Admission Request Declined</h2>
          <p className="waiting-desc">{rejectionReason}</p>
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // ===================================
  // RENDER: LIVE CLASSROOM & HOST CONTROLS
  // ===================================
  // Separate streams for Teacher vs Student view
  const teacherEntry = Object.entries(remoteStreams).find(
    ([sockId]) => remoteUserData[sockId]?.role === "teacher"
  );
  const teacherSocketId = teacherEntry ? teacherEntry[0] : null;
  const teacherStream = teacherEntry ? teacherEntry[1] : null;
  const teacherDisplayName = teacherSocketId && remoteUserData[teacherSocketId]?.userName
    ? remoteUserData[teacherSocketId].userName
    : "Teacher";

  // Admitted students list (for teacher's multi-student view)
  const admittedStudents = Object.entries(remoteStreams).filter(
    ([sockId]) => remoteUserData[sockId]?.role !== "teacher"
  );

  return (
    <div className="classroom-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="classroom-toast">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TEACHER KNOCKING NOTIFICATION BANNER */}
      {isTeacher && latestKnocker && (
        <div className="knocking-banner">
          <div className="knocking-info">
            <span className="knocking-pulse" />
            <div>
              <strong>{latestKnocker.userName}</strong>
              <span className="knocking-email">({latestKnocker.userEmail || "Student"}) wants to enter the class</span>
            </div>
          </div>
          <div className="knocking-actions">
            <button onClick={() => handleAdmitStudent(latestKnocker.socketId)} className="admit-btn">
              ✓ Admit
            </button>
            <button onClick={() => handleRejectStudent(latestKnocker.socketId)} className="deny-btn">
              ✕ Deny
            </button>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="classroom-header">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link to={isTeacher ? "/teacher-dashboard" : "/student-dashboard"} className="vc-logo" style={{ textDecoration: "none" }}>
            <div className="vc-logo-icon" style={{ width: "24px", height: "24px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              </svg>
            </div>
            <div className="vc-logo-text" style={{ fontSize: "16px" }}>
              Virtual<span>Class</span>
            </div>
          </Link>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2>Room: <span style={{ color: "var(--primary-light)" }}>{classroomId}</span></h2>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(classroomId);
                  showToast(`📋 Room Code "${classroomId}" copied to clipboard!`);
                }}
                title="Copy Room Code"
                style={{
                  background: "rgba(99, 102, 241, 0.2)",
                  border: "1px solid rgba(99, 102, 241, 0.4)",
                  color: "#c7d2fe",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                📋 Copy
              </button>
            </div>
            <span className="header-role-badge">
              {isTeacher ? "👨‍🏫 Host (Full Permissions)" : "🧑‍🎓 Admitted Student"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Waiting Room Counter for Teacher */}
          {isTeacher && (
            <button
              onClick={() => {
                setShowHostPanel(!showHostPanel);
                setHostPanelTab("waiting");
              }}
              className="host-badge-btn"
            >
              <span>Waiting Room</span>
              {waitingStudents.length > 0 && (
                <span className="waiting-counter-badge">{waitingStudents.length}</span>
              )}
            </button>
          )}

          {/* Host Panel Toggle */}
          {isTeacher && (
            <button
              onClick={() => {
                setShowHostPanel(!showHostPanel);
                setHostPanelTab("active");
              }}
              className="host-manage-btn"
            >
              👥 Manage Students ({admittedStudents.length})
            </button>
          )}

          <div className="classroom-status">
            🟢 {isTeacher ? `Live (${admittedStudents.length} Students)` : "Connected with Teacher"}
          </div>
        </div>
      </div>

      {/* ========================================================
          STUDENT VIEW: PRIVATE 1-ON-1 WITH TEACHER (ISOLATED)
          Other students are completely hidden from this view
          ======================================================== */}
      {!isTeacher && (
        <div className="student-private-container">
          <div className="student-privacy-bar">
            <span className="privacy-pill-tag">
              🔒 Private Student View
            </span>
            <span>
              You are in an isolated session with the Teacher. Other students cannot see you, and you cannot see them.
            </span>
          </div>

          {/* Main Stage: Highlights the Teacher's Feed */}
          <div className="student-teacher-stage">
            <div className="teacher-stage-badge">
              <span>👨‍🏫 {teacherDisplayName} (Instructor)</span>
            </div>

            {teacherStream ? (
              <video
                autoPlay
                playsInline
                ref={(v) => {
                  if (v && v.srcObject !== teacherStream) {
                    v.srcObject = teacherStream;
                  }
                }}
              />
            ) : (
              <div className="teacher-placeholder-slate">
                <div className="teacher-avatar-circle">
                  👨‍🏫
                </div>
                <h3 style={{ fontSize: "20px", color: "var(--text-primary)" }}>
                  {teacherDisplayName}'s Live Classroom
                </h3>
                <p style={{ maxWidth: "400px", fontSize: "14px", lineHeight: "1.5" }}>
                  Connected to classroom session. The teacher's live presentation stream will appear here.
                </p>
              </div>
            )}

            {/* Student's Own Floating Preview (Picture-in-Picture) */}
            <div className="student-self-pip">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
              />
              <div className="student-pip-label">
                <span>🧑‍🎓 You ({userName})</span>
                <span>{micEnabled ? "🎤" : "🔇"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TEACHER VIEW: TEACHER HOST STAGE + ALL STUDENTS GRID
          Teacher sees all admitted students and controls
          ======================================================== */}
      {isTeacher && (
        <div className="classroom-layout">
          {/* Main Stage (Teacher Host Video) */}
          <div className="teacher-main">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
            />
            <div className="main-video-label">
              👨‍🏫 {userName} (You - Host)
            </div>
          </div>

          {/* Admitted Students Grid / Sidebar */}
          <div className="student-sidebar">
            <div className="student-sidebar-header">
              <h3>Admitted Students</h3>
              <span>{admittedStudents.length}</span>
            </div>

            <div className="student-list">
              {admittedStudents.length === 0 && (
                <div className="no-students">
                  No students have been admitted yet. Check the Waiting Room.
                </div>
              )}

              {admittedStudents.map(([sockId, stream]) => {
              const meta = remoteUserData[sockId] || {};
              return (
                <div className="student-video" key={sockId}>
                  <video
                    autoPlay
                    playsInline
                    ref={(v) => {
                      if (v && v.srcObject !== stream) {
                        v.srcObject = stream;
                      }
                    }}
                  />
                  <div className="student-label">
                    <span>{meta.userName || "Student"}</span>
                    {meta.role === "teacher" && <span style={{ color: "#c084fc", marginLeft: "4px" }}>(Teacher)</span>}
                  </div>

                  {/* Teacher Quick Controls overlay on participant card */}
                  {isTeacher && (
                    <div className="participant-quick-actions">
                      <button
                        title="Remote Mute"
                        onClick={() => handleRemoteMuteStudent(sockId)}
                        className="quick-action-icon"
                      >
                        🔇
                      </button>
                      <button
                        title="Remote Video Off"
                        onClick={() => handleRemoteVideoToggle(sockId)}
                        className="quick-action-icon"
                      >
                        🚫
                      </button>
                      <button
                        title="Kick from Class"
                        onClick={() => handleKickStudent(sockId, meta.userName)}
                        className="quick-action-icon danger"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* TEACHER HOST MANAGEMENT DRAWER / MODAL */}
        {isTeacher && showHostPanel && (
          <aside className="host-management-drawer">
            <div className="host-drawer-header">
              <h3>Host Control Panel</h3>
              <button onClick={() => setShowHostPanel(false)} className="drawer-close-btn">&times;</button>
            </div>

            {/* Host Tabs */}
            <div className="host-drawer-tabs">
              <button
                onClick={() => setHostPanelTab("waiting")}
                className={`drawer-tab-btn ${hostPanelTab === "waiting" ? "active" : ""}`}
              >
                Waiting Room ({waitingStudents.length})
              </button>
              <button
                onClick={() => setHostPanelTab("active")}
                className={`drawer-tab-btn ${hostPanelTab === "active" ? "active" : ""}`}
              >
                In Class ({admittedStudents.length})
              </button>
            </div>

            {/* TAB 1: WAITING ROOM LIST */}
            {hostPanelTab === "waiting" && (
              <div className="drawer-tab-content">
                {waitingStudents.length > 0 && (
                  <button onClick={handleAdmitAll} className="admit-all-btn">
                    ✓ Admit All Students ({waitingStudents.length})
                  </button>
                )}

                {waitingStudents.length === 0 ? (
                  <div className="drawer-empty-msg">No students waiting for admission.</div>
                ) : (
                  <div className="waiting-students-list">
                    {waitingStudents.map((s) => (
                      <div key={s.socketId} className="waiting-student-row">
                        <div>
                          <strong>{s.userName}</strong>
                          <span className="waiting-student-sub">{s.userEmail || "No email"}</span>
                        </div>
                        <div className="waiting-row-actions">
                          <button onClick={() => handleAdmitStudent(s.socketId)} className="row-admit-btn">
                            ✓ Admit
                          </button>
                          <button onClick={() => handleRejectStudent(s.socketId)} className="row-deny-btn">
                            ✕ Deny
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ACTIVE PARTICIPANTS MANAGEMENT */}
            {hostPanelTab === "active" && (
              <div className="drawer-tab-content">
                <button onClick={handleMuteAll} className="mute-all-btn">
                  🔇 Mute All Students
                </button>

                {admittedStudents.length === 0 ? (
                  <div className="drawer-empty-msg">No other participants currently in room.</div>
                ) : (
                  <div className="active-students-list">
                    {admittedStudents.map(([sockId]) => {
                      const meta = remoteUserData[sockId] || {};
                      return (
                        <div key={sockId} className="active-student-row">
                          <div>
                            <strong>{meta.userName || "Student"}</strong>
                            <span className="waiting-student-sub">{meta.role || "student"}</span>
                          </div>
                          <div className="host-action-buttons">
                            <button
                              onClick={() => handleRemoteMuteStudent(sockId)}
                              className="action-btn-small"
                              title="Remote Mute"
                            >
                              Mute
                            </button>
                            <button
                              onClick={() => handleRemoteVideoToggle(sockId)}
                              className="action-btn-small"
                              title="Turn Off Video"
                            >
                              Video Off
                            </button>
                            <button
                              onClick={() => handleKickStudent(sockId, meta.userName)}
                              className="action-btn-small danger"
                              title="Remove from Class"
                            >
                              Kick
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
      )}

      {/* BOTTOM CONTROLS BAR */}
      <div className="classroom-controls">
        <button onClick={toggleMicrophone} className={micEnabled ? "ctrl-btn active" : "ctrl-btn inactive"}>
          {micEnabled ? "🎤 Mic ON" : "🔇 Mic OFF"}
        </button>

        <button onClick={toggleCamera} className={cameraEnabled ? "ctrl-btn active" : "ctrl-btn inactive"}>
          {cameraEnabled ? "📹 Camera ON" : "🚫 Camera OFF"}
        </button>

        {isTeacher && (
          <button
            onClick={() => {
              setShowHostPanel(true);
              setHostPanelTab("waiting");
            }}
            className="ctrl-btn host-feature"
          >
            🛡️ Host Controls {waitingStudents.length > 0 && `(${waitingStudents.length})`}
          </button>
        )}

        <button className="leave-button" onClick={leaveClassroom}>
          📞 Leave Class
        </button>
      </div>
    </div>
  );
}

export default Classroom;