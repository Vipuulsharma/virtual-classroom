/**
 * Layer 3: Zero-Trust Continuous Risk Engine
 * Activity-aware Continuous Trust in a 6-layer secure virtual classroom architecture.
 *
 * Formula:
 * T(t+1) = clamp( T(t) * lambda + positive - sum(wi * negative_i), 0, 100 )
 */

// Capability Thresholds specified in architecture design
const CAPABILITY_THRESHOLDS = {
  lecture: 20,       // View live lecture & instructor stream
  chat: 40,          // Send messages in classroom chat
  mic_camera: 50,    // Unmute mic and turn on student camera
  screen_share: 70,  // Broadcast desktop / screen share stream
  download: 75,      // Download shared files & study materials
  exam_submit: 85    // Submit online examination answers
};

// Initial Trust (T0) Table (Layer 2 Adaptive Authentication)
const T0_TABLE = {
  passkey_known_device: 80, // Passkey (WebAuthn) + known device
  otp_verified: 55,         // Verified via 2FA OTP
  guest_unverified: 30      // Guest / direct unverified entry
};

// Negative Event Weights (wi)
const PENALTY_WEIGHTS = {
  TAB_SWITCH: 10,
  TAB_SWITCH_BURST: 20,
  WINDOW_BLUR_EXAM: 25,
  CHAT_SPAM: 15,
  UNVERIFIED_SCREEN_SHARE: 15,
  SUSPICIOUS_IP_SHIFT: 25,
  FAILED_STEP_UP: 20,
  ANOMALY_THREAT: 25
};

// Positive Rewards
const POSITIVE_REWARDS = {
  STEP_UP_SUCCESS: 20,      // Successful Passkey/TOTP step-up verification
  COMPLIANT_ENGAGEMENT: 2,  // Sustained attentive behavior (periodic)
  CAMERA_VERIFIED: 5        // Visual identity verification
};

const LAMBDA_DECAY = 0.995; // Gradual decay / baseline stability factor

class ContinuousTrustEngine {
  constructor() {
    // classroomId -> Map(participantKey -> ParticipantTrustState)
    this.classroomSessions = new Map();
  }

  /**
   * Determine initial trust (T0) from authentication credentials
   */
  getInitialTrust(authContext = {}) {
    const { passkeyVerified, knownDevice, otpVerified } = authContext;
    if (passkeyVerified && knownDevice) {
      return T0_TABLE.passkey_known_device; // 80
    }
    if (passkeyVerified || otpVerified) {
      return T0_TABLE.otp_verified; // 55
    }
    return T0_TABLE.guest_unverified; // 30
  }

  /**
   * Initialize or get participant trust session
   */
  getOrCreateSession(classroomId, participantKey, userInfo = {}) {
    if (!this.classroomSessions.has(classroomId)) {
      this.classroomSessions.set(classroomId, new Map());
    }

    const room = this.classroomSessions.get(classroomId);
    if (!room.has(participantKey)) {
      const initialScore = userInfo.role === "teacher" 
        ? 100 
        : this.getInitialTrust(userInfo.authContext || { otpVerified: true, knownDevice: true });

      const state = {
        participantKey,
        userId: userInfo.userId || participantKey,
        userName: userInfo.userName || "Student",
        userEmail: userInfo.userEmail || "",
        role: userInfo.role || "student",
        trustScore: initialScore,
        initialScore,
        lastUpdated: Date.now(),
        history: [
          {
            timestamp: Date.now(),
            oldScore: initialScore,
            newScore: initialScore,
            delta: 0,
            eventType: "INITIAL_T0_ASSIGNED",
            reason: `Initial trust assigned based on adaptive auth: ${initialScore}`
          }
        ],
        recentEvents: [],
        manualBypass: false
      };

      room.set(participantKey, state);
    }

    return room.get(participantKey);
  }

  /**
   * Update participant trust score using Continuous Trust Formula
   * T(t+1) = clamp( T(t) * lambda + positive - sum(wi * negative_i), 0, 100 )
   */
  updateTrustScore({
    classroomId,
    participantKey,
    eventType,
    customPenalty = null,
    customReward = null,
    reason = "",
    threatScore = 0
  }) {
    const session = this.getOrCreateSession(classroomId, participantKey);
    if (session.role === "teacher") {
      session.trustScore = 100;
      return {
        session,
        trustScore: 100,
        delta: 0,
        capabilities: this.evaluateCapabilities(100)
      };
    }

    const currentT = session.trustScore;
    let positive = 0;
    let negative = 0;

    // Apply positive rewards
    if (customReward !== null) {
      positive += customReward;
    } else if (POSITIVE_REWARDS[eventType]) {
      positive += POSITIVE_REWARDS[eventType];
    }

    // Apply negative penalties
    if (customPenalty !== null) {
      negative += customPenalty;
    } else if (PENALTY_WEIGHTS[eventType]) {
      negative += PENALTY_WEIGHTS[eventType];
    }

    // Include Layer 4A AI Threat penalty if present
    if (threatScore > 0) {
      negative += threatScore;
    }

    // Apply formula: T(t+1) = clamp( T(t) * lambda + positive - negative, 0, 100 )
    const decayedT = currentT * LAMBDA_DECAY;
    const rawNextT = decayedT + positive - negative;
    const nextT = Math.round(Math.max(0, Math.min(100, rawNextT)));
    const delta = nextT - currentT;

    session.trustScore = nextT;
    session.lastUpdated = Date.now();

    const historyEntry = {
      timestamp: Date.now(),
      oldScore: currentT,
      newScore: nextT,
      delta,
      eventType,
      reason: reason || `${eventType}: delta ${delta > 0 ? "+" + delta : delta}`
    };

    session.history.push(historyEntry);
    if (session.history.length > 50) {
      session.history.shift();
    }

    session.recentEvents.push({
      eventType,
      timestamp: Date.now()
    });
    // Keep recent events within sliding window (60 seconds)
    const windowStart = Date.now() - 60000;
    session.recentEvents = session.recentEvents.filter(e => e.timestamp >= windowStart);

    return {
      session,
      trustScore: nextT,
      delta,
      historyEntry,
      capabilities: this.evaluateCapabilities(nextT, session.manualBypass)
    };
  }

