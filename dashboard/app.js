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
      showIncident(data.payload);
      break;

    case "decision":
      showDecision(data.payload);
      break;

    case "safety":
      showSafety(data.payload);
      break;

    case "actuation":
      showActuation(data.payload);
      break;

    case "ack":
      showAcknowledgement(data.payload);
      break;
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
}


// ======================================================
// JEV DECISION
// ======================================================

function showDecision(decision) {

  activateStep(
    "step-ai"
  );

  document.getElementById(
    "jev-mode"
  ).textContent =
    decision.source === "jev"
      ? "JEV LIVE"
      : "JEV MOCK";

  document.getElementById(
    "footer-ai"
  ).textContent =
    decision.source === "jev"
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
    `${Math.round(
      decision.confidence * 100
    )}%`;

  document.getElementById(
    "jev-severity"
  ).textContent =
    String(
      decision.severity
    ).toUpperCase();

  document.getElementById(
    "reason-value"
  ).textContent =
    decision.reason;
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

  container.innerHTML = "";


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


  if (result.approved) {

    badge.textContent =
      "APPROVED";

    badge.className =
      "badge approved";

    resultElement.textContent =
      "✓ DECISION APPROVED";

    resultElement.className =
      "decision approved";

  } else {

    badge.textContent =
      "BLOCKED";

    badge.className =
      "badge blocked";

    resultElement.textContent =
      "✗ DECISION BLOCKED";

    resultElement.className =
      "decision blocked";
  }
}


// ======================================================
// ACTUATION
// ======================================================

function showActuation(data) {

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
    data.state || "CLOSED";

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

  document
    .getElementById(id)
    .classList.add(
      "active"
    );
}


// ======================================================
// HELPERS
// ======================================================

function formatAction(action) {

  if (!action) {
    return "—";
  }

  return action
    .replaceAll("_", " ");
}