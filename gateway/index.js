require("dotenv").config();

const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const http = require("http");
const fs = require("fs");
const path = require("path");

const { analyzeIncident } = require("./services/jev");

const {
  getScenario,
  listScenarios,
} = require("./scenarios/scenarios");

// ======================================================
// CONFIGURATION
// ======================================================

const SERIAL_PORT = "COM5";
const BAUD_RATE = 115200;

const HTTP_PORT = 3000;

// Minimum AI confidence required for automatic actuation.
const MIN_AUTOMATIC_CONFIDENCE = 0.90;


// ======================================================
// PATHS
// ======================================================

const DASHBOARD_DIR =
  path.join(__dirname, "..", "dashboard");


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

// Connected dashboard SSE clients.
const dashboardClients = new Set();

// Latest dashboard state.
// Used by HTTP polling when SSE is unavailable through a proxy/tunnel.
const dashboardState = {
  version: 0,
  updatedAt: null,
  incident: null,
  decision: null,
  safety: null,
  actuation: null,
  ack: null,
  error: null,
};

function updateDashboardState(type, payload) {
  if (Object.prototype.hasOwnProperty.call(dashboardState, type)) {
    dashboardState[type] = payload;
  }

  dashboardState.version += 1;
  dashboardState.updatedAt = new Date().toISOString();
}


// ======================================================
// HTTP / DASHBOARD SERVER
// ======================================================

const server = http.createServer(
  (request, response) => {

    const requestUrl =
      new URL(
        request.url,
        `http://${request.headers.host || "localhost"}`
      );

    const pathname =
      requestUrl.pathname;


    // --------------------------------------------------
    // SSE EVENT STREAM
    // --------------------------------------------------

    if (pathname === "/events") {

      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      // Force headers to be sent immediately.
      response.flushHeaders?.();

      // Initial SSE comment.
      response.write(
        ": RescueMesh dashboard connected\n\n"
      );

      // Keep the SSE connection alive through proxies/tunnels.
      const heartbeat = setInterval(() => {
        try {
          response.write(
            `: heartbeat ${Date.now()}\n\n`
          );
        } catch (error) {
          clearInterval(heartbeat);
        }
      }, 15000);

      dashboardClients.add(response);

      console.log(
        `[DASHBOARD] Client connected (${dashboardClients.size})`
      );

      request.on("close", () => {

        clearInterval(heartbeat);

        dashboardClients.delete(response);

        console.log(
          `[DASHBOARD] Client disconnected (${dashboardClients.size})`
        );

      });

      return;
    }

// --------------------------------------------------
// DASHBOARD STATE API
// --------------------------------------------------

if (
  pathname === "/api/state" &&
  request.method === "GET"
) {

  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });

  response.end(
    JSON.stringify(
      dashboardState,
      null,
      2
    )
  );

  return;
}


    // --------------------------------------------------
    // DEMO API - LIST SCENARIOS
    // --------------------------------------------------

    if (
      pathname === "/api/scenarios" &&
      request.method === "GET"
    ) {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });

      response.end(
        JSON.stringify(
          listScenarios(),
          null,
          2
        )
      );

      return;
    }


    // --------------------------------------------------
    // DEMO API - RUN SCENARIO
    // --------------------------------------------------

    if (
      pathname.startsWith("/api/scenarios/") &&
      request.method === "POST"
    ) {
      const scenarioName =
        decodeURIComponent(
          pathname.slice(
            "/api/scenarios/".length
          )
        );


      const scenario =
        getScenario(
          scenarioName
        );


      if (!scenario) {
        response.writeHead(404, {
          "Content-Type":
            "application/json; charset=utf-8",
          "Cache-Control":
            "no-store",
        });

        response.end(
          JSON.stringify({
            accepted: false,
            error: "Unknown demo scenario",
            scenario: scenarioName,
          })
        );

        return;
      }


      console.log();
      console.log(
        "========== DEMO SCENARIO =========="
      );

      console.log(
        `[DEMO] ${scenario.name}`
      );

      console.log(
        "==================================="
      );


      response.writeHead(202, {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "no-store",
      });

      response.end(
        JSON.stringify({
          accepted: true,
          scenario: scenarioName,
          name: scenario.name,
        })
      );


      // Run exactly the same RescueMesh pipeline used
      // by a physical ESP32 incident.
      //
      // Optional decision overrides are intended only
      // for controlled demonstration scenarios.
      processEvent(
        scenario.event,
        scenario.overrides || null
      );


      return;
    }


    // --------------------------------------------------
    // DASHBOARD FILES
    // --------------------------------------------------

    const files = {
      "/": {
        name: "index.html",
        contentType: "text/html; charset=utf-8",
      },

      "/index.html": {
        name: "index.html",
        contentType: "text/html; charset=utf-8",
      },

      "/style.css": {
        name: "style.css",
        contentType: "text/css; charset=utf-8",
      },

      "/app.js": {
        name: "app.js",
        contentType:
          "application/javascript; charset=utf-8",
      },
    };


    const requestedFile =
      files[pathname];


    if (!requestedFile) {

      response.writeHead(
        404,
        {
          "Content-Type":
            "text/plain; charset=utf-8",
        }
      );

      response.end(
        "404 - Not Found"
      );

      return;
    }


    const filePath =
      path.join(
        DASHBOARD_DIR,
        requestedFile.name
      );


    fs.readFile(
      filePath,
      (error, content) => {

        if (error) {

          console.error(
            "[HTTP] Failed to read dashboard file:",
            error.message
          );

          response.writeHead(
            500,
            {
              "Content-Type":
                "text/plain; charset=utf-8",
            }
          );

          response.end(
            "500 - Dashboard file unavailable"
          );

          return;
        }


        response.writeHead(
          200,
          {
            "Content-Type":
              requestedFile.contentType,

            "Cache-Control":
              "no-store",
          }
        );

        response.end(content);
      }
    );
  }
);


