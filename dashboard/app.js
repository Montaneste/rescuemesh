// ======================================================
// RescueMesh Dashboard
// ======================================================

console.log(
  "RescueMesh Dashboard loaded."
);


// ======================================================
// SERVER-SENT EVENTS
// ======================================================

const eventSource =
  new EventSource("/events");


eventSource.onopen = () => {

  console.log(
    "[DASHBOARD] Connected to RescueMesh Gateway."
  );
};


eventSource.onerror = () => {

  console.log(
    "[DASHBOARD] Gateway connection interrupted."
  );
};


eventSource.onmessage = (message) => {

  try {

    const data =
      JSON.parse(message.data);

    console.log(
      "[RESCUEMESH EVENT]",
      data
    );

    handleDashboardEvent(
      data
    );

  } catch (error) {

    console.error(
      "[DASHBOARD] Invalid event:",
      error
    );
  }
};


// ======================================================
// EVENT ROUTER
// ======================================================

function handleDashboardEvent(data) {

  switch (data.type) {

    case "incident":
      showIncident(
        data.payload
      );
      break;

    case "decision":
      showDecision(
        data.payload
      );
      break;

    case "safety":
      showSafety(
        data.payload
      );
      break;

    case "actuation":
      showActuation(
        data.payload
      );
      break;

    case "ack":
      showAcknowledgement(
        data.payload
      );
      break;

    case "error":
      showError(
        data.payload
      );
      break;

    default:
      console.warn(
        "[DASHBOARD] Unknown event type:",
        data.type
      );
  }
}


// ======================================================
// INCIDENT
// ======================================================

function showIncident(event) {

  clearIncidentTrace();

  addTraceEntry(
    "DETECT",
    "Water leak detected",
    `Flow ${event.flow} L/min · Occupancy ${String(
      event.occupancy
    ).toUpperCase()}`,
    "warning"
  );

  activateStep(
    "step-detect"
  );


  document.getElementById(
    "incident-title"
  ).textContent =
    "Water leak detected";


  document.getElementById(
    "severity-badge"
  ).textContent =
    "INCIDENT";


  document.getElementById(
    "severity-badge"
  ).className =
    "badge critical";


  document.getElementById(
    "water-value"
  ).textContent =
    event.water_detected
      ? "YES"
      : "NO";


  document.getElementById(
    "flow-value"
  ).textContent =
    `${event.flow} L/min`;


  document.getElementById(
    "occupancy-value"
  ).textContent =
    String(
      event.occupancy
    ).toUpperCase();


  document.getElementById(
    "timestamp-value"
  ).textContent =
    new Date(
      event.timestamp
    ).toLocaleTimeString();


  // Reset physical-response area whenever
  // a new incident begins.

  document.getElementById(
    "valve-state"
  ).textContent =
    "—";


  document.getElementById(
    "ack-state"
  ).textContent =
    "Waiting for safety validation";


  document.getElementById(
    "ack-state"
  ).className =
    "ack waiting";
}


// ======================================================
// JEV DECISION
// ======================================================

let currentDecision = null;


function showDecision(decision) {

  currentDecision = decision;

  activateStep(
    "step-ai"
  );

  addTraceEntry(
    "JEV",
    formatAction(
      decision.action
    ),
    `${String(
      decision.severity
    ).toUpperCase()} · Confidence ${Math.round(
      decision.confidence * 100
    )}%`,
    "ai"
  );


  const isLive =
    decision.source === "jev" ||
    decision.source === "jev-live";


  document.getElementById(
    "jev-mode"
  ).textContent =
    isLive
      ? "JEV LIVE"
      : "JEV MOCK";


  document.getElementById(
    "footer-ai"
  ).textContent =
    isLive
      ? "JEV LIVE"
      : "JEV MOCK";


  document.getElementById(
    "jev-action"
  ).textContent =
    formatAction(
      decision.action
    );


  document.getElementById(
    "confidence-value"
  ).textContent =
    Number.isFinite(
      decision.confidence
    )
      ? `${Math.round(
          decision.confidence * 100
        )}%`
      : "—";


  document.getElementById(
    "jev-severity"
  ).textContent =
    decision.severity
      ? String(
          decision.severity
        ).toUpperCase()
      : "—";


  document.getElementById(
    "reason-value"
  ).textContent =
    decision.reason ||
    "No reasoning provided.";
}


// ======================================================
// SAFETY
// ======================================================

