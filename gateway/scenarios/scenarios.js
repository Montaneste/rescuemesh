const scenarios = {
  critical: {
    name: "Critical leak — property unoccupied",
    event: {
      type: "leak",
      water_detected: true,
      flow: 8.4,
      occupancy: "away",
    },
  },

  occupied: {
    name: "Leak detected — occupant at home",
    event: {
      type: "leak",
      water_detected: true,
      flow: 8.4,
      occupancy: "home",
    },
  },

  lowConfidence: {
    name: "Critical leak — low AI confidence",
    event: {
      type: "leak",
      water_detected: true,
      flow: 8.4,
      occupancy: "away",
    },

    overrides: {
      confidence: 0.42,
    },
  },

  noFlow: {
    name: "Water detected — no active flow",
    event: {
      type: "leak",
      water_detected: true,
      flow: 0,
      occupancy: "away",
    },
  },
};


function getScenario(name) {
  const scenario =
    scenarios[name];

  if (!scenario) {
    return null;
  }

  return {
    ...scenario,

    event: {
      ...scenario.event,
      timestamp:
        new Date().toISOString(),

      source:
        "demo-scenario",
    },
  };
}


function listScenarios() {
  return Object.entries(
    scenarios
  ).map(
    ([id, scenario]) => ({
      id,
      name: scenario.name,
    })
  );
}


module.exports = {
  getScenario,
  listScenarios,
};