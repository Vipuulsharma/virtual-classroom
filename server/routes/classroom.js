const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const Classroom = require("../models/Classroom");

const router = express.Router();

// Helper to normalize room code
const getCleanRoomId = (roomId) => String(roomId || "").trim().toUpperCase();

// Helper to get state maps from app
const getAppState = (req) => {
  return {
    io: req.app.get("io"),
    classroomWaitingRooms: req.app.get("classroomWaitingRooms") || new Map(),
    classroomTeachers: req.app.get("classroomTeachers") || new Map(),
    classroomStudentStatus: req.app.get("classroomStudentStatus") || new Map()
  };
};

// ======================================
// 1. CREATE CLASSROOM
// ======================================
router.post("/", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "teacher") {
      return res.status(403).json({ message: "Only teachers can create classrooms" });
    }

    const { title, subject } = req.body;
    if (!title || !subject) {
      return res.status(400).json({ message: "Title and subject are required" });
    }

    const classroomCode = crypto.randomBytes(4).toString("hex").toUpperCase();

    const classroom = await Classroom.create({
      title,
      subject,
      classroomCode,
      teacher: decoded.userId,
      students: [],
      isLive: false
    });

    res.status(201).json({
      message: "Classroom created successfully",
      classroom: {
        id: classroom._id,
        title: classroom.title,
        subject: classroom.subject,
        classroomCode: classroom.classroomCode,
        teacher: classroom.teacher,
        students: classroom.students,
        isLive: classroom.isLive
      }
    });
  } catch (error) {
    console.error("Create classroom error:", error);
    res.status(500).json({ message: "Server error creating classroom" });
  }
});

