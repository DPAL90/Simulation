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

// Functionality: fallback timing for unknown phase suffixes.
// Expected app behavior: simulation remains stable by defaulting to all-red timing instead of failing.
test("phaseDuration falls back to allRed for unknown suffix", () => {
  const durations = { green: 7, yellow: 2, allRed: 3 };
  assert.equal(phaseDuration("UNKNOWN_PHASE", durations), 3);
});

// Functionality: fallback phase recovery when controller gets invalid phase input.
// Expected app behavior: state machine recovers to NS_GREEN and continues running.
test("nextPhase falls back to NS_GREEN for invalid phase", () => {
  assert.equal(nextPhase("BAD_PHASE"), "NS_GREEN");
});

// Functionality: fail-safe signal color handling for unknown phases.
// Expected app behavior: unknown states default to STOP (red) for safety.
test("signal color functions return red for unknown phase", () => {
  assert.equal(nsSignalColor("UNKNOWN"), "red");
  assert.equal(ewSignalColor("UNKNOWN"), "red");
});

// Functionality: enforce minimum load factor when many priority vehicles are active.
// Expected app behavior: emergency spawning slows down but never reaches complete starvation.
test("emergency boost load factor is floored at 20%", () => {
  const atTarget = currentEmergencySpawnBoost({
    emergencyMode: true,
    nowMs: 9000,
    activePriority: 4,
    cooldownUntilMs: 0,
  });

  const wayAboveTarget = currentEmergencySpawnBoost({
    emergencyMode: true,
    nowMs: 9000,
    activePriority: 40,
    cooldownUntilMs: 0,
  });

  assert.equal(wayAboveTarget, atTarget);
});

// Functionality: clamp load factor upper bound for invalid negative active counts.
// Expected app behavior: boost never exceeds normal maximum due to bad inputs.
test("emergency boost load factor is capped at 100%", () => {
  const baseline = currentEmergencySpawnBoost({
    emergencyMode: false,
    nowMs: 7000,
    activePriority: 0,
    cooldownUntilMs: 0,
  });

  const negativeLoad = currentEmergencySpawnBoost({
    emergencyMode: false,
    nowMs: 7000,
    activePriority: -5,
    cooldownUntilMs: 0,
  });

  assert.equal(negativeLoad, baseline);
});

// Functionality: deterministic weighted-picker behavior at roll boundaries.
// Expected app behavior: lowest roll selects first bucket; highest roll selects final bucket.
test("pickVehicleType respects roll boundaries", () => {
  const first = pickVehicleType(VEHICLE_TYPES, 0, 1);
  const last = pickVehicleType(VEHICLE_TYPES, 1, 1);

  assert.equal(first.kind, "car");
  assert.equal(last.kind, "police");
});

// Functionality: picker robustness with single-type pools.
// Expected app behavior: always returns the only available vehicle type without errors.
test("pickVehicleType works with a single vehicle type", () => {
  const only = [{ kind: "car", weight: 1 }];
  const picked = pickVehicleType(only, 0.73, 2.8);
  assert.equal(picked.kind, "car");
});

// Functionality: fallback return path in weighted picker when total effective weight is zero.
// Expected app behavior: selector remains deterministic and safely returns first type.
test("pickVehicleType falls back to first type when effective total weight is zero", () => {
  const zeroWeights = [
    { kind: "car", weight: 0 },
    { kind: "ambulance", weight: 0 },
    { kind: "police", weight: 0 },
  ];

  const picked = pickVehicleType(zeroWeights, 0.5, 2.8);
  assert.equal(picked.kind, "car");
});