  /**
   * Manual Override by Teacher
   */
  manualOverride({ classroomId, participantKey, newScore, reason, bypassCapabilities = false }) {
    const session = this.getOrCreateSession(classroomId, participantKey);
    const clampedScore = Math.max(0, Math.min(100, Number(newScore)));
    const oldScore = session.trustScore;
    const delta = clampedScore - oldScore;

    session.trustScore = clampedScore;
    session.manualBypass = !!bypassCapabilities;
    session.lastUpdated = Date.now();

    const entry = {
      timestamp: Date.now(),
      oldScore,
      newScore: clampedScore,
      delta,
      eventType: "TEACHER_MANUAL_OVERRIDE",
      reason: reason || `Teacher manual override: set score to ${clampedScore}`
    };

    session.history.push(entry);

    return {
      session,
      trustScore: clampedScore,
      delta,
      capabilities: this.evaluateCapabilities(clampedScore, session.manualBypass)
    };
  }

  /**
   * Check capability statuses against thresholds
   */
  evaluateCapabilities(trustScore, manualBypass = false) {
    if (manualBypass) {
      return {
        lecture: { allowed: true, status: "ALLOW", threshold: CAPABILITY_THRESHOLDS.lecture },
        chat: { allowed: true, status: "ALLOW", threshold: CAPABILITY_THRESHOLDS.chat },
        mic_camera: { allowed: true, status: "ALLOW", threshold: CAPABILITY_THRESHOLDS.mic_camera },
        screen_share: { allowed: true, status: "ALLOW", threshold: CAPABILITY_THRESHOLDS.screen_share },
        download: { allowed: true, status: "ALLOW", threshold: CAPABILITY_THRESHOLDS.download },
        exam_submit: { allowed: true, status: "ALLOW", threshold: CAPABILITY_THRESHOLDS.exam_submit }
      };
    }

    const caps = {};
    for (const [capName, threshold] of Object.entries(CAPABILITY_THRESHOLDS)) {
      let status = "ALLOW";
      let allowed = false;

      if (trustScore >= threshold) {
        status = "ALLOW";
        allowed = true;
      } else if (trustScore >= threshold - 15) {
        status = "REQUEST_VERIFICATION"; // Can do step-up
        allowed = false;
      } else if (trustScore >= threshold - 30) {
        status = "RESTRICT";
        allowed = false;
      } else {
        status = "BLOCK";
        allowed = false;
      }

      caps[capName] = {
        allowed,
        status,
        threshold,
        currentScore: trustScore,
        deficit: Math.max(0, threshold - trustScore)
      };
    }

    return caps;
  }

  /**
   * Get all participant scores for a classroom (Teacher Dashboard view)
   */
  getClassroomTrustSummary(classroomId) {
    const room = this.classroomSessions.get(classroomId);
    if (!room) return [];

    const summary = [];
    for (const [key, state] of room.entries()) {
      summary.push({
        participantKey: key,
        userId: state.userId,
        userName: state.userName,
        userEmail: state.userEmail,
        role: state.role,
        trustScore: state.trustScore,
        initialScore: state.initialScore,
        capabilities: this.evaluateCapabilities(state.trustScore, state.manualBypass),
        lastUpdated: state.lastUpdated,
        recentEventsCount: state.recentEvents.length,
        statusColor: state.trustScore >= 70 ? "green" : state.trustScore >= 40 ? "yellow" : "red"
      });
    }

    return summary;
  }

  removeParticipant(classroomId, participantKey) {
    if (this.classroomSessions.has(classroomId)) {
      this.classroomSessions.get(classroomId).delete(participantKey);
    }
  }
}

const trustEngine = new ContinuousTrustEngine();

module.exports = {
  trustEngine,
  CAPABILITY_THRESHOLDS,
  T0_TABLE,
  PENALTY_WEIGHTS,
  POSITIVE_REWARDS
};
