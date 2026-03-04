const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

const laneCountInput = document.getElementById("laneCount");
const spawnRateInput = document.getElementById("spawnRate");
const greenInput = document.getElementById("greenSeconds");
const yellowInput = document.getElementById("yellowSeconds");
const redInput = document.getElementById("redSeconds");
const applyButton = document.getElementById("applySettings");
const emergencyModeButton = document.getElementById("emergencyMode");

const nsRedLight = document.getElementById("nsRed");
const nsYellowLight = document.getElementById("nsYellow");
const nsGreenLight = document.getElementById("nsGreen");
const ewRedLight = document.getElementById("ewRed");
const ewYellowLight = document.getElementById("ewYellow");
const ewGreenLight = document.getElementById("ewGreen");
const phaseLabel = document.getElementById("phaseLabel");
const nsState = document.getElementById("nsState");
const ewState = document.getElementById("ewState");
const nextPhaseLabel = document.getElementById("nextPhaseLabel");
const phaseCountdown = document.getElementById("phaseCountdown");
const emergencyStatus = document.getElementById("emergencyStatus");

const MARGIN = 30;
const LANE_WIDTH = 30;
const FOLLOW_GAP = 14;
const STOP_BUFFER = 8;
const MAX_VEHICLE_LENGTH = 56;
const STOP_MARGIN = 8;
const STOP_EPSILON = 0.25;
const BIKE_LANE_WIDTH = 14;
const FOOTPATH_WIDTH = 18;
const BIKE_FOLLOW_GAP = 10;
const CROSSING_OFFSET = 14;
const PRIORITY_ALERT_DISTANCE = 95;
const YIELD_SPEED_MULTIPLIER = 1.18;
const PRIORITY_GAP_FACTOR = 0.65;
const YIELD_FOLLOW_GAP_FACTOR = 0.55;
const YIELD_STOPLINE_CREEP = 10;

const VEHICLE_TYPES = [
  { kind: "car", weight: 0.53, length: 25, width: 14, minSpeed: 85, maxSpeed: 125 },
  { kind: "truck", weight: 0.22, length: 40, width: 17, minSpeed: 58, maxSpeed: 85 },
  { kind: "bike", weight: 0.19, length: 18, width: 7, minSpeed: 95, maxSpeed: 145 },
  { kind: "ambulance", weight: 0.03, length: 29, width: 15, minSpeed: 115, maxSpeed: 150 },
  { kind: "police", weight: 0.03, length: 27, width: 14, minSpeed: 110, maxSpeed: 145 },
];

const palette = ["#2e7d32", "#6a1b9a", "#ef6c00", "#0277bd", "#5d4037", "#d81b60"];

const state = {
  lanes: {
    N: [],
    S: [],
    E: [],
    W: [],
  },
  bikeLanes: {
    N: { approach: "N", bikes: [], spawnTimer: 0 },
    S: { approach: "S", bikes: [], spawnTimer: 0 },
    E: { approach: "E", bikes: [], spawnTimer: 0 },
    W: { approach: "W", bikes: [], spawnTimer: 0 },
  },
  pedestrianCrossings: {
    W: { key: "W", walkers: [], spawnTimer: 0 },
    E: { key: "E", walkers: [], spawnTimer: 0 },
    N: { key: "N", walkers: [], spawnTimer: 0 },
    S: { key: "S", walkers: [], spawnTimer: 0 },
  },
  laneCount: 3,
  spawnPerMinute: 5,
  phaseDurations: {
    green: 7,
    yellow: 2,
    allRed: 2,
  },
  phase: "NS_GREEN",
  phaseElapsed: 0,
  emergencyMode: false,
  prioritySpawnCooldownUntil: 0,
  lastTime: 0,
  idCounter: 0,
  geometry: null,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function eachLane(callback) {
  Object.values(state.lanes).forEach((group) => {
    group.forEach((lane) => callback(lane));
  });
}

function countActivePriorityVehicles() {
  let count = 0;
  eachLane((lane) => {
    lane.cars.forEach((car) => {
      if (car.isPriority) {
        count += 1;
      }
    });
  });
  return count;
}

function currentEmergencySpawnBoost() {
  const now = performance.now();
  const baseBoost = state.emergencyMode ? 2.8 : 1;
  const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(now / 4200));
  const activePriority = countActivePriorityVehicles();
  const targetActive = state.emergencyMode ? 4 : 2;
  const loadFactor = clamp(1 - activePriority / targetActive, 0.2, 1);
  const cooldownFactor = now < state.prioritySpawnCooldownUntil ? 0.25 : 1;
  return baseBoost * pulse * loadFactor * cooldownFactor;
}

function phaseDuration(phase) {
  if (phase.endsWith("GREEN")) return state.phaseDurations.green;
  if (phase.endsWith("YELLOW")) return state.phaseDurations.yellow;
  return state.phaseDurations.allRed;
}

function nextPhase(current) {
  if (current === "NS_GREEN") return "NS_YELLOW";
  if (current === "NS_YELLOW") return "ALL_RED_NS_TO_EW";
  if (current === "ALL_RED_NS_TO_EW") return "EW_GREEN";
  if (current === "EW_GREEN") return "EW_YELLOW";
  if (current === "EW_YELLOW") return "ALL_RED_EW_TO_NS";
  return "NS_GREEN";
}

function nsSignalColor() {
  if (state.phase === "NS_GREEN") return "green";
  if (state.phase === "NS_YELLOW") return "yellow";
  return "red";
}

function ewSignalColor() {
  if (state.phase === "EW_GREEN") return "green";
  if (state.phase === "EW_YELLOW") return "yellow";
  return "red";
}

function readablePhaseNameFor(phase) {
  if (phase === "NS_GREEN") return "North/South Green";
  if (phase === "NS_YELLOW") return "North/South Yellow";
  if (phase === "EW_GREEN") return "East/West Green";
  if (phase === "EW_YELLOW") return "East/West Yellow";
  return "All Red Transition";
}

function signalStateText(color) {
  if (color === "green") return "GO";
  if (color === "yellow") return "WAIT";
  return "STOP";
}

function stateClass(color) {
  if (color === "green") return "go";
  if (color === "yellow") return "wait";
  return "stop";
}

