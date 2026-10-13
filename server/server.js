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

app.set("io", io);
app.set("classroomWaitingRooms", classroomWaitingRooms);
app.set("classroomTeachers", classroomTeachers);
app.set("classroomStudentStatus", classroomStudentStatus);
app.set("classroomAdmittedStudents", classroomAdmittedStudents);

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
        statusMap.get(studentKey)?.status === "admitted";

      if (isAlreadyAdmitted) {
        socket.data.status = "admitted";
        socket.leave(`waiting-${cleanClassroomId}`);
        socket.join(cleanClassroomId);

        admittedSet.add(socket.id);
        if (socket.data.userEmail) admittedSet.add(socket.data.userEmail.toLowerCase());
        if (socket.data.userId) admittedSet.add(socket.data.userId);
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
  // LEAVE & DISCONNECT HANDLER (ISOLATED)
  // ========================================
  const handleUserLeft = (sock) => {
    const classroomId = sock.data.classroomId;
    if (!classroomId) return;

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