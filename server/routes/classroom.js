const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const Classroom = require("../models/Classroom");

const router = express.Router();


// ======================================
// CREATE CLASSROOM
// ======================================

router.post("/", async (req, res) => {
  try {

    // ------------------------------
    // JWT token check
    // ------------------------------

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );


    // ------------------------------
    // Teacher check
    // ------------------------------

    if (decoded.role !== "teacher") {
      return res.status(403).json({
        message: "Only teachers can create classrooms"
      });
    }


    // ------------------------------
    // Request data
    // ------------------------------

    const { title, subject } = req.body;

    if (!title || !subject) {
      return res.status(400).json({
        message: "Title and subject are required"
      });
    }


    // ------------------------------
    // Generate classroom code
    // ------------------------------

    const classroomCode = crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase();


    // ------------------------------
    // Save classroom
    // ------------------------------

    const classroom = await Classroom.create({
      title,
      subject,
      classroomCode,
      teacher: decoded.userId,
      students: [],
      isLive: false
    });


    // ------------------------------
    // Response
    // ------------------------------

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

    res.status(500).json({
      message: "Server error"
    });

  }
});


module.exports = router;
