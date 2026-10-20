/**
 * Layer 5: Security Policy Decision Engine
 * Translates trust score into granular capability-level actions:
 *
 * Rules:
 * - T >= threshold          -> ALLOW
 * - T >= threshold - 15     -> REQUEST_VERIFICATION (step-up challenge prompt)
 * - T >= threshold - 30     -> RESTRICT (capability disabled)
 * - T < 20                  -> BLOCK + Alert (Probation lock)
 */

const { CAPABILITY_THRESHOLDS } = require("./trustEngine");

class SecurityPolicyEngine {
  /**
   * Evaluate decision for a single capability
   */
  evaluateCapabilityPolicy(capabilityName, trustScore, reasonCodes = []) {
    const threshold = CAPABILITY_THRESHOLDS[capabilityName];
    if (threshold === undefined) {
      return {
        decision: "RESTRICT",
        capability: capabilityName,
        reason_code: "UNKNOWN_CAPABILITY",
        allowed: false,
        requiresStepUp: false
      };
    }

    let decision = "ALLOW";
    let allowed = false;
    let requiresStepUp = false;

    if (trustScore < 20) {
      decision = "BLOCK";
      allowed = false;
      requiresStepUp = true;
    } else if (trustScore >= threshold) {
      decision = "ALLOW";
      allowed = true;
      requiresStepUp = false;
    } else if (trustScore >= threshold - 15) {
      decision = "REQUEST_VERIFICATION";
      allowed = false;
      requiresStepUp = true;
    } else {
      decision = "RESTRICT";
      allowed = false;
      requiresStepUp = false;
    }

    const code = reasonCodes && reasonCodes.length > 0 
      ? reasonCodes.join(" + ") 
      : (decision === "ALLOW" ? "TRUST_MET" : "TRUST_DEFICIT");

    return {
      decision,
      capability: capabilityName,
      threshold,
      trustScore,
      allowed,
      requiresStepUp,
      reason_code: code
    };
  }

  /**
   * Evaluate all capability decisions for a participant
   */
  evaluateAllPolicies(trustScore, reasonCodes = [], manualBypass = false) {
    if (manualBypass) {
      const allAllowed = {};
      for (const cap of Object.keys(CAPABILITY_THRESHOLDS)) {
        allAllowed[cap] = {
          decision: "ALLOW",
          capability: cap,
          threshold: CAPABILITY_THRESHOLDS[cap],
          trustScore,
          allowed: true,
          requiresStepUp: false,
          reason_code: "TEACHER_MANUAL_BYPASS"
        };
      }
      return allAllowed;
    }

    const policies = {};
    for (const cap of Object.keys(CAPABILITY_THRESHOLDS)) {
      policies[cap] = this.evaluateCapabilityPolicy(cap, trustScore, reasonCodes);
    }
    return policies;
  }
}

const policyEngine = new SecurityPolicyEngine();

module.exports = {
  policyEngine
};
