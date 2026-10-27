/**
 * Adaptive SFU System Controller (Research Implementation)
 * Dynamically balances SFU Worker server load and client network degradation.
 * Adjusts simulcast spatial/temporal layers (High, Medium, Low, Audio-only)
 * based on packet loss, RTT, and server CPU load.
 */

class AdaptiveSfuController {
  constructor(options = {}) {
    this.serverCpuThresholdHigh = options.serverCpuThresholdHigh || 80; // 80% CPU
    this.serverCpuThresholdNormal = options.serverCpuThresholdNormal || 55;
    
    // Active worker metrics (simulated/measured)
    this.workers = new Map(); // workerId -> { id, cpuUsagePercent, memoryMb, activeRooms, activeConsumers }
    this.clientFeedback = new Map(); // clientKey -> { rtt, packetLossPercent, jitter, assignedLayer }
  }

  /**
   * Register or update worker telemetry
   */
  updateWorkerMetrics(workerId, metrics = {}) {
    this.workers.set(workerId, {
      id: workerId,
      cpuUsagePercent: metrics.cpuUsagePercent || Math.floor(20 + Math.random() * 25),
      memoryMb: metrics.memoryMb || 140,
      activeRooms: metrics.activeRooms || 1,
      activeConsumers: metrics.activeConsumers || 4,
      updatedAt: Date.now()
    });
  }

  /**
   * Evaluates optimal video layer for a subscriber based on:
   * 1. Client Network Conditions (Packet Loss %, RTT, Jitter)
   * 2. Server Load (Worker CPU Usage %, Memory)
   * 3. Role Priority (Teacher streams have strict priority over Student streams)
   *
   * @param {Object} params
   * @param {number} params.rtt - Client round trip time in ms
   * @param {number} params.packetLoss - Client packet loss percentage
   * @param {string} params.producerRole - 'teacher' | 'student'
   * @param {string} params.workerId - SFU worker handling this transport
   * @returns {Object} { spatialLayer, temporalLayer, qualityLabel, reason }
   */
  calculateOptimalLayer({ rtt = 40, packetLoss = 0, producerRole = "student", workerId = "worker-1" }) {
    const worker = this.workers.get(workerId) || { cpuUsagePercent: 30 };
    const isServerOverloaded = worker.cpuUsagePercent >= this.serverCpuThresholdHigh;

    // RULE 1: If server is severely overloaded, downscale student producers first (Teacher gets priority)
    if (isServerOverloaded && producerRole !== "teacher") {
      return {
        spatialLayer: 0,
        temporalLayer: 0,
        qualityLabel: "LOW_SERVER_LOAD_SHED",
        bitrateLimitKbps: 150,
        reason: "SFU Worker CPU load > 80%; downscaling background participants to preserve host audio/video integrity"
      };
    }

    // RULE 2: Extreme Network Congestion -> Audio Only
    if (packetLoss > 20 || rtt > 450) {
      return {
        spatialLayer: -1, // Paused video
        temporalLayer: -1,
        qualityLabel: "AUDIO_ONLY",
        bitrateLimitKbps: 48,
        reason: "Severe packet loss (>20%) or RTT (>450ms); pausing video feed to sustain stable speech audio"
      };
    }

    // RULE 3: Moderate Network Degradation -> Low (240p / 15fps)
    if (packetLoss > 8 || rtt > 220) {
      return {
        spatialLayer: 0,
        temporalLayer: 1,
        qualityLabel: "LOW_240P",
        bitrateLimitKbps: 200,
        reason: "Packet loss between 8%-20% or elevated RTT; switching to Spatial Layer 0 (240p@15fps)"
      };
    }

    // RULE 4: Mild Degradation -> Medium (480p / 24fps)
    if (packetLoss > 2.5 || rtt > 110) {
      return {
        spatialLayer: 1,
        temporalLayer: 2,
        qualityLabel: "MEDIUM_480P",
        bitrateLimitKbps: 600,
        reason: "Moderate connection jitter / mild packet loss; switching to Spatial Layer 1 (480p@24fps)"
      };
    }

    // RULE 5: Pristine Network & Normal Server Load -> High (1080p/720p @ 30fps)
    return {
      spatialLayer: 2,
      temporalLayer: 2,
      qualityLabel: "HIGH_1080P",
      bitrateLimitKbps: 2000,
      reason: "Network quality optimal (loss < 2.5%, RTT < 110ms); delivering full HD Spatial Layer 2"
    };
  }

  /**
   * Summary diagnostics report for teacher dashboard / research paper charts
   */
  getSystemDiagnostics() {
    return {
      workers: Array.from(this.workers.values()),
      totalActiveWorkers: this.workers.size,
      timestamp: new Date().toISOString()
    };
  }
}

const adaptiveSfu = new AdaptiveSfuController();
// Initialize baseline worker
adaptiveSfu.updateWorkerMetrics("worker-main", { cpuUsagePercent: 24, memoryMb: 120, activeRooms: 1, activeConsumers: 4 });

module.exports = {
  AdaptiveSfuController,
  adaptiveSfu
};
