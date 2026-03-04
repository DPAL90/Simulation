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

test("component: phaseDuration returns configured green duration", () => {
  const durations = { green: 9, yellow: 3, allRed: 2 };
  assert.equal(phaseDuration("NS_GREEN", durations), 9);
});

test("component: nextPhase transitions NS_GREEN -> NS_YELLOW", () => {
  assert.equal(nextPhase("NS_GREEN"), "NS_YELLOW");
});

test("component: nsSignalColor maps NS_YELLOW to yellow", () => {
  assert.equal(nsSignalColor("NS_YELLOW"), "yellow");
});

test("component: ewSignalColor maps EW_GREEN to green", () => {
  assert.equal(ewSignalColor("EW_GREEN"), "green");
});

test("component: currentEmergencySpawnBoost increases when emergency mode is on", () => {
  const off = currentEmergencySpawnBoost({
    emergencyMode: false,
    nowMs: 6000,
    activePriority: 0,
    cooldownUntilMs: 0,
  });

  const on = currentEmergencySpawnBoost({
    emergencyMode: true,
    nowMs: 6000,
    activePriority: 0,
    cooldownUntilMs: 0,
  });

  assert.ok(on > off);
});

test("component: pickVehicleType returns valid kind at upper roll boundary", () => {
  const type = pickVehicleType(VEHICLE_TYPES, 1, 1);
  assert.equal(type.kind, "police");
});
