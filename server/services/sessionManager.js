/**
 * Session Security & Concurrent Session Manager
 * Enforces Single Active Session Policy, detects session hijacking,
 * and evicts unauthorized duplicate connections.
 */

class SessionManager {
  constructor() {
    // userId -> { socketId, ip, userAgent, classroomId, loggedInAt, tokenHash }
    this.activeSessions = new Map();
    // socketId -> userId
    this.socketToUser = new Map();
  }

  /**
   * Register a user session upon classroom join or login
   * Returns: { status: 'OK' | 'DUPLICATE_TERMINATED', previousSocketId?: string }
   */
  registerSession(userId, socketId, metadata = {}) {
    if (!userId) return { status: "ANONYMOUS" };

    const cleanUserId = String(userId);
    const existing = this.activeSessions.get(cleanUserId);

    let terminatedSocketId = null;

    if (existing && existing.socketId !== socketId) {
      // Duplicate / Concurrent login detected!
      terminatedSocketId = existing.socketId;
      console.warn(`🚨 Security Alert: Duplicate login detected for user ${cleanUserId}! Evicting old socket: ${terminatedSocketId}`);
    }

    const sessionInfo = {
      userId: cleanUserId,
      socketId,
      ip: metadata.ip || "127.0.0.1",
      userAgent: metadata.userAgent || "Unknown",
      classroomId: metadata.classroomId || "",
      userName: metadata.userName || "",
      role: metadata.role || "student",
      loggedInAt: Date.now()
    };

    this.activeSessions.set(cleanUserId, sessionInfo);
    this.socketToUser.set(socketId, cleanUserId);

    return {
      status: terminatedSocketId ? "DUPLICATE_TERMINATED" : "OK",
      terminatedSocketId,
      session: sessionInfo
    };
  }

  /**
   * Check if a socket session is still authorized
   */
  isSessionValid(socketId) {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return true; // Guest / anonymous allowed within room rules
    const session = this.activeSessions.get(userId);
    return session && session.socketId === socketId;
  }

  /**
   * Remove session on disconnect
   */
  removeSession(socketId) {
    const userId = this.socketToUser.get(socketId);
    if (userId) {
      const session = this.activeSessions.get(userId);
      if (session && session.socketId === socketId) {
        this.activeSessions.delete(userId);
      }
      this.socketToUser.delete(socketId);
    }
  }

  /**
   * Get all active sessions for teacher administration
   */
  getActiveSessionsCount() {
    return this.activeSessions.size;
  }
}

const sessionManager = new SessionManager();

module.exports = {
  SessionManager,
  sessionManager
};