// ======================================================
// BROADCAST DASHBOARD EVENT
// ======================================================

function broadcast(
  type,
  payload
) {


  updateDashboardState(type, payload);

  const message =
    JSON.stringify({
      type,
      payload,
      timestamp:
        new Date().toISOString(),
    });


  for (
    const client of dashboardClients
  ) {

    try {

      client.write(
        `data: ${message}\n\n`
      );

    } catch (error) {

      dashboardClients.delete(
        client
      );

      console.error(
        "[DASHBOARD] Failed to send event:",
        error.message
      );
    }
  }
}


// ======================================================
// START HTTP SERVER
// ======================================================

server.listen(
  HTTP_PORT,
  "127.0.0.1",
  () => {

    console.log(
      `[DASHBOARD] http://localhost:${HTTP_PORT}`
    );
  }
);


// ======================================================
// STARTUP
// ======================================================

console.log();
console.log("================================");
console.log(" RescueMesh Gateway");
console.log("================================");

console.log(
  `Serial: ${SERIAL_PORT} @ ${BAUD_RATE}`
);

console.log(
  `Safety confidence threshold: ${MIN_AUTOMATIC_CONFIDENCE}`
);

console.log(
  `Dashboard: http://localhost:${HTTP_PORT}`
);

console.log(
  "Waiting for ESP32..."
);

console.log();


// ======================================================
// SERIAL EVENTS
// ======================================================

port.on(
  "open",
  () => {

    console.log(
      "✓ Serial connection opened."
    );

    broadcast(
      "device",
      {
        connected: true,
        device: "ESP32-C3",
      }
    );
  }
);


port.on(
  "error",
  (error) => {

    console.error(
      "[SERIAL] Error:",
      error.message
    );

    broadcast(
      "device",
      {
        connected: false,
        error: error.message,
      }
    );
  }
);


// ======================================================
// RECEIVE DATA FROM ESP32
// ======================================================

