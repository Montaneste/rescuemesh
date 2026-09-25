# RescueMesh

**AI-Assisted Infrastructure Safety**

RescueMesh is a real-time infrastructure safety prototype that combines physical sensing, AI-assisted incident analysis, deterministic safety validation, and physical actuation.

The current prototype demonstrates autonomous water-leak mitigation using an ESP32-C3, a Node.js gateway, a Jev-compatible decision layer, a local safety policy, and a real-time monitoring dashboard.

---

## The Problem

Infrastructure incidents such as water leaks require fast decisions.

Traditional automation generally relies on fixed rules:

```text
IF water detected
THEN close valve
```

That approach lacks context.

A water event may occur while someone is at home, may have no active flow, or an AI-generated recommendation may not be sufficiently reliable to justify physical intervention.

RescueMesh introduces contextual decision-making while retaining deterministic control over safety-critical actions.

---

## Architecture

```text
┌──────────────────────┐
│      ESP32-C3        │
│                      │
│ Physical detection   │
│ Flow telemetry       │
│ Valve actuation      │
└──────────┬───────────┘
           │
           │ USB Serial
           ▼
┌──────────────────────┐
│ RescueMesh Gateway   │
│       Node.js        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Decision Engine      │
│                      │
│ JEV MOCK / JEV LIVE  │
└──────────┬───────────┘
           │
           │ Structured decision
           ▼
┌──────────────────────┐
│ RescueMesh Safety    │
│ Policy               │
│                      │
│ • Action allowlist   │
│ • Confidence         │
│ • Confirmation       │
│ • Physical context   │
└──────────┬───────────┘
           │
      APPROVE / BLOCK
           │
           ▼
┌──────────────────────┐
│ Physical Actuation   │
│                      │
│ ESP32 → Water Valve  │
└──────────┬───────────┘
           │
           ▼
     Actuation ACK
```

---

## Safety Principle

The AI decision engine does **not** directly control physical infrastructure.

Every proposed action must pass through the local RescueMesh Safety Policy before it can reach the ESP32.

The current safety layer validates:

- decision structure;
- action allowlist;
- confidence value;
- minimum confidence threshold;
- human-confirmation requirements;
- physical water detection;
- active water flow;
- occupancy context.

The current minimum confidence threshold for autonomous physical intervention is:

```text
0.90
```

A decision can therefore be rejected even when the AI recommends physical action.

---

## Decision Flow

```text
DETECT
   ↓
JEV
   ↓
VALIDATE
   ↓
ACT
   ↓
ACK
```

Example:

```text
Water detected
Flow: 8.4 L/min
Occupancy: AWAY
        │
        ▼
Jev analysis
        │
        ▼
VALVE_CLOSE
Confidence: 97%
Severity: CRITICAL
        │
        ▼
RescueMesh Safety Policy
        │
        ▼
APPROVED
        │
        ▼
ESP32
        │
        ▼
VALVE_CLOSE
        │
        ▼
VALVE_CLOSED_ACK
```

---

## Demo Scenarios

RescueMesh currently includes four predefined safety scenarios.

### 01 — Critical Leak

```text
Water detected: YES
Flow: 8.4 L/min
Occupancy: AWAY
Confidence: 97%
```

Expected result:

```text
JEV → VALVE_CLOSE
SAFETY → APPROVED
ESP32 → VALVE_CLOSE
ACK → VALVE_CLOSED
```

### 02 — Occupant Home

```text
Water detected: YES
Flow: 8.4 L/min
Occupancy: HOME
```

Expected result:

```text
JEV → NONE
SAFETY → NO ACTION
ESP32 → NO ACTION
```

### 03 — Low Confidence

```text
Water detected: YES
Flow: 8.4 L/min
Occupancy: AWAY
Confidence: 42%
```

Jev proposes:

```text
VALVE_CLOSE
```

but the local policy rejects the action:

```text
SAFETY → BLOCKED
Reason: confidence < 0.90
```

No physical command reaches the ESP32.

### 04 — No Active Flow

```text
Water detected: YES
Flow: 0 L/min
Occupancy: AWAY
```

Expected result:

```text
JEV → NONE
SAFETY → NO ACTION
ESP32 → NO ACTION
```

---

