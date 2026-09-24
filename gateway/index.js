const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const { analyzeIncident } = require("./services/jev");


// ======================================================
// CONFIGURATION
// ======================================================

const SERIAL_PORT = "COM5";
const BAUD_RATE = 115200;

// Minimum AI confidence required for automatic actuation.
const MIN_AUTOMATIC_CONFIDENCE = 0.90;


// ======================================================
// SERIAL CONNECTION
// ======================================================

const port = new SerialPort({
  path: SERIAL_PORT,
  baudRate: BAUD_RATE,
});

const parser = port.pipe(
  new ReadlineParser({
    delimiter: "\n",
  })
);


// ======================================================
// STATE
// ======================================================

let currentEvent = null;


// ======================================================
// STARTUP
// ======================================================

console.log();
console.log("================================");
console.log(" RescueMesh Gateway");
console.log("================================");
console.log(`Serial: ${SERIAL_PORT} @ ${BAUD_RATE}`);
console.log(
  `Safety confidence threshold: ${MIN_AUTOMATIC_CONFIDENCE}`
);
console.log("Waiting for ESP32...");
console.log();


// ======================================================
// SERIAL EVENTS
// ======================================================

port.on("open", () => {
  console.log("✓ Serial connection opened.");
});

port.on("error", (error) => {
  console.error(
    "[SERIAL] Error:",
    error.message
  );
});


// ======================================================
// RECEIVE DATA FROM ESP32
// ======================================================

parser.on("data", (rawLine) => {

  const line = rawLine.trim();

  if (!line) {
    return;
  }

  console.log(`[ESP32] ${line}`);


  // ----------------------------------------------------
  // START OF LEAK EVENT
  // ----------------------------------------------------

  if (line === "LEAK_EVENT") {

    currentEvent = {
      type: "leak",
      timestamp: new Date().toISOString(),
    };

    return;
  }


  // ----------------------------------------------------
  // EVENT PARAMETERS
  // ----------------------------------------------------

  if (
    currentEvent &&
    line.includes("=")
  ) {

    const separatorIndex =
      line.indexOf("=");

    const key =
      line
        .slice(0, separatorIndex)
        .trim();

    const value =
      line
        .slice(separatorIndex + 1)
        .trim();


    switch (key) {

      case "water_detected":

        currentEvent.water_detected =
          value === "true";

        break;


      case "flow":

        currentEvent.flow =
          Number(value);

        break;


      case "occupancy":

        currentEvent.occupancy =
          value;

        break;
    }


    // --------------------------------------------------
    // COMPLETE EVENT?
    // --------------------------------------------------

    const eventComplete =
      currentEvent.water_detected !== undefined &&
      Number.isFinite(currentEvent.flow) &&
      currentEvent.occupancy !== undefined;


    if (eventComplete) {

      const completedEvent =
        currentEvent;

      currentEvent = null;

      processEvent(
        completedEvent
      );
    }
  }
});


// ======================================================
// PROCESS INCIDENT
// ======================================================

async function processEvent(event) {

  console.log();
  console.log("========== INCIDENT ==========");

  console.log(
    JSON.stringify(
      event,
      null,
      2
    )
  );

  console.log("==============================");
  console.log();


  try {

    // --------------------------------------------------
    // AI DECISION LAYER
    // --------------------------------------------------

    const decision =
      await analyzeIncident(event);


    // --------------------------------------------------
    // SAFETY + ACTUATION
    // --------------------------------------------------

    executeDecision(
      decision,
      event
    );

  } catch (error) {

    console.error(
      "[JEV] Analysis failed:",
      error.message
    );

    console.log(
      "[SAFETY] Fail-safe: no physical command sent."
    );
  }
}


// ======================================================
// SAFETY POLICY
// ======================================================

