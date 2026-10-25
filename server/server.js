const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  console.warn("Could not set custom DNS servers:", e.message);
}

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const classroomRoutes = require("./routes/classroom");
const trustRoutes = require("./routes/trust");

const { trustEngine } = require("./utils/trustEngine");
const { threatDetector } = require("./utils/threatDetector");
const { policyEngine } = require("./utils/policyEngine");
const { auditLedger } = require("./utils/auditLedger");

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/+$/, "") : null;

app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins or match FRONTEND_URL and localhost
    if (!origin || !FRONTEND_URL || origin === FRONTEND_URL || origin.includes("localhost") || origin.includes("netlify.app")) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all valid cross-origin requests
    }
  },
  credentials: true
}));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/classrooms", classroomRoutes);
app.use("/api/trust", trustRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Virtual Classroom API is running",
    status: "online",
    timestamp: new Date().toISOString()
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});


// ==========================================
// SOCKET.IO
// ==========================================

// ==========================================
// SOCKET.IO (WITH WAITING ROOM & TEACHER CONTROLS)
// ==========================================

// In-memory state for waiting rooms and host controls
// classroomId -> Array<{ socketId, userName, userEmail, userId, joinedAt, status }>
const classroomWaitingRooms = new Map();
// classroomId -> Set of teacher socket IDs
const classroomTeachers = new Map();
// classroomId -> Map of studentKey -> { status: 'waiting' | 'admitted' | 'rejected', updatedAt, reason, userName }
const classroomStudentStatus = new Map();
// classroomId -> Set of admitted student identifiers (socketId, userEmail, userId)
const classroomAdmittedStudents = new Map();
// classroomId -> Active Exam Object { id, title, description, durationMinutes, minTrustScore, questions, createdBy, createdAt, isOpen }
const classroomExams = new Map();
// classroomId -> Array of student submissions
const classroomExamSubmissions = new Map();
// classroomId -> Array of resources
const classroomResources = new Map();

app.set("io", io);
app.set("classroomWaitingRooms", classroomWaitingRooms);
app.set("classroomTeachers", classroomTeachers);
app.set("classroomStudentStatus", classroomStudentStatus);
app.set("classroomAdmittedStudents", classroomAdmittedStudents);
app.set("classroomExams", classroomExams);
app.set("classroomExamSubmissions", classroomExamSubmissions);
app.set("classroomResources", classroomResources);

