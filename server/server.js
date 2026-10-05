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
// classroomId -> Array<{ socketId, userName, userEmail, userId, joinedAt }>
const classroomWaitingRooms = new Map();
// classroomId -> Set of teacher socket IDs
const classroomTeachers = new Map();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // ========================================
  // JOIN CLASSROOM
  // ========================================
  socket.on("join-classroom", ({ classroomId, role, userName, userEmail, userId }) => {
    socket.data.classroomId = classroomId;
    socket.data.role = role;
    socket.data.userName = userName || (role === "teacher" ? "Teacher" : "Student");
    socket.data.userEmail = userEmail || "";
    socket.data.userId = userId || "";

    if (role === "teacher") {
      // Teacher joins directly as Host
      socket.join(classroomId);

      if (!classroomTeachers.has(classroomId)) {
        classroomTeachers.set(classroomId, new Set());
      }
      classroomTeachers.get(classroomId).add(socket.id);

      console.log(`👨‍🏫 Teacher (${socket.data.userName}) started host session in ${classroomId}`);

      // Gather existing active users in room
      const room = io.sockets.adapter.rooms.get(classroomId);
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
      const waitingList = classroomWaitingRooms.get(classroomId) || [];
      socket.emit("waiting-list-update", { waitingStudents: waitingList });

    } else {
      // STUDENT ENTERS WAITING ROOM (REQUIRES TEACHER ACCEPTANCE)
      socket.data.status = "waiting";
      socket.join(`waiting-${classroomId}`);

      if (!classroomWaitingRooms.has(classroomId)) {
        classroomWaitingRooms.set(classroomId, []);
      }

      const waitingEntry = {
        socketId: socket.id,
        userName: socket.data.userName,
        userEmail: socket.data.userEmail,
        userId: socket.data.userId,
        joinedAt: new Date().toISOString()
      };

      const currentWaiting = classroomWaitingRooms.get(classroomId);
      // Avoid duplicate entries
      const filtered = currentWaiting.filter((item) => item.socketId !== socket.id);
      filtered.push(waitingEntry);
      classroomWaitingRooms.set(classroomId, filtered);

      console.log(`🧑‍🎓 Student (${socket.data.userName}) entered waiting room for ${classroomId}`);

      // Notify the student that they are in the waiting room
      socket.emit("waiting-for-admission", {
        message: "You are in the Waiting Room. The Teacher will admit you shortly.",
        classroomId
      });

      // Notify all teachers in this classroom
      io.to(classroomId).emit("student-knocking", {
        student: waitingEntry,
        classroomId
      });
      io.to(classroomId).emit("waiting-list-update", {
        waitingStudents: classroomWaitingRooms.get(classroomId)
      });
    }
  });


  // ========================================
  // TEACHER ADMITS STUDENT
  // ========================================
  socket.on("admit-student", ({ socketId, classroomId }) => {
    // Only teacher can admit
    if (socket.data.role !== "teacher") return;

    const studentSocket = io.sockets.sockets.get(socketId);
    if (!studentSocket) return;

    studentSocket.data.status = "admitted";
    studentSocket.leave(`waiting-${classroomId}`);
    studentSocket.join(classroomId);

    // Remove from waiting list
    if (classroomWaitingRooms.has(classroomId)) {
      const remaining = classroomWaitingRooms.get(classroomId).filter((s) => s.socketId !== socketId);
      classroomWaitingRooms.set(classroomId, remaining);
      io.to(classroomId).emit("waiting-list-update", { waitingStudents: remaining });
    }

    console.log(`✅ Teacher admitted student (${studentSocket.data.userName}) into ${classroomId}`);

    // Notify student they are admitted
    studentSocket.emit("admission-accepted", {
      classroomId,
      message: "The Teacher has admitted you into the classroom!"
    });

    // Send existing users in room to the newly admitted student
    // PRIVACY WEBINAR MODE: Students only connect to the Teacher!
    const room = io.sockets.adapter.rooms.get(classroomId);
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

    // Tell TEACHER that this student has officially joined (keep other students private)
    const teachers = classroomTeachers.get(classroomId);
    if (teachers) {
      teachers.forEach((teacherSockId) => {
        io.to(teacherSockId).emit("user-joined", {
          socketId: studentSocket.id,
          role: "student",
          userName: studentSocket.data.userName
        });
      });
    }
  });


  // ========================================
  // TEACHER REJECTS STUDENT
  // ========================================
  socket.on("reject-student", ({ socketId, classroomId, reason }) => {
    if (socket.data.role !== "teacher") return;

    const studentSocket = io.sockets.sockets.get(socketId);
    if (studentSocket) {
      studentSocket.emit("admission-rejected", {
        reason: reason || "The teacher declined your admission request."
      });
      studentSocket.leave(`waiting-${classroomId}`);
    }

    if (classroomWaitingRooms.has(classroomId)) {
      const remaining = classroomWaitingRooms.get(classroomId).filter((s) => s.socketId !== socketId);
      classroomWaitingRooms.set(classroomId, remaining);
      io.to(classroomId).emit("waiting-list-update", { waitingStudents: remaining });
    }

    console.log(`❌ Teacher rejected student from ${classroomId}`);
  });


  // ========================================
  // TEACHER KICKS / REMOVES STUDENT FROM ROOM
  // ========================================
  socket.on("kick-student", ({ socketId, classroomId, reason }) => {
    if (socket.data.role !== "teacher") return;

    const studentSocket = io.sockets.sockets.get(socketId);
    if (studentSocket) {
      studentSocket.emit("kicked-from-class", {
        message: reason || "You were removed from the classroom by the teacher."
      });
      studentSocket.leave(classroomId);
    }

    socket.to(classroomId).emit("user-left", { socketId });
    console.log(`🚫 Teacher kicked student ${socketId} from ${classroomId}`);
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