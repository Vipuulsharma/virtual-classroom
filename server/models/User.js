const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["teacher", "student"],
      required: true
    },

    phone: {
      type: String,
      default: "",
      trim: true
    },

    bio: {
      type: String,
      default: "",
      trim: true
    },

    institution: {
      type: String,
      default: "",
      trim: true
    },

    subjectOrGrade: {
      type: String,
      default: "",
      trim: true
    },

    avatar: {
      type: String,
      default: ""
    },

    isEmailVerified: {
      type: Boolean,
      default: false
    },

    isMobileVerified: {
      type: Boolean,
      default: false
    },

    twoFactorEnabled: {
      type: Boolean,
      default: true
    },

    biometricRegistered: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);