const initAdmittedStudentTrust = (sock, cleanClassroomId) => {
  if (!sock) return;
  const trustSession = trustEngine.getOrCreateSession(cleanClassroomId, sock.id, {
    role: "student",
    userName: sock.data.userName,
    userEmail: sock.data.userEmail,
    userId: sock.data.userId,
    authContext: {
      passkeyVerified: false,
      knownDevice: true,
      otpVerified: true
    }
  });
  const policies = policyEngine.evaluateAllPolicies(trustSession.trustScore);
  sock.emit("trust-session-ready", {
    participantKey: sock.id,
    trustScore: trustSession.trustScore,
    capabilities: trustEngine.evaluateCapabilities(trustSession.trustScore),
    policies,
    history: trustSession.history
  });

  const teachers = classroomTeachers.get(cleanClassroomId);
  if (teachers) {
    const summary = trustEngine.getClassroomTrustSummary(cleanClassroomId);
    teachers.forEach((tId) => io.to(tId).emit("classroom-trust-summary", { summary }));
  }
};

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // ========================================
  // JOIN CLASSROOM
  // ========================================
  socket.on("join-classroom", ({ classroomId, role, userName, userEmail, userId }) => {
    const cleanClassroomId = String(classroomId || "").trim().toUpperCase();
    socket.data.classroomId = cleanClassroomId;
    socket.data.role = role;
    socket.data.userName = userName || (role === "teacher" ? "Teacher" : "Student");
    socket.data.userEmail = userEmail || "";
    socket.data.userId = userId || "";

    if (role === "teacher") {
      // Teacher joins directly as Host
      socket.join(cleanClassroomId);

      if (!classroomTeachers.has(cleanClassroomId)) {
        classroomTeachers.set(cleanClassroomId, new Set());
      }
      classroomTeachers.get(cleanClassroomId).add(socket.id);

      console.log(`👨‍🏫 Teacher (${socket.data.userName}) started host session in ${cleanClassroomId}`);

      // Gather existing active users in room
      const room = io.sockets.adapter.rooms.get(cleanClassroomId);
      const existingUsers = [];
      if (room) {
        room.forEach((sockId) => {
          if (sockId !== socket.id) {
            const existingSocket = io.sockets.sockets.get(sockId);
            if (existingSocket && existingSocket.data.status !== "waiting") {
              existingUsers.push({
                socketId: sockId,
                role: existingSocket.data.role,
                userName: existingSocket.data.userName,
                avatar: existingSocket.data.avatar
              });
            }
          }
        });
      }

      socket.emit("existing-users", { users: existingUsers });

      // Initialize teacher trust session
      trustEngine.getOrCreateSession(cleanClassroomId, socket.id, {
        role: "teacher",
        userName: socket.data.userName,
        userId: socket.data.userId
      });
      const trustSummary = trustEngine.getClassroomTrustSummary(cleanClassroomId);
      socket.emit("classroom-trust-summary", { summary: trustSummary });

      // Send any currently pending students waiting for admission
      const waitingList = classroomWaitingRooms.get(cleanClassroomId) || [];
      socket.emit("waiting-list-update", { waitingStudents: waitingList });

      // If any students are already waiting, also notify teacher with student-knocking
      if (waitingList.length > 0) {
        const latestKnock = waitingList[waitingList.length - 1];
        socket.emit("student-knocking", {
          student: latestKnock,
          classroomId: cleanClassroomId
        });
      }

    } else {
      // Check if student is ALREADY admitted
      const admittedSet = classroomAdmittedStudents.get(cleanClassroomId) || new Set();
      const statusMap = classroomStudentStatus.get(cleanClassroomId) || new Map();
      const studentKey = socket.data.userEmail ? socket.data.userEmail.toLowerCase() : (socket.data.userId || socket.id);

      const isAlreadyAdmitted =
        socket.data.status === "admitted" ||
        admittedSet.has(socket.id) ||
        (socket.data.userEmail && admittedSet.has(socket.data.userEmail.toLowerCase())) ||
        (socket.data.userId && admittedSet.has(socket.data.userId)) ||
        (socket.data.userName && admittedSet.has(socket.data.userName.toLowerCase())) ||
        statusMap.get(studentKey)?.status === "admitted" ||
        (socket.data.userName && statusMap.get(socket.data.userName.toLowerCase())?.status === "admitted");

      if (isAlreadyAdmitted) {
        socket.data.status = "admitted";
        socket.leave(`waiting-${cleanClassroomId}`);
        socket.join(cleanClassroomId);

        admittedSet.add(socket.id);
        if (socket.data.userEmail) admittedSet.add(socket.data.userEmail.toLowerCase());
        if (socket.data.userId) admittedSet.add(socket.data.userId);
        if (socket.data.userName) admittedSet.add(socket.data.userName.toLowerCase());
        classroomAdmittedStudents.set(cleanClassroomId, admittedSet);

        // Remove from waiting room if present
        if (classroomWaitingRooms.has(cleanClassroomId)) {
          const remaining = classroomWaitingRooms.get(cleanClassroomId).filter((item) => {
            if (item.socketId === socket.id) return false;
            if (socket.data.userEmail && item.userEmail && item.userEmail.toLowerCase() === socket.data.userEmail.toLowerCase()) return false;
            if (socket.data.userId && item.userId && item.userId === socket.data.userId) return false;
            return true;
          });
          classroomWaitingRooms.set(cleanClassroomId, remaining);
        }

        socket.emit("admission-accepted", {
          classroomId: cleanClassroomId,
          message: "You are admitted into the classroom!"
        });

        // Send existing teachers to this admitted student
        const room = io.sockets.adapter.rooms.get(cleanClassroomId);
        const existingUsers = [];
        if (room) {
          room.forEach((sockId) => {
            if (sockId !== socket.id) {
              const s = io.sockets.sockets.get(sockId);
              if (s && s.data.status !== "waiting" && s.data.role === "teacher") {
                existingUsers.push({
                  socketId: sockId,
                  role: s.data.role,
                  userName: s.data.userName
                });
              }
            }
          });
        }
        socket.emit("existing-users", { users: existingUsers });
        initAdmittedStudentTrust(socket, cleanClassroomId);
        return;
      }

      // STUDENT ENTERS WAITING ROOM (REQUIRES TEACHER ACCEPTANCE)
      socket.data.status = "waiting";
      socket.join(`waiting-${cleanClassroomId}`);

      if (!classroomWaitingRooms.has(cleanClassroomId)) {
        classroomWaitingRooms.set(cleanClassroomId, []);
      }

      const waitingEntry = {
        socketId: socket.id,
        userName: socket.data.userName,
        userEmail: socket.data.userEmail,
        userId: socket.data.userId,
        joinedAt: new Date().toISOString(),
        status: "waiting"
      };

      const currentWaiting = classroomWaitingRooms.get(cleanClassroomId);
      // Avoid duplicate entries
      const filtered = currentWaiting.filter((item) => {
        if (item.socketId === socket.id) return false;
        if (socket.data.userEmail && item.userEmail && item.userEmail.toLowerCase() === socket.data.userEmail.toLowerCase()) return false;
        if (socket.data.userId && item.userId && item.userId === socket.data.userId) return false;
        return true;
      });
      filtered.push(waitingEntry);
      classroomWaitingRooms.set(cleanClassroomId, filtered);

      // Save status map
      statusMap.set(studentKey, { status: "waiting", userName: socket.data.userName, updatedAt: Date.now() });
      statusMap.set(socket.id, { status: "waiting", userName: socket.data.userName, updatedAt: Date.now() });
      classroomStudentStatus.set(cleanClassroomId, statusMap);

      console.log(`🧑‍🎓 Student (${socket.data.userName}) entered waiting room for ${cleanClassroomId}`);

      // Notify the student that they are in the waiting room
      socket.emit("waiting-for-admission", {
        message: "You are in the Waiting Room. The Teacher will admit you shortly.",
        classroomId: cleanClassroomId
      });

      // Notify all teachers in this classroom room AND direct socket IDs
      io.to(cleanClassroomId).emit("student-knocking", {
        student: waitingEntry,
        classroomId: cleanClassroomId
      });
      io.to(cleanClassroomId).emit("waiting-list-update", {
        waitingStudents: filtered
      });

      const teachers = classroomTeachers.get(cleanClassroomId);
      if (teachers) {
        teachers.forEach((tId) => {
          io.to(tId).emit("student-knocking", { student: waitingEntry, classroomId: cleanClassroomId });
          io.to(tId).emit("waiting-list-update", { waitingStudents: filtered });
        });
      }
    }
  });


  // ========================================
  // TEACHER ADMITS STUDENT
  // ========================================
  socket.on("admit-student", ({ socketId, studentEmail, studentId, studentName, classroomId }) => {
    // Only teacher can admit
    if (socket.data.role !== "teacher") return;

    const cleanClassroomId = String(classroomId || socket.data.classroomId || "").trim().toUpperCase();
    
    // Multi-criteria lookup for student socket
    let studentSocket = socketId ? io.sockets.sockets.get(socketId) : null;
    if (!studentSocket) {
      for (const [, s] of io.sockets.sockets) {
        if (
          s.data.classroomId === cleanClassroomId &&
          s.data.role !== "teacher" &&
          ((studentEmail && s.data.userEmail && s.data.userEmail.toLowerCase() === studentEmail.toLowerCase()) ||
            (studentId && s.data.userId === studentId) ||
            (studentName && s.data.userName === studentName))
        ) {
          studentSocket = s;
          break;
        }
      }
    }

    if (studentSocket) {
      studentSocket.data.status = "admitted";
      studentSocket.leave(`waiting-${cleanClassroomId}`);
      studentSocket.join(cleanClassroomId);

      // Notify student they are admitted
      studentSocket.emit("admission-accepted", {
        classroomId: cleanClassroomId,
        message: "The Teacher has admitted you into the classroom!"
      });

      // Send existing users in room to the newly admitted student
      const room = io.sockets.adapter.rooms.get(cleanClassroomId);
      const existingUsers = [];
      if (room) {
        room.forEach((sockId) => {
          if (sockId !== studentSocket.id) {
            const s = io.sockets.sockets.get(sockId);
            if (s && s.data.status !== "waiting" && s.data.role === "teacher") {
              existingUsers.push({
                socketId: sockId,
                role: s.data.role,
                userName: s.data.userName
              });
            }
          }
        });
      }
      studentSocket.emit("existing-users", { users: existingUsers });
      initAdmittedStudentTrust(studentSocket, cleanClassroomId);
    }

    // Remove from waiting list
    if (classroomWaitingRooms.has(cleanClassroomId)) {
      const remaining = classroomWaitingRooms.get(cleanClassroomId).filter((s) => {
        if (socketId && s.socketId === socketId) return false;
        if (studentEmail && s.userEmail && s.userEmail.toLowerCase() === studentEmail.toLowerCase()) return false;
        if (studentId && s.userId && s.userId === studentId) return false;
        return true;
      });
      classroomWaitingRooms.set(cleanClassroomId, remaining);
      io.to(cleanClassroomId).emit("waiting-list-update", { waitingStudents: remaining });
      const teachers = classroomTeachers.get(cleanClassroomId);
      if (teachers) {
        teachers.forEach((tId) => io.to(tId).emit("waiting-list-update", { waitingStudents: remaining }));
      }
    }

    // Update status in status map
    const statusMap = classroomStudentStatus.get(cleanClassroomId) || new Map();
    const studentKey = studentEmail ? studentEmail.toLowerCase() : (studentId || socketId);
    statusMap.set(studentKey, { status: "admitted", userName: studentName, updatedAt: Date.now() });
    if (socketId) statusMap.set(socketId, { status: "admitted", userName: studentName, updatedAt: Date.now() });
    classroomStudentStatus.set(cleanClassroomId, statusMap);

    // Save in classroomAdmittedStudents
    if (!classroomAdmittedStudents.has(cleanClassroomId)) {
      classroomAdmittedStudents.set(cleanClassroomId, new Set());
    }
    const admittedSet = classroomAdmittedStudents.get(cleanClassroomId);
    if (socketId) admittedSet.add(socketId);
    if (studentEmail) admittedSet.add(studentEmail.toLowerCase());
    if (studentId) admittedSet.add(studentId);
    if (studentSocket?.id) admittedSet.add(studentSocket.id);
    if (studentName) {
      admittedSet.add(studentName.toLowerCase());
      statusMap.set(studentName.toLowerCase(), { status: "admitted", userName: studentName, updatedAt: Date.now() });
    }

    console.log(`✅ Teacher admitted student (${studentName || studentEmail || socketId}) into ${cleanClassroomId}`);

    // Tell TEACHER and all classroom room participants that this student has joined
    io.to(cleanClassroomId).emit("user-joined", {
      socketId: studentSocket ? studentSocket.id : socketId,
      role: "student",
      userName: studentName || (studentSocket ? studentSocket.data.userName : "Student"),
      userEmail: studentEmail || ""
    });

    const teachers = classroomTeachers.get(cleanClassroomId);
    if (teachers) {
      teachers.forEach((teacherSockId) => {
        io.to(teacherSockId).emit("user-joined", {
          socketId: studentSocket ? studentSocket.id : socketId,
          role: "student",
          userName: studentName || (studentSocket ? studentSocket.data.userName : "Student"),
          userEmail: studentEmail || ""
        });
      });
    }
  });


  // ========================================
  // TEACHER REJECTS STUDENT
  // ========================================
  socket.on("reject-student", ({ socketId, studentEmail, studentId, classroomId, reason }) => {
    if (socket.data.role !== "teacher") return;

    const cleanClassroomId = String(classroomId || socket.data.classroomId || "").trim().toUpperCase();
    
    let studentSocket = socketId ? io.sockets.sockets.get(socketId) : null;
    if (!studentSocket) {
      for (const [, s] of io.sockets.sockets) {
        if (
          s.data.classroomId === cleanClassroomId &&
          s.data.role !== "teacher" &&
          ((studentEmail && s.data.userEmail && s.data.userEmail.toLowerCase() === studentEmail.toLowerCase()) ||
            (studentId && s.data.userId === studentId))
        ) {
          studentSocket = s;
          break;
        }
      }
    }

    if (studentSocket) {
      studentSocket.emit("admission-rejected", {
        reason: reason || "The teacher declined your admission request."
      });
      studentSocket.leave(`waiting-${cleanClassroomId}`);
    }

    if (classroomWaitingRooms.has(cleanClassroomId)) {
      const remaining = classroomWaitingRooms.get(cleanClassroomId).filter((s) => {
        if (socketId && s.socketId === socketId) return false;
        if (studentEmail && s.userEmail && s.userEmail.toLowerCase() === studentEmail.toLowerCase()) return false;
        if (studentId && s.userId && s.userId === studentId) return false;
        return true;
      });
      classroomWaitingRooms.set(cleanClassroomId, remaining);
      io.to(cleanClassroomId).emit("waiting-list-update", { waitingStudents: remaining });
      const teachers = classroomTeachers.get(cleanClassroomId);
      if (teachers) {
        teachers.forEach((tId) => io.to(tId).emit("waiting-list-update", { waitingStudents: remaining }));
      }
    }

    const statusMap = classroomStudentStatus.get(cleanClassroomId) || new Map();
    const studentKey = studentEmail ? studentEmail.toLowerCase() : (studentId || socketId);
    statusMap.set(studentKey, { status: "rejected", reason: reason || "Declined by teacher", updatedAt: Date.now() });
    if (socketId) statusMap.set(socketId, { status: "rejected", reason: reason || "Declined by teacher", updatedAt: Date.now() });
    classroomStudentStatus.set(cleanClassroomId, statusMap);

    console.log(`❌ Teacher rejected student from ${cleanClassroomId}`);
  });


  // ========================================
  // TEACHER KICKS / REMOVES STUDENT FROM ROOM
  // ========================================
  socket.on("kick-student", ({ socketId, classroomId, reason }) => {
    if (socket.data.role !== "teacher") return;

    const cleanClassroomId = String(classroomId || socket.data.classroomId || "").trim().toUpperCase();
    const studentSocket = io.sockets.sockets.get(socketId);
    if (studentSocket) {
      studentSocket.emit("kicked-from-class", {
        message: reason || "You were removed from the classroom by the teacher."
      });
      studentSocket.leave(cleanClassroomId);
    }

    socket.to(cleanClassroomId).emit("user-left", { socketId });
    console.log(`🚫 Teacher kicked student ${socketId} from ${cleanClassroomId}`);
  });


  // ========================================
  // TEACHER REMOTE MODERATION (MUTE / VIDEO OFF)
  // ========================================
  socket.on("teacher-remote-mute", ({ targetSocketId, mute }) => {
    if (socket.data.role !== "teacher") return;
    io.to(targetSocketId).emit("force-mic-state", { mute });
  });

  socket.on("teacher-remote-video", ({ targetSocketId, videoOff }) => {
    if (socket.data.role !== "teacher") return;
    io.to(targetSocketId).emit("force-camera-state", { videoOff });
  });

  socket.on("teacher-mute-all", ({ classroomId }) => {
    if (socket.data.role !== "teacher") return;
    // Broadcast to all students in room to mute
    socket.to(classroomId).emit("force-mic-state", { mute: true });
  });


  // ========================================
  // WEBRTC SIGNALING: OFFER, ANSWER, ICE
  // (Privacy Enforcement: Students only connect with Teachers!)
  // ========================================
  socket.on("offer", ({ offer, target }) => {
    const targetSocket = io.sockets.sockets.get(target);
    if (!targetSocket) return;

    // Student privacy: Students can only exchange WebRTC streams with teachers
    if (socket.data.role === "student" && targetSocket.data.role !== "teacher") {
      return;
    }

    io.to(target).emit("offer", {
      offer,
      sender: socket.id
    });
  });

  socket.on("answer", ({ answer, target }) => {
    const targetSocket = io.sockets.sockets.get(target);
    if (!targetSocket) return;

    if (socket.data.role === "student" && targetSocket.data.role !== "teacher") {
      return;
    }

    io.to(target).emit("answer", {
      answer,
      sender: socket.id
    });
  });

  socket.on("ice-candidate", ({ candidate, target }) => {
    const targetSocket = io.sockets.sockets.get(target);
    if (!targetSocket) return;

    if (socket.data.role === "student" && targetSocket.data.role !== "teacher") {
      return;
    }

    io.to(target).emit("ice-candidate", {
      candidate,
      sender: socket.id
    });
  });


  // ========================================
  // CONTINUOUS TRUST ENGINE & ZERO-TRUST EVENT COLLECTOR
  // ========================================

  // 1. Process activity event (Tab switch, window blur, IP change, exam alert, etc.)
  socket.on("trust-activity-event", ({ eventType, metadata = {} }) => {
    const cleanClassroomId = socket.data.classroomId;
    if (!cleanClassroomId || socket.data.role === "teacher") return;

    const startTime = Date.now();
    const clientIp = metadata.ip || socket.handshake.address || "127.0.0.1";

    // Layer 4A: AI Threat Detection
    const threatResult = threatDetector.evaluateThreat(socket.id, eventType, {
      ...metadata,
      ip: clientIp
    });

    // If anomaly detected, send alert to teacher
    if (threatResult.isAnomaly) {
      const teachers = classroomTeachers.get(cleanClassroomId);
      if (teachers) {
        teachers.forEach((tId) => {
          io.to(tId).emit("threat-alert", {
            studentSocketId: socket.id,
            studentName: socket.data.userName,
            threatLevel: threatResult.threatLevel,
            anomalyScore: threatResult.anomalyScore,
            threatPenalty: threatResult.threatPenalty,
            reasonCodes: threatResult.reasonCodes,
            timestamp: Date.now()
          });
        });
      }
    }

    // Layer 3: Continuous Trust Engine Update
    const updateResult = trustEngine.updateTrustScore({
      classroomId: cleanClassroomId,
      participantKey: socket.id,
      eventType,
      threatScore: threatResult.threatPenalty,
      reason: threatResult.reasonCodes.join(" + ")
    });

    // Layer 5: Security Policy Evaluation
    const policies = policyEngine.evaluateAllPolicies(
      updateResult.trustScore,
      threatResult.reasonCodes,
      updateResult.session.manualBypass
    );

    const latencyMs = Math.max(1, Date.now() - startTime);

    // Layer 6: Hash-Chained Audit Ledger
    auditLedger.logEvent({
      classroomId: cleanClassroomId,
      userId: socket.data.userId || socket.id,
      userName: socket.data.userName,
      eventType,
      delta: updateResult.delta,
      newScore: updateResult.trustScore,
      decision: updateResult.trustScore >= 20 ? "ALLOW" : "BLOCK",
      reasonCode: threatResult.reasonCodes.join(" + "),
      latencyMs
    });

    // Notify student with updated trust score and capabilities
    socket.emit("trust-score-updated", {
      participantKey: socket.id,
      trustScore: updateResult.trustScore,
      delta: updateResult.delta,
      capabilities: updateResult.capabilities,
      policies,
      reason: threatResult.reasonCodes.join(" + "),
      threatLevel: threatResult.threatLevel,
      anomalyScore: threatResult.anomalyScore
    });

    // Policy Enforcement Triggers (Immediate capability restrictions)
    if (!policies.screen_share.allowed) {
      socket.emit("policy-enforced", {
        capability: "screen_share",
        action: "REVOKE",
        reason: `Screen share revoked: Continuous Trust score (${updateResult.trustScore}) below required 70`
      });
    }

    if (!policies.mic_camera.allowed) {
      socket.emit("policy-enforced", {
        capability: "mic_camera",
        action: "MUTE",
        reason: `Microphone muted: Continuous Trust score (${updateResult.trustScore}) below required 50`
      });
    }

    if (!policies.lecture.allowed) {
      socket.emit("policy-enforced", {
        capability: "lecture",
        action: "BLOCK",
        reason: `Session suspended: Continuous Trust score (${updateResult.trustScore}) fell below 20 (Probation)`
      });
    }

    // Update Classroom Summary for Teachers
    const teachers = classroomTeachers.get(cleanClassroomId);
    if (teachers) {
      const summary = trustEngine.getClassroomTrustSummary(cleanClassroomId);
      teachers.forEach((tId) => {
        io.to(tId).emit("classroom-trust-summary", { summary });
      });
    }
  });

  // 2. Classroom Chat Message (Layer 5 Protected: Requires Trust >= 40)
  socket.on("classroom-chat-message", ({ text, file, timestamp }) => {
    const cleanClassroomId = socket.data.classroomId;
    const hasText = Boolean(text && typeof text === "string" && text.trim().length > 0);
    const hasFile = Boolean(file && file.dataUrl && file.name);
    if (!cleanClassroomId || (!hasText && !hasFile)) return;

    if (socket.data.role !== "teacher") {
      const session = trustEngine.getOrCreateSession(cleanClassroomId, socket.id);
      const policy = policyEngine.evaluateCapabilityPolicy("chat", session.trustScore);
      if (!policy.allowed) {
        socket.emit("capability-denied", {
          capability: "chat",
          requiredScore: 40,
          currentScore: session.trustScore,
          message: "Chat restricted. Your continuous trust score must be >= 40 to participate in chat."
        });
        return;
      }

      // Record for chat spam monitoring
      threatDetector.recordEvent(socket.id, "CHAT_MESSAGE_SENT");
    }

    const messagePayload = {
      id: "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
      senderId: socket.id,
      senderName: socket.data.userName,
      senderRole: socket.data.role,
      text: hasText ? text.trim().slice(0, 500) : "",
      file: hasFile ? {
        name: String(file.name).slice(0, 100),
        type: String(file.type || "application/octet-stream"),
        size: Number(file.size || 0),
        dataUrl: String(file.dataUrl)
      } : null,
      timestamp: timestamp || new Date().toISOString()
    };

    // Broadcast message to everyone in classroom
    io.to(cleanClassroomId).emit("classroom-chat-message", messagePayload);
  });

  // 3. Screen Share Status & Validation (Layer 5: Requires Trust >= 70)
  socket.on("screen-share-status", ({ isSharing }) => {
    const cleanClassroomId = socket.data.classroomId;
    if (!cleanClassroomId) return;

    if (isSharing && socket.data.role !== "teacher") {
      const session = trustEngine.getOrCreateSession(cleanClassroomId, socket.id);
      const policy = policyEngine.evaluateCapabilityPolicy("screen_share", session.trustScore);
      if (!policy.allowed) {
        socket.emit("capability-denied", {
          capability: "screen_share",
          requiredScore: 70,
          currentScore: session.trustScore,
          message: `Screen sharing denied. Your continuous trust score (${session.trustScore}) must be >= 70.`
        });
        return;
      }
    }

    io.to(cleanClassroomId).emit("participant-screen-share-changed", {
      socketId: socket.id,
      userName: socket.data.userName,
      role: socket.data.role,
      isSharing
    });
  });

  // 4. File Download Request (Layer 5: Requires Trust >= 75)
  socket.on("request-file-download", ({ fileId, fileName }) => {
    const cleanClassroomId = socket.data.classroomId;
    if (!cleanClassroomId) return;

    if (socket.data.role !== "teacher") {
      const session = trustEngine.getOrCreateSession(cleanClassroomId, socket.id);
      const policy = policyEngine.evaluateCapabilityPolicy("download", session.trustScore);
      if (!policy.allowed) {
        socket.emit("capability-denied", {
          capability: "download",
          requiredScore: 75,
          currentScore: session.trustScore,
          message: `Download locked: Continuous Trust score (${session.trustScore}) is below required 75.`
        });
        return;
      }
    }

    socket.emit("file-download-approved", { fileId, fileName });
  });

  // 5. Exam Submit Request (Layer 5: Requires Trust >= 85)
  socket.on("request-exam-submit", ({ examId, answers }) => {
    const cleanClassroomId = socket.data.classroomId;
    if (!cleanClassroomId) return;

    const session = trustEngine.getOrCreateSession(cleanClassroomId, socket.id);
    const policy = policyEngine.evaluateCapabilityPolicy("exam_submit", session.trustScore);
    if (!policy.allowed) {
      socket.emit("exam-submit-denied", {
        requiredScore: 85,
        currentScore: session.trustScore,
        message: `Exam submission blocked! Continuous trust score (${session.trustScore}) is below the required 85 threshold due to focus/tab-switch penalties. Please perform Step-Up verification.`
      });
      return;
    }

    auditLedger.logEvent({
      classroomId: cleanClassroomId,
      userId: socket.data.userId || socket.id,
      userName: socket.data.userName,
      eventType: "EXAM_SUBMISSION_VERIFIED",
      delta: 0,
      newScore: session.trustScore,
      decision: "ALLOW",
      reasonCode: "EXAM_SUBMIT_SUCCESS"
    });

    socket.emit("exam-submit-approved", {
      examId,
      message: "Exam submission accepted and verified with Continuous Trust score: " + session.trustScore
    });
  });

  // 6. In-Class Step-Up Verification (Layer 2: +20 Trust Boost)
  socket.on("step-up-verify", ({ method }) => {
    const cleanClassroomId = socket.data.classroomId;
    if (!cleanClassroomId) return;

    const updateResult = trustEngine.updateTrustScore({
      classroomId: cleanClassroomId,
      participantKey: socket.id,
      eventType: "STEP_UP_SUCCESS",
      customReward: 20,
      reason: `Step-up authentication verified (+20 boost via ${method || "biometric"})`
    });

    const policies = policyEngine.evaluateAllPolicies(
      updateResult.trustScore,
      ["STEP_UP_VERIFICATION_SUCCESS"],
      updateResult.session.manualBypass
    );

    auditLedger.logEvent({
      classroomId: cleanClassroomId,
      userId: socket.data.userId || socket.id,
      userName: socket.data.userName,
      eventType: "STEP_UP_SUCCESS",
      delta: updateResult.delta,
      newScore: updateResult.trustScore,
      decision: "ALLOW",
      reasonCode: "STEP_UP_BOOST"
    });

    socket.emit("trust-score-updated", {
      participantKey: socket.id,
      trustScore: updateResult.trustScore,
      delta: updateResult.delta,
      capabilities: updateResult.capabilities,
      policies,
      reason: "Step-up verification passed! +20 Trust Boost applied."
    });

    const teachers = classroomTeachers.get(cleanClassroomId);
    if (teachers) {
      const summary = trustEngine.getClassroomTrustSummary(cleanClassroomId);
      teachers.forEach((tId) => {
        io.to(tId).emit("classroom-trust-summary", { summary });
      });
    }
  });

  // 7. Teacher Manual Override
  socket.on("teacher-trust-override", ({ targetSocketId, newScore, reason, bypassCapabilities }) => {
    if (socket.data.role !== "teacher") return;
    const cleanClassroomId = socket.data.classroomId;
    if (!cleanClassroomId || !targetSocketId) return;

    const result = trustEngine.manualOverride({
      classroomId: cleanClassroomId,
      participantKey: targetSocketId,
      newScore,
      reason,
      bypassCapabilities
    });

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      const policies = policyEngine.evaluateAllPolicies(result.trustScore, ["TEACHER_MANUAL_OVERRIDE"], bypassCapabilities);
      targetSocket.emit("trust-score-updated", {
        participantKey: targetSocketId,
        trustScore: result.trustScore,
        delta: result.delta,
        capabilities: result.capabilities,
        policies,
        reason: reason || "Score overridden by Teacher"
      });
    }

    auditLedger.logEvent({
      classroomId: cleanClassroomId,
      userId: targetSocket ? (targetSocket.data.userId || targetSocketId) : targetSocketId,
      userName: targetSocket ? targetSocket.data.userName : "Student",
      eventType: "TEACHER_MANUAL_OVERRIDE",
      delta: result.delta,
      newScore: result.trustScore,
      decision: result.trustScore >= 20 ? "ALLOW" : "BLOCK",
      reasonCode: "TEACHER_OVERRIDE"
    });

    // Broadcast updated summary to all teachers
    const teachers = classroomTeachers.get(cleanClassroomId);
    if (teachers) {
      const summary = trustEngine.getClassroomTrustSummary(cleanClassroomId);
      teachers.forEach((tId) => {
        io.to(tId).emit("classroom-trust-summary", { summary });
      });
    }
  });

  // 8. Request Trust Summary
  socket.on("get-trust-summary", () => {
    const cleanClassroomId = socket.data.classroomId;
    if (!cleanClassroomId) return;
    const summary = trustEngine.getClassroomTrustSummary(cleanClassroomId);
    socket.emit("classroom-trust-summary", { summary });
  });

  // ========================================
  // EXAM MODE & ASSESSMENT ENGINE (TEACHER & STUDENT)
  // ========================================

  // 1. Teacher publishes an Exam
  socket.on("publish-classroom-exam", ({ exam, classroomId }) => {
    if (socket.data.role !== "teacher") return;
    const cleanClassroomId = String(classroomId || socket.data.classroomId || "").trim().toUpperCase();
    if (!cleanClassroomId || !exam) return;

    const examId = exam.id || "exam_" + Date.now();
    const fullExam = {
      id: examId,
      title: exam.title || "Classroom Examination",
      description: exam.description || "Proctored Continuous Trust Assessment",
      durationMinutes: Number(exam.durationMinutes) || 15,
      minTrustScore: Number(exam.minTrustScore) || 70,
      questions: Array.isArray(exam.questions) ? exam.questions : [],
      createdBy: socket.data.userName || "Instructor",
      createdAt: new Date().toISOString(),
      isOpen: true
    };

    classroomExams.set(cleanClassroomId, fullExam);
    classroomExamSubmissions.set(cleanClassroomId, []);

    // Create a student-safe version (remove correct answer keys so cheating is impossible)
    const studentSafeQuestions = fullExam.questions.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options,
      points: q.points || 1
    }));

    const studentSafeExam = {
      ...fullExam,
      questions: studentSafeQuestions
    };

    // Broadcast safe exam to students, and full exam to teachers
    socket.to(cleanClassroomId).emit("classroom-exam-published", { exam: studentSafeExam });
    socket.emit("classroom-exam-published", { exam: fullExam, submissions: [] });

    console.log(`📝 Teacher launched exam "${fullExam.title}" (${fullExam.questions.length} questions) in room ${cleanClassroomId}`);
  });

  // 2. Fetch current active exam & submissions
  socket.on("get-classroom-exam", () => {
    const cleanClassroomId = socket.data.classroomId;
    if (!cleanClassroomId) return;

    const exam = classroomExams.get(cleanClassroomId);
    const submissions = classroomExamSubmissions.get(cleanClassroomId) || [];

    if (!exam) {
      socket.emit("classroom-exam-state", { exam: null, submissions: [] });
      return;
    }

    if (socket.data.role === "teacher") {
      socket.emit("classroom-exam-state", { exam, submissions });
    } else {
      const studentSafeQuestions = exam.questions.map(q => ({
        id: q.id,
        text: q.text,
        options: q.options,
        points: q.points || 1
      }));
      const mySubmission = submissions.find(s => s.studentSocketId === socket.id || (s.studentEmail && s.studentEmail === socket.data.userEmail));
      socket.emit("classroom-exam-state", {
        exam: { ...exam, questions: studentSafeQuestions },
        mySubmission: mySubmission || null
      });
    }
  });

  // 3. Student Submits Exam
  socket.on("submit-classroom-exam", ({ examId, answers = {}, trustScore = 80, violationsCount = 0 }) => {
    const cleanClassroomId = socket.data.classroomId;
    if (!cleanClassroomId) return;

    const exam = classroomExams.get(cleanClassroomId);
    if (!exam || exam.id !== examId) {
      socket.emit("exam-submission-error", { message: "Exam session is not active or has ended." });
      return;
    }

    // Calculate score accurately by comparing against exam.questions
    let score = 0;
    const answerBreakdown = exam.questions.map(q => {
      const studentChosen = answers[q.id];
      const correctChoice = q.correctOption || q.correct || "A";
      const isCorrect = studentChosen && String(studentChosen).toUpperCase() === String(correctChoice).toUpperCase();
      if (isCorrect) score += (q.points || 1);
      return {
        questionId: q.id,
        questionText: q.text,
        chosen: studentChosen || "Not Answered",
        correct: correctChoice,
        isCorrect
      };
    });

    const totalPossible = exam.questions.reduce((acc, q) => acc + (q.points || 1), 0) || 1;
    const percentage = Math.round((score / totalPossible) * 100);
    const passed = percentage >= 50;

    const submissionRecord = {
      submissionId: "sub_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      examId,
      examTitle: exam.title,
      studentSocketId: socket.id,
      studentName: socket.data.userName || "Student",
      studentEmail: socket.data.userEmail || "",
      studentId: socket.data.userId || socket.id,
      score,
      totalPossible,
      percentage,
      passed,
      trustScore,
      violationsCount,
      answers,
      answerBreakdown,
      submittedAt: new Date().toISOString()
    };

    // Store in submissions map
    if (!classroomExamSubmissions.has(cleanClassroomId)) {
      classroomExamSubmissions.set(cleanClassroomId, []);
    }
    const currentSubs = classroomExamSubmissions.get(cleanClassroomId);
    const filteredSubs = currentSubs.filter(s => s.studentSocketId !== socket.id && (!s.studentEmail || s.studentEmail !== socket.data.userEmail));
    filteredSubs.push(submissionRecord);
    classroomExamSubmissions.set(cleanClassroomId, filteredSubs);

    // Notify the submitting student with confirmation
    socket.emit("exam-submitted-success", {
      submission: submissionRecord,
      message: `Exam submitted successfully! Score: ${score}/${totalPossible} (${percentage}%)`
    });

    // Notify ALL Teachers in real-time
    const teachers = classroomTeachers.get(cleanClassroomId);
    if (teachers) {
      teachers.forEach(teacherId => {
        io.to(teacherId).emit("student-exam-submitted", {
          newSubmission: submissionRecord,
          submissions: filteredSubs,
          message: `🧑‍🎓 Student ${submissionRecord.studentName} just submitted "${exam.title}"! Score: ${percentage}%`
        });
      });
    }

    // Log to Audit Ledger
    auditLedger.logEvent({
      classroomId: cleanClassroomId,
      userId: socket.data.userId || socket.id,
      userName: socket.data.userName,
      eventType: "EXAM_COMPLETED",
      delta: 0,
      newScore: trustScore,
      decision: "ALLOW",
      reasonCode: `SCORE_${percentage}PCT_VIOLATIONS_${violationsCount}`
    });

    console.log(`✅ Student ${submissionRecord.studentName} submitted exam in ${cleanClassroomId}: ${percentage}%`);
  });

  // 4. Teacher closes/ends the active Exam
  socket.on("close-classroom-exam", () => {
    if (socket.data.role !== "teacher") return;
    const cleanClassroomId = socket.data.classroomId;
    if (!cleanClassroomId) return;

    const exam = classroomExams.get(cleanClassroomId);
    if (exam) {
      exam.isOpen = false;
      classroomExams.set(cleanClassroomId, exam);
    }
    io.to(cleanClassroomId).emit("classroom-exam-closed", { message: "The instructor has concluded the examination session." });
  });

  // ========================================
  // CLASSROOM RESOURCES & FILE SYSTEM
  // (Restricted: ONLY TEACHER CAN UPLOAD/DELETE)
  // ========================================

  const getOrInitClassroomResources = (cleanClassroomId) => {
    if (!classroomResources.has(cleanClassroomId)) {
      classroomResources.set(cleanClassroomId, [
        {
          id: "res_001",
          name: "Lecture-04-Zero-Trust-Architecture.pdf",
          size: "2.8 MB",
          type: "pdf",
          category: "Lecture Slides",
          uploader: "Instructor",
          uploaderRole: "teacher",
          uploadedAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: "res_002",
          name: "Continuous-Trust-Algorithm-Notes.docx",
          size: "1.4 MB",
          type: "doc",
          category: "Notes",
          uploader: "Instructor",
          uploaderRole: "teacher",
          uploadedAt: new Date(Date.now() - 1800000).toISOString()
        },
        {
          id: "res_003",
          name: "Assignment-3-Security-Code-Starter.zip",
          size: "5.2 MB",
          type: "zip",
          category: "Code Starter",
          uploader: "Instructor",
          uploaderRole: "teacher",
          uploadedAt: new Date(Date.now() - 900000).toISOString()
        }
      ]);
    }
    return classroomResources.get(cleanClassroomId);
  };

  // 1. Fetch Resources
  socket.on("get-classroom-resources", () => {
    const cleanClassroomId = socket.data.classroomId;
    if (!cleanClassroomId) return;
    const files = getOrInitClassroomResources(cleanClassroomId);
    socket.emit("classroom-resources-list", { files });
  });

  // 2. Teacher Uploads Resource (STRICT ROLE CHECK: ONLY TEACHER)
  socket.on("upload-classroom-resource", ({ file }) => {
    if (socket.data.role !== "teacher") {
      socket.emit("resource-upload-denied", { message: "Upload restricted: Only teachers are permitted to upload classroom materials." });
      return;
    }
    const cleanClassroomId = socket.data.classroomId;
    if (!cleanClassroomId || !file) return;

    const files = getOrInitClassroomResources(cleanClassroomId);
    const newFile = {
      id: "res_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      name: file.name || "Classroom-Document.pdf",
      size: file.size || "1.2 MB",
      type: file.type || "pdf",
      category: file.category || "Classroom Material",
      uploader: socket.data.userName || "Instructor",
      uploaderRole: "teacher",
      dataUrl: file.dataUrl || null,
      uploadedAt: new Date().toISOString()
    };

    files.unshift(newFile);
    classroomResources.set(cleanClassroomId, files);

    // Broadcast new resource to all students and teachers in the room
    io.to(cleanClassroomId).emit("classroom-resource-added", { file: newFile, files });
    console.log(`📁 Teacher uploaded resource "${newFile.name}" into ${cleanClassroomId}`);
  });

  // 3. Teacher Deletes Resource (STRICT ROLE CHECK: ONLY TEACHER)
  socket.on("delete-classroom-resource", ({ fileId }) => {
    if (socket.data.role !== "teacher") return;
    const cleanClassroomId = socket.data.classroomId;
    if (!cleanClassroomId || !fileId) return;

    const files = getOrInitClassroomResources(cleanClassroomId);
    const updated = files.filter(f => f.id !== fileId);
    classroomResources.set(cleanClassroomId, updated);

    io.to(cleanClassroomId).emit("classroom-resource-deleted", { fileId, files: updated });
  });


  // ========================================
  // LEAVE & DISCONNECT HANDLER (ISOLATED)
  // ========================================
  const handleUserLeft = (sock) => {
    const classroomId = sock.data.classroomId;
    if (!classroomId) return;

    trustEngine.removeParticipant(classroomId, sock.id);
    threatDetector.cleanupParticipant(sock.id);

    if (classroomWaitingRooms.has(classroomId)) {
      const remaining = classroomWaitingRooms.get(classroomId).filter((s) => s.socketId !== sock.id);
      classroomWaitingRooms.set(classroomId, remaining);
      io.to(classroomId).emit("waiting-list-update", { waitingStudents: remaining });
      const teachers = classroomTeachers.get(classroomId);
      if (teachers) {
        teachers.forEach((tId) => io.to(tId).emit("waiting-list-update", { waitingStudents: remaining }));
      }
    }

    if (sock.data.role === "teacher" && classroomTeachers.has(classroomId)) {
      classroomTeachers.get(classroomId).delete(sock.id);
      // Teacher left: notify all students
      sock.to(classroomId).emit("user-left", { socketId: sock.id });
    } else {
      // Student left: notify ONLY teachers so other students remain private
      const teachers = classroomTeachers.get(classroomId);
      if (teachers) {
        teachers.forEach((teacherSockId) => {
          io.to(teacherSockId).emit("user-left", { socketId: sock.id });
        });
      }
    }

    // Refresh trust summary for teachers
    const teachers = classroomTeachers.get(classroomId);
    if (teachers) {
      const summary = trustEngine.getClassroomTrustSummary(classroomId);
      teachers.forEach((tId) => io.to(tId).emit("classroom-trust-summary", { summary }));
    }
  };

  socket.on("leave-classroom", () => {
    handleUserLeft(socket);
    const classroomId = socket.data.classroomId;
    if (classroomId) {
      socket.leave(classroomId);
      socket.leave(`waiting-${classroomId}`);
    }
  });

  socket.on("disconnect", () => {
    handleUserLeft(socket);
    console.log("Socket disconnected:", socket.id);
  });
});


// ==========================================
// MONGODB
// ==========================================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((error) => {
    console.error(
      "MongoDB connection error:",
      error.message || error
    );
  });


// ==========================================
// SERVER
// ==========================================

const PORT =
  process.env.PORT || 5000;

server.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );

});