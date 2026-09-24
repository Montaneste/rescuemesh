// RescueMesh - Jev integration layer
//
// Esta camada isola o RescueMesh da implementação do Jev.
// Enquanto não existirem credenciais/documentação,
// funciona em MOCK mode.

const MODE = process.env.JEV_MODE || "mock";

async function analyzeIncident(event) {
  if (MODE === "mock") {
    return analyzeWithMock(event);
  }

  if (MODE === "live") {
    return analyzeWithJev(event);
  }

  throw new Error(`Invalid JEV_MODE: ${MODE}`);
}


// ======================================================
// MOCK
// ======================================================

async function analyzeWithMock(event) {
  console.log("[JEV] Mode: MOCK");
  console.log("[JEV] Analysing incident...");

  if (
    event.water_detected === true &&
    event.flow > 0 &&
    event.occupancy === "away"
  ) {
    return {
      action: "VALVE_CLOSE",
      severity: "critical",
      reason: "Water detected while property is unoccupied.",
      source: "jev-mock"
    };
  }

  return {
    action: "NONE",
    severity: "low",
    reason: "No automatic intervention required.",
    source: "jev-mock"
  };
}


// ======================================================
// REAL JEV
// ======================================================

async function analyzeWithJev(event) {
  /*
   * TODO when Jev access is provided:
   *
   * 1. Authentication
   * 2. Send incident context
   * 3. Request structured decision
   * 4. Validate response
   * 5. Return normalized RescueMesh decision
   */

  throw new Error(
    "Jev live integration is not configured yet."
  );
}


module.exports = {
  analyzeIncident
};