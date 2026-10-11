const crypto = require("crypto");
let Otp = null;
try {
  Otp = require("../models/Otp");
} catch (e) {
  Otp = null;
}

// Store active OTPs in memory for fast retrieval, backed by MongoDB for persistence
const otpStore = new Map();

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a 6-digit cryptographic numeric OTP
 */
function generate6DigitOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Persist OTP record to MongoDB (if available) with TTL auto-cleanup
 */
async function saveToDb(key, data) {
  if (!Otp) return;
  try {
    await Otp.findOneAndUpdate(
      { key },
      {
        ...data,
        key,
        expiresAt: new Date(data.expiresAt)
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn("Could not save OTP to MongoDB (using in-memory cache):", err.message);
  }
}

/**
 * Retrieve OTP from in-memory cache or MongoDB fallback
 */
async function getFromStoreOrDb(key) {
  let record = otpStore.get(key);
  if (record) return record;

  if (Otp) {
    try {
      const dbRecord = await Otp.findOne({ key });
      if (dbRecord) {
        record = {
          email: dbRecord.email,
          phone: dbRecord.phone,
          emailOtp: dbRecord.emailOtp,
          mobileOtp: dbRecord.mobileOtp,
          joinOtp: dbRecord.joinOtp,
          expiresAt: dbRecord.expiresAt ? new Date(dbRecord.expiresAt).getTime() : Date.now() + OTP_EXPIRY_MS,
          userId: dbRecord.identifier
        };
        otpStore.set(key, record);
        return record;
      }
    } catch (err) {
      console.warn("Could not query OTP from MongoDB:", err.message);
    }
  }
  return null;
}

/**
 * Remove OTP after successful use or expiration
 */
async function deleteFromStoreAndDb(key) {
  otpStore.delete(key);
  if (Otp) {
    try {
      await Otp.deleteOne({ key });
    } catch (e) {
      // ignore cleanup errors
    }
  }
}

/**
 * Dispatch / Store registration OTPs (Email + Mobile)
 */
async function sendRegisterOtps({ email, phone, name }) {
  const emailOtp = generate6DigitOtp();
  const mobileOtp = generate6DigitOtp();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const key = `register:${normalizedEmail}`;

  const record = {
    email: normalizedEmail,
    phone: phone ? String(phone).trim() : "",
    emailOtp,
    mobileOtp,
    expiresAt,
    verified: false
  };

  otpStore.set(key, record);
  await saveToDb(key, {
    purpose: "register",
    identifier: normalizedEmail,
    email: normalizedEmail,
    phone: record.phone,
    emailOtp,
    mobileOtp,
    expiresAt
  });

  console.log("\n=======================================================");
  console.log("🔒 [HIGH SECURITY VERIFICATION] REGISTRATION OTPs");
  console.log(`👤 User:       ${name} (${normalizedEmail})`);
  console.log(`📱 Phone:      ${record.phone || "N/A"}`);
  console.log(`📧 Email OTP:  ${emailOtp}`);
  console.log(`📲 Mobile OTP: ${mobileOtp}`);
  console.log(`⏳ Valid For:  10 Minutes`);
  console.log("=======================================================\n");

  return { emailOtp, mobileOtp, expiresAt };
}

/**
 * Verify registration OTPs
 */
async function verifyRegisterOtps({ email, emailOtp, mobileOtp }) {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const key = `register:${normalizedEmail}`;
  const record = await getFromStoreOrDb(key);

  if (!record) {
    return { success: false, message: "No active verification session found. Please request new OTPs." };
  }

  if (Date.now() > record.expiresAt) {
    await deleteFromStoreAndDb(key);
    return { success: false, message: "OTPs have expired. Please request a new code." };
  }

  const cleanEmailOtp = String(emailOtp || "").trim();
  const cleanMobileOtp = String(mobileOtp || "").trim();

  if (record.emailOtp !== cleanEmailOtp) {
    return { success: false, message: "Invalid Email OTP. Please check your email and try again." };
  }

  if (record.mobileOtp && cleanMobileOtp && record.mobileOtp !== cleanMobileOtp) {
    return { success: false, message: "Invalid Mobile OTP. Please check your SMS and try again." };
  }

  await deleteFromStoreAndDb(key);
  return { success: true, message: "Email and Mobile OTPs verified successfully!" };
}

/**
 * Dispatch / Store Login 2FA OTPs (Email + Mobile)
 */
async function sendLoginOtps({ userId, email, phone, name }) {
  const emailOtp = generate6DigitOtp();
  const mobileOtp = generate6DigitOtp();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  const cleanUserId = String(userId || "").trim();
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const key = `login:${cleanUserId}`;

  const record = {
    userId: cleanUserId,
    email: normalizedEmail,
    phone: phone ? String(phone).trim() : "",
    emailOtp,
    mobileOtp,
    expiresAt
  };

  otpStore.set(key, record);
  await saveToDb(key, {
    purpose: "login",
    identifier: cleanUserId,
    email: normalizedEmail,
    phone: record.phone,
    emailOtp,
    mobileOtp,
    expiresAt
  });

  console.log("\n=======================================================");
  console.log("🔒 [HIGH SECURITY 2FA] LOGIN OTPs");
  console.log(`👤 User:       ${name} (${normalizedEmail})`);
  console.log(`📱 Phone:      ${record.phone || "N/A"}`);
  console.log(`📧 Email OTP:  ${emailOtp}`);
  console.log(`📲 Mobile OTP: ${mobileOtp}`);
  console.log(`⏳ Valid For:  10 Minutes`);
  console.log("=======================================================\n");

  return { emailOtp, mobileOtp, expiresAt };
}

/**
 * Verify Login 2FA OTPs
 */
async function verifyLoginOtps({ userId, emailOtp, mobileOtp }) {
  const cleanUserId = String(userId || "").trim();
  const key = `login:${cleanUserId}`;
  const record = await getFromStoreOrDb(key);

  if (!record) {
    return { success: false, message: "No active login 2FA session found. Please log in again." };
  }

  if (Date.now() > record.expiresAt) {
    await deleteFromStoreAndDb(key);
    return { success: false, message: "Login OTP has expired. Please log in again." };
  }

  const cleanEmailOtp = String(emailOtp || "").trim();
  const cleanMobileOtp = String(mobileOtp || "").trim();

  if (record.emailOtp !== cleanEmailOtp) {
    return { success: false, message: "Incorrect Email OTP." };
  }

  if (record.phone && cleanMobileOtp && record.mobileOtp !== cleanMobileOtp) {
    return { success: false, message: "Incorrect Mobile OTP." };
  }

  await deleteFromStoreAndDb(key);
  return { success: true, message: "Two-factor authentication successful!" };
}

/**
 * Dispatch Classroom Join OTP
 */
async function sendClassJoinOtp({ classroomId, email, phone, name }) {
  const joinOtp = generate6DigitOtp();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  const cleanClassId = String(classroomId || "").trim().toUpperCase();
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const key = `join:${cleanClassId}:${normalizedEmail}`;

  const record = {
    classroomId: cleanClassId,
    email: normalizedEmail,
    joinOtp,
    expiresAt
  };

  otpStore.set(key, record);
  await saveToDb(key, {
    purpose: "join",
    identifier: `${cleanClassId}:${normalizedEmail}`,
    email: normalizedEmail,
    joinOtp,
    expiresAt
  });

  console.log("\n=======================================================");
  console.log("🔒 [HIGH SECURITY CLASSROOM ACCESS] JOIN OTP");
  console.log(`🏫 Classroom: ${cleanClassId}`);
  console.log(`👤 Student:   ${name} (${normalizedEmail})`);
  console.log(`🔑 Join OTP:  ${joinOtp}`);
  console.log("=======================================================\n");

  return { joinOtp, expiresAt };
}

/**
 * Verify Classroom Join OTP
 */
async function verifyClassJoinOtp({ classroomId, email, otp }) {
  const cleanClassId = String(classroomId || "").trim().toUpperCase();
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const key = `join:${cleanClassId}:${normalizedEmail}`;
  const record = await getFromStoreOrDb(key);

  if (!record) {
    return { success: false, message: "No active join verification found. Please request an OTP." };
  }

  if (Date.now() > record.expiresAt) {
    await deleteFromStoreAndDb(key);
    return { success: false, message: "Classroom Join OTP has expired." };
  }

  const cleanOtp = String(otp || "").trim();
  if (record.joinOtp !== cleanOtp) {
    return { success: false, message: "Incorrect Classroom Join OTP." };
  }

  await deleteFromStoreAndDb(key);
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
