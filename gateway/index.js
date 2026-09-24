const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const { analyzeIncident } = require("./services/jev");


// ======================================================
// CONFIGURATION
// ======================================================

const SERIAL_PORT = "COM5";
const BAUD_RATE = 115200;


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
  console.log("========== EVENT ==========");
  console.log(
    JSON.stringify(
      event,
      null,
      2
    )
  );
  console.log("===========================");
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
      decision
    );

  } catch (error) {

    console.error(
      "[JEV] Analysis failed:",
      error.message
    );
  }
}


// ======================================================
// VALIDATE AND EXECUTE DECISION
// ======================================================

function executeDecision(decision) {

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


  // ====================================================
  // BASIC RESPONSE VALIDATION
  // ====================================================

  if (
    !decision ||
    typeof decision !== "object"
  ) {

    console.error(
      "[SAFETY] Invalid decision object."
    );

    return;
  }


  // ====================================================
  // ACTION ALLOWLIST
  // ====================================================

  const allowedActions = [
    "VALVE_CLOSE",
    "VALVE_OPEN",
    "NONE",
  ];


  if (
    !allowedActions.includes(
      decision.action
    )
  ) {

    console.error(
      `[SAFETY] Blocked invalid action: ${decision.action}`
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

      console.log(
        "[SAFETY] Action validated."
      );

      console.log(
        "→ Sending VALVE_CLOSE to ESP32"
      );

      port.write(
        "VALVE_CLOSE\n",
        (error) => {

          if (error) {

            console.error(
              "[SERIAL] Failed to send command:",
              error.message
            );
          }
        }
      );

      break;


    // --------------------------------------------------
    // OPEN VALVE
    // --------------------------------------------------

    case "VALVE_OPEN":

      console.log(
        "[SAFETY] Action validated."
      );

      console.log(
        "→ Sending VALVE_OPEN to ESP32"
      );

      port.write(
        "VALVE_OPEN\n",
        (error) => {

          if (error) {

            console.error(
              "[SERIAL] Failed to send command:",
              error.message
            );
          }
        }
      );

      break;


    // --------------------------------------------------
    // NO ACTION
    // --------------------------------------------------

    case "NONE":

      console.log(
        "[SAFETY] Action validated."
      );

      console.log(
        "→ No physical action required."
      );

      break;
  }
}