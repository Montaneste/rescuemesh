// ======================================================
// RescueMesh - Jev Integration Layer
// ======================================================
//
// This module isolates RescueMesh from the Jev
// implementation.
//
// Supported modes:
//
//   mock -> local simulated AI decision
//   live -> real Jev integration
//
// RescueMesh always expects the same normalized
// Decision Contract, regardless of the Jev transport
// or API implementation.
// ======================================================


// ======================================================
// CONFIGURATION
// ======================================================

const MODE =
  (process.env.JEV_MODE || "mock")
    .trim()
    .toLowerCase();


// ======================================================
// DECISION CONTRACT
// ======================================================

const ALLOWED_ACTIONS = [
  "VALVE_CLOSE",
  "VALVE_OPEN",
  "NONE",
];

const ALLOWED_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
];


// ======================================================
// PUBLIC API
// ======================================================

async function analyzeIncident(event) {

  validateIncident(event);

  switch (MODE) {

    case "mock":
      return normalizeDecision(
        await analyzeWithMock(event),
        "jev-mock"
      );

    case "live":
      return normalizeDecision(
        await analyzeWithJev(event),
        "jev"
      );

    default:
      throw new Error(
        `Invalid JEV_MODE: ${MODE}`
      );
  }
}


// ======================================================
// INCIDENT VALIDATION
// ======================================================

function validateIncident(event) {

  if (
    !event ||
    typeof event !== "object" ||
    Array.isArray(event)
  ) {
    throw new Error(
      "Invalid incident: expected an object."
    );
  }

  if (event.type !== "leak") {
    throw new Error(
      `Unsupported incident type: ${event.type}`
    );
  }

  if (
    typeof event.water_detected !== "boolean"
  ) {
    throw new Error(
      "Invalid incident: water_detected must be boolean."
    );
  }

  if (
    typeof event.flow !== "number" ||
    !Number.isFinite(event.flow) ||
    event.flow < 0
  ) {
    throw new Error(
      "Invalid incident: flow must be a non-negative number."
    );
  }

  if (
    typeof event.occupancy !== "string" ||
    event.occupancy.length === 0
  ) {
    throw new Error(
      "Invalid incident: occupancy is required."
    );
  }
}


// ======================================================
// MOCK JEV
// ======================================================

async function analyzeWithMock(event) {

  console.log(
    "[JEV] Mode: MOCK"
  );

  console.log(
    "[JEV] Analysing incident..."
  );


  // ----------------------------------------------------
  // CRITICAL WATER LEAK
  // ----------------------------------------------------

  if (
    event.water_detected === true &&
    event.flow > 0 &&
    event.occupancy === "away"
  ) {

    return {

      action: "VALVE_CLOSE",

      severity: "critical",

      confidence: 0.97,

      reason:
        "Water detected with active flow while property is unoccupied.",

      requires_confirmation: false,

    };
  }


  // ----------------------------------------------------
  // NO AUTOMATIC INTERVENTION
  // ----------------------------------------------------

  return {

    action: "NONE",

    severity: "low",

    confidence: 0.85,

    reason:
      "Incident does not meet the criteria for automatic intervention.",

    requires_confirmation: false,

  };
}


// ======================================================
// REAL JEV
// ======================================================

async function analyzeWithJev(event) {

  console.log(
    "[JEV] Mode: LIVE"
  );

  console.log(
    "[JEV] Analysing incident..."
  );


  /*
   * LIVE INTEGRATION BOUNDARY
   *
   * Do not implement the transport until the official
   * Jev API / SDK contract is available.
   *
   * Expected conceptual flow:
   *
   * RescueMesh incident
   *        ↓
   * Build Jev request
   *        ↓
   * Authenticate
   *        ↓
   * Send incident context
   *        ↓
   * Jev reasoning
   *        ↓
   * Receive structured response
   *        ↓
   * Map response to Decision Contract
   *        ↓
   * RescueMesh Safety Policy
   *
   *
   * Required normalized output:
   *
   * {
   *   action:
   *     "VALVE_CLOSE" |
   *     "VALVE_OPEN" |
   *     "NONE",
   *
   *   severity:
   *     "low" |
   *     "medium" |
   *     "high" |
   *     "critical",
   *
   *   confidence: 0.0 - 1.0,
   *
   *   reason:
   *     "Human-readable explanation",
   *
   *   requires_confirmation:
   *     true | false
   * }
   */

  void event;

  throw new Error(
    "Jev live integration is not configured. " +
    "Official API/SDK access is required."
  );
}


// ======================================================
// NORMALIZE / VALIDATE JEV DECISION
// ======================================================

function normalizeDecision(
  decision,
  source
) {

  if (
    !decision ||
    typeof decision !== "object" ||
    Array.isArray(decision)
  ) {
    throw new Error(
      "Invalid Jev response: expected an object."
    );
  }


  const normalized = {

    action:
      String(decision.action || "")
        .trim()
        .toUpperCase(),

    severity:
      String(decision.severity || "")
        .trim()
        .toLowerCase(),

    confidence:
      Number(decision.confidence),

    reason:
      String(decision.reason || "")
        .trim(),

    requires_confirmation:
      decision.requires_confirmation === true,

    source,

  };


  if (
    !ALLOWED_ACTIONS.includes(
      normalized.action
    )
  ) {
    throw new Error(
      `Invalid Jev action: ${normalized.action}`
    );
  }


  if (
    !ALLOWED_SEVERITIES.includes(
      normalized.severity
    )
  ) {
    throw new Error(
      `Invalid Jev severity: ${normalized.severity}`
    );
  }


  if (
    !Number.isFinite(
      normalized.confidence
    ) ||
    normalized.confidence < 0 ||
    normalized.confidence > 1
  ) {
    throw new Error(
      "Invalid Jev confidence value."
    );
  }


  if (
    normalized.reason.length === 0
  ) {
    throw new Error(
      "Invalid Jev response: reason is required."
    );
  }


  return normalized;
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  analyzeIncident,
};