function validateSafetyPolicy(
  decision,
  event
) {

  const checks = [];

  let approved = true;


  // ----------------------------------------------------
  // CHECK 1 - VALID DECISION OBJECT
  // ----------------------------------------------------

  const validDecision =
    decision !== null &&
    typeof decision === "object";

  checks.push({
    name: "Valid decision object",
    passed: validDecision,
  });

  if (!validDecision) {

    return {
      approved: false,
      checks,
      reason:
        "Jev returned an invalid decision object.",
    };
  }


  // ----------------------------------------------------
  // CHECK 2 - ACTION ALLOWLIST
  // ----------------------------------------------------

  const allowedActions = [
    "VALVE_CLOSE",
    "VALVE_OPEN",
    "NONE",
  ];

  const actionAllowed =
    allowedActions.includes(
      decision.action
    );

  checks.push({
    name: "Action is allowlisted",
    passed: actionAllowed,
  });

  if (!actionAllowed) {
    approved = false;
  }


  // ----------------------------------------------------
  // CHECK 3 - CONFIDENCE FORMAT
  // ----------------------------------------------------

  const confidenceValid =
    typeof decision.confidence === "number" &&
    Number.isFinite(decision.confidence) &&
    decision.confidence >= 0 &&
    decision.confidence <= 1;

  checks.push({
    name: "Confidence value is valid",
    passed: confidenceValid,
  });

  if (!confidenceValid) {
    approved = false;
  }


  // ----------------------------------------------------
  // CHECK 4 - AUTOMATIC CONFIDENCE THRESHOLD
  // ----------------------------------------------------

  let confidenceSufficient = true;

  if (
    decision.action !== "NONE"
  ) {

    confidenceSufficient =
      confidenceValid &&
      decision.confidence >=
        MIN_AUTOMATIC_CONFIDENCE;
  }

  checks.push({
    name: `Confidence >= ${MIN_AUTOMATIC_CONFIDENCE}`,
    passed: confidenceSufficient,
  });

  if (!confidenceSufficient) {
    approved = false;
  }


  // ----------------------------------------------------
  // CHECK 5 - HUMAN CONFIRMATION
  // ----------------------------------------------------

  const confirmationNotRequired =
    decision.requires_confirmation === false;

  checks.push({
    name: "No human confirmation required",
    passed:
      decision.action === "NONE"
        ? true
        : confirmationNotRequired,
  });

  if (
    decision.action !== "NONE" &&
    !confirmationNotRequired
  ) {
    approved = false;
  }


  // ====================================================
  // PHYSICAL CONTEXT VALIDATION
  // ====================================================


  // ----------------------------------------------------
  // VALVE_CLOSE POLICY
  // ----------------------------------------------------

  if (
    decision.action === "VALVE_CLOSE"
  ) {

    const waterDetected =
      event.water_detected === true;

    const activeFlow =
      Number.isFinite(event.flow) &&
      event.flow > 0;

    const propertyUnoccupied =
      event.occupancy === "away";


    checks.push({
      name: "Water physically detected",
      passed: waterDetected,
    });

    checks.push({
      name: "Active water flow detected",
      passed: activeFlow,
    });

    checks.push({
      name: "Property is unoccupied",
      passed: propertyUnoccupied,
    });


    if (
      !waterDetected ||
      !activeFlow ||
      !propertyUnoccupied
    ) {
      approved = false;
    }
  }


  // ----------------------------------------------------
  // VALVE_OPEN POLICY
  // ----------------------------------------------------

  if (
    decision.action === "VALVE_OPEN"
  ) {

    /*
     * For safety, RescueMesh does NOT currently permit
     * autonomous reopening of a valve.
     *
     * Closing water can mitigate damage.
     * Reopening water may recreate the hazardous state.
     *
     * Future implementation:
     * require explicit human confirmation.
     */

    checks.push({
      name: "Automatic valve reopening permitted",
      passed: false,
    });

    approved = false;
  }


  // ----------------------------------------------------
  // FINAL RESULT
  // ----------------------------------------------------

  return {
    approved,
    checks,
    reason: approved
      ? "Safety policy requirements satisfied."
      : "Safety policy requirements not satisfied.",
  };
}


// ======================================================
// DISPLAY SAFETY RESULT
// ======================================================

function printSafetyResult(result) {

  console.log();
  console.log("========== SAFETY ==========");

  for (
    const check of result.checks
  ) {

    const symbol =
      check.passed
        ? "✓"
        : "✗";

    console.log(
      `${symbol} ${check.name}`
    );
  }

  console.log("----------------------------");

  if (result.approved) {

    console.log(
      "[SAFETY] DECISION APPROVED"
    );

  } else {

    console.log(
      "[SAFETY] DECISION BLOCKED"
    );
  }

  console.log(
    `[SAFETY] ${result.reason}`
  );

  console.log("============================");
}


// ======================================================
// VALIDATE AND EXECUTE DECISION
// ======================================================

function executeDecision(
  decision,
  event
) {

  console.log();
  console.log("========= DECISION =========");

  console.log(
    JSON.stringify(
      decision,
      null,
      2
    )
  );

  console.log("============================");


  // ----------------------------------------------------
  // SAFETY VALIDATION
  // ----------------------------------------------------

  const safetyResult =
    validateSafetyPolicy(
      decision,
      event
    );

  printSafetyResult(
    safetyResult
  );


  // ----------------------------------------------------
  // BLOCK UNSAFE DECISION
  // ----------------------------------------------------

  if (!safetyResult.approved) {

    console.log(
      "→ NO COMMAND SENT TO ESP32"
    );

    return;
  }


  // ====================================================
  // EXECUTION
  // ====================================================

  switch (decision.action) {


    // --------------------------------------------------
    // CLOSE VALVE
    // --------------------------------------------------

    case "VALVE_CLOSE":

      console.log();
      console.log(
        "→ Sending VALVE_CLOSE to ESP32"
      );

      sendCommand(
        "VALVE_CLOSE"
      );

      break;


    // --------------------------------------------------
    // OPEN VALVE
    // --------------------------------------------------

    case "VALVE_OPEN":

      /*
       * This case should currently never execute because
       * automatic reopening is blocked by the safety
       * policy.
       */

      console.log();
      console.log(
        "→ Sending VALVE_OPEN to ESP32"
      );

      sendCommand(
        "VALVE_OPEN"
      );

      break;


    // --------------------------------------------------
    // NO ACTION
    // --------------------------------------------------

    case "NONE":

      console.log();
      console.log(
        "→ No physical action required."
      );

      break;
  }
}


// ======================================================
// SEND COMMAND TO ESP32
// ======================================================

function sendCommand(command) {

  port.write(
    `${command}\n`,
    (error) => {

      if (error) {

        console.error(
          "[SERIAL] Failed to send command:",
          error.message
        );

        return;
      }

      console.log(
        `[SERIAL] Command sent: ${command}`
      );
    }
  );
}