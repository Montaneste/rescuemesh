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

  console.log("[JEV] Mode: LIVE");
  console.log("[JEV] Analysing incident...");

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured."
    );
  }

const body = {
  model: "typesafe/jev-1.13",

  state: {
    incident_type: event.type,
    water_detected: event.water_detected,
    flow_l_min: event.flow,
    occupancy: event.occupancy,
  },

  questions: {

    action: {
      type: "choice",

      instructions:
        "Which water safety action is appropriate for this incident?",

      criteria: {
        VALVE_CLOSE:
          "Close the water valve when there is a credible active water leak requiring immediate isolation.",

        VALVE_OPEN:
          "Open the water valve only when the incident clearly indicates that restoring water flow is appropriate.",

        NONE:
          "Take no valve action when there is insufficient evidence that physical intervention is required."
      }
    },

    severity: {
      type: "choice",

      instructions:
        "What is the severity of this water incident?",

      criteria: {
        low:
          "No significant immediate risk.",

        medium:
          "Potential problem requiring attention but no immediate serious damage expected.",

        high:
          "Significant active incident with substantial risk of property damage.",

        critical:
          "Active incident requiring immediate intervention to prevent or limit serious property damage."
      }
    },

    intervention: {
      type: "noul",

      instructions:
        "Should this incident trigger an automatic safety intervention?",

      criteria: {
        true:
          "The evidence supports immediate automatic intervention.",

        false:
          "The evidence does not justify automatic intervention."
      }
    }
  }
};

  const response = await fetch(
    "https://openrouter.ai/api/alpha/decisions",
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {

    const errorText =
      await response.text();

    throw new Error(
      `Jev API error ${response.status}: ${errorText}`
    );
  }

  const data = await response.json();

  console.log(
    "[JEV] Real response:",
    JSON.stringify(data, null, 2)
  );

  const actionAnswer =
    data.answers?.action;

  const severityAnswer =
    data.answers?.severity;

  const interventionAnswer =
    data.answers?.intervention;

  if (
    !actionAnswer ||
    !severityAnswer
  ) {
    throw new Error(
      "Invalid Jev response: required answers missing."
    );
  }

  const action =
    actionAnswer.choice;

  const severity =
    severityAnswer.choice;

  const confidence =
    Number(actionAnswer.confidence);

  const interventionProbability =
    Number(interventionAnswer?.noul);

  return {

    action,

    severity,

    confidence,

    reason:
      `Jev selected ${action} for a ${severity} incident` +
      (
        Number.isFinite(interventionProbability)
          ? ` with intervention probability ${interventionProbability.toFixed(2)}.`
          : "."
      ),

    requires_confirmation: false,
  };
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