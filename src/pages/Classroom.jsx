import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo
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
import TrustStatusBadge from "../components/TrustStatusBadge";
import StepUpVerificationModal from "../components/StepUpVerificationModal";
import PrivacyConsentBanner from "../components/PrivacyConsentBanner";
import ClassroomChatPanel from "../components/ClassroomChatPanel";
import ClassroomFilePanel from "../components/ClassroomFilePanel";
import ExamModeModal from "../components/ExamModeModal";
import TeacherTrustDashboard from "../components/TeacherTrustDashboard";
import AuditTrailModal from "../components/AuditTrailModal";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" }
  ]
};

// Persistent module-level MediaStream instance to avoid hardware restarts/reloads on component remounts
let persistentLocalStream = null;

export const stopPersistentStream = () => {
  if (persistentLocalStream) {
    try {
      persistentLocalStream.getTracks().forEach((track) => track.stop());
    } catch (e) {}
    persistentLocalStream = null;
  }
};

function Classroom() {
  const { classroomId } = useParams();
  const cleanClassroomId = (classroomId || "").trim().toUpperCase();
  const location = useLocation();
  const navigate = useNavigate();

  const currentUser = useMemo(() => {
    try {
      const rawUser = localStorage.getItem("user");
      return rawUser ? JSON.parse(rawUser) : null;
    } catch (e) {
      return null;
    }
  }, []);

  const currentUserId = currentUser?.id || currentUser?._id || "";
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
  const localStreamRef = useRef(persistentLocalStream);

  // Reliable stable ref callback: attaches stream immediately when <video> mounts and avoids reloads
  const handleLocalVideoRef = useCallback((node) => {
    localVideoRef.current = node;
    const stream = localStreamRef.current || persistentLocalStream;
    if (node && stream) {
      if (node.srcObject !== stream) {
        node.srcObject = stream;
        node.play().catch(() => {});
      }
    }
  }, []);

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

  // Ref tracking already admitted student keys so teacher never receives duplicate knocking alerts
  const admittedStudentsRef = useRef(new Set());
  const executeStudentKnockRef = useRef(null);

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

  // ===================================
  // CONTINUOUS TRUST ZERO-TRUST ARCHITECTURE STATE
  // ===================================
  const [trustScore, setTrustScore] = useState(isTeacher ? 100 : 80);
  const [capabilities, setCapabilities] = useState({
    lecture: { allowed: true, status: "ALLOW", threshold: 20 },
    chat: { allowed: true, status: "ALLOW", threshold: 40 },
    mic_camera: { allowed: true, status: "ALLOW", threshold: 50 },
    screen_share: { allowed: isTeacher, status: isTeacher ? "ALLOW" : "ALLOW", threshold: 70 },
    download: { allowed: isTeacher, status: isTeacher ? "ALLOW" : "ALLOW", threshold: 75 },
    exam_submit: { allowed: isTeacher, status: isTeacher ? "ALLOW" : "ALLOW", threshold: 85 }
  });
  const [policies, setPolicies] = useState({});
  const [latestReason, setLatestReason] = useState("");
  const [threatLevel, setThreatLevel] = useState("NORMAL");
  const [anomalyScore, setAnomalyScore] = useState(0);
  const [threatAlerts, setThreatAlerts] = useState([]);
  const [classroomTrustSummary, setClassroomTrustSummary] = useState([]);

  // Panels & Modals State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [filesOpen, setFilesOpen] = useState(false);
  const [examOpen, setExamOpen] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpReason, setStepUpReason] = useState("general");
  const [teacherTrustDrawerOpen, setTeacherTrustDrawerOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);

  // Screen Share Stream Ref
  const screenStreamRef = useRef(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

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
    if (isTeacher || admissionStatus === "admitted") return;

    const studentKey = userEmail ? userEmail.toLowerCase() : userName;
    try {
      const localAdmitted =
        localStorage.getItem(`vc_admitted_${cleanClassroomId}_${studentKey}`) ||
        (userEmail && localStorage.getItem(`vc_admitted_${cleanClassroomId}_${userEmail.toLowerCase()}`)) ||
        (userName && localStorage.getItem(`vc_admitted_${cleanClassroomId}_${userName}`));
      if (localAdmitted) {
        setAdmissionStatus("admitted");
        return;
      }
    } catch (e) {}

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
    if (!force && socketRef.current && (socketRef.current.connected || socketRef.current.active)) return;

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
      transports: ["polling", "websocket"],
      timeout: 15000,
      reconnectionAttempts: 20,
      reconnectionDelay: 2500
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
        userId: currentUserId
      });

      setStatus(isTeacher ? "Session live (Host)" : "Connected. In Waiting Room...");

      // If student, trigger dual knock
      if (!isTeacher) {
        executeStudentKnockRef.current?.();
      }
    });

    socket.on("connect_error", (err) => {
      console.warn("Classroom socket connecting / fallback:", err.message);
      setServerOnline(false);
      setStatus(isTeacher ? "Session live (Host - Fallback Sync Active)" : "Waiting Room (Fallback Sync Active)");
      if (!isTeacher) {
        executeStudentKnockRef.current?.();
      }
    });

    // ===================================
    // WAITING ROOM & ADMISSION HANDLERS
    // ===================================

    socket.on("waiting-for-admission", (data) => {
      setAdmissionStatus((prev) => {
        // Never demote a student who has already been admitted
        if (prev === "admitted") return "admitted";
        const studentKey = userEmail ? userEmail.toLowerCase() : userName;
        const localAdmitted =
          localStorage.getItem(`vc_admitted_${cleanClassroomId}_${studentKey}`) ||
          (userEmail && localStorage.getItem(`vc_admitted_${cleanClassroomId}_${userEmail.toLowerCase()}`)) ||
          (userName && localStorage.getItem(`vc_admitted_${cleanClassroomId}_${userName}`));
        if (localAdmitted) return "admitted";
        return "waiting";
      });
      setStatus(data.message || "Waiting for Teacher to admit you...");
    });

    socket.on("student-knocking", ({ student }) => {
      if (isTeacher && student) {
        const sKey = student.userEmail ? student.userEmail.toLowerCase() : (student.userId || student.socketId);
        if (admittedStudentsRef.current.has(sKey) || admittedStudentsRef.current.has(student.socketId)) {
          return;
        }
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
        const validList = (list || []).filter((s) => {
          const sKey = s.userEmail ? s.userEmail.toLowerCase() : (s.userId || s.socketId);
          return !admittedStudentsRef.current.has(sKey) && !admittedStudentsRef.current.has(s.socketId);
        });
        setWaitingStudents(validList);
        if (validList.length > 0) {
          setLatestKnocker((prev) => {
            if (!prev || !validList.some((s) => s.socketId === prev.socketId || (s.userEmail && prev.userEmail && s.userEmail.toLowerCase() === prev.userEmail.toLowerCase()))) {
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
      stopPersistentStream();
      localStreamRef.current = null;
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

    socket.on("user-joined", ({ socketId, role: participantRole, userName: participantName, userEmail: participantEmail }) => {
      if (!isTeacher && participantRole !== "teacher") {
        return;
      }
      if (participantRole !== "teacher" && socketId) {
        admittedStudentsRef.current.add(socketId);
        if (participantEmail) admittedStudentsRef.current.add(participantEmail.toLowerCase());
      }
      setRemoteUserData((prev) => ({
        ...prev,
        [socketId]: {
          role: participantRole,
          userName: participantName || (participantRole === "teacher" ? "Teacher" : "Student")
        }
      }));
      setWaitingStudents((prev) => prev.filter((s) => s.socketId !== socketId && (!participantEmail || s.userEmail !== participantEmail)));
      setLatestKnocker((prev) => (prev?.socketId === socketId || (participantEmail && prev?.userEmail === participantEmail) ? null : prev));

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

    // ===================================
    // CONTINUOUS TRUST SOCKET LISTENERS
    // ===================================

    socket.on("trust-session-ready", ({ trustScore: initialScore, capabilities: initialCaps, policies: initialPols }) => {
      if (initialScore !== undefined) setTrustScore(initialScore);
      if (initialCaps) setCapabilities(initialCaps);
      if (initialPols) setPolicies(initialPols);
    });

    socket.on("trust-score-updated", ({ trustScore: newScore, delta, capabilities: newCaps, policies: newPols, reason, threatLevel: tl, anomalyScore: ascore }) => {
      if (newScore !== undefined) setTrustScore(newScore);
      if (newCaps) setCapabilities(newCaps);
      if (newPols) setPolicies(newPols);
      if (reason) setLatestReason(reason);
      if (tl) setThreatLevel(tl);
      if (ascore !== undefined) setAnomalyScore(ascore);
      showToast(`🛡️ Trust Score: ${newScore} (${delta >= 0 ? "+" + delta : delta})`);
    });

    socket.on("classroom-trust-summary", ({ summary }) => {
      setClassroomTrustSummary(summary || []);
    });

    socket.on("threat-alert", ({ studentName, threatLevel: tl, threatPenalty, reasonCodes }) => {
      if (isTeacher) {
        setThreatAlerts((prev) => [{ studentName, threatLevel: tl, threatPenalty, reasonCodes, timestamp: Date.now() }, ...prev]);
        showToast(`🚨 AI Threat: ${studentName} (${tl}) - ${reasonCodes?.join(", ")}`);
      }
    });

    socket.on("policy-enforced", ({ capability, reason }) => {
      showToast(`⚠️ Policy Enforced: ${reason}`);
      if (capability === "screen_share") {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((t) => t.stop());
          screenStreamRef.current = null;
        }
        setIsSharingScreen(false);
      }
      if (capability === "mic_camera") {
        setMicEnabled(false);
      }
    });

    socket.on("classroom-chat-message", ({ id, senderId, senderName, senderRole, text, timestamp }) => {
      setChatMessages((prev) => [...prev, { id, senderId, senderName, senderRole, text, timestamp }]);
    });

    socket.on("participant-screen-share-changed", ({ userName: sharerName, isSharing }) => {
      showToast(`🖥️ ${sharerName} ${isSharing ? "started" : "stopped"} screen sharing`);
    });

    socket.on("capability-denied", ({ capability, message }) => {
      showToast(`🚫 ${message}`);
      setStepUpReason(capability);
      setStepUpOpen(true);
    });

    socket.on("file-download-approved", ({ fileName }) => {
      showToast(`✓ File download approved: ${fileName}`);
    });

    socket.on("exam-submit-approved", ({ message }) => {
      showToast(`🎉 ${message}`);
    });

    socket.on("exam-submit-denied", ({ message }) => {
      showToast(`⚠️ ${message}`);
    });
  }, [cleanClassroomId, role, userName, userEmail, currentUserId, isTeacher, navigate]);

  // Listen to backend URL change event
  useEffect(() => {
    const handleUrlChange = () => {
      checkHealth();
      connectSocket(true);
    };
    window.addEventListener("vc_backend_url_changed", handleUrlChange);
    return () => window.removeEventListener("vc_backend_url_changed", handleUrlChange);
  }, [checkHealth, connectSocket]);

  // 1. Initialize Media Stream ONCE on mount (prevent camera restart / reload loop)
  useEffect(() => {
    let mounted = true;

    const startMedia = async () => {
      // Reuse existing active stream if available
      const existing = localStreamRef.current || persistentLocalStream;
      if (existing && existing.getTracks().some((t) => t.readyState === "live")) {
        localStreamRef.current = existing;
        persistentLocalStream = existing;
        if (localVideoRef.current && localVideoRef.current.srcObject !== existing) {
          localVideoRef.current.srcObject = existing;
          localVideoRef.current.play().catch(() => {});
        }
        return;
      }

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
        persistentLocalStream = stream;

        if (localVideoRef.current && localVideoRef.current.srcObject !== stream) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }

        // Attach tracks to any established WebRTC peer connections
        Object.values(peerConnectionsRef.current).forEach((peer) => {
          const senders = peer.getSenders ? peer.getSenders() : [];
          stream.getTracks().forEach((track) => {
            const alreadyAdded = senders.some((s) => s.track && s.track.id === track.id);
            if (!alreadyAdded) {
              try {
                peer.addTrack(track, stream);
              } catch (e) {}
            }
          });
        });
      } catch (error) {
        console.error("Camera error:", error);
        setStatus("Camera/mic access error. You may need to grant browser permissions.");
      }
    };

    startMedia();

    return () => {
      mounted = false;
      // Do not stop hardware tracks on React remounts/StrictMode cycles
      // Tracks are stopped on explicit leave / exit
    };
  }, []);

  // 2. Attach local stream to video element whenever video element appears or admission status changes
  useEffect(() => {
    const stream = localStreamRef.current || persistentLocalStream;
    if (localVideoRef.current && stream) {
      if (localVideoRef.current.srcObject !== stream) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [admissionStatus]);

  // 3. Connect socket on mount and cleanup only on unmount
  useEffect(() => {
    connectSocket();

    return () => {
      Object.values(peerConnectionsRef.current).forEach((peer) => {
        try { peer.close(); } catch (e) {}
      });
      peerConnectionsRef.current = {};
      if (socketRef.current) {
        try { socketRef.current.disconnect(); } catch (e) {}
        socketRef.current = null;
      }
    };
  }, [cleanClassroomId]);

  // ===================================
  // DUAL-CHANNEL POLLING LOOPS
  // ===================================

  // 1. Student Active Admission Status Polling
  useEffect(() => {
    if (isTeacher || admissionStatus === "admitted") return;

    // Immediately trigger student knock once
    executeStudentKnock();

    let isAdmittedHandled = false;

    const checkStudentStatus = async () => {
      if (isAdmittedHandled) return;

      // Check 1: localStorage for admission
      try {
        const studentKey = userEmail ? userEmail.toLowerCase() : userName;
        const localAdmitted =
          localStorage.getItem(`vc_admitted_${cleanClassroomId}_${studentKey}`) ||
          localStorage.getItem(`vc_admitted_${cleanClassroomId}_${userEmail}`) ||
          localStorage.getItem(`vc_admitted_${cleanClassroomId}_${userName}`);

        if (localAdmitted) {
          isAdmittedHandled = true;
          setAdmissionStatus("admitted");
          showToast("🎉 The Teacher has admitted you into the classroom!");
          return;
        }

        const localRejected = localStorage.getItem(`vc_rejected_${cleanClassroomId}_${studentKey}`);
        if (localRejected) {
          isAdmittedHandled = true;
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
              userId: currentUserId,
              socketId: socketRef.current?.id || "",
              userName
            },
            timeout: 3000
          });

          if (res.data?.status === "admitted") {
            isAdmittedHandled = true;
            setAdmissionStatus("admitted");
            showToast("🎉 The Teacher has admitted you into the classroom!");
          } else if (res.data?.status === "rejected") {
            isAdmittedHandled = true;
            setAdmissionStatus("rejected");
            setRejectionReason(res.data?.reason || "The teacher declined your admission request.");
          }
        } catch (e) {}
      }
    };

    const interval = setInterval(checkStudentStatus, 2500);
    return () => clearInterval(interval);
  }, [cleanClassroomId, isTeacher, admissionStatus, userEmail, userName, currentUserId, executeStudentKnock]);

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
        const isAdmittedLocal =
          localStorage.getItem(`vc_admitted_${cleanClassroomId}_${studentKey}`) ||
          (s.userEmail && localStorage.getItem(`vc_admitted_${cleanClassroomId}_${s.userEmail.toLowerCase()}`));
        const isAdmittedRef =
          admittedStudentsRef.current.has(s.socketId) ||
          (s.userEmail && admittedStudentsRef.current.has(s.userEmail.toLowerCase())) ||
          (s.userId && admittedStudentsRef.current.has(s.userId));
        const isRemoteUser = remoteUserData[s.socketId];
        return !isAdmittedLocal && !isAdmittedRef && !isRemoteUser;
      });

      setWaitingStudents((prev) => {
        if (prev.length === 0 && combined.length === 0) return prev;
        if (
          prev.length === combined.length &&
          prev.every((p, idx) => p.socketId === combined[idx]?.socketId && p.status === combined[idx]?.status)
        ) {
          return prev;
        }
        return combined;
      });

      if (combined.length > 0) {
        setLatestKnocker((prev) => {
          if (!prev || !combined.some((s) => s.socketId === prev.socketId || (s.userEmail && prev.userEmail && s.userEmail.toLowerCase() === prev.userEmail.toLowerCase()))) {
            return combined[combined.length - 1];
          }
          return prev;
        });
      } else {
        setLatestKnocker(null);
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

  // Local Controls with Layer 5 Capability Checks
  const toggleMicrophone = () => {
    if (!isTeacher && !micEnabled && trustScore < 50 && !capabilities.mic_camera?.allowed) {
      showToast("🔒 Microphone restricted: Continuous Trust score must be >= 50. Please Step-Up.");
      setStepUpReason("mic_camera");
      setStepUpOpen(true);
      return;
    }

    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (!isTeacher && !cameraEnabled && trustScore < 50 && !capabilities.mic_camera?.allowed) {
      showToast("🔒 Camera restricted: Continuous Trust score must be >= 50. Please Step-Up.");
      setStepUpReason("mic_camera");
      setStepUpOpen(true);
      return;
    }

    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
      }
    }
  };

  // Screen Share Handling (Requires Trust >= 70)
  const startScreenShare = async () => {
    if (!isTeacher && trustScore < 70 && !capabilities.screen_share?.allowed) {
      showToast("🔒 Screen Sharing requires Continuous Trust Score >= 70. Please Step-Up.");
      setStepUpReason("screen_share");
      setStepUpOpen(true);
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      screenStreamRef.current = displayStream;
      setIsSharingScreen(true);

      const screenTrack = displayStream.getVideoTracks()[0];

      // Replace video track in established WebRTC peer connections
      Object.values(peerConnectionsRef.current).forEach((peer) => {
        const senders = peer.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }
      });

      if (socketRef.current) {
        socketRef.current.emit("screen-share-status", { isSharing: true });
      }

      showToast("🖥️ Screen sharing active!");

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.warn("Screen share cancelled:", err);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setIsSharingScreen(false);

    // Restore camera video track
    if (localStreamRef.current) {
      const cameraTrack = localStreamRef.current.getVideoTracks()[0];
      if (cameraTrack) {
        Object.values(peerConnectionsRef.current).forEach((peer) => {
          const senders = peer.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === "video");
          if (videoSender) {
            videoSender.replaceTrack(cameraTrack);
          }
        });
      }
    }

    if (socketRef.current) {
      socketRef.current.emit("screen-share-status", { isSharing: false });
    }
    showToast("Screen sharing stopped");
  };

  // Step-Up Verification Success Handler (+20 Boost)
  const handleStepUpSuccess = (method) => {
    setStepUpOpen(false);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("step-up-verify", { method });
    } else {
      // Direct REST fallback
      axios.post(`${getApiBaseUrl()}/api/trust/step-up`, {
        classroomId: cleanClassroomId,
        participantKey: socketRef.current?.id || "local",
        method
      }).then(res => {
        if (res.data?.success) {
          setTrustScore(res.data.trustScore);
          setCapabilities(res.data.capabilities || {});
        }
      }).catch(() => {});
    }
    showToast("🎉 Step-Up verified! Continuous Trust score boosted +20 points.");
  };

  // Layer 1 Continuous Zero-Trust Event Collector
  useEffect(() => {
    if (isTeacher || admissionStatus !== "admitted") return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit("trust-activity-event", {
            eventType: "TAB_SWITCH",
            metadata: { timestamp: Date.now() }
          });
        }
      } else {
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit("trust-activity-event", {
            eventType: "WINDOW_FOCUS",
            metadata: { timestamp: Date.now() }
          });
        }
      }
    };

    const handleWindowBlur = () => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("trust-activity-event", {
          eventType: "WINDOW_BLUR",
          metadata: { timestamp: Date.now() }
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [isTeacher, admissionStatus]);

  const leaveClassroom = () => {
    stopPersistentStream();
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    localStreamRef.current = null;
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

      // Mark in admittedStudentsRef immediately so knocking toasts / intervals are suppressed
      if (studentSocketId) admittedStudentsRef.current.add(studentSocketId);
      if (sEmail) admittedStudentsRef.current.add(sEmail.toLowerCase());
      if (sId) admittedStudentsRef.current.add(sId);

      // Clear knocking banner and waiting list immediately
      setLatestKnocker((prev) => (prev?.socketId === studentSocketId || (sEmail && prev?.userEmail === sEmail) ? null : prev));
      setWaitingStudents((prev) => prev.filter((s) => s.socketId !== studentSocketId && (!sEmail || s.userEmail !== sEmail)));

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
      if (admittedStudent && studentSocketId) {
        setRemoteUserData((prev) => ({
          ...prev,
          [studentSocketId]: {
            role: "student",
            userName: sName,
            userEmail: sEmail
          }
        }));
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

      if (studentSocketId) admittedStudentsRef.current.add(studentSocketId);
      if (sEmail) admittedStudentsRef.current.add(sEmail.toLowerCase());
      if (sId) admittedStudentsRef.current.add(sId);

      setLatestKnocker((prev) => (prev?.socketId === studentSocketId || (sEmail && prev?.userEmail === sEmail) ? null : prev));
      setWaitingStudents((prev) => prev.filter((s) => s.socketId !== studentSocketId && (!sEmail || s.userEmail !== sEmail)));

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

      showToast("Admission request declined.");
    }
  };

  const handleAdmitAll = () => {
    if (isTeacher) {
      waitingStudents.forEach((student) => {
        if (student.socketId) admittedStudentsRef.current.add(student.socketId);
        if (student.userEmail) admittedStudentsRef.current.add(student.userEmail.toLowerCase());
        if (student.userId) admittedStudentsRef.current.add(student.userId);
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

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Continuous Trust Badge & Dynamic Capability Matrix */}
          <TrustStatusBadge
            trustScore={trustScore}
            capabilities={capabilities}
            latestReason={latestReason}
            threatLevel={threatLevel}
            anomalyScore={anomalyScore}
            onOpenStepUp={() => {
              setStepUpReason("general");
              setStepUpOpen(true);
            }}
            onOpenAuditLogs={() => setAuditModalOpen(true)}
            isTeacher={isTeacher}
          />

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
                ref={handleLocalVideoRef}
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
              ref={handleLocalVideoRef}
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

        {/* Screen Share Button (Layer 5: Trust >= 70) */}
        <button
          onClick={isSharingScreen ? stopScreenShare : startScreenShare}
          className={`ctrl-btn ${isSharingScreen ? "active screen-active" : ""}`}
          title={!isTeacher && trustScore < 70 ? "Screen Sharing locked (Trust < 70)" : "Share Screen"}
        >
          {isSharingScreen ? "🖥️ Stop Share" : "🖥️ Share Screen"}
        </button>

        {/* Classroom Chat (Layer 5: Trust >= 40) */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`ctrl-btn ${chatOpen ? "active" : ""}`}
        >
          💬 Chat {chatMessages.length > 0 && <span className="ctrl-badge">{chatMessages.length}</span>}
        </button>

        {/* Resources / Files Panel (Layer 5: Trust >= 75) */}
        <button
          onClick={() => setFilesOpen(!filesOpen)}
          className={`ctrl-btn ${filesOpen ? "active" : ""}`}
        >
          📁 Resources
        </button>

        {/* Exam Mode (Layer 5: Trust >= 85) */}
        <button
          onClick={() => setExamOpen(true)}
          className="ctrl-btn exam-btn"
          title="Online Proctored Exam Mode (Req: 85 Trust)"
        >
          📝 Exam Mode
        </button>

        {/* Teacher Trust Dashboard Button */}
        {isTeacher && (
          <button
            onClick={() => setTeacherTrustDrawerOpen(true)}
            className="ctrl-btn host-feature"
          >
            🛡️ Trust Center {threatAlerts.length > 0 && <span className="ctrl-badge danger">{threatAlerts.length}</span>}
          </button>
        )}

        {/* Audit Ledger Inspector */}
        <button
          onClick={() => setAuditModalOpen(true)}
          className="ctrl-btn"
          title="Inspect SHA-256 Hash-Chained Audit Ledger"
        >
          ⛓️ Ledger
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

      {/* Layer 4B Privacy Notice Banner */}
      <PrivacyConsentBanner />

      {/* Layer 2 Step-Up Verification Modal */}
      <StepUpVerificationModal
        isOpen={stepUpOpen}
        requiredCapability={stepUpReason}
        currentScore={trustScore}
        neededScore={70}
        userName={userName}
        onSuccess={handleStepUpSuccess}
        onClose={() => setStepUpOpen(false)}
      />

      {/* Layer 1 Live Classroom Chat Panel */}
      <ClassroomChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        onSendMessage={(msgText) => {
          if (socketRef.current) {
            socketRef.current.emit("classroom-chat-message", { text: msgText });
          }
        }}
        trustScore={trustScore}
        chatAllowed={isTeacher || capabilities.chat?.allowed || trustScore >= 40}
        onOpenStepUp={() => {
          setStepUpReason("chat");
          setStepUpOpen(true);
        }}
        currentUserId={currentUserId}
        userName={userName}
      />

      {/* Layer 1 Shared Files / Resources Panel */}
      <ClassroomFilePanel
        isOpen={filesOpen}
        onClose={() => setFilesOpen(false)}
        trustScore={trustScore}
        downloadAllowed={isTeacher || capabilities.download?.allowed || trustScore >= 75}
        onOpenStepUp={() => {
          setStepUpReason("download");
          setStepUpOpen(true);
        }}
        onTriggerDownload={(file) => {
          if (socketRef.current) {
            socketRef.current.emit("request-file-download", { fileId: file.id, fileName: file.name });
          }
        }}
      />

      {/* Layer 1 & 5 Proctored Exam Mode */}
      <ExamModeModal
        isOpen={examOpen}
        onClose={() => setExamOpen(false)}
        trustScore={trustScore}
        canSubmitExam={isTeacher || capabilities.exam_submit?.allowed || trustScore >= 85}
        onTabSwitchViolation={(evt, meta) => {
          if (socketRef.current) {
            socketRef.current.emit("trust-activity-event", {
              eventType: "EXAM_TAB_SWITCH",
              metadata: meta
            });
          }
        }}
        onOpenStepUp={() => {
          setStepUpReason("exam_submit");
          setStepUpOpen(true);
        }}
        onSubmitExam={(answers) => {
          if (socketRef.current) {
            socketRef.current.emit("request-exam-submit", { examId: "exam_01", answers });
          }
        }}
      />

      {/* Layer 1 & 4 Teacher Continuous Trust Dashboard */}
      <TeacherTrustDashboard
        isOpen={teacherTrustDrawerOpen}
        onClose={() => setTeacherTrustDrawerOpen(false)}
        classroomSummary={classroomTrustSummary}
        threatAlerts={threatAlerts}
        onManualOverride={({ targetSocketId, newScore, reason, bypassCapabilities }) => {
          if (socketRef.current) {
            socketRef.current.emit("teacher-trust-override", {
              targetSocketId,
              newScore,
              reason,
              bypassCapabilities
            });
          }
          showToast(`Applied manual override for student score: ${newScore}`);
        }}
        onOpenAuditLedger={() => setAuditModalOpen(true)}
      />

      {/* Layer 6 Tamper-Evident SHA-256 Audit Trail */}
      <AuditTrailModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        classroomId={cleanClassroomId}
      />

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