parser.on(
  "data",
  (rawLine) => {

    const line =
      rawLine.trim();


    if (!line) {
      return;
    }


    console.log(
      `[ESP32] ${line}`
    );


    // --------------------------------------------------
    // PHYSICAL ACKNOWLEDGEMENTS
    // --------------------------------------------------

    if (
      line === "VALVE_CLOSED_ACK"
    ) {

      broadcast(
        "ack",
        {
          command:
            "VALVE_CLOSE",

          state:
            "CLOSED",

          acknowledged:
            true,
        }
      );

      return;
    }


    if (
      line === "VALVE_OPENED_ACK"
    ) {

      broadcast(
        "ack",
        {
          command:
            "VALVE_OPEN",

          state:
            "OPEN",

          acknowledged:
            true,
        }
      );

      return;
    }


    // --------------------------------------------------
    // START OF LEAK EVENT
    // --------------------------------------------------

    if (
      line === "LEAK_EVENT"
    ) {

      currentEvent = {
        type: "leak",

        timestamp:
          new Date().toISOString(),
      };

      return;
    }


    // --------------------------------------------------
    // EVENT PARAMETERS
    // --------------------------------------------------

    if (
      currentEvent &&
      line.includes("=")
    ) {

      const separatorIndex =
        line.indexOf("=");


      const key =
        line
          .slice(
            0,
            separatorIndex
          )
          .trim();


      const value =
        line
          .slice(
            separatorIndex + 1
          )
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


      // ------------------------------------------------
      // COMPLETE EVENT?
      // ------------------------------------------------

      const eventComplete =
        currentEvent.water_detected !==
          undefined &&

        Number.isFinite(
          currentEvent.flow
        ) &&

        currentEvent.occupancy !==
          undefined;


      if (eventComplete) {

        const completedEvent =
          currentEvent;

        currentEvent = null;


        processEvent(
          completedEvent
        );
      }
    }
  }
);


// ======================================================
// PROCESS INCIDENT
// ======================================================

