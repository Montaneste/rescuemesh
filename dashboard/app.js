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

function showDecision(decision) {

  activateStep(
    "step-ai"
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

  } else {

    badge.textContent =
      "BLOCKED";


    badge.className =
      "badge blocked";


    resultElement.textContent =
      "✗ DECISION BLOCKED";


    resultElement.className =
      "decision blocked";


    // Pipeline intentionally stops at VALIDATE.
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
  }
}


// ======================================================
// ACTUATION
// ======================================================

function showActuation(data) {

  // ----------------------------------------------------
  // BLOCKED / NOT EXECUTED
  // ----------------------------------------------------

  if (
    data.executed === false
  ) {

    // Do NOT activate ACT.
    // The pipeline stopped during safety validation.

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