function showSafety(result) {

  activateStep(
    "step-safety"
  );


  const container =
    document.getElementById(
      "safety-checks"
    );


  container.innerHTML =
    "";


  for (
    const check of result.checks
  ) {

    const element =
      document.createElement(
        "div"
      );


    element.className =
      check.passed
        ? "check pass"
        : "check fail";


    element.textContent =
      `${check.passed ? "✓" : "✗"} ${check.name}`;


    container.appendChild(
      element
    );
  }


  const badge =
    document.getElementById(
      "safety-badge"
    );


  const resultElement =
    document.getElementById(
      "safety-result"
    );


  const noAction =
    result.approved &&
    currentDecision?.action === "NONE";


  // ----------------------------------------------------
  // VALID DECISION — NO PHYSICAL ACTION REQUIRED
  // ----------------------------------------------------

  if (noAction) {

    badge.textContent =
      "NO ACTION";

    badge.className =
      "badge neutral";


    resultElement.textContent =
      "○ NO ACTION REQUIRED";

    resultElement.className =
      "decision waiting";


    document.getElementById(
      "valve-state"
    ).textContent =
      "NO ACTION";


    document.getElementById(
      "ack-state"
    ).textContent =
      "○ No physical action required";


    document.getElementById(
      "ack-state"
    ).className =
      "ack waiting";


    addTraceEntry(
      "VALIDATE",
      "Decision accepted",
      "No physical action required",
      "success"
    );


    return;
  }


  // ----------------------------------------------------
  // APPROVED PHYSICAL ACTION
  // ----------------------------------------------------

  if (
    result.approved
  ) {

    badge.textContent =
      "APPROVED";


    badge.className =
      "badge approved";


    resultElement.textContent =
      "✓ DECISION APPROVED";


    resultElement.className =
      "decision approved";


    document.getElementById(
      "ack-state"
    ).textContent =
      "Safety approved — awaiting actuation";


    document.getElementById(
      "ack-state"
    ).className =
      "ack waiting";


    addTraceEntry(
      "VALIDATE",
      "Safety policy approved",
      "Physical actuation authorised",
      "success"
    );


    return;
  }


  // ----------------------------------------------------
  // BLOCKED BY SAFETY POLICY
  // ----------------------------------------------------

  badge.textContent =
    "BLOCKED";


  badge.className =
    "badge blocked";


  resultElement.textContent =
    "✗ DECISION BLOCKED";


  resultElement.className =
    "decision blocked";


  activateStep(
    "step-safety"
  );


  document.getElementById(
    "valve-state"
  ).textContent =
    "NO ACTION";


  document.getElementById(
    "ack-state"
  ).textContent =
    "✗ Command blocked by RescueMesh Safety Policy";


  document.getElementById(
    "ack-state"
  ).className =
    "ack blocked";


  const failedChecks =
    result.checks
      .filter(
        (check) =>
          !check.passed
      )
      .map(
        (check) =>
          check.name
      )
      .join(" · ");


  addTraceEntry(
    "VALIDATE",
    "Decision blocked",
    failedChecks ||
      "Safety policy requirements not satisfied",
    "blocked"
  );
}

// ======================================================
// ACTUATION
// ======================================================

function showActuation(data) {

  // ----------------------------------------------------
  // VALID DECISION — NO PHYSICAL ACTION REQUIRED
  // ----------------------------------------------------

  if (
    data.command === "NONE"
  ) {

    activateStep(
      "step-safety"
    );


    document.getElementById(
      "valve-state"
    ).textContent =
      "NO ACTION";


    document.getElementById(
      "ack-state"
    ).textContent =
      "○ No physical action required";


    document.getElementById(
      "ack-state"
    ).className =
      "ack waiting";


    return;
  }


  // ----------------------------------------------------
  // BLOCKED / NOT EXECUTED
  // ----------------------------------------------------

  if (
    data.executed === false
  ) {

    activateStep(
      "step-safety"
    );


    document.getElementById(
      "valve-state"
    ).textContent =
      "NO ACTION";


    document.getElementById(
      "ack-state"
    ).textContent =
      data.reason
        ? `✗ ${data.reason}`
        : "✗ Command blocked by RescueMesh Safety Policy";


    document.getElementById(
      "ack-state"
    ).className =
      "ack blocked";


    return;
  }


  // ----------------------------------------------------
  // COMMAND ACTUALLY SENT
  // ----------------------------------------------------

  activateStep(
    "step-act"
  );


  document.getElementById(
    "valve-state"
  ).textContent =
    formatAction(
      data.command
    );


  document.getElementById(
    "ack-state"
  ).textContent =
    "Command sent — waiting for acknowledgement";


  document.getElementById(
    "ack-state"
  ).className =
    "ack waiting";


  addTraceEntry(
    "ACT",
    formatAction(
      data.command
    ),
    "Command sent to ESP32-C3",
    "act"
  );
}

// ======================================================
// ACKNOWLEDGEMENT
// ======================================================

