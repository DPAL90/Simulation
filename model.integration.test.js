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

test("integration: full phase cycle returns to NS_GREEN with coherent signal ownership", () => {
  let phase = "NS_GREEN";
  const seen = [phase];

  for (let i = 0; i < 6; i += 1) {
    const ns = nsSignalColor(phase);
    const ew = ewSignalColor(phase);

    if (phase.startsWith("NS_")) {
      assert.notEqual(ns, "red");
      assert.equal(ew, "red");
    } else if (phase.startsWith("EW_")) {
      assert.notEqual(ew, "red");
      assert.equal(ns, "red");
    }

    phase = nextPhase(phase);
    seen.push(phase);
  }

  assert.equal(phase, "NS_GREEN");
  assert.deepEqual(seen, [
    "NS_GREEN",
    "NS_YELLOW",
    "ALL_RED_NS_TO_EW",
    "EW_GREEN",
    "EW_YELLOW",
    "ALL_RED_EW_TO_NS",
    "NS_GREEN",
  ]);
});

test("integration: emergency mode produces more emergency picks across deterministic rolls", () => {
  const rolls = Array.from({ length: 100 }, (_, i) => i / 100);

  const offBoost = currentEmergencySpawnBoost({
    emergencyMode: false,
    nowMs: 5000,
    activePriority: 0,
    cooldownUntilMs: 0,
  });
  const onBoost = currentEmergencySpawnBoost({
    emergencyMode: true,
    nowMs: 5000,
    activePriority: 0,
    cooldownUntilMs: 0,
  });

  const countEmergency = (boost) => {
    let count = 0;
    for (const roll of rolls) {
      const kind = pickVehicleType(VEHICLE_TYPES, roll, boost).kind;
      if (kind === "ambulance" || kind === "police") {
        count += 1;
      }
    }
    return count;
  };

  const offCount = countEmergency(offBoost);
  const onCount = countEmergency(onBoost);

  assert.ok(onCount > offCount);
});

test("integration: cooldown + active load both reduce emergency boost", () => {
  const ideal = currentEmergencySpawnBoost({
    emergencyMode: true,
    nowMs: 9000,
    activePriority: 0,
    cooldownUntilMs: 0,
  });

  const heavyLoad = currentEmergencySpawnBoost({
    emergencyMode: true,
    nowMs: 9000,
    activePriority: 8,
    cooldownUntilMs: 0,
  });

  const cooldown = currentEmergencySpawnBoost({
    emergencyMode: true,
    nowMs: 9000,
    activePriority: 0,
    cooldownUntilMs: 9500,
  });

  assert.ok(heavyLoad < ideal);
  assert.ok(cooldown < ideal);
});

test("integration: invalid phase gracefully falls back to safe defaults", () => {
  const durations = { green: 7, yellow: 2, allRed: 3 };
  const invalid = "BAD_PHASE";

  assert.equal(phaseDuration(invalid, durations), 3);
  assert.equal(nsSignalColor(invalid), "red");
  assert.equal(ewSignalColor(invalid), "red");
  assert.equal(nextPhase(invalid), "NS_GREEN");
});
