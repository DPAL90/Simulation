function phaseDuration(phase, phaseDurations) {
  if (phase.endsWith("GREEN")) return phaseDurations.green;
  if (phase.endsWith("YELLOW")) return phaseDurations.yellow;
  return phaseDurations.allRed;
}

function nextPhase(current) {
  if (current === "NS_GREEN") return "NS_YELLOW";
  if (current === "NS_YELLOW") return "ALL_RED_NS_TO_EW";
  if (current === "ALL_RED_NS_TO_EW") return "EW_GREEN";
  if (current === "EW_GREEN") return "EW_YELLOW";
  if (current === "EW_YELLOW") return "ALL_RED_EW_TO_NS";
  return "NS_GREEN";
}

function nsSignalColor(phase) {
  if (phase === "NS_GREEN") return "green";
  if (phase === "NS_YELLOW") return "yellow";
  return "red";
}

function ewSignalColor(phase) {
  if (phase === "EW_GREEN") return "green";
  if (phase === "EW_YELLOW") return "yellow";
  return "red";
}

function currentEmergencySpawnBoost(options) {
  const {
    emergencyMode,
    nowMs,
    activePriority,
    cooldownUntilMs,
    normalTargetActive = 2,
    emergencyTargetActive = 4,
  } = options;

  const baseBoost = emergencyMode ? 2.8 : 1;
  const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(nowMs / 4200));
  const targetActive = emergencyMode ? emergencyTargetActive : normalTargetActive;
  const loadFactor = Math.min(1, Math.max(0.2, 1 - activePriority / targetActive));
  const cooldownFactor = nowMs < cooldownUntilMs ? 0.25 : 1;
  return baseBoost * pulse * loadFactor * cooldownFactor;
}

function pickVehicleType(vehicleTypes, roll, emergencyBoost) {
  const totalWeight = vehicleTypes.reduce((sum, type) => {
    const adjusted = (type.kind === "ambulance" || type.kind === "police")
      ? type.weight * emergencyBoost
      : type.weight;
    return sum + adjusted;
  }, 0);

  let cumulative = 0;
  for (const type of vehicleTypes) {
    const adjusted = (type.kind === "ambulance" || type.kind === "police")
      ? type.weight * emergencyBoost
      : type.weight;
    cumulative += adjusted;
    if (roll <= cumulative / totalWeight) {
      return type;
    }
  }

  return vehicleTypes[0];
}

module.exports = {
  phaseDuration,
  nextPhase,
  nsSignalColor,
  ewSignalColor,
  currentEmergencySpawnBoost,
  pickVehicleType,
};