## Hardware

Current prototype:

- ESP32-C3
- USB connection to gateway
- BOOT button used to simulate physical leak detection
- simulated water-valve state

The ESP32 firmware already supports:

```text
LEAK_EVENT
VALVE_CLOSE
VALVE_OPEN
PING
STATUS
```

and physical-action acknowledgement:

```text
VALVE_CLOSED_ACK
VALVE_OPENED_ACK
```

The simulated sensing and valve layers can be replaced with real sensors and actuators without changing the higher-level RescueMesh architecture.

---

## Software

### Edge Device

Firmware:

```text
src/main.cpp
```

Platform:

```text
ESP32-C3
Arduino
PlatformIO
```

### Gateway

Main gateway:

```text
gateway/index.js
```

Responsibilities include:

- ESP32 serial communication;
- incident parsing;
- decision-engine orchestration;
- safety validation;
- physical command execution;
- acknowledgement handling;
- dashboard updates;
- incident audit trail.

### Decision Engine

```text
gateway/services/jev.js
```

The Jev integration is intentionally isolated from the rest of RescueMesh.

Current development mode:

```text
JEV MOCK
```

The architecture is prepared for:

```text
JEV LIVE
```

once official API access and integration details are available.

### Demo Scenarios

```text
gateway/scenarios/scenarios.js
```

Contains deterministic scenarios used to demonstrate RescueMesh safety behavior.

### Dashboard

```text
dashboard/
```

The real-time dashboard displays:

- incident telemetry;
- Jev analysis;
- confidence;
- severity;
- reasoning;
- safety-policy validation;
- physical response;
- ESP32 acknowledgement;
- incident trace.

---

## Running RescueMesh

Install Node.js dependencies:

```bash
npm install
```

Connect the ESP32-C3.

The current development configuration uses:

```text
COM5
115200 baud
```

Start RescueMesh:

```bash
node gateway/index.js
```

Open:

```text
http://localhost:3000
```

The dashboard should report:

```text
SYSTEM ONLINE
ESP32 CONNECTED
```

Pressing the ESP32 BOOT button generates a physical leak event.

---

## Example Incident

ESP32 telemetry:

```text
LEAK_EVENT
water_detected=true
flow=8.4
occupancy=away
```

Decision:

```json
{
  "action": "VALVE_CLOSE",
  "severity": "critical",
  "confidence": 0.97,
  "reason": "Water detected with active flow while property is unoccupied.",
  "requires_confirmation": false,
  "source": "jev-mock"
}
```

Safety result:

```text
DECISION APPROVED
```

Physical command:

```text
VALVE_CLOSE
```

ESP32 acknowledgement:

```text
VALVE_CLOSED_ACK
```

---

## Jev Integration Status

The RescueMesh decision layer currently operates in an explicitly identified **JEV MOCK** mode.

The production integration boundary is isolated in:

```text
gateway/services/jev.js
```

The rest of the system — physical sensing, incident transport, safety validation, actuation, acknowledgement, dashboard, and audit trail — operates independently of the Jev transport implementation.

Once official Jev API access and documentation are available, the mock adapter can be replaced by the live implementation without redesigning the remaining system.

---

## Design Philosophy

RescueMesh follows one central principle:

> AI may recommend an action. Safety policy decides whether that action is allowed to affect the physical world.

This separates probabilistic reasoning from deterministic infrastructure control.

---

## Current Prototype Status

- [x] ESP32-C3 communication
- [x] Physical incident simulation
- [x] Structured incident telemetry
- [x] Decision-engine abstraction
- [x] Jev mock integration
- [x] Local safety policy
- [x] Confidence gating
- [x] Action allowlist
- [x] Physical actuation command
- [x] ESP32 acknowledgement
- [x] Real-time dashboard
- [x] Incident audit trail
- [x] Four safety demonstration scenarios
- [ ] Jev live API integration
- [ ] Real water sensor
- [ ] Real motorized water valve

---

## Hackathon Prototype

Developed for **AI Hacker House: Equinox Edition powered by HackMeridian — Lisbon, 2026**.

RescueMesh is currently a functional safety prototype intended to demonstrate how AI-assisted reasoning can be integrated with physical infrastructure while preserving deterministic local safety controls.