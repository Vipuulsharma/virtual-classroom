const mongoose = require("mongoose");

const classroomSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },

    subject: {
      type: String,
      required: true
    },

    classroomCode: {
      type: String,
      required: true,
      unique: true
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    isLive: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "Classroom",
  classroomSchema
);