function updatePhasePanel() {
  const nsColor = nsSignalColor();
  const ewColor = ewSignalColor();

  phaseLabel.textContent = `Current: ${readablePhaseNameFor(state.phase)}`;

  nsState.textContent = signalStateText(nsColor);
  nsState.className = `stateBadge ${stateClass(nsColor)}`;

  ewState.textContent = signalStateText(ewColor);
  ewState.className = `stateBadge ${stateClass(ewColor)}`;

  nextPhaseLabel.textContent = readablePhaseNameFor(nextPhase(state.phase));

  const secondsLeft = Math.max(0, phaseDuration(state.phase) - state.phaseElapsed);
  phaseCountdown.textContent = `${secondsLeft.toFixed(1)}s`;
}

function buildLanes(count) {
  const makeGroup = (approach) => Array.from({ length: count }, (_, index) => ({
    approach,
    index,
    cars: [],
    spawnTimer: 0,
  }));

  state.lanes.N = makeGroup("N");
  state.lanes.S = makeGroup("S");
  state.lanes.E = makeGroup("E");
  state.lanes.W = makeGroup("W");

  state.bikeLanes.N = { approach: "N", bikes: [], spawnTimer: 0 };
  state.bikeLanes.S = { approach: "S", bikes: [], spawnTimer: 0 };
  state.bikeLanes.E = { approach: "E", bikes: [], spawnTimer: 0 };
  state.bikeLanes.W = { approach: "W", bikes: [], spawnTimer: 0 };

  state.pedestrianCrossings.W = { key: "W", walkers: [], spawnTimer: 0 };
  state.pedestrianCrossings.E = { key: "E", walkers: [], spawnTimer: 0 };
  state.pedestrianCrossings.N = { key: "N", walkers: [], spawnTimer: 0 };
  state.pedestrianCrossings.S = { key: "S", walkers: [], spawnTimer: 0 };
}

function resizeCanvas() {
  canvas.width = 1000;
  canvas.height = 620;
}

function updateLightUI() {
  const nsColor = nsSignalColor();
  const ewColor = ewSignalColor();

  nsRedLight.classList.toggle("active", nsColor === "red");
  nsYellowLight.classList.toggle("active", nsColor === "yellow");
  nsGreenLight.classList.toggle("active", nsColor === "green");

  ewRedLight.classList.toggle("active", ewColor === "red");
  ewYellowLight.classList.toggle("active", ewColor === "yellow");
  ewGreenLight.classList.toggle("active", ewColor === "green");

  updatePhasePanel();
}

function updateGeometry() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const halfRoad = state.laneCount * LANE_WIDTH;

  const laneYWest = (laneIndex) => centerY - LANE_WIDTH * (laneIndex + 0.5);
  const laneYEast = (laneIndex) => centerY + LANE_WIDTH * (laneIndex + 0.5);
  const laneXNorth = (laneIndex) => centerX + LANE_WIDTH * (laneIndex + 0.5);
  const laneXSouth = (laneIndex) => centerX - LANE_WIDTH * (laneIndex + 0.5);

  state.geometry = {
    centerX,
    centerY,
    halfRoad,
    laneYWest,
    laneYEast,
    laneXNorth,
    laneXSouth,
    stopLines: {
      W: centerX - halfRoad - STOP_BUFFER,
      E: centerX + halfRoad + STOP_BUFFER,
      N: centerY - halfRoad - STOP_BUFFER,
      S: centerY + halfRoad + STOP_BUFFER,
    },
  };
}

function updatePhase(dt) {
  state.phaseElapsed += dt;
  const currentDuration = phaseDuration(state.phase);
  if (state.phaseElapsed >= currentDuration) {
    state.phase = nextPhase(state.phase);
    state.phaseElapsed = 0;
    updateLightUI();
  }
}

function canSpawnInLane(lane) {
  if (lane.cars.length === 0) return true;
  return lane.cars[0].d > lane.cars[0].length + FOLLOW_GAP;
}

function pickVehicleType() {
  const roll = Math.random();
  const emergencyBoost = currentEmergencySpawnBoost();
  const totalWeight = VEHICLE_TYPES.reduce((sum, type) => {
    const adjusted = (type.kind === "ambulance" || type.kind === "police") ? type.weight * emergencyBoost : type.weight;
    return sum + adjusted;
  }, 0);

  let cumulative = 0;
  for (const type of VEHICLE_TYPES) {
    const adjusted = (type.kind === "ambulance" || type.kind === "police") ? type.weight * emergencyBoost : type.weight;
    cumulative += adjusted;
    if (roll <= cumulative / totalWeight) {
      return type;
    }
  }
  return VEHICLE_TYPES[0];
}

function updateEmergencyModeUI() {
  emergencyModeButton.textContent = state.emergencyMode ? "Emergency Mode: ON" : "Emergency Mode: OFF";
  emergencyModeButton.classList.toggle("active", state.emergencyMode);
  emergencyStatus.textContent = state.emergencyMode ? "Emergency Priority: ON" : "Emergency Priority: OFF";
  emergencyStatus.style.color = state.emergencyMode ? "#c62828" : "#2e7d32";
}

function createCar(lane) {
  const type = pickVehicleType();
  const isPriority = type.kind === "ambulance" || type.kind === "police";

  if (isPriority) {
    const cooldownBase = state.emergencyMode ? 2200 : 4200;
    state.prioritySpawnCooldownUntil = performance.now() + cooldownBase + Math.random() * 1400;
  }

  let color = palette[lane.index % palette.length];
  if (type.kind === "ambulance") color = "#f8fbff";
  if (type.kind === "police") color = "#1f3f7a";

  return {
    id: state.idCounter++,
    d: 0,
    kind: type.kind,
    length: type.length,
    width: type.width,
    speed: type.minSpeed + Math.random() * (type.maxSpeed - type.minSpeed),
    isPriority,
    yieldForPriority: false,
    isBraking: false,
    color,
  };
}

function maybeSpawnCars(dt) {
  const spawnInterval = 60 / state.spawnPerMinute;
  eachLane((lane) => {
    lane.spawnTimer += dt;
    if (lane.spawnTimer >= spawnInterval) {
      lane.spawnTimer = 0;
      if (!canSpawnInLane(lane)) return;
      lane.cars.push(createCar(lane));
    }
  });
}