async function processEvent(
  event,
  decisionOverrides = null
) {

  console.log();

  console.log(
    "========== INCIDENT =========="
  );


  console.log(
    JSON.stringify(
      event,
      null,
      2
    )
  );


  console.log(
    "=============================="
  );

  console.log();


  // ----------------------------------------------------
  // DASHBOARD: INCIDENT
  // ----------------------------------------------------

  broadcast(
    "incident",
    event
  );


  try {

    // --------------------------------------------------
    // AI DECISION LAYER
    // --------------------------------------------------

    let decision =
      await analyzeIncident(
        event
      );


    // --------------------------------------------------
    // DEMO DECISION OVERRIDE
    // --------------------------------------------------
    //
    // This does NOT bypass the RescueMesh Safety Policy.
    //
    // It allows controlled demo scenarios to alter
    // selected fields returned by the Jev adapter,
    // e.g. confidence = 0.42.
    //
    // The resulting decision still passes through the
    // complete local validation and actuation pipeline.
    // --------------------------------------------------

    if (
      decisionOverrides &&
      typeof decisionOverrides === "object"
    ) {

      decision = {
        ...decision,
        ...decisionOverrides,

        source:
          `${decision.source || "jev"}+demo-override`,
      };


      console.log(
        "[DEMO] Decision override applied:",
        decisionOverrides
      );
    }


    // --------------------------------------------------
    // DASHBOARD: JEV DECISION
    // --------------------------------------------------

    broadcast(
      "decision",
      decision
    );


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


    broadcast(
      "error",
      {
        stage: "jev",

        message:
          error.message,

        failSafe: true,
      }
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
    name:
      "Valid decision object",

    passed:
      validDecision,
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
    name:
      "Action is allowlisted",

    passed:
      actionAllowed,
  });


  if (!actionAllowed) {
    approved = false;
  }


  // ----------------------------------------------------
  // CHECK 3 - CONFIDENCE FORMAT
  // ----------------------------------------------------

  const confidenceValid =
    typeof decision.confidence ===
      "number" &&

    Number.isFinite(
      decision.confidence
    ) &&

    decision.confidence >= 0 &&

    decision.confidence <= 1;


  checks.push({
    name:
      "Confidence value is valid",

    passed:
      confidenceValid,
  });


  if (!confidenceValid) {
    approved = false;
  }


  // ----------------------------------------------------
  // CHECK 4 - AUTOMATIC CONFIDENCE THRESHOLD
  // ----------------------------------------------------

  const physicalActionRequested =
    decision.action !== "NONE";


  if (physicalActionRequested) {

    const confidenceSufficient =
      confidenceValid &&
      decision.confidence >=
        MIN_AUTOMATIC_CONFIDENCE;


    checks.push({
      name:
        `Confidence >= ${MIN_AUTOMATIC_CONFIDENCE}`,

      passed:
        confidenceSufficient,
    });


    if (!confidenceSufficient) {
      approved = false;
    }

  } else {

    checks.push({
      name:
        "Confidence threshold not required — no physical action",

      passed:
        true,
    });
  }


  // ----------------------------------------------------
  // CHECK 5 - HUMAN CONFIRMATION
  // ----------------------------------------------------

  const confirmationNotRequired =
    decision.requires_confirmation ===
      false;


  checks.push({
    name:
      "No human confirmation required",

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
    decision.action ===
      "VALVE_CLOSE"
  ) {

    const waterDetected =
      event.water_detected ===
        true;


    const activeFlow =
      Number.isFinite(
        event.flow
      ) &&
      event.flow > 0;


    const propertyUnoccupied =
      event.occupancy ===
        "away";


    checks.push({
      name:
        "Water physically detected",

      passed:
        waterDetected,
    });


    checks.push({
      name:
        "Active water flow detected",

      passed:
        activeFlow,
    });


    checks.push({
      name:
        "Property is unoccupied",

      passed:
        propertyUnoccupied,
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
    decision.action ===
      "VALVE_OPEN"
  ) {

    /*
     * RescueMesh intentionally blocks autonomous
     * valve reopening.
     *
     * Reopening must require explicit human
     * confirmation in a future implementation.
     */

    checks.push({
      name:
        "Automatic valve reopening permitted",

      passed:
        false,
    });


    approved = false;
  }


  // ----------------------------------------------------
  // FINAL RESULT
  // ----------------------------------------------------

  return {

    approved,

    checks,

    reason:
      approved
        ? "Safety policy requirements satisfied."
        : "Safety policy requirements not satisfied.",
  };
}


// ======================================================
// DISPLAY SAFETY RESULT
// ======================================================

function printSafetyResult(
  result
) {

  console.log();

  console.log(
    "========== SAFETY =========="
  );


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


  console.log(
    "----------------------------"
  );


  if (
    result.approved
  ) {

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


  console.log(
    "============================"
  );
}


// ======================================================
// VALIDATE AND EXECUTE DECISION
// ======================================================

function executeDecision(
  decision,
  event
) {

  console.log();

  console.log(
    "========= DECISION ========="
  );


  console.log(
    JSON.stringify(
      decision,
      null,
      2
    )
  );


  console.log(
    "============================"
  );


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
  // DASHBOARD: SAFETY RESULT
  // ----------------------------------------------------

  broadcast(
    "safety",
    safetyResult
  );


  // ----------------------------------------------------
  // BLOCK UNSAFE DECISION
  // ----------------------------------------------------

  if (
    !safetyResult.approved
  ) {

    console.log(
      "→ NO COMMAND SENT TO ESP32"
    );


    broadcast(
      "actuation",
      {
        command: null,

        executed: false,

        reason:
          "Blocked by RescueMesh Safety Policy",
      }
    );


    return;
  }


  // ====================================================
  // EXECUTION
  // ====================================================

  switch (
    decision.action
  ) {


    // --------------------------------------------------
    // CLOSE VALVE
    // --------------------------------------------------

    case "VALVE_CLOSE":

      console.log();

      console.log(
        "→ Sending VALVE_CLOSE to ESP32"
      );


      broadcast(
        "actuation",
        {
          command:
            "VALVE_CLOSE",

          executed:
            true,

          status:
            "sent",
        }
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
       * This should currently never execute because
       * autonomous reopening is blocked by the
       * safety policy.
       */

      console.log();

      console.log(
        "→ Sending VALVE_OPEN to ESP32"
      );


      broadcast(
        "actuation",
        {
          command:
            "VALVE_OPEN",

          executed:
            true,

          status:
            "sent",
        }
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


      broadcast(
        "actuation",
        {
          command:
            "NONE",

          executed:
            false,

          reason:
            "No physical action required",
        }
      );

      break;
  }
}


// ======================================================
// SEND COMMAND TO ESP32
// ======================================================

function sendCommand(
  command
) {

  port.write(
    `${command}\n`,
    (error) => {

      if (error) {

        console.error(
          "[SERIAL] Failed to send command:",
          error.message
        );


        broadcast(
          "error",
          {
            stage:
              "actuation",

            command,

            message:
              error.message,
          }
        );


        return;
      }


      console.log(
        `[SERIAL] Command sent: ${command}`
      );
    }
  );
}


// ======================================================
// GRACEFUL SHUTDOWN
// ======================================================

function shutdown() {

  console.log();
  console.log(
    "[SYSTEM] Shutting down RescueMesh..."
  );


  for (
    const client of dashboardClients
  ) {

    client.end();
  }


  dashboardClients.clear();


  server.close();


  if (
    port.isOpen
  ) {

    port.close(
      () => {
        process.exit(0);
      }
    );

    return;
  }


  process.exit(0);
}


process.on(
  "SIGINT",
  shutdown
);