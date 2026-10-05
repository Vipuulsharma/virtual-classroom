const crypto = require("crypto");

// Store active OTPs in memory with automatic expiration
// Key format: "register:<email>" or "login:<userId>" or "join:<classroomId>:<email>"
const otpStore = new Map();

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a 6-digit cryptographic numeric OTP
 */
function generate6DigitOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Dispatch / Store registration OTPs (Email + Mobile)
 */
function sendRegisterOtps({ email, phone, name }) {
  const emailOtp = generate6DigitOtp();
  const mobileOtp = generate6DigitOtp();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;

  const key = `register:${email.toLowerCase().trim()}`;
  otpStore.set(key, {
    email: email.toLowerCase().trim(),
    phone: phone ? phone.trim() : "",
    emailOtp,
    mobileOtp,
    expiresAt,
    verified: false
  });

  // Log prominently for security tracking in console
  console.log("\n=======================================================");
  console.log("🔒 [HIGH SECURITY VERIFICATION] REGISTRATION OTPs");
  console.log(`👤 User:       ${name} (${email})`);
  console.log(`📱 Phone:      ${phone || "N/A"}`);
  console.log(`📧 Email OTP:  ${emailOtp}`);
  console.log(`📲 Mobile OTP: ${mobileOtp}`);
  console.log(`⏳ Valid For:  10 Minutes`);
  console.log("=======================================================\n");

  return { emailOtp, mobileOtp, expiresAt };
}

/**
 * Verify registration OTPs
 */
function verifyRegisterOtps({ email, emailOtp, mobileOtp }) {
  const key = `register:${email.toLowerCase().trim()}`;
  const record = otpStore.get(key);

  if (!record) {
    return { success: false, message: "No active verification session found. Please request new OTPs." };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return { success: false, message: "OTPs have expired. Please request a new code." };
  }

  if (record.emailOtp !== emailOtp.trim()) {
    return { success: false, message: "Invalid Email OTP. Please check your email and try again." };
  }

  // If mobile OTP was requested, verify it as well
  if (record.mobileOtp && record.mobileOtp !== mobileOtp.trim()) {
    return { success: false, message: "Invalid Mobile OTP. Please check your SMS and try again." };
  }

  // Clear once successfully used
  otpStore.delete(key);
  return { success: true, message: "Email and Mobile OTPs verified successfully!" };
}

/**
 * Dispatch / Store Login 2FA OTPs (Email + Mobile)
 */
function sendLoginOtps({ userId, email, phone, name }) {
  const emailOtp = generate6DigitOtp();
  const mobileOtp = generate6DigitOtp();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;

  const key = `login:${userId.toString()}`;
  otpStore.set(key, {
    userId: userId.toString(),
    email: email.toLowerCase().trim(),
    phone: phone || "",
    emailOtp,
    mobileOtp,
    expiresAt
  });

  console.log("\n=======================================================");
  console.log("🔒 [HIGH SECURITY 2FA] LOGIN OTPs");
  console.log(`👤 User:       ${name} (${email})`);
  console.log(`📱 Phone:      ${phone || "N/A"}`);
  console.log(`📧 Email OTP:  ${emailOtp}`);
  console.log(`📲 Mobile OTP: ${mobileOtp}`);
  console.log(`⏳ Valid For:  10 Minutes`);
  console.log("=======================================================\n");

  return { emailOtp, mobileOtp, expiresAt };
}

/**
 * Verify Login 2FA OTPs
 */
function verifyLoginOtps({ userId, emailOtp, mobileOtp }) {
  const key = `login:${userId.toString()}`;
  const record = otpStore.get(key);

  if (!record) {
    return { success: false, message: "No active login 2FA session found. Please log in again." };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return { success: false, message: "Login OTP has expired. Please log in again." };
  }

  if (record.emailOtp !== emailOtp.trim()) {
    return { success: false, message: "Incorrect Email OTP." };
  }

  // If user has phone registered, verify mobile OTP too
  if (record.phone && mobileOtp && record.mobileOtp !== mobileOtp.trim()) {
    return { success: false, message: "Incorrect Mobile OTP." };
  }

  otpStore.delete(key);
  return { success: true, message: "Two-factor authentication successful!" };
}

/**
 * Dispatch Classroom Join OTP
 */
function sendClassJoinOtp({ classroomId, email, phone, name }) {
  const joinOtp = generate6DigitOtp();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  const key = `join:${classroomId}:${email.toLowerCase().trim()}`;

  otpStore.set(key, {
    classroomId,
    email: email.toLowerCase().trim(),
    joinOtp,
    expiresAt
  });

  console.log("\n=======================================================");
  console.log("🔒 [HIGH SECURITY CLASSROOM ACCESS] JOIN OTP");
  console.log(`🏫 Classroom: ${classroomId}`);
  console.log(`👤 Student:   ${name} (${email})`);
  console.log(`🔑 Join OTP:  ${joinOtp}`);
  console.log("=======================================================\n");

  return { joinOtp, expiresAt };
}

/**
 * Verify Classroom Join OTP
 */
function verifyClassJoinOtp({ classroomId, email, otp }) {
  const key = `join:${classroomId}:${email.toLowerCase().trim()}`;
  const record = otpStore.get(key);

  if (!record) {
    return { success: false, message: "No active join verification found. Please request an OTP." };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return { success: false, message: "Classroom Join OTP has expired." };
  }

  if (record.joinOtp !== otp.trim()) {
    return { success: false, message: "Incorrect Classroom Join OTP." };
  }

  otpStore.delete(key);
  return { success: true, message: "Identity verified for classroom entry!" };
}

module.exports = {
  generate6DigitOtp,
  sendRegisterOtps,
  verifyRegisterOtps,
  sendLoginOtps,
  verifyLoginOtps,
  sendClassJoinOtp,
  verifyClassJoinOtp
};
