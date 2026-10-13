import {
  useEffect,
  useRef,
  useState,
  useCallback
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  Link
} from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";
import {
  getApiBaseUrl,
  getSocketServerUrl,
  checkBackendHealth
} from "../utils/apiConfig";
import BackendConfigModal from "../components/BackendConfigModal";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" }
  ]
};

function Classroom() {
  const { classroomId } = useParams();
  const cleanClassroomId = (classroomId || "").trim().toUpperCase();
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

  // Backend Modal & Server Online Status
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [serverOnline, setServerOnline] = useState(null);

  // Video & Stream Refs
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  // Sockets & WebRTC Peers
  const socketRef = useRef(null);
  const broadcastChannelRef = useRef(null);
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
    setTimeout(() => setToastMessage(""), 4500);
  };

  // Check backend server health on mount & wake up Render instance
  const checkHealth = useCallback(async () => {
    try {
      const res = await checkBackendHealth();
      setServerOnline(res.online);
    } catch (e) {
      setServerOnline(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Dual-channel knock execution for student
  const executeStudentKnock = useCallback(async () => {
    if (isTeacher) return;

    // 1. WebSocket Knock
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("join-classroom", {
        classroomId: cleanClassroomId,
        role: "student",
        userName,
        userEmail,
        userId: currentUser?.id || currentUser?._id || ""
      });
    }

    // 2. HTTP Knock Fallback
    const backend = getApiBaseUrl();
    if (backend) {
      try {
        await axios.post(
          `${backend}/api/classrooms/${cleanClassroomId}/knock`,
          {
            classroomId: cleanClassroomId,
            userName,
            userEmail,
            userId: currentUser?.id || currentUser?._id || "",
            socketId: socketRef.current?.id || ""
          },
          { timeout: 4500 }
        );
      } catch (err) {
        console.warn("HTTP knock fallback notice:", err.message);
      }
    }

    // 3. LocalStorage registration for same-device/tab testing
    try {
      const existing = JSON.parse(localStorage.getItem(`vc_waiting_${cleanClassroomId}`) || "[]");
      const record = {
        socketId: socketRef.current?.id || `local_${Date.now()}`,
        userName,
        userEmail,
        userId: currentUser?.id || currentUser?._id || "",
        joinedAt: new Date().toISOString(),
        status: "waiting"
      };
      const filtered = existing.filter((s) => (userEmail && s.userEmail === userEmail) ? false : (s.userName !== userName));
      filtered.push(record);
      localStorage.setItem(`vc_waiting_${cleanClassroomId}`, JSON.stringify(filtered));
    } catch (e) {}

    // 4. Cross-tab BroadcastChannel
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: "student-knocking",
        student: {
          socketId: socketRef.current?.id || `local_${Date.now()}`,
          userName,
          userEmail,
          userId: currentUser?.id || ""
        }
      });
    }
  }, [cleanClassroomId, isTeacher, userName, userEmail, currentUser]);

  // Cross-tab Synchronization (Native BroadcastChannel fallback)
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.BroadcastChannel) {
        const ch = new BroadcastChannel(`vc_room_${cleanClassroomId}`);
        broadcastChannelRef.current = ch;
        ch.onmessage = (event) => {
          const data = event.data;
          if (!data) return;

          if (isTeacher && data.type === "student-knocking") {
            setLatestKnocker(data.student);
            setWaitingStudents((prev) => {
              const filtered = prev.filter((s) => s.socketId !== data.student.socketId);
              return [...filtered, data.student];
            });
            showToast(`🔔 ${data.student.userName} is requesting to join the class!`);
          }

          if (!isTeacher && (data.type === "admission-accepted" || data.type === "admission-accepted-all")) {
            if (
              data.type === "admission-accepted-all" ||
              data.studentId === socketRef.current?.id ||
              (data.studentEmail && data.studentEmail.toLowerCase() === (userEmail || "").toLowerCase()) ||
              data.studentName === userName
            ) {
              setAdmissionStatus("admitted");
              showToast("🎉 The Teacher has admitted you into the classroom!");
            }
          }
        };

        return () => {
          ch.close();
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel error:", e);
    }
  }, [cleanClassroomId, isTeacher, userEmail, userName]);

  // Socket Connection & Event Handling
  const connectSocket = useCallback((force = false) => {
    if (!force && socketRef.current && socketRef.current.connected) return;

    if (socketRef.current) {
      try {
        socketRef.current.disconnect();
      } catch (e) {}
      socketRef.current = null;
    }

    const socketUrl = getSocketServerUrl();
    if (!socketUrl) {
      console.warn("Classroom: No socket server URL configured.");
      setStatus(isTeacher ? "Session live (Host - Offline Mode)" : "In Waiting Room (Local)");
      return;
    }

    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      timeout: 10000,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      setServerOnline(true);

      socket.emit("join-classroom", {
        classroomId: cleanClassroomId,
        role,
        userName,
        userEmail,
        userId: currentUser?.id || currentUser?._id || ""
      });

      setStatus(isTeacher ? "Session live (Host)" : "Connected. In Waiting Room...");

      // If student, trigger dual knock
      if (!isTeacher) {
        executeStudentKnock();
      }
    });

    socket.on("connect_error", (err) => {
      console.warn("Classroom socket connecting / fallback:", err.message);
      setServerOnline(false);
      setStatus(isTeacher ? "Session live (Host - Fallback Sync Active)" : "Waiting Room (Fallback Sync Active)");
      if (!isTeacher) {
        executeStudentKnock();
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
      if (isTeacher && student) {
        setLatestKnocker(student);
        setWaitingStudents((prev) => {
          const filtered = prev.filter((s) => s.socketId !== student.socketId && (!student.userEmail || s.userEmail !== student.userEmail));
          return [...filtered, student];
        });
        showToast(`🔔 ${student.userName} is requesting to join the class!`);
      }
    });

    socket.on("waiting-list-update", ({ waitingStudents: list }) => {
      if (isTeacher) {
        const validList = list || [];
        setWaitingStudents(validList);
        if (validList.length > 0) {
          setLatestKnocker((prev) => {
            if (!prev || !validList.some((s) => s.socketId === prev.socketId)) {
              return validList[validList.length - 1];
            }
            return prev;
          });
        } else {
          setLatestKnocker(null);
        }
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
      const validUsers = isTeacher ? users : (users || []).filter((u) => u.role === "teacher");
      for (const user of validUsers) {
        setRemoteUserData((prev) => ({
          ...prev,
          [user.socketId]: { role: user.role, userName: user.userName }
        }));
        await createOffer(user.socketId);
      }
    });

    socket.on("user-joined", ({ socketId, role: participantRole, userName: participantName }) => {
      if (!isTeacher && participantRole !== "teacher") {
        return;
      }
      setRemoteUserData((prev) => ({
        ...prev,
        [socketId]: {
          role: participantRole,
          userName: participantName || (participantRole === "teacher" ? "Teacher" : "Student")
        }
      }));
      setWaitingStudents((prev) => prev.filter((s) => s.socketId !== socketId));
      setLatestKnocker((prev) => (prev?.socketId === socketId ? null : prev));

      setStatus(isTeacher ? `${participantName || "Student"} joined` : "Teacher is present");
      if (isTeacher) {
        showToast(`🎉 ${participantName || "Student"} has joined the classroom!`);
      }
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
  }, [cleanClassroomId, role, userName, userEmail, currentUser, isTeacher, executeStudentKnock, navigate]);

  // Listen to backend URL change event
  useEffect(() => {
    const handleUrlChange = () => {
      checkHealth();
      connectSocket(true);
    };
    window.addEventListener("vc_backend_url_changed", handleUrlChange);
    return () => window.removeEventListener("vc_backend_url_changed", handleUrlChange);
  }, [checkHealth, connectSocket]);

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
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [connectSocket]);

  // ===================================
  // DUAL-CHANNEL POLLING LOOPS
  // ===================================

  // 1. Student Active Admission Status Polling
  useEffect(() => {
    if (isTeacher || admissionStatus === "admitted") return;

    // Immediately trigger student knock
    executeStudentKnock();

    const checkStudentStatus = async () => {
      // Check 1: localStorage for admission
      try {
        const studentKey = userEmail ? userEmail.toLowerCase() : userName;
        const localAdmitted =
          localStorage.getItem(`vc_admitted_${cleanClassroomId}_${studentKey}`) ||
          localStorage.getItem(`vc_admitted_${cleanClassroomId}_${userEmail}`) ||
          localStorage.getItem(`vc_admitted_${cleanClassroomId}_${userName}`);

        if (localAdmitted) {
          setAdmissionStatus("admitted");
          showToast("🎉 The Teacher has admitted you into the classroom!");
          return;
        }

        const localRejected = localStorage.getItem(`vc_rejected_${cleanClassroomId}_${studentKey}`);
        if (localRejected) {
          setAdmissionStatus("rejected");
          setRejectionReason("The teacher declined your admission request.");
          return;
        }
      } catch (e) {}

      // Check 2: HTTP status on backend
      const backend = getApiBaseUrl();
      if (backend) {
        try {
          const res = await axios.get(`${backend}/api/classrooms/${cleanClassroomId}/student-status`, {
            params: {
              email: userEmail,
              userId: currentUser?.id || currentUser?._id || "",
              socketId: socketRef.current?.id || "",
              userName
            },
            timeout: 3000
          });

          if (res.data?.status === "admitted") {
            setAdmissionStatus("admitted");
            showToast("🎉 The Teacher has admitted you into the classroom!");
          } else if (res.data?.status === "rejected") {
            setAdmissionStatus("rejected");
            setRejectionReason(res.data?.reason || "The teacher declined your admission request.");
          }
        } catch (e) {}
      }

      // Check 3: If socket is connected, keep server waiting room state warm
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("join-classroom", {
          classroomId: cleanClassroomId,
          role: "student",
          userName,
          userEmail,
          userId: currentUser?.id || currentUser?._id || ""
        });
      }
    };

    const interval = setInterval(checkStudentStatus, 2500);
    return () => clearInterval(interval);
  }, [cleanClassroomId, isTeacher, admissionStatus, userEmail, userName, currentUser, executeStudentKnock]);

  // 2. Teacher Active Waiting List Polling
  useEffect(() => {
    if (!isTeacher) return;

    const pollWaitingStudents = async () => {
      let combined = [];

      // 1. LocalStorage sync
      try {
        const localRaw = localStorage.getItem(`vc_waiting_${cleanClassroomId}`);
        if (localRaw) {
          const list = JSON.parse(localRaw);
          if (Array.isArray(list)) {
            list.forEach((item) => {
              if (item && item.userName) {
                combined.push(item);
              }
            });
          }
        }
      } catch (e) {}

      // 2. HTTP waiting list sync
      const backend = getApiBaseUrl();
      if (backend) {
        try {
          const res = await axios.get(`${backend}/api/classrooms/${cleanClassroomId}/waiting-list`, { timeout: 3000 });
          if (res.data?.success && Array.isArray(res.data.waitingStudents)) {
            res.data.waitingStudents.forEach((item) => {
              if (!combined.some((s) => s.socketId === item.socketId || (s.userEmail && item.userEmail && s.userEmail.toLowerCase() === item.userEmail.toLowerCase()))) {
                combined.push(item);
              }
            });
          }
        } catch (e) {}
      }

      // Filter out any already admitted students
      combined = combined.filter((s) => {
        const studentKey = s.userEmail ? s.userEmail.toLowerCase() : s.userName;
        const isAdmitted =
          localStorage.getItem(`vc_admitted_${cleanClassroomId}_${studentKey}`) ||
          remoteUserData[s.socketId];
        return !isAdmitted;
      });

      setWaitingStudents((prev) => {
        const merged = [...prev];
        combined.forEach((item) => {
          if (!merged.some((s) => s.socketId === item.socketId || (s.userEmail && item.userEmail && s.userEmail.toLowerCase() === item.userEmail.toLowerCase()))) {
            merged.push(item);
          }
        });
        return merged;
      });

      if (combined.length > 0) {
        setLatestKnocker((prev) => {
          if (!prev || !combined.some((s) => s.socketId === prev.socketId)) {
            return combined[combined.length - 1];
          }
          return prev;
        });
      }
    };

    const interval = setInterval(pollWaitingStudents, 2500);
    pollWaitingStudents();
    return () => clearInterval(interval);
  }, [cleanClassroomId, isTeacher, remoteUserData]);

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
    if (isTeacher) {
      const admittedStudent = waitingStudents.find((s) => s.socketId === studentSocketId) || latestKnocker;
      const sEmail = admittedStudent?.userEmail || "";
      const sId = admittedStudent?.userId || "";
      const sName = admittedStudent?.userName || "Student";

      // 1. Socket emit
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("admit-student", {
          socketId: studentSocketId,
          studentEmail: sEmail,
          studentId: sId,
          studentName: sName,
          classroomId: cleanClassroomId
        });
      }

      // 2. HTTP admit fallback
      const backend = getApiBaseUrl();
      if (backend) {
        axios.post(`${backend}/api/classrooms/${cleanClassroomId}/admit`, {
          socketId: studentSocketId,
          studentEmail: sEmail,
          studentId: sId,
          studentName: sName
        }).catch((e) => console.warn("HTTP admit fallback:", e.message));
      }

      // 3. LocalStorage persistence for same-browser/device testing
      try {
        const studentKey = sEmail ? sEmail.toLowerCase() : sName;
        localStorage.setItem(`vc_admitted_${cleanClassroomId}_${studentKey}`, JSON.stringify({ status: "admitted", timestamp: Date.now() }));
        if (sEmail) {
          localStorage.setItem(`vc_admitted_${cleanClassroomId}_${sEmail.toLowerCase()}`, JSON.stringify({ status: "admitted", timestamp: Date.now() }));
        }
        const currentWaiting = JSON.parse(localStorage.getItem(`vc_waiting_${cleanClassroomId}`) || "[]");
        const remaining = currentWaiting.filter((s) => s.socketId !== studentSocketId && (!sEmail || s.userEmail !== sEmail));
        localStorage.setItem(`vc_waiting_${cleanClassroomId}`, JSON.stringify(remaining));
      } catch (e) {}

      // 4. Cross-tab BroadcastChannel
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: "admission-accepted",
          studentId: studentSocketId,
          studentEmail: sEmail,
          studentName: sName
        });
      }

      // 5. Optimistically add to remoteUserData so student appears immediately
      if (admittedStudent) {
        setRemoteUserData((prev) => ({
          ...prev,
          [studentSocketId]: {
            role: "student",
            userName: sName,
            userEmail: sEmail
          }
        }));
      }

      setWaitingStudents((prev) => prev.filter((s) => s.socketId !== studentSocketId && (!sEmail || s.userEmail !== sEmail)));
      if (latestKnocker?.socketId === studentSocketId || (sEmail && latestKnocker?.userEmail === sEmail)) {
        setLatestKnocker(null);
      }
      showToast(`🎉 Admitted ${sName} into the classroom!`);
    }
  };

  const handleRejectStudent = (studentSocketId) => {
    if (isTeacher) {
      const rejectedStudent = waitingStudents.find((s) => s.socketId === studentSocketId) || latestKnocker;
      const sEmail = rejectedStudent?.userEmail || "";
      const sId = rejectedStudent?.userId || "";
      const sName = rejectedStudent?.userName || "Student";

      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("reject-student", {
          socketId: studentSocketId,
          studentEmail: sEmail,
          studentId: sId,
          studentName: sName,
          classroomId: cleanClassroomId,
          reason: "The teacher has declined your request to join."
        });
      }

      const backend = getApiBaseUrl();
      if (backend) {
        axios.post(`${backend}/api/classrooms/${cleanClassroomId}/reject`, {
          socketId: studentSocketId,
          studentEmail: sEmail,
          studentId: sId,
          reason: "The teacher has declined your request to join."
        }).catch((e) => console.warn("HTTP reject fallback:", e.message));
      }

      try {
        const studentKey = sEmail ? sEmail.toLowerCase() : sName;
        localStorage.setItem(`vc_rejected_${cleanClassroomId}_${studentKey}`, JSON.stringify({ status: "rejected", timestamp: Date.now() }));
        const currentWaiting = JSON.parse(localStorage.getItem(`vc_waiting_${cleanClassroomId}`) || "[]");
        const remaining = currentWaiting.filter((s) => s.socketId !== studentSocketId && (!sEmail || s.userEmail !== sEmail));
        localStorage.setItem(`vc_waiting_${cleanClassroomId}`, JSON.stringify(remaining));
      } catch (e) {}

      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: "admission-rejected",
          studentId: studentSocketId,
          studentEmail: sEmail,
          reason: "The teacher has declined your request to join."
        });
      }

      setWaitingStudents((prev) => prev.filter((s) => s.socketId !== studentSocketId && (!sEmail || s.userEmail !== sEmail)));
      if (latestKnocker?.socketId === studentSocketId || (sEmail && latestKnocker?.userEmail === sEmail)) {
        setLatestKnocker(null);
      }
      showToast("Admission request declined.");
    }
  };

  const handleAdmitAll = () => {
    if (isTeacher) {
      waitingStudents.forEach((student) => {
        handleAdmitStudent(student.socketId);
      });
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: "admission-accepted-all"
        });
      }
      setWaitingStudents([]);
      setLatestKnocker(null);
      showToast("Admitted all waiting students!");
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

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setIsBackendModalOpen(true)}
              style={{
                background: "rgba(99, 102, 241, 0.15)",
                border: "1px solid rgba(99, 102, 241, 0.4)",
                color: "#c7d2fe",
                borderRadius: "8px",
                padding: "10px 18px",
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              🌐 Server Settings
            </button>
            <button onClick={leaveClassroom} className="leave-button" style={{ padding: "10px 24px", fontSize: "14px" }}>
              Leave Waiting Room
            </button>
          </div>
        </div>

        <BackendConfigModal
          isOpen={isBackendModalOpen}
          onClose={() => setIsBackendModalOpen(false)}
          onServerUpdated={() => {
            checkHealth();
            connectSocket(true);
          }}
        />
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
  const teacherUserEntry = Object.entries(remoteUserData).find(
    ([, meta]) => meta?.role === "teacher"
  );
  const teacherSocketId = teacherUserEntry ? teacherUserEntry[0] : null;
  const teacherStream = teacherSocketId ? remoteStreams[teacherSocketId] : null;
  const teacherDisplayName = teacherUserEntry && teacherUserEntry[1]?.userName
    ? teacherUserEntry[1].userName
    : "Teacher";

  // Admitted students list (derived from presence in remoteUserData)
  const admittedStudents = Object.entries(remoteUserData).filter(
    ([sockId, meta]) => meta?.role !== "teacher"
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
          {/* Server Connection Status Pill */}
          <button
            type="button"
            onClick={() => setIsBackendModalOpen(true)}
            title="Configure Live Backend Server"
            style={{
              background: serverOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
              border: `1px solid ${serverOnline ? "rgba(16, 185, 129, 0.4)" : "rgba(245, 158, 11, 0.4)"}`,
              color: serverOnline ? "#6ee7b7" : "#fcd34d",
              borderRadius: "20px",
              padding: "4px 12px",
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>{serverOnline ? "🟢" : "🟡"}</span>
            <span>{serverOnline ? "Server Live" : "Server Config"}</span>
          </button>

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

              {admittedStudents.map(([sockId, meta]) => {
                const stream = remoteStreams[sockId];
                return (
                  <div className="student-video" key={sockId}>
                    {stream ? (
                      <video
                        autoPlay
                        playsInline
                        ref={(v) => {
                          if (v && v.srcObject !== stream) {
                            v.srcObject = stream;
                          }
                        }}
                      />
                    ) : (
                      <div className="student-placeholder-slate">
                        <div className="student-avatar-badge">
                          {(meta?.userName || "S").charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "#f8fafc", marginTop: "6px" }}>
                          {meta?.userName || "Student"}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                          🎤 Live In Session
                        </span>
                      </div>
                    )}
                    <div className="student-label">
                      <span>{meta?.userName || "Student"}</span>
                      {meta?.role === "teacher" && <span style={{ color: "#c084fc", marginLeft: "4px" }}>(Teacher)</span>}
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
                          onClick={() => handleKickStudent(sockId, meta?.userName)}
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

      {/* Live Backend Configuration & Health Modal */}
      <BackendConfigModal
        isOpen={isBackendModalOpen}
        onClose={() => setIsBackendModalOpen(false)}
        onServerUpdated={() => {
          checkHealth();
          connectSocket(true);
        }}
      />
    </div>
  );
}

export default Classroom;