function showAcknowledgement(data) {

  activateStep(
    "step-act"
  );


  document.getElementById(
    "valve-state"
  ).textContent =
    data.state ||
    "CLOSED";


  document.getElementById(
    "ack-state"
  ).textContent =
    "✓ Physical action acknowledged by ESP32";


  document.getElementById(
    "ack-state"
  ).className =
    "ack success";


  addTraceEntry(
    "ACK",
    "Physical action confirmed",
    `ESP32-C3 reports valve ${
      data.state || "CLOSED"
    }`,
    "success"
  );
}

// ======================================================
// FAIL-SAFE / ERROR
// ======================================================

function showError(data) {

  console.error(
    "[RESCUEMESH FAIL-SAFE]",
    data
  );


  activateStep(
    "step-safety"
  );


  document.getElementById(
    "valve-state"
  ).textContent =
    "NO ACTION";


  document.getElementById(
    "ack-state"
  ).textContent =
    data.failSafe
      ? "✗ Fail-safe active — no physical command sent"
      : "✗ RescueMesh processing error";


  document.getElementById(
    "ack-state"
  ).className =
    "ack blocked";
}


// ======================================================
// PIPELINE
// ======================================================

function activateStep(id) {

  document
    .querySelectorAll(
      ".pipeline-step"
    )
    .forEach(
      (element) => {

        element.classList.remove(
          "active"
        );
      }
    );


  const target =
    document.getElementById(
      id
    );


  if (
    target
  ) {

    target.classList.add(
      "active"
    );
  }
}


// ======================================================
// HELPERS
// ======================================================

function formatAction(action) {

  if (
    !action
  ) {

    return "—";
  }


  return String(
    action
  )
    .replaceAll(
      "_",
      " "
    );
}


// ======================================================
// INCIDENT TRACE
// ======================================================

function clearIncidentTrace() {

  const container =
    document.getElementById(
      "incident-trace"
    );

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const status =
    document.getElementById(
      "trace-status"
    );

  if (status) {
    status.textContent = "LIVE";
  }
}


function addTraceEntry(
  stage,
  message,
  detail = "",
  state = ""
) {

  const container =
    document.getElementById(
      "incident-trace"
    );

  if (!container) {
    return;
  }


  const empty =
    container.querySelector(
      ".trace-empty"
    );

  if (empty) {
    empty.remove();
  }


  const entry =
    document.createElement(
      "div"
    );

  entry.className =
    `trace-entry ${state}`;


  const time =
    new Date()
      .toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }
      );


  entry.innerHTML = `
    <span class="trace-time">
      ${time}
    </span>

    <span class="trace-stage">
      ${stage}
    </span>

    <span class="trace-message">
      ${message}

      ${
        detail
          ? `<span class="trace-detail">${detail}</span>`
          : ""
      }
    </span>
  `;


  container.appendChild(
    entry
  );


  const status =
    document.getElementById(
      "trace-status"
    );

  if (status) {
    status.textContent =
      "LIVE";
  }
}


// ======================================================
// DEMO CONTROL
// ======================================================

const scenarioButtons =
  document.querySelectorAll(
    ".scenario-button"
  );


scenarioButtons.forEach(
  (button) => {

    button.addEventListener(
      "click",
      async () => {

        const scenario =
          button.dataset.scenario;

        if (!scenario) {
          return;
        }

        await runDemoScenario(
          scenario,
          button
        );
      }
    );
  }
);


// ======================================================
// RUN DEMO SCENARIO
// ======================================================

async function runDemoScenario(
  scenario,
  button
) {

  const status =
    document.getElementById(
      "demo-status"
    );


  // Prevent duplicate requests while a scenario
  // is already being submitted.
  setDemoButtonsDisabled(
    true
  );


  document
    .querySelectorAll(
      ".scenario-button"
    )
    .forEach(
      (element) => {

        element.classList.remove(
          "running"
        );
      }
    );


  button.classList.add(
    "running"
  );


  status.textContent =
    "RUNNING";


  status.className =
    "demo-status running";


  try {

    const response =
      await fetch(
        `/api/scenarios/${scenario}`,
        {
          method: "POST",
        }
      );


    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}`
      );
    }


    const result =
      await response.json();


    console.log(
      "[DEMO] Scenario accepted:",
      result
    );


    status.textContent =
      "SCENARIO SENT";


    status.className =
      "demo-status success";


  } catch (error) {

    console.error(
      "[DEMO] Scenario failed:",
      error
    );


    status.textContent =
      "ERROR";


    status.className =
      "demo-status error";
  }


  window.setTimeout(
    () => {

      button.classList.remove(
        "running"
      );


      status.textContent =
        "READY";


      status.className =
        "demo-status";


      setDemoButtonsDisabled(
        false
      );

    },
    1200
  );
}


// ======================================================
// DEMO BUTTON STATE
// ======================================================

function setDemoButtonsDisabled(
  disabled
) {

  scenarioButtons.forEach(
    (button) => {

      button.disabled =
        disabled;
    }
  );
}