function createBikeRider() {
  return {
    id: state.idCounter++,
    d: 0,
    kind: "bike",
    length: 16,
    width: 6,
    speed: 90 + Math.random() * 28,
    isBraking: false,
    color: "#f5f7fa",
  };
}

function canSpawnInBikeLane(lane) {
  if (lane.bikes.length === 0) return true;
  return lane.bikes[0].d > lane.bikes[0].length + BIKE_FOLLOW_GAP;
}

function maybeSpawnBikeLaneTraffic(dt) {
  const bikeSpawnInterval = 60 / Math.max(3, state.spawnPerMinute * 0.8);
  Object.values(state.bikeLanes).forEach((lane) => {
    lane.spawnTimer += dt;
    if (lane.spawnTimer >= bikeSpawnInterval) {
      lane.spawnTimer = 0;
      if (!canSpawnInBikeLane(lane)) return;
      lane.bikes.push(createBikeRider());
    }
  });
}

function crossingAllowsWalk(crossingKey) {
  if (crossingKey === "W" || crossingKey === "E") {
    return !approachHasGreen("W");
  }
  return !approachHasGreen("N");
}

function createWalker() {
  const fromStart = Math.random() > 0.5;
  return {
    id: state.idCounter++,
    progress: fromStart ? 0 : 1,
    direction: fromStart ? 1 : -1,
    targetSpeed: 0.2 + Math.random() * 0.12,
    speedCurrent: 0,
    walkPhase: Math.random() * Math.PI * 2,
    idlePhase: Math.random() * Math.PI * 2,
    isWaiting: false,
    lateralOffset: (Math.random() - 0.5) * 5,
    strideScale: 0.82 + Math.random() * 0.36,
    color: "#455a64",
  };
}

function maybeSpawnPedestrians(dt) {
  const spawnInterval = Math.max(6, 45 / Math.max(5, state.spawnPerMinute));
  Object.values(state.pedestrianCrossings).forEach((crossing) => {
    crossing.spawnTimer += dt;
    if (crossing.spawnTimer < spawnInterval) return;
    crossing.spawnTimer = 0;
    if (!crossingAllowsWalk(crossing.key)) return;

    const candidate = createWalker();
    const spawnGuard = 0.15;
    const tooCloseToSpawn = crossing.walkers.some((walker) => {
      if (candidate.direction > 0) return walker.progress < spawnGuard;
      return walker.progress > 1 - spawnGuard;
    });

    if (tooCloseToSpawn) return;
    crossing.walkers.push(candidate);
  });
}

function lanePathLength(approach) {
  if (approach === "W" || approach === "E") return canvas.width + MAX_VEHICLE_LENGTH * 2;
  return canvas.height + MAX_VEHICLE_LENGTH * 2;
}

function stopDistanceForCar(approach) {
  const { stopLines } = state.geometry;
  if (approach === "W") return stopLines.W - STOP_MARGIN;
  if (approach === "E") return canvas.width - (stopLines.E + STOP_MARGIN);
  if (approach === "N") return stopLines.N - STOP_MARGIN;
  return canvas.height - (stopLines.S + STOP_MARGIN);
}

function approachHasGreen(approach) {
  if (approach === "N" || approach === "S") return state.phase === "NS_GREEN";
  return state.phase === "EW_GREEN";
}

function updateCars(dt) {
  eachLane((lane) => {
    const canProceed = approachHasGreen(lane.approach);
    lane.cars.sort((a, b) => a.d - b.d);
    lane.cars.forEach((car) => {
      car.yieldForPriority = false;
    });

    for (let i = lane.cars.length - 1; i >= 0; i -= 1) {
      const car = lane.cars[i];
      const ahead = lane.cars[i + 1] ?? null;
      const stopDistance = stopDistanceForCar(lane.approach);

      if (!car.isPriority) {
        for (let j = i - 1; j >= 0; j -= 1) {
          const behindCandidate = lane.cars[j];
          if (!behindCandidate.isPriority) {
            continue;
          }

          const priorityDistance = car.d - behindCandidate.d;
          if (priorityDistance > 0 && priorityDistance < PRIORITY_ALERT_DISTANCE) {
            car.yieldForPriority = true;
          }
          break;
        }
      }

      let maxAllowedD = Number.POSITIVE_INFINITY;

      if (!canProceed && car.d <= stopDistance + STOP_EPSILON) {
        const redStopTarget = car.yieldForPriority ? stopDistance + YIELD_STOPLINE_CREEP : stopDistance;
        maxAllowedD = Math.min(maxAllowedD, redStopTarget);
      }

      if (ahead) {
        const yieldGap = car.yieldForPriority ? FOLLOW_GAP * YIELD_FOLLOW_GAP_FACTOR : FOLLOW_GAP;
        const followGap = car.isPriority ? FOLLOW_GAP * PRIORITY_GAP_FACTOR : FOLLOW_GAP;
        maxAllowedD = Math.min(maxAllowedD, ahead.d - ahead.length - (car.isPriority ? followGap : yieldGap));
      }

      const speedFactor = car.yieldForPriority ? YIELD_SPEED_MULTIPLIER : 1;
      const proposed = car.d + car.speed * speedFactor * dt;
      const nextD = Math.min(proposed, maxAllowedD);
      car.isBraking = nextD + 0.1 < proposed;
      car.d = nextD;
    }

    const maxDistance = lanePathLength(lane.approach);
    lane.cars = lane.cars.filter((car) => car.d < maxDistance + car.length + 40);
  });
}

function updateBikeLaneTraffic(dt) {
  Object.values(state.bikeLanes).forEach((lane) => {
    const canProceed = approachHasGreen(lane.approach);
    lane.bikes.sort((a, b) => a.d - b.d);

    for (let i = lane.bikes.length - 1; i >= 0; i -= 1) {
      const bike = lane.bikes[i];
      const ahead = lane.bikes[i + 1] ?? null;
      const stopDistance = stopDistanceForCar(lane.approach);

      let maxAllowedD = Number.POSITIVE_INFINITY;

      if (!canProceed && bike.d <= stopDistance + STOP_EPSILON) {
        maxAllowedD = Math.min(maxAllowedD, stopDistance);
      }

      if (ahead) {
        maxAllowedD = Math.min(maxAllowedD, ahead.d - ahead.length - BIKE_FOLLOW_GAP);
      }

      const proposed = bike.d + bike.speed * dt;
      const nextD = Math.min(proposed, maxAllowedD);
      bike.isBraking = nextD + 0.1 < proposed;
      bike.d = nextD;
    }

    const maxDistance = lanePathLength(lane.approach);
    lane.bikes = lane.bikes.filter((bike) => bike.d < maxDistance + bike.length + 40);
  });
}

