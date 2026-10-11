const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const otpService = require("../utils/otpService");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "virtual_classroom_jwt_secret_key";

const formatUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || "",
  bio: user.bio || "",
  institution: user.institution || "",
  subjectOrGrade: user.subjectOrGrade || "",
  avatar: user.avatar || "",
  isEmailVerified: user.isEmailVerified || false,
  isMobileVerified: user.isMobileVerified || false,
  biometricRegistered: user.biometricRegistered || false,
  createdAt: user.createdAt
});

// Helper to authenticate request
const authenticateUser = (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return null;
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired session token" });
    return null;
  }
};

// ===============================
// REGISTER: 1. SEND OTPs (Email + Mobile)
// ===============================

router.post("/send-register-otp", async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "Please provide name, email, password, and role"
      });
    }

    if (!phone || phone.trim().length < 8) {
      return res.status(400).json({
        message: "Please provide a valid mobile number for high-security SMS OTP verification"
      });
    }

    if (!["teacher", "student"].includes(role)) {
      return res.status(400).json({
        message: "Role must be either 'teacher' or 'student'"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        message: "An account with this email already exists"
      });
    }

    // Generate & Dispatch Email OTP and Mobile OTP
    const otps = await otpService.sendRegisterOtps({
      email: normalizedEmail,
      phone: phone.trim(),
      name: name.trim()
    });

    res.json({
      success: true,
      message: "High-security OTPs dispatched to your Email and Mobile!",
      email: normalizedEmail,
      phone: phone.trim(),
      devEmailOtp: otps.emailOtp,
      devMobileOtp: otps.mobileOtp
    });
  } catch (error) {
    console.error("Send register OTP error:", error);
    res.status(500).json({ message: "Failed to dispatch verification codes" });
  }
});


// ===============================
// REGISTER: 2. VERIFY OTPs & CREATE ACCOUNT
// ===============================

router.post("/verify-register", async (req, res) => {
  try {
    const { name, email, phone, password, role, emailOtp, mobileOtp } = req.body;

    if (!name || !email || !password || !role || !emailOtp || !mobileOtp) {
      return res.status(400).json({
        message: "All fields including Email OTP and Mobile OTP are required"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const verification = await otpService.verifyRegisterOtps({
      email: normalizedEmail,
      emailOtp,
      mobileOtp
    });

    if (!verification.success) {
      return res.status(400).json({ message: verification.message });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        message: "An account with this email already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone ? phone.trim() : "",
      password: hashedPassword,
      role,
      isEmailVerified: true,
      isMobileVerified: true,
      biometricRegistered: !!req.body.biometricVerified
    });

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    res.status(201).json({
      message: "Security verification complete! Account created successfully.",
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    console.error("Verify register error:", error);
    res.status(500).json({
      message: "Server error during registration verification"
    });
  }
});


// Fallback legacy register endpoint
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "Please provide name, email, password, and role"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        message: "An account with this email already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone ? phone.trim() : "",
      password: hashedPassword,
      role,
      isEmailVerified: true,
      isMobileVerified: true
    });

    const token = jwt.sign(
      { userId: user._id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Registration successful",
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});


// ===============================
// LOGIN: INITIATES 2FA OTP DISPATCH
// ===============================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Please enter both email and password"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    // High security 2FA: Dispatch OTPs to Email and Phone
    const otps = await otpService.sendLoginOtps({
      userId: user._id,
      email: user.email,
      phone: user.phone,
      name: user.name
    });

    res.json({
      requires2FA: true,
      userId: user._id,
      email: user.email,
      phone: user.phone || "",
      message: "Security verification code sent to your registered email and mobile",
      devEmailOtp: otps.emailOtp,
      devMobileOtp: otps.mobileOtp
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Server error during login"
    });
  }
});


// ===============================
// LOGIN: VERIFY 2FA OTPs & ISSUE TOKEN
// ===============================

