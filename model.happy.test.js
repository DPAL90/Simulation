const test = require("node:test");
const assert = require("node:assert/strict");

const {
  phaseDuration,
  nextPhase,
  nsSignalColor,
  ewSignalColor,
  currentEmergencySpawnBoost,
  pickVehicleType,
} = require("./model");

const VEHICLE_TYPES = [
  { kind: "car", weight: 0.53 },
  { kind: "truck", weight: 0.22 },
  { kind: "bike", weight: 0.19 },
  { kind: "ambulance", weight: 0.03 },
  { kind: "police", weight: 0.03 },
];

// Functionality: map active phase family to configured timing bucket.
// Expected app behavior: countdown and phase timing should match user-selected Green/Yellow/All-Red values.
test("phaseDuration maps phase suffix to duration", () => {
  const durations = { green: 7, yellow: 2, allRed: 3 };
  assert.equal(phaseDuration("NS_GREEN", durations), 7);
  assert.equal(phaseDuration("EW_YELLOW", durations), 2);
  assert.equal(phaseDuration("ALL_RED_NS_TO_EW", durations), 3);
});

// Functionality: enforce the canonical 6-step intersection phase cycle.
// Expected app behavior: signal progression should remain predictable and repeatable for users.
test("nextPhase follows expected 6-step cycle", () => {
  assert.equal(nextPhase("NS_GREEN"), "NS_YELLOW");
  assert.equal(nextPhase("NS_YELLOW"), "ALL_RED_NS_TO_EW");
  assert.equal(nextPhase("ALL_RED_NS_TO_EW"), "EW_GREEN");
  assert.equal(nextPhase("EW_GREEN"), "EW_YELLOW");
  assert.equal(nextPhase("EW_YELLOW"), "ALL_RED_EW_TO_NS");
  assert.equal(nextPhase("ALL_RED_EW_TO_NS"), "NS_GREEN");
});

// Functionality: resolve per-direction signal color from current phase.
// Expected app behavior: one direction gets GO/WAIT while perpendicular traffic stays STOP.
test("signal color functions reflect phase ownership", () => {
  assert.equal(nsSignalColor("NS_GREEN"), "green");
  assert.equal(nsSignalColor("NS_YELLOW"), "yellow");
  assert.equal(nsSignalColor("EW_GREEN"), "red");

  assert.equal(ewSignalColor("EW_GREEN"), "green");
  assert.equal(ewSignalColor("EW_YELLOW"), "yellow");
  assert.equal(ewSignalColor("NS_GREEN"), "red");
});

// Functionality: increase emergency spawn influence when emergency mode is enabled.
// Expected app behavior: users should observe more ambulance/police events in Emergency Mode.
test("emergency spawn boost is higher in emergency mode than normal", () => {
  const normal = currentEmergencySpawnBoost({
    emergencyMode: false,
    nowMs: 5000,
    activePriority: 0,
    cooldownUntilMs: 0,
  });

  const emergency = currentEmergencySpawnBoost({
    emergencyMode: true,
    nowMs: 5000,
    activePriority: 0,
    cooldownUntilMs: 0,
  });

  assert.ok(emergency > normal);
});

// Functionality: damp emergency spawn immediately after a priority spawn event.
// Expected app behavior: emergency vehicles should not appear unrealistically back-to-back.
test("cooldown strongly suppresses emergency spawn boost", () => {
  const withoutCooldown = currentEmergencySpawnBoost({
    emergencyMode: true,
    nowMs: 8000,
    activePriority: 1,
    cooldownUntilMs: 0,
  });

  const withCooldown = currentEmergencySpawnBoost({
    emergencyMode: true,
    nowMs: 8000,
    activePriority: 1,
    cooldownUntilMs: 9000,
  });

  assert.ok(withCooldown < withoutCooldown);
});

// Functionality: weighted picker should bias toward emergency kinds under higher emergency boost.
// Expected app behavior: emergency scenarios become more frequent when boost rises.
test("pickVehicleType favors emergency kinds more when boost is high", () => {
  const lowBoostChoice = pickVehicleType(VEHICLE_TYPES, 0.9, 1);
  const highBoostChoice = pickVehicleType(VEHICLE_TYPES, 0.9, 2.8);

  assert.equal(lowBoostChoice.kind, "bike");
  assert.equal(highBoostChoice.kind, "ambulance");
});
