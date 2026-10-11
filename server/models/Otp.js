const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    purpose: {
      type: String, // 'register' | 'login' | 'join'
      required: true
    },
    identifier: {
      type: String,
      required: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      default: "",
      trim: true
    },
    emailOtp: {
      type: String,
      default: "",
      trim: true
    },
    mobileOtp: {
      type: String,
      default: "",
      trim: true
    },
    joinOtp: {
      type: String,
      default: "",
      trim: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // MongoDB TTL index
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Otp", otpSchema);