// ======================================
// 2. STUDENT KNOCK (HTTP FALLBACK)
// ======================================
router.post("/:classroomId/knock", (req, res) => {
  try {
    const cleanClassroomId = getCleanRoomId(req.params.classroomId);
    if (!cleanClassroomId) {
      return res.status(400).json({ success: false, message: "Classroom ID is required" });
    }

    const { userName, userEmail, userId, socketId } = req.body;
    const { io, classroomWaitingRooms, classroomTeachers, classroomStudentStatus } = getAppState(req);

    if (!classroomWaitingRooms.has(cleanClassroomId)) {
      classroomWaitingRooms.set(cleanClassroomId, []);
    }

    const currentWaiting = classroomWaitingRooms.get(cleanClassroomId);

    const waitingEntry = {
      socketId: socketId || `http_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userName: userName || "Student",
      userEmail: userEmail || "",
      userId: userId || "",
      joinedAt: new Date().toISOString(),
      status: "waiting"
    };

    // Filter duplicates
    const filtered = currentWaiting.filter((item) => {
      if (socketId && item.socketId === socketId) return false;
      if (userEmail && item.userEmail && item.userEmail.toLowerCase() === userEmail.toLowerCase()) return false;
      if (userId && item.userId && item.userId === userId) return false;
      return true;
    });

    filtered.push(waitingEntry);
    classroomWaitingRooms.set(cleanClassroomId, filtered);

    // Save status
    const statusMap = classroomStudentStatus.get(cleanClassroomId) || new Map();
    const studentKey = userEmail ? userEmail.toLowerCase() : (userId || waitingEntry.socketId);
    statusMap.set(studentKey, { status: "waiting", userName: waitingEntry.userName, updatedAt: Date.now() });
    classroomStudentStatus.set(cleanClassroomId, statusMap);

    console.log(`[HTTP KNOCK] 🧑‍🎓 Student (${waitingEntry.userName}) knocked for room ${cleanClassroomId}`);

    // Realtime notification to all connected teachers
    if (io) {
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

    res.json({
      success: true,
      status: "waiting",
      message: "Join request recorded in Waiting Room",
      student: waitingEntry
    });
  } catch (error) {
    console.error("HTTP Knock error:", error);
    res.status(500).json({ success: false, message: "Failed to record knock request" });
  }
});

// ======================================
// 3. GET WAITING ROOM LIST
// ======================================
router.get("/:classroomId/waiting-list", (req, res) => {
  try {
    const cleanClassroomId = getCleanRoomId(req.params.classroomId);
    const { classroomWaitingRooms } = getAppState(req);

    const waitingStudents = classroomWaitingRooms.get(cleanClassroomId) || [];

    res.json({
      success: true,
      classroomId: cleanClassroomId,
      waitingStudents
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching waiting list" });
  }
});

// ======================================
// 4. TEACHER ADMITS STUDENT (HTTP FALLBACK)
// ======================================
router.post("/:classroomId/admit", (req, res) => {
  try {
    const cleanClassroomId = getCleanRoomId(req.params.classroomId);
    const { socketId, studentEmail, studentId, studentName } = req.body;
    const { io, classroomWaitingRooms, classroomTeachers, classroomStudentStatus } = getAppState(req);

    // Update waiting list
    if (classroomWaitingRooms.has(cleanClassroomId)) {
      const remaining = classroomWaitingRooms.get(cleanClassroomId).filter((s) => {
        if (socketId && s.socketId === socketId) return false;
        if (studentEmail && s.userEmail && s.userEmail.toLowerCase() === studentEmail.toLowerCase()) return false;
        if (studentId && s.userId && s.userId === studentId) return false;
        return true;
      });
      classroomWaitingRooms.set(cleanClassroomId, remaining);

      if (io) {
        io.to(cleanClassroomId).emit("waiting-list-update", { waitingStudents: remaining });
        const teachers = classroomTeachers.get(cleanClassroomId);
        if (teachers) {
          teachers.forEach((tId) => io.to(tId).emit("waiting-list-update", { waitingStudents: remaining }));
        }
      }
    }

    // Update status map
    const statusMap = classroomStudentStatus.get(cleanClassroomId) || new Map();
    const studentKey = studentEmail ? studentEmail.toLowerCase() : (studentId || socketId);
    statusMap.set(studentKey, { status: "admitted", userName: studentName, updatedAt: Date.now() });
    if (socketId) statusMap.set(socketId, { status: "admitted", userName: studentName, updatedAt: Date.now() });
    classroomStudentStatus.set(cleanClassroomId, statusMap);

    console.log(`[HTTP ADMIT] ✅ Teacher admitted student (${studentName || studentEmail || socketId}) into ${cleanClassroomId}`);

    // Handle WebSocket admission if socket exists
    if (io) {
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

        studentSocket.emit("admission-accepted", {
          classroomId: cleanClassroomId,
          message: "The Teacher has admitted you into the classroom!"
        });

        // Send existing teachers
        const room = io.sockets.adapter.rooms.get(cleanClassroomId);
        const existingUsers = [];
        if (room) {
          room.forEach((sId) => {
            if (sId !== studentSocket.id) {
              const s = io.sockets.sockets.get(sId);
              if (s && s.data.status !== "waiting" && s.data.role === "teacher") {
                existingUsers.push({
                  socketId: sId,
                  role: s.data.role,
                  userName: s.data.userName
                });
              }
            }
          });
        }
        studentSocket.emit("existing-users", { users: existingUsers });
      }

      // Tell teachers and participants that student joined
      io.to(cleanClassroomId).emit("user-joined", {
        socketId: studentSocket ? studentSocket.id : (socketId || `admitted_${Date.now()}`),
        role: "student",
        userName: studentName || (studentSocket ? studentSocket.data.userName : "Student"),
        userEmail: studentEmail || ""
      });

      const teachers = classroomTeachers.get(cleanClassroomId);
      if (teachers) {
        teachers.forEach((tId) => {
          io.to(tId).emit("user-joined", {
            socketId: studentSocket ? studentSocket.id : (socketId || `admitted_${Date.now()}`),
            role: "student",
            userName: studentName || (studentSocket ? studentSocket.data.userName : "Student"),
            userEmail: studentEmail || ""
          });
        });
      }
    }

    res.json({
      success: true,
      status: "admitted",
      message: "Student admitted successfully"
    });
  } catch (error) {
    console.error("HTTP Admit error:", error);
    res.status(500).json({ success: false, message: "Error admitting student" });
  }
});

// ======================================
// 5. TEACHER REJECTS STUDENT (HTTP FALLBACK)
// ======================================
router.post("/:classroomId/reject", (req, res) => {
  try {
    const cleanClassroomId = getCleanRoomId(req.params.classroomId);
    const { socketId, studentEmail, studentId, reason } = req.body;
    const { io, classroomWaitingRooms, classroomTeachers, classroomStudentStatus } = getAppState(req);

    if (classroomWaitingRooms.has(cleanClassroomId)) {
      const remaining = classroomWaitingRooms.get(cleanClassroomId).filter((s) => {
        if (socketId && s.socketId === socketId) return false;
        if (studentEmail && s.userEmail && s.userEmail.toLowerCase() === studentEmail.toLowerCase()) return false;
        if (studentId && s.userId && s.userId === studentId) return false;
        return true;
      });
      classroomWaitingRooms.set(cleanClassroomId, remaining);

      if (io) {
        io.to(cleanClassroomId).emit("waiting-list-update", { waitingStudents: remaining });
        const teachers = classroomTeachers.get(cleanClassroomId);
        if (teachers) {
          teachers.forEach((tId) => io.to(tId).emit("waiting-list-update", { waitingStudents: remaining }));
        }
      }
    }

    const statusMap = classroomStudentStatus.get(cleanClassroomId) || new Map();
    const studentKey = studentEmail ? studentEmail.toLowerCase() : (studentId || socketId);
    statusMap.set(studentKey, {
      status: "rejected",
      reason: reason || "The teacher declined your admission request.",
      updatedAt: Date.now()
    });
    if (socketId) {
      statusMap.set(socketId, {
        status: "rejected",
        reason: reason || "The teacher declined your admission request.",
        updatedAt: Date.now()
      });
    }
    classroomStudentStatus.set(cleanClassroomId, statusMap);

    if (io) {
      const studentSocket = socketId ? io.sockets.sockets.get(socketId) : null;
      if (studentSocket) {
        studentSocket.emit("admission-rejected", {
          reason: reason || "The teacher declined your admission request."
        });
        studentSocket.leave(`waiting-${cleanClassroomId}`);
      }
    }

    res.json({
      success: true,
      status: "rejected",
      message: "Student admission rejected"
    });
  } catch (error) {
    console.error("HTTP Reject error:", error);
    res.status(500).json({ success: false, message: "Error rejecting student" });
  }
});

// ======================================
// 6. STUDENT ADMISSION STATUS POLL
// ======================================
router.get("/:classroomId/student-status", (req, res) => {
  try {
    const cleanClassroomId = getCleanRoomId(req.params.classroomId);
    const { email, userId, socketId, userName } = req.query;
    const { classroomWaitingRooms, classroomStudentStatus } = getAppState(req);

    const statusMap = classroomStudentStatus.get(cleanClassroomId);
    let statusRecord = null;

    if (statusMap) {
      if (email && statusMap.has(email.toLowerCase())) {
        statusRecord = statusMap.get(email.toLowerCase());
      } else if (userId && statusMap.has(userId)) {
        statusRecord = statusMap.get(userId);
      } else if (socketId && statusMap.has(socketId)) {
        statusRecord = statusMap.get(socketId);
      }
    }

    if (!statusRecord) {
      // Check if student is still in waiting list
      const waitingList = classroomWaitingRooms.get(cleanClassroomId) || [];
      const isWaiting = waitingList.some((s) => {
        if (socketId && s.socketId === socketId) return true;
        if (email && s.userEmail && s.userEmail.toLowerCase() === email.toLowerCase()) return true;
        if (userId && s.userId && s.userId === userId) return true;
        if (userName && s.userName && s.userName === userName) return true;
        return false;
      });

      if (isWaiting) {
        return res.json({ success: true, status: "waiting" });
      }

      return res.json({ success: true, status: "none" });
    }

    res.json({
      success: true,
      status: statusRecord.status,
      reason: statusRecord.reason || ""
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error checking status" });
  }
});

module.exports = router;
