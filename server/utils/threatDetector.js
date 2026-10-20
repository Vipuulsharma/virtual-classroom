/**
 * Layer 4A: AI Threat Detection Engine
 * Evaluates real-time behavioral features to detect suspicious logins,
 * rapid tab hopping, chat floods, network anomalies, and exam breaches.
 *
 * Output: Anomaly Score in [0, 1] and dynamic threat penalty = k * anomaly_score
 */

class AIThreatDetector {
  constructor() {
    // Scaling factor k for converting anomaly score into trust penalty
    this.K_FACTOR = 30;

    // Feature baselines & thresholds (events per 60 seconds)
    this.THRESHOLDS = {
      tabSwitchesPerMin: 4,      // > 4 tab switches/min indicates loss of attention / cheating
      chatRatePerMin: 8,         // > 8 msgs/min indicates automated chat spamming / bot
      ipChangesCount: 1,         // Any mid-session IP jump indicates proxy / session hijacking
      failedStepUpsCount: 2,     // > 2 failed biometric/OTP step-ups indicates unauthorized user
      rapidRejoinCount: 3        // Rapid disconnect/reconnect hopping
    };

    // Tracking windows per participant: participantKey -> { events: [], ipHistory: Set }
    this.participantWindows = new Map();
  }

  /**
   * Log an event into participant's feature tracking window
   */
  recordEvent(participantKey, eventType, metadata = {}) {
    if (!this.participantWindows.has(participantKey)) {
      this.participantWindows.set(participantKey, {
        events: [],
        ips: new Set(),
        currentIp: metadata.ip || "127.0.0.1"
      });
    }

    const windowData = this.participantWindows.get(participantKey);
    const now = Date.now();

    // Check IP change
    let ipChanged = false;
    if (metadata.ip && metadata.ip !== windowData.currentIp) {
      windowData.ips.add(metadata.ip);
      windowData.currentIp = metadata.ip;
      ipChanged = true;
    }

    windowData.events.push({
      eventType,
      timestamp: now,
      ipChanged: ipChanged,
      isFailedStepUp: eventType === "STEP_UP_FAILED",
      isTabSwitch: eventType === "TAB_SWITCH" || eventType === "WINDOW_BLUR",
      isChatMessage: eventType === "CHAT_MESSAGE_SENT",
      isRejoin: eventType === "REJOIN"
    });

    // Prune events older than 60 seconds
    const cutoff = now - 60000;
    windowData.events = windowData.events.filter(e => e.timestamp >= cutoff);
  }

  /**
   * Compute feature vector over the last 60 seconds
   */
  extractFeatures(participantKey) {
    const windowData = this.participantWindows.get(participantKey);
    if (!windowData || windowData.events.length === 0) {
      return {
        tabSwitchesPerMin: 0,
        chatRatePerMin: 0,
        ipChangesCount: 0,
        failedStepUpsCount: 0,
        rapidRejoinCount: 0
      };
    }

    const events = windowData.events;
    return {
      tabSwitchesPerMin: events.filter(e => e.isTabSwitch).length,
      chatRatePerMin: events.filter(e => e.isChatMessage).length,
      ipChangesCount: events.filter(e => e.ipChanged).length,
      failedStepUpsCount: events.filter(e => e.isFailedStepUp).length,
      rapidRejoinCount: events.filter(e => e.isRejoin).length
    };
  }

  /**
   * Multivariate Statistical / Heuristic Anomaly Scoring (Isolation-Forest baseline equivalent)
   * Evaluates feature deviations from normal classroom behavioral distributions.
   * Returns: { anomalyScore: 0.0 - 1.0, threatPenalty: number, isAnomaly: boolean, reasonCodes: string[] }
   */
  evaluateThreat(participantKey, latestEventType = "", metadata = {}) {
    this.recordEvent(participantKey, latestEventType, metadata);
    const features = this.extractFeatures(participantKey);

    let anomalyComponents = [];
    const reasonCodes = [];

    // 1. Tab Switching Anomaly
    if (features.tabSwitchesPerMin > this.THRESHOLDS.tabSwitchesPerMin) {
      const excess = (features.tabSwitchesPerMin - this.THRESHOLDS.tabSwitchesPerMin) / 5;
      anomalyComponents.push(Math.min(1.0, 0.4 + excess * 0.4));
      reasonCodes.push(`EXCESSIVE_TAB_SWITCHING (${features.tabSwitchesPerMin}/min)`);
    }

    // 2. Chat Spam Flood Anomaly
    if (features.chatRatePerMin > this.THRESHOLDS.chatRatePerMin) {
      const excess = (features.chatRatePerMin - this.THRESHOLDS.chatRatePerMin) / 8;
      anomalyComponents.push(Math.min(1.0, 0.5 + excess * 0.5));
      reasonCodes.push(`CHAT_FLOOD_ANOMALY (${features.chatRatePerMin} msgs/min)`);
    }

    // 3. IP / Network Shift Anomaly
    if (features.ipChangesCount >= this.THRESHOLDS.ipChangesCount) {
      anomalyComponents.push(0.85);
      reasonCodes.push(`UNEXPECTED_IP_NETWORK_JUMP (${features.ipChangesCount} changes)`);
    }

    // 4. Failed Step-up Authentication Anomaly
    if (features.failedStepUpsCount >= this.THRESHOLDS.failedStepUpsCount) {
      anomalyComponents.push(0.9);
      reasonCodes.push(`REPEATED_AUTHENTICATION_FAILURES (${features.failedStepUpsCount})`);
    }

    // 5. Rapid Rejoin Pattern
    if (features.rapidRejoinCount >= this.THRESHOLDS.rapidRejoinCount) {
      anomalyComponents.push(0.6);
      reasonCodes.push(`SUSPICIOUS_RECONNECT_BURST`);
    }

    // Aggregate Multivariate Anomaly Score using maximum single deviation + damped average
    let anomalyScore = 0;
    if (anomalyComponents.length > 0) {
      const maxComponent = Math.max(...anomalyComponents);
      const avgComponent = anomalyComponents.reduce((a, b) => a + b, 0) / anomalyComponents.length;
      anomalyScore = Math.min(1.0, Number((0.6 * maxComponent + 0.4 * avgComponent).toFixed(3)));
    }

    // Convert anomaly score to dynamic penalty: penalty = k * anomaly_score
    const threatPenalty = Math.round(this.K_FACTOR * anomalyScore);
    const isAnomaly = anomalyScore >= 0.35;

    let threatLevel = "NORMAL";
    if (anomalyScore >= 0.75) threatLevel = "CRITICAL";
    else if (anomalyScore >= 0.5) threatLevel = "HIGH";
    else if (anomalyScore >= 0.35) threatLevel = "MEDIUM";

    return {
      anomalyScore,
      threatPenalty,
      threatLevel,
      isAnomaly,
      features,
      reasonCodes: reasonCodes.length > 0 ? reasonCodes : ["NORMAL_ACTIVITY"],
      timestamp: Date.now()
    };
  }

  cleanupParticipant(participantKey) {
    this.participantWindows.delete(participantKey);
  }
}

const threatDetector = new AIThreatDetector();

module.exports = {
  threatDetector
};
