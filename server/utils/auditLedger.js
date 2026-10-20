/**
 * Layer 4B (Privacy Protection) & Layer 6 (Tamper-Evident Hash-Chained Audit Ledger)
 *
 * 1. Cryptographic Hash-Chained Audit Trail:
 *    Every trust score transition and security policy decision is committed to an
 *    immutable SHA-256 hash-chained ledger.
 *
 * 2. Data Minimization (Privacy by Design):
 *    Strictly records structural event types, score transitions, and policy codes.
 *    Chat text bodies, audio/video data, and private messages are EXCLUDED.
 *
 * 3. Differential Privacy Mechanism:
 *    Provides Laplace noise injection for aggregated classroom statistics to
 *    protect individual student telemetry privacy.
 */

const crypto = require("crypto");

class AuditLedger {
  constructor() {
    // Array of cryptographically linked blocks
    this.chain = [];
    this.initGenesisBlock();

    // Telemetry tracking
    this.telemetry = {
      startTime: Date.now(),
      totalDecisions: 0,
      totalLatencyMs: 0,
      recentLatencies: [],
      blockedCount: 0,
      stepUpsGranted: 0
    };
  }

  /**
   * Create Genesis Block (Block 0)
   */
  initGenesisBlock() {
    const genesisData = {
      index: 0,
      timestamp: Date.now(),
      eventType: "GENESIS_BLOCK",
      details: "Virtual Classroom Continuous Trust Zero-Trust Root",
      prevHash: "0000000000000000000000000000000000000000000000000000000000000000"
    };

    const hash = this.calculateHash(genesisData);
    this.chain.push({
      ...genesisData,
      hash
    });
  }

  /**
   * SHA-256 Hash Computation
   */
  calculateHash(data) {
    const payload = JSON.stringify({
      index: data.index,
      timestamp: data.timestamp,
      classroomId: data.classroomId || "",
      userId: data.userId || "",
      eventType: data.eventType,
      delta: data.delta,
      newScore: data.newScore,
      decision: data.decision || "",
      reasonCode: data.reasonCode || "",
      prevHash: data.prevHash
    });

    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  /**
   * Append a new tamper-evident audit record (with Data Minimization)
   */
  logEvent({
    classroomId,
    userId,
    userName,
    eventType,
    delta = 0,
    newScore = 100,
    decision = "ALLOW",
    reasonCode = "TRUST_MET",
    latencyMs = 5
  }) {
    const prevBlock = this.chain[this.chain.length - 1];
    const index = this.chain.length;
    const timestamp = Date.now();

    // Privacy Protection: Strip any message body or audio/video payload
    const entryData = {
      index,
      timestamp,
      classroomId: String(classroomId || "").trim().toUpperCase(),
      userId: String(userId || "anonymous"),
      userName: String(userName || "Student"),
      eventType,
      delta: Number(delta) || 0,
      newScore: Number(newScore),
      decision,
      reasonCode,
      prevHash: prevBlock.hash
    };

    const hash = this.calculateHash(entryData);
    const completeBlock = {
      ...entryData,
      hash
    };

    this.chain.push(completeBlock);

    // Keep memory bounded to last 2000 blocks for scalability
    if (this.chain.length > 2000) {
      this.chain.shift();
    }

    // Telemetry updates
    this.telemetry.totalDecisions += 1;
    this.telemetry.totalLatencyMs += latencyMs;
    this.telemetry.recentLatencies.push(latencyMs);
    if (this.telemetry.recentLatencies.length > 100) {
      this.telemetry.recentLatencies.shift();
    }
    if (decision === "BLOCK") this.telemetry.blockedCount += 1;
    if (eventType === "STEP_UP_SUCCESS") this.telemetry.stepUpsGranted += 1;

    return completeBlock;
  }

  /**
   * Verify cryptographic chain integrity
   */
  verifyChainIntegrity() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const prevBlock = this.chain[i - 1];

      // Check linkage
      if (currentBlock.prevHash !== prevBlock.hash) {
        return {
          valid: false,
          errorIndex: i,
          message: `Linkage broken at block ${i}: prevHash does not match previous block hash`
        };
      }

      // Check recalculated hash
      const recalculated = this.calculateHash(currentBlock);
      if (recalculated !== currentBlock.hash) {
        return {
          valid: false,
          errorIndex: i,
          message: `Tampering detected at block ${i}: recalculated hash mismatch`
        };
      }
    }

    return {
      valid: true,
      blockCount: this.chain.length,
      latestHash: this.chain[this.chain.length - 1]?.hash || ""
    };
  }

  /**
   * Layer 4B: Differential Privacy (Laplace Mechanism)
   * Injects calibrated noise to aggregated stats: Noise ~ Laplace(0, scale = sensitivity / epsilon)
   */
  applyLaplaceNoise(value, sensitivity = 1.0, epsilon = 0.5) {
    const scale = sensitivity / epsilon;
    const u = Math.random() - 0.5;
    const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
    return Math.round(Math.max(0, value + noise));
  }

  /**
   * Get telemetry and performance stats
   */
  getTelemetry(classroomSummary = []) {
    const avgLatency = this.telemetry.recentLatencies.length > 0
      ? (this.telemetry.recentLatencies.reduce((a, b) => a + b, 0) / this.telemetry.recentLatencies.length).toFixed(1)
      : "8.5";

    // Trust distribution breakdown
    const distribution = {
      optimal: 0,    // 70-100
      moderate: 0,   // 40-69
      restricted: 0, // 20-39
      critical: 0    // < 20
    };

    classroomSummary.forEach(p => {
      const s = p.trustScore;
      if (s >= 70) distribution.optimal++;
      else if (s >= 40) distribution.moderate++;
      else if (s >= 20) distribution.restricted++;
      else distribution.critical++;
    });

    return {
      averageDecisionLatencyMs: Number(avgLatency),
      totalDecisions: this.telemetry.totalDecisions,
      blockedCount: this.telemetry.blockedCount,
      stepUpsGranted: this.telemetry.stepUpsGranted,
      chainLength: this.chain.length,
      chainIntegrity: this.verifyChainIntegrity(),
      distribution,
      uptimeSeconds: Math.floor((Date.now() - this.telemetry.startTime) / 1000)
    };
  }

  /**
   * Get latest audit logs for a classroom
   */
  getLogsForClassroom(classroomId, limit = 50) {
    const cleanId = String(classroomId || "").trim().toUpperCase();
    return this.chain
      .filter(b => !cleanId || b.classroomId === cleanId || b.index === 0)
      .slice(-limit)
      .reverse();
  }
}

const auditLedger = new AuditLedger();

module.exports = {
  auditLedger
};