function updatePedestrians(dt) {
  Object.values(state.pedestrianCrossings).forEach((crossing) => {
    const canWalk = crossingAllowsWalk(crossing.key);
    crossing.walkers.forEach((walker) => {
      const blend = Math.min(1, dt * 5);
      const desiredSpeed = canWalk ? walker.targetSpeed : 0;
      walker.speedCurrent += (desiredSpeed - walker.speedCurrent) * blend;

      const edgeDistance = Math.min(walker.progress, 1 - walker.progress);
      const edgeFactor = edgeDistance < 0.1 ? 0.45 + (edgeDistance / 0.1) * 0.55 : 1;

      walker.progress += walker.direction * walker.speedCurrent * edgeFactor * dt;
      walker.walkPhase += dt * (2 + walker.speedCurrent * 26 * walker.strideScale);
      walker.idlePhase += dt * 2.2;
      walker.isWaiting = !canWalk && walker.speedCurrent < 0.03;
    });

    crossing.walkers = crossing.walkers.filter((walker) => walker.progress >= 0 && walker.progress <= 1);
  });
}

function lanePosition(lane) {
  const geometry = state.geometry;
  if (lane.approach === "W") return { constant: geometry.laneYWest(lane.index) };
  if (lane.approach === "E") return { constant: geometry.laneYEast(lane.index) };
  if (lane.approach === "N") return { constant: geometry.laneXNorth(lane.index) };
  return { constant: geometry.laneXSouth(lane.index) };
}

function carPose(lane, car) {
  const { constant } = lanePosition(lane);

  if (lane.approach === "W") return { x: -car.length / 2 + car.d, y: constant, heading: 0 };
  if (lane.approach === "E") return { x: canvas.width + car.length / 2 - car.d, y: constant, heading: Math.PI };
  if (lane.approach === "N") return { x: constant, y: -car.length / 2 + car.d, heading: Math.PI / 2 };
  return { x: constant, y: canvas.height + car.length / 2 - car.d, heading: -Math.PI / 2 };
}

function bikeLaneCenterForApproach(approach) {
  const { centerX, centerY, halfRoad } = state.geometry;
  if (approach === "W") return centerY - halfRoad - BIKE_LANE_WIDTH / 2;
  if (approach === "E") return centerY + halfRoad + BIKE_LANE_WIDTH / 2;
  if (approach === "N") return centerX + halfRoad + BIKE_LANE_WIDTH / 2;
  return centerX - halfRoad - BIKE_LANE_WIDTH / 2;
}

function bikePose(approach, bike) {
  const constant = bikeLaneCenterForApproach(approach);

  if (approach === "W") return { x: -bike.length / 2 + bike.d, y: constant, heading: 0 };
  if (approach === "E") return { x: canvas.width + bike.length / 2 - bike.d, y: constant, heading: Math.PI };
  if (approach === "N") return { x: constant, y: -bike.length / 2 + bike.d, heading: Math.PI / 2 };
  return { x: constant, y: canvas.height + bike.length / 2 - bike.d, heading: -Math.PI / 2 };
}

