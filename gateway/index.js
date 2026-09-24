const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const SERIAL_PORT = "COM5";
const BAUD_RATE = 115200;

const port = new SerialPort({
  path: SERIAL_PORT,
  baudRate: BAUD_RATE,
});

const parser = port.pipe(
  new ReadlineParser({ delimiter: "\n" })
);

let event = null;

console.log("================================");
console.log(" RescueMesh Gateway");
console.log("================================");
console.log(`Serial: ${SERIAL_PORT} @ ${BAUD_RATE}`);
console.log("Waiting for ESP32...");

port.on("open", () => {
  console.log("✓ Serial connection opened.");
});

port.on("error", (error) => {
  console.error("Serial error:", error.message);
});

parser.on("data", (rawLine) => {
  const line = rawLine.trim();

  if (!line) return;

  console.log(`[ESP32] ${line}`);

  if (line === "LEAK_EVENT") {
    event = {
      type: "leak",
      timestamp: new Date().toISOString(),
    };

    return;
  }

  if (event && line.includes("=")) {
    const [key, value] = line.split("=");

    if (key === "water_detected") {
      event.water_detected = value === "true";
    }

    if (key === "flow") {
      event.flow = Number(value);
    }

    if (key === "occupancy") {
      event.occupancy = value;
    }

    if (
      event.water_detected !== undefined &&
      event.flow !== undefined &&
      event.occupancy !== undefined
    ) {
      processEvent(event);
      event = null;
    }
  }
});

function processEvent(event) {
  console.log();
  console.log("========== EVENT ==========");
  console.log(JSON.stringify(event, null, 2));
  console.log("===========================");
  console.log();

  /*
   * Próximo passo:
   *
   * event
   *   ↓
   * Jev Client
   *   ↓
   * decisão estruturada
   *   ↓
   * executeDecision()
   */

  simulateJevDecision(event);
}

function simulateJevDecision(event) {
  console.log("[JEV MOCK] Analysing incident...");

  let decision = {
    action: "NONE",
    reason: "No intervention required",
  };

  if (
    event.water_detected === true &&
    event.flow > 0 &&
    event.occupancy === "away"
  ) {
    decision = {
      action: "VALVE_CLOSE",
      reason:
        "Water detected while property is unoccupied.",
    };
  }

  executeDecision(decision);
}

function executeDecision(decision) {
  console.log();
  console.log("========= DECISION =========");
  console.log(JSON.stringify(decision, null, 2));
  console.log("============================");

  if (decision.action === "VALVE_CLOSE") {
    console.log("→ Sending VALVE_CLOSE to ESP32");

    port.write("VALVE_CLOSE\n");
  }
}