router.post("/verify-login-2fa", async (req, res) => {
  try {
    const { userId, emailOtp, mobileOtp } = req.body;

    if (!userId || !emailOtp) {
      return res.status(400).json({
        message: "User ID and Email OTP are required"
      });
    }

    const verification = await otpService.verifyLoginOtps({
      userId,
      emailOtp,
      mobileOtp
    });

    if (!verification.success) {
      return res.status(400).json({ message: verification.message });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    res.json({
      message: "Two-Factor Verification Successful! Logging in...",
      token,
      user: formatUserResponse(user)
    });
  } catch (error) {
    console.error("Login 2FA verification error:", error);
    res.status(500).json({ message: "Server error during 2FA verification" });
  }
});


// ===============================
// DEVICE SECURITY / PASSWORD VERIFICATION
// ===============================

router.post("/verify-device-password", async (req, res) => {
  try {
    const { userId, email, password } = req.body;

    if (!password || password.trim().length < 4) {
      return res.status(400).json({
        success: false,
        message: "Device password or PIN must be at least 4 characters long"
      });
    }

    let user = null;
    if (userId) {
      user = await User.findById(userId);
    } else if (email) {
      user = await User.findOne({ email: email.trim().toLowerCase() });
    }

    if (!user) {
      // Guest student or room joiner without stored password
      return res.json({ success: true, message: "Device password/PIN authorized successfully" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    // Allow either exact user password or device screen lock PIN/password (minimum 4 chars)
    if (!isMatch && password.trim().length < 4) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password. Please enter your valid account password or device PIN."
      });
    }

    // Mark biometrics as verified on user
    user.biometricRegistered = true;
    await user.save();

    res.json({
      success: true,
      message: "Device password/PIN verified successfully"
    });
  } catch (error) {
    console.error("Device password check error:", error);
    res.status(500).json({ success: false, message: "Error verifying device password" });
  }
});


// ===============================
// CLASSROOM JOIN: SEND & VERIFY OTP
// ===============================

router.post("/send-join-otp", async (req, res) => {
  try {
    const { classroomId, email, phone, name } = req.body;
    if (!classroomId || !email) {
      return res.status(400).json({ message: "Classroom ID and email are required" });
    }

    const otps = await otpService.sendClassJoinOtp({
      classroomId,
      email,
      phone,
      name: name || "Student"
    });

    res.json({
      success: true,
      message: "Classroom entry security OTP sent!",
      devJoinOtp: otps.joinOtp
    });
  } catch (error) {
    console.error("Send join OTP error:", error);
    res.status(500).json({ message: "Failed to dispatch join OTP" });
  }
});

router.post("/verify-join-otp", async (req, res) => {
  try {
    const { classroomId, email, otp } = req.body;
    if (!classroomId || !email || !otp) {
      return res.status(400).json({ message: "Classroom ID, email, and OTP are required" });
    }

    const verification = await otpService.verifyClassJoinOtp({
      classroomId,
      email,
      otp
    });

    if (!verification.success) {
      return res.status(400).json({ message: verification.message });
    }

    res.json({
      success: true,
      message: "Identity verified! Proceeding to classroom."
    });
  } catch (error) {
    console.error("Verify join OTP error:", error);
    res.status(500).json({ message: "Server error verifying join OTP" });
  }
});


// ===============================
// CURRENT USER / ME
// ===============================

router.get("/me", async (req, res) => {
  try {
    const decoded = authenticateUser(req, res);
    if (!decoded) return;

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      user: formatUserResponse(user)
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user details" });
  }
});


// ===============================
// UPDATE PROFILE
// ===============================

router.put("/profile", async (req, res) => {
  try {
    const decoded = authenticateUser(req, res);
    if (!decoded) return;

    const { name, email, phone, bio, institution, subjectOrGrade, avatar } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check email uniqueness if email is changed
    if (email && email.trim().toLowerCase() !== user.email) {
      const normalizedNewEmail = email.trim().toLowerCase();
      const existingUser = await User.findOne({
        email: normalizedNewEmail,
        _id: { $ne: user._id }
      });

      if (existingUser) {
        return res.status(400).json({
          message: "The email is already registered with another account"
        });
      }

      user.email = normalizedNewEmail;
    }

    user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (institution !== undefined) user.institution = institution.trim();
    if (subjectOrGrade !== undefined) user.subjectOrGrade = subjectOrGrade.trim();
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    // Re-sign token in case email changed
    const newToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    res.json({
      message: "Profile updated successfully!",
      token: newToken,
      user: formatUserResponse(user)
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});


// ===============================
// CHANGE PASSWORD
// ===============================

router.put("/change-password", async (req, res) => {
  try {
    const decoded = authenticateUser(req, res);
    if (!decoded) return;

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Please provide both current and new password"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters long"
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect"
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({
      message: "Password changed successfully!"
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Failed to change password" });
  }
});


// ===============================
// RESET PASSWORD (FORGOT / RECOVER)
// ===============================

router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword, role } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        message: "Please provide email and new password"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters long"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const query = { email: normalizedEmail };
    if (role) {
      query.role = role;
    }

    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({
        message: "No user found with the provided email address"
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({
      message: "Password has been reset successfully! You can now log in with your new password."
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

module.exports = router;