function roundedBox(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function drawWheel(x, y, radius) {
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7c7c7c";
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeadlights(car) {
  const bodyW = car.length;
  const bodyH = car.width;
  const headSize = Math.max(1.6, bodyH * 0.11);
  const spread = bodyH * 0.28;

  ctx.fillStyle = "#fff3b0";
  ctx.shadowColor = "rgba(255, 243, 176, 0.75)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(bodyW / 2 - 1, -spread, headSize, 0, Math.PI * 2);
  ctx.arc(bodyW / 2 - 1, spread, headSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawBrakeLights(car) {
  if (!car.isBraking) return;

  const bodyW = car.length;
  const bodyH = car.width;
  const lampW = Math.max(2, bodyW * 0.08);
  const lampH = Math.max(2, bodyH * 0.2);
  const rearX = -bodyW / 2 + 1;
  const upperY = -bodyH * 0.35;
  const lowerY = bodyH * 0.15;

  ctx.fillStyle = "#ff3b30";
  ctx.shadowColor = "rgba(255, 59, 48, 0.8)";
  ctx.shadowBlur = 10;
  roundedBox(rearX, upperY, lampW, lampH, 2);
  ctx.fill();
  roundedBox(rearX, lowerY, lampW, lampH, 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawEmergencyLights(car) {
  if (!car.isPriority) return;

  const bodyW = car.length;
  const bodyH = car.width;
  const blinkOn = Math.sin(performance.now() / 120 + car.id) > 0;
  const leftColor = car.kind === "ambulance" ? (blinkOn ? "#ff3b30" : "#4fc3f7") : (blinkOn ? "#4fc3f7" : "#ff3b30");
  const rightColor = car.kind === "ambulance" ? (blinkOn ? "#4fc3f7" : "#ff3b30") : (blinkOn ? "#ff3b30" : "#4fc3f7");

  const barY = -bodyH * 0.64;
  roundedBox(-bodyW * 0.16, barY, bodyW * 0.32, bodyH * 0.18, 2);
  ctx.fillStyle = "#1e1e1e";
  ctx.fill();

  roundedBox(-bodyW * 0.15, barY + 1, bodyW * 0.14, bodyH * 0.14, 2);
  ctx.fillStyle = leftColor;
  ctx.shadowColor = leftColor;
  ctx.shadowBlur = 8;
  ctx.fill();

  roundedBox(bodyW * 0.01, barY + 1, bodyW * 0.14, bodyH * 0.14, 2);
  ctx.fillStyle = rightColor;
  ctx.shadowColor = rightColor;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawCarSprite(car) {
  const bodyW = car.length;
  const bodyH = car.width;
  ctx.fillStyle = car.color;
  roundedBox(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 6);
  ctx.fill();

  if (car.yieldForPriority && !car.isPriority) {
    ctx.strokeStyle = "#ffb300";
    ctx.lineWidth = 1.8;
    ctx.shadowColor = "rgba(255, 179, 0, 0.85)";
    ctx.shadowBlur = 10;
    roundedBox(-bodyW / 2 - 1, -bodyH / 2 - 1, bodyW + 2, bodyH + 2, 7);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (car.kind === "ambulance") {
    ctx.fillStyle = "#d32f2f";
    roundedBox(-bodyW * 0.1, -bodyH * 0.08, bodyW * 0.2, bodyH * 0.16, 1);
    ctx.fill();
    roundedBox(-bodyW * 0.04, -bodyH * 0.2, bodyW * 0.08, bodyH * 0.4, 1);
    ctx.fill();
  }

  if (car.kind === "police") {
    ctx.fillStyle = "#e9eef5";
    roundedBox(-bodyW * 0.42, -bodyH * 0.08, bodyW * 0.84, bodyH * 0.16, 2);
    ctx.fill();
  }

  ctx.fillStyle = "#bfd7ef";
  roundedBox(-bodyW * 0.18, -bodyH * 0.32, bodyW * 0.36, bodyH * 0.64, 4);
  ctx.fill();

  drawWheel(-bodyW * 0.28, -bodyH * 0.58, bodyH * 0.17);
  drawWheel(bodyW * 0.28, -bodyH * 0.58, bodyH * 0.17);
  drawWheel(-bodyW * 0.28, bodyH * 0.58, bodyH * 0.17);
  drawWheel(bodyW * 0.28, bodyH * 0.58, bodyH * 0.17);

  drawHeadlights(car);
  drawBrakeLights(car);
  drawEmergencyLights(car);
}

function drawTruckSprite(car) {
  const bodyW = car.length;
  const bodyH = car.width;
  const trailerW = bodyW * 0.72;
  const cabW = bodyW * 0.28;

  ctx.fillStyle = "#607d8b";
  roundedBox(-bodyW / 2, -bodyH / 2, trailerW, bodyH, 3);
  ctx.fill();

  ctx.fillStyle = car.color;
  roundedBox(-bodyW / 2 + trailerW, -bodyH / 2, cabW, bodyH, 3);
  ctx.fill();

  ctx.fillStyle = "#d6e7f8";
  roundedBox(bodyW * 0.17, -bodyH * 0.28, bodyW * 0.16, bodyH * 0.56, 2);
  ctx.fill();

  drawWheel(-bodyW * 0.28, -bodyH * 0.62, bodyH * 0.16);
  drawWheel(bodyW * 0.08, -bodyH * 0.62, bodyH * 0.16);
  drawWheel(-bodyW * 0.28, bodyH * 0.62, bodyH * 0.16);
  drawWheel(bodyW * 0.08, bodyH * 0.62, bodyH * 0.16);

  drawHeadlights(car);
  drawBrakeLights(car);
}

function drawBikeSprite(car) {
  const bodyW = car.length;
  const bodyH = car.width;
  const wheelR = bodyH * 0.45;

  drawWheel(-bodyW * 0.25, 0, wheelR);
  drawWheel(bodyW * 0.25, 0, wheelR);

  ctx.strokeStyle = car.color;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-bodyW * 0.25, 0);
  ctx.lineTo(-bodyW * 0.03, -bodyH * 0.45);
  ctx.lineTo(bodyW * 0.15, 0);
  ctx.lineTo(-bodyW * 0.05, 0);
  ctx.lineTo(-bodyW * 0.25, 0);
  ctx.stroke();

  ctx.strokeStyle = "#f1f5f8";
  ctx.beginPath();
  ctx.moveTo(bodyW * 0.12, -bodyH * 0.5);
  ctx.lineTo(bodyW * 0.27, -bodyH * 0.62);
  ctx.stroke();

  ctx.fillStyle = "#263238";
  roundedBox(-bodyW * 0.02, -bodyH * 0.62, bodyW * 0.12, bodyH * 0.22, 2);
  ctx.fill();

  ctx.fillStyle = "#fff3b0";
  ctx.shadowColor = "rgba(255, 243, 176, 0.75)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(bodyW * 0.28, -bodyH * 0.1, Math.max(1.4, bodyH * 0.16), 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (car.isBraking) {
    ctx.fillStyle = "#ff3b30";
    ctx.shadowColor = "rgba(255, 59, 48, 0.8)";
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.arc(-bodyW * 0.3, -bodyH * 0.08, Math.max(1.2, bodyH * 0.14), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawVehicle(lane, car) {
  const pose = carPose(lane, car);
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.heading);

  if (car.kind === "truck") drawTruckSprite(car);
  else if (car.kind === "bike") drawBikeSprite(car);
  else drawCarSprite(car);

  ctx.restore();
}

function drawRoadMarkings(centerX, centerY, halfRoad) {
  ctx.strokeStyle = "rgba(210, 224, 240, 0.75)";
  ctx.lineWidth = 1;
  ctx.setLineDash([12, 10]);

  for (let lane = 1; lane < state.laneCount; lane += 1) {
    const yTopHalf = centerY - lane * LANE_WIDTH;
    const yBottomHalf = centerY + lane * LANE_WIDTH;

    ctx.beginPath();
    ctx.moveTo(MARGIN, yTopHalf);
    ctx.lineTo(centerX - halfRoad, yTopHalf);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX + halfRoad, yTopHalf);
    ctx.lineTo(canvas.width - MARGIN, yTopHalf);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(MARGIN, yBottomHalf);
    ctx.lineTo(centerX - halfRoad, yBottomHalf);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX + halfRoad, yBottomHalf);
    ctx.lineTo(canvas.width - MARGIN, yBottomHalf);
    ctx.stroke();

    const xRightHalf = centerX + lane * LANE_WIDTH;
    const xLeftHalf = centerX - lane * LANE_WIDTH;

    ctx.beginPath();
    ctx.moveTo(xRightHalf, MARGIN);
    ctx.lineTo(xRightHalf, centerY - halfRoad);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xRightHalf, centerY + halfRoad);
    ctx.lineTo(xRightHalf, canvas.height - MARGIN);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(xLeftHalf, MARGIN);
    ctx.lineTo(xLeftHalf, centerY - halfRoad);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xLeftHalf, centerY + halfRoad);
    ctx.lineTo(xLeftHalf, canvas.height - MARGIN);
    ctx.stroke();
  }

  ctx.setLineDash([]);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  const stop = state.geometry.stopLines;

  ctx.beginPath();
  ctx.moveTo(stop.W, centerY - halfRoad);
  ctx.lineTo(stop.W, centerY + halfRoad);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(stop.E, centerY - halfRoad);
  ctx.lineTo(stop.E, centerY + halfRoad);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX - halfRoad, stop.N);
  ctx.lineTo(centerX + halfRoad, stop.N);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX - halfRoad, stop.S);
  ctx.lineTo(centerX + halfRoad, stop.S);
  ctx.stroke();
}

function drawArrowAt(x, y, heading, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(7, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(2, -4);
  ctx.lineTo(2, 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawLaneDirectionIndicators(centerX, centerY, halfRoad) {
  const stop = state.geometry.stopLines;
  const nsCanGo = approachHasGreen("N");
  const ewCanGo = approachHasGreen("W");
  const arrowOffset = 40;

  const nsColor = nsCanGo ? "#8de7a0" : "#ff8a80";
  const ewColor = ewCanGo ? "#8de7a0" : "#ff8a80";

  const bandThickness = 5;
  const bandAlpha = 0.85;
  ctx.save();
  ctx.globalAlpha = bandAlpha;
  ctx.fillStyle = ewColor;
  ctx.fillRect(stop.W - 2, centerY - halfRoad, bandThickness, halfRoad * 2);
  ctx.fillRect(stop.E - bandThickness + 2, centerY - halfRoad, bandThickness, halfRoad * 2);

  ctx.fillStyle = nsColor;
  ctx.fillRect(centerX - halfRoad, stop.N - 2, halfRoad * 2, bandThickness);
  ctx.fillRect(centerX - halfRoad, stop.S - bandThickness + 2, halfRoad * 2, bandThickness);

  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fillRect(MARGIN, centerY - 1, centerX - halfRoad - MARGIN, 2);
  ctx.fillRect(centerX + halfRoad, centerY - 1, canvas.width - MARGIN - (centerX + halfRoad), 2);
  ctx.fillRect(centerX - 1, MARGIN, 2, centerY - halfRoad - MARGIN);
  ctx.fillRect(centerX - 1, centerY + halfRoad, 2, canvas.height - MARGIN - (centerY + halfRoad));
  ctx.restore();

  state.lanes.W.forEach((lane) => {
    drawArrowAt(stop.W - arrowOffset, state.geometry.laneYWest(lane.index), 0, ewColor);
  });

  state.lanes.E.forEach((lane) => {
    drawArrowAt(stop.E + arrowOffset, state.geometry.laneYEast(lane.index), Math.PI, ewColor);
  });

  state.lanes.N.forEach((lane) => {
    drawArrowAt(state.geometry.laneXNorth(lane.index), stop.N - arrowOffset, Math.PI / 2, nsColor);
  });

  state.lanes.S.forEach((lane) => {
    drawArrowAt(state.geometry.laneXSouth(lane.index), stop.S + arrowOffset, -Math.PI / 2, nsColor);
  });
}

function drawCars() {
  eachLane((lane) => {
    lane.cars.forEach((car) => drawVehicle(lane, car));
  });
}

function drawBikeLaneTraffic() {
  Object.values(state.bikeLanes).forEach((lane) => {
    lane.bikes.forEach((bike) => {
      const pose = bikePose(lane.approach, bike);
      ctx.save();
      ctx.translate(pose.x, pose.y);
      ctx.rotate(pose.heading);
      drawBikeSprite(bike);
      ctx.restore();
    });
  });
}

function drawTrafficLights(centerX, centerY, halfRoad) {
  const poleColor = "#263238";
  const cabinetColor = "#171c22";
  const lampOff = "#3b3f46";

  function drawSignalHead(anchorX, anchorY, facing, activeColor) {
    const headW = 20;
    const headH = 44;
    const r = 5;

    ctx.save();
    ctx.translate(anchorX, anchorY);
    ctx.rotate(facing);

    ctx.fillStyle = poleColor;
    ctx.fillRect(-3, 14, 6, 26);

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    roundedBox(-headW / 2 - 2, -headH / 2 - 2, headW + 4, headH + 4, 4);
    ctx.fill();

    ctx.fillStyle = cabinetColor;
    roundedBox(-headW / 2, -headH / 2, headW, headH, 3);
    ctx.fill();

    const lamps = [
      { name: "red", y: -13, color: "#ef5350" },
      { name: "yellow", y: 0, color: "#f9a825" },
      { name: "green", y: 13, color: "#4caf50" },
    ];

    lamps.forEach((lamp) => {
      const isActive = activeColor === lamp.name;
      ctx.fillStyle = isActive ? lamp.color : lampOff;
      if (isActive) {
        ctx.shadowColor = lamp.color;
        ctx.shadowBlur = 12;
      }
      ctx.beginPath();
      ctx.arc(0, lamp.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    ctx.restore();
  }

  const nsColor = nsSignalColor();
  const ewColor = ewSignalColor();
  const stop = state.geometry.stopLines;

  const westLaneMidY = centerY - halfRoad / 2;
  const eastLaneMidY = centerY + halfRoad / 2;
  const northLaneMidX = centerX + halfRoad / 2;
  const southLaneMidX = centerX - halfRoad / 2;

  drawSignalHead(stop.W - 14, westLaneMidY, 0, ewColor);
  drawSignalHead(stop.E + 14, eastLaneMidY, Math.PI, ewColor);
  drawSignalHead(northLaneMidX, stop.N - 14, Math.PI / 2, nsColor);
  drawSignalHead(southLaneMidX, stop.S + 14, -Math.PI / 2, nsColor);
}

function drawBikeLanesAndFootpaths(centerX, centerY, halfRoad) {
  const roadLeft = centerX - halfRoad;
  const roadRight = centerX + halfRoad;
  const roadTop = centerY - halfRoad;
  const roadBottom = centerY + halfRoad;

  const footpathColor = "#cfd8dc";
  const bikeLaneColor = "#2e6a73";
  const edgeLineColor = "rgba(255, 255, 255, 0.75)";

  ctx.fillStyle = footpathColor;
  ctx.fillRect(MARGIN, roadTop - BIKE_LANE_WIDTH - FOOTPATH_WIDTH, canvas.width - MARGIN * 2, FOOTPATH_WIDTH);
  ctx.fillRect(MARGIN, roadBottom + BIKE_LANE_WIDTH, canvas.width - MARGIN * 2, FOOTPATH_WIDTH);
  ctx.fillRect(roadLeft - BIKE_LANE_WIDTH - FOOTPATH_WIDTH, MARGIN, FOOTPATH_WIDTH, canvas.height - MARGIN * 2);
  ctx.fillRect(roadRight + BIKE_LANE_WIDTH, MARGIN, FOOTPATH_WIDTH, canvas.height - MARGIN * 2);

  ctx.fillStyle = bikeLaneColor;
  ctx.fillRect(MARGIN, roadTop - BIKE_LANE_WIDTH, canvas.width - MARGIN * 2, BIKE_LANE_WIDTH);
  ctx.fillRect(MARGIN, roadBottom, canvas.width - MARGIN * 2, BIKE_LANE_WIDTH);
  ctx.fillRect(roadLeft - BIKE_LANE_WIDTH, MARGIN, BIKE_LANE_WIDTH, canvas.height - MARGIN * 2);
  ctx.fillRect(roadRight, MARGIN, BIKE_LANE_WIDTH, canvas.height - MARGIN * 2);

  ctx.strokeStyle = edgeLineColor;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([8, 6]);

  ctx.beginPath();
  ctx.moveTo(MARGIN, roadTop - BIKE_LANE_WIDTH);
  ctx.lineTo(canvas.width - MARGIN, roadTop - BIKE_LANE_WIDTH);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(MARGIN, roadBottom + BIKE_LANE_WIDTH);
  ctx.lineTo(canvas.width - MARGIN, roadBottom + BIKE_LANE_WIDTH);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(roadLeft - BIKE_LANE_WIDTH, MARGIN);
  ctx.lineTo(roadLeft - BIKE_LANE_WIDTH, canvas.height - MARGIN);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(roadRight + BIKE_LANE_WIDTH, MARGIN);
  ctx.lineTo(roadRight + BIKE_LANE_WIDTH, canvas.height - MARGIN);
  ctx.stroke();

  ctx.setLineDash([]);
}

function drawPedestrianCrossings(centerX, centerY, halfRoad) {
  const stop = state.geometry.stopLines;
  const roadLeft = centerX - halfRoad;
  const roadRight = centerX + halfRoad;
  const roadTop = centerY - halfRoad;
  const roadBottom = centerY + halfRoad;

  const topEdge = roadTop - BIKE_LANE_WIDTH;
  const bottomEdge = roadBottom + BIKE_LANE_WIDTH;
  const leftEdge = roadLeft - BIKE_LANE_WIDTH;
  const rightEdge = roadRight + BIKE_LANE_WIDTH;

  const crossWidth = 10;
  const stripe = 3;
  const gap = 5;
  const westX = stop.W + CROSSING_OFFSET;
  const eastX = stop.E - CROSSING_OFFSET;
  const northY = stop.N + CROSSING_OFFSET;
  const southY = stop.S - CROSSING_OFFSET;

  ctx.fillStyle = "rgba(255, 255, 255, 0.68)";

  for (let y = topEdge + 2; y <= bottomEdge - stripe - 2; y += stripe + gap) {
    ctx.fillRect(westX - crossWidth / 2, y, crossWidth, stripe);
    ctx.fillRect(eastX - crossWidth / 2, y, crossWidth, stripe);
  }

  for (let x = leftEdge + 2; x <= rightEdge - stripe - 2; x += stripe + gap) {
    ctx.fillRect(x, northY - crossWidth / 2, stripe, crossWidth);
    ctx.fillRect(x, southY - crossWidth / 2, stripe, crossWidth);
  }
}

function drawMobilitySignals(centerX, centerY, halfRoad) {
  const stop = state.geometry.stopLines;

  function drawSignalPanel(x, y, canGo, iconType) {
    const panelW = 26;
    const panelH = 18;

    ctx.fillStyle = "#1a1f25";
    roundedBox(x - panelW / 2, y - panelH / 2, panelW, panelH, 4);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1;
    roundedBox(x - panelW / 2, y - panelH / 2, panelW, panelH, 4);
    ctx.stroke();

    ctx.fillStyle = canGo ? "#71e6a0" : "#ff8a80";
    ctx.beginPath();
    ctx.arc(x - 7, y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f5f7fa";
    if (iconType === "bike") {
      ctx.beginPath();
      ctx.arc(x + 3, y + 1.5, 1.3, 0, Math.PI * 2);
      ctx.arc(x + 9.2, y + 1.5, 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f5f7fa";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 1.5);
      ctx.lineTo(x + 5.8, y - 2);
      ctx.lineTo(x + 8, y + 1.5);
      ctx.lineTo(x + 5, y + 1.5);
      ctx.lineTo(x + 3, y + 1.5);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x + 6.5, y - 2.8, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f5f7fa";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 6.5, y -1.4);
      ctx.lineTo(x + 6.5, y + 3.5);
      ctx.moveTo(x + 6.5, y + 0.4);
      ctx.lineTo(x + 4.5, y + 2.4);
      ctx.moveTo(x + 6.5, y + 0.4);
      ctx.lineTo(x + 8.5, y + 2.4);
      ctx.stroke();
    }
  }

  drawSignalPanel(stop.W - 28, centerY - halfRoad - BIKE_LANE_WIDTH - 10, approachHasGreen("W"), "bike");
  drawSignalPanel(stop.E + 28, centerY + halfRoad + BIKE_LANE_WIDTH + 10, approachHasGreen("E"), "bike");
  drawSignalPanel(centerX + halfRoad + BIKE_LANE_WIDTH + 10, stop.N - 28, approachHasGreen("N"), "bike");
  drawSignalPanel(centerX - halfRoad - BIKE_LANE_WIDTH - 10, stop.S + 28, approachHasGreen("S"), "bike");

  drawSignalPanel(stop.W - 28, centerY, crossingAllowsWalk("W"), "ped");
  drawSignalPanel(stop.E + 28, centerY, crossingAllowsWalk("E"), "ped");
  drawSignalPanel(centerX, stop.N - 28, crossingAllowsWalk("N"), "ped");
  drawSignalPanel(centerX, stop.S + 28, crossingAllowsWalk("S"), "ped");
}

function pedestrianPosition(crossingKey, progress) {
  const { centerX, centerY, halfRoad, stopLines } = state.geometry;
  const roadLeft = centerX - halfRoad;
  const roadRight = centerX + halfRoad;
  const roadTop = centerY - halfRoad;
  const roadBottom = centerY + halfRoad;

  const topEdge = roadTop - BIKE_LANE_WIDTH - FOOTPATH_WIDTH / 2;
  const bottomEdge = roadBottom + BIKE_LANE_WIDTH + FOOTPATH_WIDTH / 2;
  const leftEdge = roadLeft - BIKE_LANE_WIDTH - FOOTPATH_WIDTH / 2;
  const rightEdge = roadRight + BIKE_LANE_WIDTH + FOOTPATH_WIDTH / 2;

  if (crossingKey === "W") return { x: stopLines.W + CROSSING_OFFSET, y: topEdge + (bottomEdge - topEdge) * progress, heading: Math.PI / 2 };
  if (crossingKey === "E") return { x: stopLines.E - CROSSING_OFFSET, y: topEdge + (bottomEdge - topEdge) * progress, heading: Math.PI / 2 };
  if (crossingKey === "N") return { x: leftEdge + (rightEdge - leftEdge) * progress, y: stopLines.N + CROSSING_OFFSET, heading: 0 };
  return { x: leftEdge + (rightEdge - leftEdge) * progress, y: stopLines.S - CROSSING_OFFSET, heading: 0 };
}

function drawWalkerSprite(walker) {
  const swingBase = Math.sin(walker.walkPhase || 0);
  const idleSwing = Math.sin(walker.idlePhase || 0) * 0.35;
  const swing = walker.isWaiting ? idleSwing : swingBase;
  const armSwing = swing * 2.2 * walker.strideScale;
  const legSwing = -swing * 2.2 * walker.strideScale;
  const bodyBob = walker.isWaiting ? Math.abs(idleSwing) * 0.35 : Math.abs(swing) * 0.6;

  ctx.strokeStyle = walker.color;
  ctx.fillStyle = walker.color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(0, -5.9 + bodyBob * 0.2, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -3.4 + bodyBob * 0.2);
  ctx.lineTo(0, 2.6 + bodyBob * 0.4);

  ctx.moveTo(0, -1.3 + bodyBob * 0.2);
  ctx.lineTo(-2.4, 1 + armSwing * 0.45);
  ctx.moveTo(0, -1.3 + bodyBob * 0.2);
  ctx.lineTo(2.4, 1 - armSwing * 0.45);

  ctx.moveTo(0, 2.6 + bodyBob * 0.4);
  ctx.lineTo(-2, 6 + legSwing * 0.45);
  ctx.moveTo(0, 2.6 + bodyBob * 0.4);
  ctx.lineTo(2, 6 - legSwing * 0.45);
  ctx.stroke();
}

function drawPedestrians() {
  Object.values(state.pedestrianCrossings).forEach((crossing) => {
    crossing.walkers.forEach((walker) => {
      const pose = pedestrianPosition(crossing.key, walker.progress);
      const sway = Math.sin((walker.walkPhase || 0) * 0.45) * 0.7;
      ctx.save();
      ctx.translate(pose.x, pose.y);
      ctx.rotate(pose.heading);
      ctx.translate(0, walker.lateralOffset + sway);
      drawWalkerSprite(walker);
      ctx.restore();
    });
  });
}

function drawScene() {
  const { centerX, centerY, halfRoad } = state.geometry;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#d9ecff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawBikeLanesAndFootpaths(centerX, centerY, halfRoad);

  ctx.fillStyle = "#3f4a57";
  ctx.fillRect(MARGIN, centerY - halfRoad, canvas.width - MARGIN * 2, halfRoad * 2);
  ctx.fillRect(centerX - halfRoad, MARGIN, halfRoad * 2, canvas.height - MARGIN * 2);

  drawRoadMarkings(centerX, centerY, halfRoad);
  drawPedestrianCrossings(centerX, centerY, halfRoad);
  drawBikeLaneTraffic();
  drawPedestrians();
  drawCars();
  drawLaneDirectionIndicators(centerX, centerY, halfRoad);
  drawTrafficLights(centerX, centerY, halfRoad);
  drawMobilitySignals(centerX, centerY, halfRoad);
}

function step(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }
  const dt = (timestamp - state.lastTime) / 1000;
  state.lastTime = timestamp;

  updatePhase(dt);
  updatePhasePanel();
  maybeSpawnCars(dt);
  maybeSpawnBikeLaneTraffic(dt);
  maybeSpawnPedestrians(dt);
  updateCars(dt);
  updateBikeLaneTraffic(dt);
  updatePedestrians(dt);
  drawScene();

  requestAnimationFrame(step);
}

function applySettings() {
  state.laneCount = clamp(Number(laneCountInput.value) || 3, 1, 4);
  state.spawnPerMinute = clamp(Number(spawnRateInput.value) || 5, 5, 120);
  state.phaseDurations.green = clamp(Number(greenInput.value) || 7, 2, 20);
  state.phaseDurations.yellow = clamp(Number(yellowInput.value) || 2, 1, 8);
  state.phaseDurations.allRed = clamp(Number(redInput.value) || 2, 1, 10);

  laneCountInput.value = String(state.laneCount);
  spawnRateInput.value = String(state.spawnPerMinute);
  greenInput.value = String(state.phaseDurations.green);
  yellowInput.value = String(state.phaseDurations.yellow);
  redInput.value = String(state.phaseDurations.allRed);

  buildLanes(state.laneCount);
  resizeCanvas();
  updateGeometry();
}

applyButton.addEventListener("click", applySettings);
emergencyModeButton.addEventListener("click", () => {
  state.emergencyMode = !state.emergencyMode;
  updateEmergencyModeUI();
});

applySettings();
updateEmergencyModeUI();
updateLightUI();
requestAnimationFrame(step);
