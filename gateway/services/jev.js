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
// Until Jev credentials and API documentation are
// available, RescueMesh operates in MOCK mode.
// ======================================================


// ======================================================
// CONFIGURATION
// ======================================================

const MODE =
  process.env.JEV_MODE || "mock";


// ======================================================
// PUBLIC API
// ======================================================

async function analyzeIncident(event) {

  switch (MODE) {

    case "mock":
      return analyzeWithMock(event);

    case "live":
      return analyzeWithJev(event);

    default:
      throw new Error(
        `Invalid JEV_MODE: ${MODE}`
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

      source: "jev-mock",

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

    source: "jev-mock",

  };
}


// ======================================================
// REAL JEV
// ======================================================

async function analyzeWithJev(event) {

  /*
   * REAL JEV INTEGRATION
   *
   * To be implemented when Jev access and official
   * documentation are provided.
   *
   * Expected flow:
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
   * Structured response
   *        ↓
   * Normalize response
   *        ↓
   * RescueMesh Safety Layer
   *
   *
   * Expected RescueMesh Decision Contract:
   *
   * {
   *   action: "VALVE_CLOSE" | "VALVE_OPEN" | "NONE",
   *   severity: "low" | "medium" | "high" | "critical",
   *   confidence: 0.0 - 1.0,
   *   reason: "Human-readable explanation",
   *   requires_confirmation: true | false,
   *   source: "jev"
   * }
   */

  console.log(
    "[JEV] Mode: LIVE"
  );

  console.log(
    "[JEV] Analysing incident..."
  );


  // Prevent unused parameter warnings while the
  // integration is not implemented.
  void event;


  throw new Error(
    "Jev live integration is not configured yet."
  );
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  analyzeIncident,
};