(() => {
const { normalizeStage, number, clamp, fmtTemp, tempDeltaToDisplay, tempUnitLabel } = window.AppUtils;

// Display temperature unit ("C" default / "F"), set once from settings so the
// alert/status strings match the rest of the UI. Storage stays in °F.
let displayTempUnit = "C";
function setTempUnit(unit) {
  displayTempUnit = unit === "F" ? "F" : "C";
}

const CUBIC_METERS_TO_CUBIC_FEET = 35.3147;

// Ventilation + heat constants.
// At steady state ~100% of an LED's electrical power ends up as heat inside the
// enclosure (photons are absorbed by walls/canopy and thermalize; only a tiny
// fraction is stored as biomass). A transpiring canopy moves some of that into
// humidity (latent) instead of air temperature, so the predicted air-temp rise
// here is a conservative upper bound — the live temp/RH readings fine-tune it.
// WATTS_TO_BTU: 1 W = 3.412 BTU/hr.
// Sensible-heat airflow: CFM = BTU/hr ÷ (1.08 × ΔT°F), ΔT = allowed rise of
//   the air passing through the tent (tent target − intake/room temp).
// Steady-state temperature: P = (U·A + ρ·cp·V̇)·ΔT, so a sealed box (V̇=0)
//   settles at ΔT = P/(U·A); a fan adds the ρ·cp·V̇ term and pulls ΔT down.
// Derates: a fan's rated CFM is free-air (zero static pressure). A DIY carbon
//   filter and ducting add resistance that robs real airflow.
const WATTS_TO_BTU = 3.412;
const FILTER_DERATE = 0.75; // carbon filter ≈ -25% airflow
const DUCT_DERATE = { none: 1, short: 0.95, typical: 0.85, long: 0.72 };
const AIR_DENSITY = 1.2; // kg/m³
const AIR_CP = 1005; // J/(kg·K), constant-pressure specific heat of air
const RHO_CP = AIR_DENSITY * AIR_CP; // 1206 J/(m³·K) carried per m³/s of airflow
const CFM_TO_M3S = 0.000471947;
// Overall heat-transfer coefficient U (W/m²·K) of the enclosure skin — how
// readily heat leaks out. Thin tent leaks freely; insulated walls trap it.
const U_VALUES = { tent: 5.0, wood: 2.5, insulated: 0.5 };

// Site elevation (metres), set once from settings. Thin high-altitude air
// carries less heat per unit volume, so heat-removal needs proportionally
// more CFM. Density ratio vs sea level comes from the barometric pressure
// formula (at a fixed room temperature, density tracks pressure).
let siteElevationM = 0;
function setElevation(metres) {
  siteElevationM = number(metres, 0);
}
function airDensityRatio(elevationM) {
  if (!elevationM || elevationM <= 0) return 1;
  return Math.pow(Math.max(0.0001, 1 - 2.25577e-5 * elevationM), 5.25588);
}

function equipmentProfile(room, setpoint) {
  const lengthM = number(room.lengthM);
  const widthM = number(room.widthM);
  const heightM = number(room.heightM);
  const volumeM3 = lengthM && widthM && heightM ? lengthM * widthM * heightM : 0;
  const volumeFt3 = volumeM3 * CUBIC_METERS_TO_CUBIC_FEET;
  const fanCapacityCfm = number(room.fanCapacityCfm);
  const fanSpeed = number(room.fanSpeed, 100);
  const targetAirChanges = number(room.targetAirChangesPerMin, 1);

  // Altitude correction: thinner air carries less heat per CFM.
  const elevationM = number(room.elevationM, siteElevationM);
  const densityRatio = airDensityRatio(elevationM);
  const heatConstant = 1.08 * densityRatio; // altitude-corrected sensible-heat constant

  const warmCount = number(room.warmLightCount);
  const coolCount = number(room.coolLightCount);
  const warmKelvin = number(room.warmLightKelvin, 3000);
  const coolKelvin = number(room.coolLightKelvin, 5000);
  const totalLights = warmCount + coolCount;
  const averageKelvin = totalLights ? Math.round((warmCount * warmKelvin + coolCount * coolKelvin) / totalLights) : 0;
  // Watts are summed per fixture (fixtures may have different wattage), and the
  // heat tracks the ones actually ON — so flipping a light (or the night cycle)
  // updates the prediction and fan target live by that fixture's real watts.
  const lightInfo = effectiveLights(room);
  const totalWatts = lightInfo.totalWatts || 0;
  const activeWatts = lightInfo.activeWatts || 0;
  const heatWatts = activeWatts;

  // Enclosure heat loss through the walls — needed both for the cooling-airflow
  // requirement and the temperature prediction.
  const surfaceAreaM2 = lengthM && widthM && heightM ? 2 * (lengthM * widthM + lengthM * heightM + widthM * heightM) : 0;
  const uValue = U_VALUES[room.enclosureType] != null ? U_VALUES[room.enclosureType] : U_VALUES.tent;
  const wallLossPerK = uValue * surfaceAreaM2; // W/K shed through the skin
  const rhoCpLocal = RHO_CP * densityRatio; // heat carried per m³/s of (thin) air

  // Airflow demand. The fan does two jobs: swap the volume for fresh air, and
  // remove only the heat the WALLS can't shed on their own. From
  //   P = (U·A + ρ·cp·V̇)·ΔT  ⟹  V̇ = max(0, P/ΔT − U·A) / (ρ·cp)
  // In a cool room the walls alone often cover it (V̇ = 0) and the lights are
  // simply free heat — that is the "heating regime".
  const exchangeCfm = volumeFt3 * targetAirChanges;
  const heatBtuPerHr = heatWatts * WATTS_TO_BTU;
  const ambientTempF = number(room.ambientTempF, 75);
  const targetTempF = setpoint && Number.isFinite(Number(setpoint.tempMax))
    ? Number(setpoint.tempMax)
    : number(room.targetTentTempF, 80);
  const allowableRiseF = targetTempF - ambientTempF;
  const allowableRiseC = allowableRiseF / 1.8;
  // If the room air is already at/above target, ventilation can't cool below it.
  const coolingImpossible = heatWatts > 0 && allowableRiseF <= 0;
  const airNeedWperK = heatWatts > 0 && allowableRiseC > 0 ? Math.max(0, heatWatts / allowableRiseC - wallLossPerK) : 0;
  // Cooling airflow the fan must add beyond wall loss to hold tempMax.
  const coolingCfm = coolingImpossible ? Infinity : (rhoCpLocal > 0 ? airNeedWperK / rhoCpLocal / CFM_TO_M3S : 0);
  const heatCfm = Number.isFinite(coolingCfm) ? coolingCfm : 0; // wall-aware cooling need
  const requiredCfm = Math.max(exchangeCfm, heatCfm);
  const heatLimited = Number.isFinite(coolingCfm) && coolingCfm > exchangeCfm;
  // Heating regime: lights warm a below-target room and the walls shed the
  // surplus, so the fan only needs the fresh-air/humidity minimum.
  const heatingRegime = heatWatts > 0 && !coolingImpossible && !heatLimited && ambientTempF < targetTempF;

  // Effective capacity after filter + ducting losses.
  const ductDerate = DUCT_DERATE[room.ductingSetup] != null ? DUCT_DERATE[room.ductingSetup] : DUCT_DERATE.typical;
  const filterOn = String(room.carbonFilter) === "Yes";
  const derateNoFilter = ductDerate;
  const derateWithFilter = ductDerate * FILTER_DERATE;
  const activeDerate = filterOn ? derateWithFilter : derateNoFilter;

  const speedFor = (derate) =>
    fanCapacityCfm && derate ? clamp((requiredCfm / (fanCapacityCfm * derate)) * 100, 5, 100) : 0;
  const recommendedFanSpeed = speedFor(activeDerate);
  const speedNoFilter = speedFor(derateNoFilter);
  const speedWithFilter = speedFor(derateWithFilter);

  // Delivered airflow at the configured speed, after the active derate.
  const actualCfm = fanCapacityCfm * (fanSpeed / 100) * activeDerate;
  const actualAirChanges = volumeFt3 ? actualCfm / volumeFt3 : 0;
  const maxDeliverableCfm = fanCapacityCfm * activeDerate;
  const undersized = fanCapacityCfm > 0 && requiredCfm > 0 && maxDeliverableCfm < requiredCfm * 0.98;

  // Steady-state temperature prediction. ΔT = P / (U·A + ρ·cp·V̇):
  //  - sealed (no fan): ΔT = P / (U·A)
  //  - at the current fan speed: add the ρ·cp·V̇ airflow term
  // sealedRateCPerHr is the bare-air initial climb if the fan ever fails
  // (real thermal mass slows this hugely; it's a worst-case alarm figure).
  const deliveredM3s = actualCfm * CFM_TO_M3S;
  const ventLossPerK = wallLossPerK + rhoCpLocal * deliveredM3s;
  const ambientC = (ambientTempF - 32) / 1.8;
  const passiveRiseC = wallLossPerK > 0 ? heatWatts / wallLossPerK : 0;
  const ventedRiseC = ventLossPerK > 0 ? heatWatts / ventLossPerK : 0;
  const passiveTempC = ambientC + passiveRiseC;
  const ventedTempC = ambientC + ventedRiseC;
  const ventedTempF = ambientTempF + ventedRiseC * 1.8;
  const airMassKg = volumeM3 * AIR_DENSITY * densityRatio;
  const sealedRateCPerHr = airMassKg > 0 ? (heatWatts / (airMassKg * AIR_CP)) * 3600 : 0;
  // Will the tent overrun its target at the current fan speed?
  const predictedHot = heatWatts > 0 && !coolingImpossible && ventedTempF > targetTempF + 2;

  return {
    surfaceAreaM2,
    uValue,
    wallLossPerK,
    passiveRiseC,
    ventedRiseC,
    passiveTempC,
    ventedTempC,
    ventedTempF,
    ambientC,
    sealedRateCPerHr,
    predictedHot,
    heatingRegime,
    elevationM,
    densityRatio,
    heatConstant,
    activeWatts,
    heatWatts,
    volumeM3,
    volumeFt3,
    fanCapacityCfm,
    fanSpeed,
    targetAirChanges,
    requiredCfm,
    exchangeCfm,
    heatCfm,
    heatBtuPerHr,
    ambientTempF,
    targetTempF,
    allowableRiseF,
    heatLimited,
    coolingImpossible,
    filterOn,
    ductDerate,
    derateNoFilter,
    derateWithFilter,
    activeDerate,
    recommendedFanSpeed,
    speedNoFilter,
    speedWithFilter,
    actualCfm,
    actualAirChanges,
    maxDeliverableCfm,
    undersized,
    averageKelvin,
    totalLights,
    totalWatts
  };
}

// Day vs night bands for a reading. A log taken with lights off is judged
// against the stage's night temperature range and night RH cap.
function bandsFor(log, setpoint) {
  if (!setpoint) return null;
  const night = log?.lights === "Off";
  return {
    night,
    tempMin: night && Number.isFinite(Number(setpoint.nightTempMin)) ? Number(setpoint.nightTempMin) : setpoint.tempMin,
    tempMax: night && Number.isFinite(Number(setpoint.nightTempMax)) ? Number(setpoint.nightTempMax) : setpoint.tempMax,
    humidityMin: night ? 0 : setpoint.humidityMin,
    humidityMax: night && Number.isFinite(Number(setpoint.nightHumidityMax)) ? Number(setpoint.nightHumidityMax) : setpoint.humidityMax
  };
}

function environmentStatus(log, setpoint) {
  if (!log || !setpoint) return { level: "warn", text: "No setpoint or reading" };
  const bands = bandsFor(log, setpoint);
  const problems = [];
  const tempF = resolvedTempF(log);
  if (Number.isFinite(tempF) && (tempF < bands.tempMin || tempF > bands.tempMax)) problems.push(`Temp ${formatTemp(log, tempF)}${bands.night ? " (night)" : ""}`);
  if (number(log.humidity) < bands.humidityMin || number(log.humidity) > bands.humidityMax) problems.push(`RH ${log.humidity}%${bands.night ? " (night)" : ""}`);
  if (number(log.co2Ppm) < setpoint.co2Min || number(log.co2Ppm) > setpoint.co2Max) problems.push(`CO2 ${log.co2Ppm} ppm`);
  return problems.length ? { level: "bad", text: problems.join(", ") } : { level: "", text: "In range" };
}

// Magnus-formula dew point. Condensation forms on any surface at or below
// this temperature; bud surfaces close to it stay wet — botrytis territory.
function dewpointC(tempC, rh) {
  if (!Number.isFinite(tempC) || !Number.isFinite(rh) || rh <= 0) return NaN;
  const g = Math.log(rh / 100) + (17.625 * tempC) / (243.04 + tempC);
  return (243.04 * g) / (17.625 - g);
}

function dewpointF(log) {
  const tempF = resolvedTempF(log);
  const rh = number(log?.humidity, NaN);
  if (!Number.isFinite(tempF) || !Number.isFinite(rh)) return NaN;
  const dC = dewpointC((tempF - 32) / 1.8, rh);
  return Number.isFinite(dC) ? dC * 1.8 + 32 : NaN;
}

// Bud-rot (botrytis) risk for flower/drying rooms. Two drivers, both
// well-established: sustained RH above ~55-60% in a dense canopy, and a
// temp-to-dewpoint spread small enough that surfaces condense as the room
// cools at lights-off.
function moldRisk(log, setpoint, stageKey) {
  if (!log || (stageKey !== "flower" && stageKey !== "drying")) return null;
  const rh = number(log.humidity, NaN);
  const tempF = resolvedTempF(log);
  const dewF = dewpointF(log);
  const spreadF = Number.isFinite(tempF) && Number.isFinite(dewF) ? tempF - dewF : NaN;
  if (!Number.isFinite(rh) && !Number.isFinite(spreadF)) return null;
  const night = log.lights === "Off";
  const rhCap = stageKey === "drying" ? 65 : 60;
  if ((Number.isFinite(rh) && rh >= rhCap) || (Number.isFinite(spreadF) && spreadF <= 3.5)) {
    return {
      level: "high",
      spreadF,
      text: `RH ${Number.isFinite(rh) ? rh + "%" : "?"}${night ? " at lights-off" : ""} with only ${Number.isFinite(spreadF) ? tempDeltaToDisplay(spreadF, displayTempUnit, 1) + " " + tempUnitLabel(displayTempUnit) : "?"} to dew point — condensation/botrytis conditions. Dehumidify and increase air movement now.`
    };
  }
  if ((Number.isFinite(rh) && rh >= rhCap - 5) || (Number.isFinite(spreadF) && spreadF <= 6)) {
    return {
      level: "elevated",
      spreadF,
      text: `RH ${Number.isFinite(rh) ? rh + "%" : "?"}${night ? " at lights-off" : ""} is creeping toward bud-rot range (dew point ${Number.isFinite(spreadF) ? tempDeltaToDisplay(spreadF, displayTempUnit, 1) + " " + tempUnitLabel(displayTempUnit) : "?"} below air temp). Aim drier, especially for the dark period.`
    };
  }
  return null;
}

function resolvedTempF(log) {
  const tempF = Number(log?.tempF);
  if (Number.isFinite(tempF)) return tempF;
  const tempC = Number(log?.tempC);
  return Number.isFinite(tempC) ? tempC * 1.8 + 32 : NaN;
}

function formatTemp(log, tempF = resolvedTempF(log)) {
  return fmtTemp(tempF, displayTempUnit, 1);
}

// --- Light fixtures / room operation -------------------------------------

// Expands a room's warm/cool light counts into an ordered fixture list,
// carrying each fixture's on/off state from room.lightsOn when present.
// room.lightLayout (array of "warm"/"cool" per grid slot) overrides the
// default warm-first order so the grower can mix colour-temperature placement;
// it is ignored if it no longer matches the configured counts.
function lightFixtures(room) {
  const warm = Math.max(0, Math.round(number(room.warmLightCount)));
  const cool = Math.max(0, Math.round(number(room.coolLightCount)));
  const total = warm + cool;
  const stored = Array.isArray(room.lightsOn) ? room.lightsOn : [];
  const matched = stored.length === total;
  let layout = Array.isArray(room.lightLayout) ? room.lightLayout : null;
  if (!layout || layout.length !== total || layout.filter((t) => t === "warm").length !== warm) {
    layout = [...Array(warm).fill("warm"), ...Array(cool).fill("cool")];
  }
  // Per-fixture wattage. lightWatts (one entry per grid slot) lets fixtures of
  // different wattage be mixed; if it's missing or stale, every fixture falls
  // back to the room's default lightWattsEach.
  const wattsEach = number(room.lightWattsEach);
  const wattsArr = Array.isArray(room.lightWatts) && room.lightWatts.length === total ? room.lightWatts : null;
  return layout.map((type, i) => ({
    index: i,
    type,
    on: matched ? stored[i] !== false : true,
    watts: wattsArr && Number.isFinite(Number(wattsArr[i])) ? Number(wattsArr[i]) : wattsEach
  }));
}

// Effective lighting given which fixtures are currently switched on.
function effectiveLights(room) {
  const fixtures = lightFixtures(room);
  const warmK = number(room.warmLightKelvin, 3000);
  const coolK = number(room.coolLightKelvin, 5000);
  let onCount = 0;
  let kelvinSum = 0;
  let activeWatts = 0;
  let totalWatts = 0;
  fixtures.forEach((fixture) => {
    totalWatts += fixture.watts;
    if (!fixture.on) return;
    onCount += 1;
    activeWatts += fixture.watts;
    kelvinSum += fixture.type === "warm" ? warmK : coolK;
  });
  return {
    fixtures,
    total: fixtures.length,
    onCount,
    activeWatts,
    totalWatts,
    activeKelvin: onCount ? Math.round(kelvinSum / onCount) : 0
  };
}

// --- Targets Now / guidance ---------------------------------------------

const PHOTOPERIOD_HOURS = { seedling: 18, propagation: 18, vegetative: 18, flower: 12, drying: 0 };
const DLI_PPFD_TARGETS = {
  seedling: { min: 100, max: 300 },
  propagation: { min: 100, max: 300 },
  vegetative: { min: 250, max: 600 },
  flower: { min: 500, max: 1050 },
  drying: { min: 0, max: 0 }
};

// General horticultural defaults used for feed/root-zone guidance. EC is mS/cm;
// PPM is derived with the common 500 (TDS) scale.
const PPM_SCALE = 500;
const EC_TARGET_BY_STAGE = {
  seedling: { min: 0.2, max: 0.6 },
  propagation: { min: 0.4, max: 0.8 },
  vegetative: { min: 1.0, max: 1.8 },
  flower: { min: 1.4, max: 2.4 },
  drying: { min: 0, max: 0 }
};

function mediumIsSoil(room) {
  const medium = String(room?.medium || "").toLowerCase();
  return medium.includes("soil") && !medium.includes("soilless");
}

// pH and EC/PPM targets for a room's medium and stage.
function feedTargets(room, stageKey, settings = {}) {
  const ph = mediumIsSoil(room) ? { min: 6.0, max: 7.0 } : { min: 5.5, max: 6.5 };
  const ec = EC_TARGET_BY_STAGE[stageKey] || EC_TARGET_BY_STAGE.vegetative;
  const ppmScale = Number(settings.ppmScale) === 700 ? 700 : PPM_SCALE;
  return {
    ph,
    ec,
    ppm: { min: ec.min * ppmScale, max: ec.max * ppmScale, scale: ppmScale },
    photoperiod: PHOTOPERIOD_HOURS[stageKey] || 0
  };
}

function svpKpa(tempC) {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

function toCelsius(tempF) {
  return (tempF - 32) / 1.8;
}

// Reading may be blank string; treat blank/non-numeric as missing.
function reading(value) {
  if (value === "" || value === null || value === undefined) return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

// Leaf-temperature VPD in kPa. Uses logged leaf temp if present, else assumes
// leaf is 1 C below air (a common canopy assumption).
function vpdForReading(log) {
  if (!log) return NaN;
  const airF = resolvedTempF(log);
  const rh = reading(log.humidity);
  if (!Number.isFinite(airF) || !Number.isFinite(rh)) return NaN;
  const airC = toCelsius(airF);
  const leafCLogged = reading(log.leafTempC);
  const leafFLogged = reading(log.leafTempF);
  const leafC = Number.isFinite(leafCLogged)
    ? leafCLogged
    : Number.isFinite(leafFLogged)
    ? toCelsius(leafFLogged)
    : airC - 1;
  return Math.max(0, svpKpa(leafC) - svpKpa(airC) * (rh / 100));
}

function vpdAt(tempF, rh) {
  const airC = toCelsius(tempF);
  return Math.max(0, svpKpa(airC - 1) - svpKpa(airC) * (rh / 100));
}

// Derive a VPD target band from the existing temp/RH setpoint box corners:
// the cool+humid corner gives the low end, the warm+dry corner the high end.
function vpdTargetForStage(setpoint) {
  if (!setpoint) return null;
  const a = vpdAt(setpoint.tempMin, setpoint.humidityMax);
  const b = vpdAt(setpoint.tempMax, setpoint.humidityMin);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

function statusFor(value, min, max) {
  if (!Number.isFinite(value)) return "warn";
  if (Number.isFinite(min) && value < min) return "low";
  if (Number.isFinite(max) && value > max) return "high";
  return "ok";
}

function dliFromPpfd(ppfd, photoperiodHours) {
  if (!Number.isFinite(ppfd) || !Number.isFinite(photoperiodHours) || photoperiodHours <= 0) return NaN;
  return ppfd * photoperiodHours * 0.0036;
}

function dliTargetForStage(stageKey, photoperiodHours = PHOTOPERIOD_HOURS[stageKey] || 0) {
  const ppfd = DLI_PPFD_TARGETS[stageKey] || DLI_PPFD_TARGETS.vegetative;
  if (!photoperiodHours || !ppfd.max) return null;
  return {
    min: dliFromPpfd(ppfd.min, photoperiodHours),
    max: dliFromPpfd(ppfd.max, photoperiodHours),
    ppfdMin: ppfd.min,
    ppfdMax: ppfd.max,
    photoperiod: photoperiodHours
  };
}

function lightDliReading(log) {
  if (!log) return NaN;
  const loggedDli = reading(log.dli);
  if (Number.isFinite(loggedDli)) return loggedDli;
  return dliFromPpfd(reading(log.ppfd), reading(log.photoperiod));
}

function adviceFor(status, label) {
  if (status === "warn") return `Log a ${label.toLowerCase()} reading`;
  if (status === "low") return "Below target - raise";
  if (status === "high") return "Above target - lower";
  return "On target";
}

function round(value, places = 0) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function daysSinceDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(0, Math.floor((end - start) / 86400000) + 1);
}

// --- watering / dry-back ---------------------------------------------------

// Dry-back from pot-weight logs. The wet reference is the last "Watered"
// entry's weight (or the heaviest log seen); the dry reference is the
// lightest weight ever logged, which converges on pot + dry medium after a
// few cycles. Until ~3 logs exist the tool stays in "learning" mode rather
// than guessing. Soil is watered at a deeper dry-back than coco: soil roots
// want a real wet-dry cycle, coco should never fully dry.
function dryBackInfo(room, logs) {
  const entries = (logs || [])
    .filter((log) => log.roomId === room.id && log.type === "water" && Number.isFinite(Number(log.potWeight)))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (!entries.length) return null;

  const weights = entries.map((log) => Number(log.potWeight));
  const latest = entries[entries.length - 1];
  const current = Number(latest.potWeight);
  const lastWatered = [...entries].reverse().find((log) => String(log.event || "").toLowerCase().startsWith("watered"));
  const wet = lastWatered ? Number(lastWatered.potWeight) : Math.max(...weights);
  const driest = Math.min(...weights);
  const span = wet - driest;
  const soil = mediumIsSoil(room);
  const threshold = soil ? 60 : 35;
  const learning = entries.length < 3 || span <= wet * 0.05;
  const pct = !learning && span > 0 ? clamp(((wet - current) / span) * 100, 0, 100) : NaN;
  const hoursOld = (Date.now() - new Date(latest.createdAt).getTime()) / 36e5;
  const daysSinceWater = lastWatered ? (Date.now() - new Date(lastWatered.createdAt).getTime()) / 864e5 : null;

  let level;
  let advice;
  if (learning) {
    level = "learn";
    advice = "Calibrating: log the weight right after watering, then once a day. After ~3 entries the dry-back % computes itself.";
  } else if (pct >= threshold) {
    level = "water";
    advice = soil
      ? `Water today — ${Math.round(pct)}% dried back, past the ~${threshold}% soil target.`
      : `Water/fertigate now — ${Math.round(pct)}% dried back; coco should not dry this far.`;
  } else if (pct >= threshold - 10) {
    level = "soon";
    advice = `Almost there (${Math.round(pct)}% of ${threshold}%) — check again later today or tomorrow.`;
  } else {
    level = "wait";
    advice = `Wait — only ${Math.round(pct)}% dried back. Roots need the oxygen a real dry-back brings.`;
  }
  return { latest, current, wet, driest, pct, threshold, soil, learning, level, advice, hoursOld, daysSinceWater };
}

// --- ripeness / harvest window ----------------------------------------------

// Reads trichome logs for a batch: classifies the latest split and, once two
// or more amber readings exist, projects when amber crosses 10% (window
// opens) and 30% (window closes) from the observed ripening rate.
function ripenessInfo(batchId, logs) {
  const entries = (logs || [])
    .filter((log) => log.type === "ripeness" && (!batchId || log.batchId === batchId))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (!entries.length) return null;

  const latest = entries[entries.length - 1];
  const amber = number(latest.amberPct, NaN);
  const cloudy = number(latest.cloudyPct, NaN);
  const clear = number(latest.clearPct, NaN);

  let phase;
  let advice;
  if (Number.isFinite(amber) && amber >= 30) {
    phase = "past-peak";
    advice = "Past the balanced window — heavy amber means a sedative effect and degrading THC. Harvest now.";
  } else if (Number.isFinite(amber) && amber >= 10 && (!Number.isFinite(cloudy) || cloudy >= 50)) {
    phase = "window";
    advice = "In the harvest window: cloudy-dominant with 10-30% amber. Chop when the split matches the effect you want.";
  } else if (Number.isFinite(cloudy) && cloudy >= 60) {
    phase = "close";
    advice = "Close — mostly cloudy with amber just starting. Check every 2 days; warm rooms amber fast.";
  } else {
    phase = "early";
    advice = "Not ready — too many clear trichomes; potency is still building. Keep checking 2x/week with the loupe.";
  }

  const amberPts = entries
    .map((log) => ({ t: new Date(log.createdAt).getTime(), v: Number(log.amberPct) }))
    .filter((p) => Number.isFinite(p.v));
  let window = null;
  if (amberPts.length >= 2) {
    const first = amberPts[0];
    const last = amberPts[amberPts.length - 1];
    const days = (last.t - first.t) / 864e5;
    const rate = days >= 1 ? (last.v - first.v) / days : NaN;
    if (Number.isFinite(rate) && rate > 0.05) {
      const toStart = Math.max(0, (10 - last.v) / rate);
      const toEnd = Math.max(0, (30 - last.v) / rate);
      window = { start: new Date(last.t + toStart * 864e5), end: new Date(last.t + toEnd * 864e5), ratePerDay: rate };
    }
  }
  return { latest, amber, cloudy, clear, phase, advice, window, count: entries.length };
}

// --- flip-to-flower height planner ------------------------------------------
// Photoperiod plants gain ~50-100% height in the first weeks of 12/12 ("the
// stretch"). Flip while the plant still has room to roughly double (or less,
// if trained) without the canopy hitting the lamp. The usable vertical budget
// is the tent height minus the pot, the light-to-canopy gap, and fixture/strap
// clearance; the recommended flip height is that budget ÷ (1 + stretch).
const FLOWER_LAMP_GAP_CM = 38; // ~15 in LED hang gap above the canopy
const FIXTURE_CLEARANCE_CM = 10; // fixture body + straps near the ceiling
const TRAINING_STRETCH_PCT = { none: 100, scrog: 50, lst: 70 };

function stretchFraction(room) {
  const explicit = number(room.stretchPct, NaN);
  if (Number.isFinite(explicit) && explicit > 0) return explicit / 100;
  return (TRAINING_STRETCH_PCT[room.training] != null ? TRAINING_STRETCH_PCT[room.training] : 100) / 100;
}

function potHeightCm(room) {
  const inches = number(room.potHeightIn, NaN);
  if (Number.isFinite(inches) && inches > 0) return inches * 2.54;
  const liters = number(room.potLiters, NaN);
  if (Number.isFinite(liters) && liters > 0) return Math.cbrt(liters * 1000); // ~cube assumption: 20 L ≈ 27 cm
  return 25;
}

// currentHeightCm = latest logged plant height (soil line up), in cm.
function flipPlan(room, currentHeightCm) {
  const tentCm = number(room.heightM) * 100;
  if (!tentCm) return null;
  const potCm = potHeightCm(room);
  const usableCm = Math.max(10, tentCm - potCm - FLOWER_LAMP_GAP_CM - FIXTURE_CLEARANCE_CM);
  const sf = stretchFraction(room);
  const flipHeightCm = usableCm / (1 + sf);
  const cur = Number(currentHeightCm);
  const hasCur = Number.isFinite(cur) && cur > 0;
  const projectedFinalCm = hasCur ? cur * (1 + sf) : NaN;
  let level;
  if (!hasCur) level = "nodata";
  // "overdue" only once the projected canopy would overshoot the usable height
  // by more than ~10% — a small overshoot is still a fine "flip now".
  else if (cur >= flipHeightCm && projectedFinalCm > usableCm * 1.1) level = "late";
  else if (cur >= flipHeightCm) level = "flip";
  else if (cur >= flipHeightCm * 0.85) level = "soon";
  else level = "veg";
  return { tentCm, potCm, usableCm, sf, flipHeightCm, currentCm: hasCur ? cur : NaN, projectedFinalCm, level };
}

function stageHistory(batch) {
  if (!batch) return [];
  const fallback = [{ stage: batch.stage || "Seedling", startDate: batch.startDate }];
  const history = Array.isArray(batch.stageHistory) ? batch.stageHistory : fallback;
  return history
    .filter((entry) => entry && entry.stage && entry.startDate)
    .map((entry) => ({ stage: entry.stage, startDate: entry.startDate }))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

function currentStageEntry(batch) {
  const history = stageHistory(batch);
  if (!history.length) return null;
  const currentStage = batch?.stage || history[history.length - 1].stage;
  return [...history].reverse().find((entry) => entry.stage === currentStage) || history[history.length - 1];
}

// Builds the "what is expected right now" rows for one room.
function targetGuide(room, state) {
  const stageKey = normalizeStage(room.stage);
  const setpoint = state.settings.setpoints[stageKey];
  const latestEnv = [...state.logs].reverse().find((log) => log.roomId === room.id && log.type === "environment");
  const latestLight = [...state.logs].reverse().find((log) => log.roomId === room.id && log.type === "light");
  const profile = equipmentProfile(room, setpoint);
  const lights = effectiveLights(room);
  const rows = [];

  const push = (label, unit, min, max, value, places = 0) => {
    const status = statusFor(value, min, max);
    const targetText =
      Number.isFinite(min) && Number.isFinite(max)
        ? min === max
          ? `${round(min, places)} ${unit}`
          : `${round(min, places)} - ${round(max, places)} ${unit}`
        : "-";
    const current = round(value, places);
    rows.push({
      label,
      target: targetText,
      current: current === null ? "No reading" : `${current} ${unit}`,
      status,
      advice: adviceFor(status, label)
    });
  };

  if (setpoint) {
    const envBands = bandsFor(latestEnv, setpoint) || setpoint;
    push("Air temp", "F", envBands.tempMin, envBands.tempMax, latestEnv ? resolvedTempF(latestEnv) : NaN, 1);
    push("Humidity (RH)", "%", envBands.humidityMin, envBands.humidityMax, latestEnv ? reading(latestEnv.humidity) : NaN);
    push("CO2", "ppm", setpoint.co2Min, setpoint.co2Max, latestEnv ? reading(latestEnv.co2Ppm) : NaN);

    const vpdBand = vpdTargetForStage(setpoint);
    if (vpdBand) push("VPD (leaf)", "kPa", vpdBand.min, vpdBand.max, vpdForReading(latestEnv), 2);

    if (setpoint.lightKelvinMax) {
      const observedK = latestLight ? reading(latestLight.colorTempK) : NaN;
      const k = Number.isFinite(observedK) ? observedK : lights.activeKelvin || NaN;
      push("Light color", "K", setpoint.lightKelvinMin, setpoint.lightKelvinMax, k);
    }

    const ppfdTarget = dliTargetForStage(stageKey);
    if (ppfdTarget) {
      push("PPFD", "umol/m2/s", ppfdTarget.ppfdMin, ppfdTarget.ppfdMax, latestLight ? reading(latestLight.ppfd) : NaN);
    }
  }

  const expectedPhoto = PHOTOPERIOD_HOURS[stageKey];
  if (expectedPhoto > 0) {
    push("Photoperiod", "h", expectedPhoto - 0.5, expectedPhoto + 0.5, latestLight ? reading(latestLight.photoperiod) : NaN, 1);
  }

  const actualPhoto = latestLight ? reading(latestLight.photoperiod) : NaN;
  const dliTarget = dliTargetForStage(stageKey, Number.isFinite(actualPhoto) ? actualPhoto : expectedPhoto);
  if (dliTarget) {
    push("DLI", "mol/m2/d", dliTarget.min, dliTarget.max, lightDliReading(latestLight), 1);
  }

  if (profile.recommendedFanSpeed) {
    push("Fan speed", "%", profile.recommendedFanSpeed * 0.85, profile.recommendedFanSpeed * 1.3, reading(room.fanSpeed), 0);
  }

  const ok = rows.filter((row) => row.status === "ok").length;
  const scored = rows.filter((row) => row.status !== "warn").length;
  const score = scored ? Math.round((ok / scored) * 100) : null;

  return { stageKey, stageLabel: room.stage, setpoint, latestEnv, rows, score };
}

// Suggests a fan-speed % (with resulting CFM and air changes) to set on a
// controller. Starts from the speed that meets the target air exchange, then
// nudges it up when the tent is too humid or too hot, and down when it is too
// dry - so an oversized inline fan does not strip the tent of moisture.
function fanSuggestion(room, latestEnv, setpoint) {
  const profile = equipmentProfile(room, setpoint);
  if (!profile.volumeFt3 || !profile.fanCapacityCfm) return null;

  const baseSpeed = profile.recommendedFanSpeed;
  let speed = baseSpeed;
  const reasons = [];

  const rh = latestEnv ? reading(latestEnv.humidity) : NaN;
  const tempF = latestEnv ? resolvedTempF(latestEnv) : NaN;

  if (setpoint && Number.isFinite(rh)) {
    if (rh > setpoint.humidityMax) {
      const over = rh - setpoint.humidityMax;
      speed += over * 2;
      reasons.push(`RH ${round(rh)}% is ${round(over)} above the ${setpoint.humidityMax}% max - exhaust more to dump moisture.`);
    } else if (rh < setpoint.humidityMin) {
      const under = setpoint.humidityMin - rh;
      speed -= under * 2;
      reasons.push(`RH ${round(rh)}% is ${round(under)} below the ${setpoint.humidityMin}% min - slow the fan so it stops drying the tent out.`);
    }
  }

  if (setpoint && Number.isFinite(tempF) && tempF > setpoint.tempMax) {
    const over = tempF - setpoint.tempMax;
    speed += over * 1.5;
    reasons.push(`Air temp ${round(tempF)}F is above the ${setpoint.tempMax}F max - more exhaust pulls heat out.`);
  }

  if (profile.heatLimited && profile.heatWatts) {
    reasons.push(`Sized for light heat: ${round(profile.heatWatts)}W of LEDs on ≈ ${round(profile.heatBtuPerHr)} BTU/hr, needing ${round(profile.heatCfm)} CFM to hold ≤${fmtTemp(profile.targetTempF, displayTempUnit, 0)}.`);
  }
  if (profile.filterOn) {
    reasons.push(`Carbon filter attached — its ~25% airflow loss is already in this target.`);
  }

  // Keep at least enough flow for ~0.5 air changes/min for fresh air and CO2.
  const minFreshSpeed = Math.max(5, baseSpeed * 0.5);
  speed = Math.round(clamp(speed, minFreshSpeed, 100));

  // Delivered airflow accounts for filter + ducting losses.
  const cfm = profile.fanCapacityCfm * (speed / 100) * profile.activeDerate;
  const airChanges = profile.volumeFt3 ? cfm / profile.volumeFt3 : 0;

  return {
    speed,
    cfm,
    airChanges,
    baseSpeed: Math.round(baseSpeed),
    reasons,
    oversized: baseSpeed <= 20 && !profile.heatLimited,
    undersized: profile.undersized
  };
}

function collectAlerts(state) {
  const alerts = [];

  state.rooms.forEach((room) => {
    const latestEnv = [...state.logs].reverse().find((log) => log.roomId === room.id && log.type === "environment");
    const latestLight = [...state.logs].reverse().find((log) => log.roomId === room.id && log.type === "light");
    const setpoint = state.settings.setpoints[normalizeStage(room.stage)];
    const profile = equipmentProfile(room, setpoint);
    const lights = effectiveLights(room);

    // Flip-to-flower height advisory (veg/seedling only).
    const stageKeyRoom = normalizeStage(room.stage);
    if (stageKeyRoom === "vegetative" || stageKeyRoom === "seedling") {
      const lh = [...state.logs].reverse().find((log) => log.roomId === room.id && log.type === "health");
      const curCm = lh && Number.isFinite(Number(lh.heightIn)) ? Number(lh.heightIn) * 2.54 : NaN;
      if (Number.isFinite(curCm) && number(room.heightM)) {
        const plan = flipPlan(room, curCm);
        if (plan && (plan.level === "flip" || plan.level === "late")) {
          alerts.push({
            title: `${room.name}: ${plan.level === "late" ? "flip overdue — height risk" : "ready to flip to flower"}`,
            detail: `Plant ~${Math.round(curCm)} cm. At ${Math.round(plan.sf * 100)}% stretch it finishes ~${Math.round(plan.projectedFinalCm)} cm vs ~${Math.round(plan.usableCm)} cm of usable height. ${plan.level === "late" ? "Flip ASAP, or train/super-crop hard to keep it off the lamp." : "Good time to switch to 12/12."}`
          });
        }
      }
    }

    if (!latestEnv) {
      alerts.push({ title: `${room.name}: missing environment reading`, detail: "No current temperature, humidity, or CO2 entry exists for this room." });
    } else {
      const status = environmentStatus(latestEnv, setpoint);
      if (status.level === "bad") alerts.push({ title: `${room.name}: environment outside setpoint`, detail: status.text });
      const rot = moldRisk(latestEnv, setpoint, normalizeStage(room.stage));
      if (rot) {
        alerts.push({
          title: `${room.name}: ${rot.level === "high" ? "bud-rot conditions" : "bud-rot risk building"}`,
          detail: rot.text
        });
      }
    }

    if (profile.coolingImpossible) {
      alerts.push({
        title: `${room.name}: exhaust can't cool the tent`,
        detail: `Intake air ${fmtTemp(profile.ambientTempF, displayTempUnit, 0)} is at/above the ${fmtTemp(profile.targetTempF, displayTempUnit, 0)} target, so airflow alone won't hold temperature. Cool the intake air or add active cooling, especially with lights on.`
      });
    } else if (profile.undersized) {
      alerts.push({
        title: `${room.name}: fan undersized for this setup`,
        detail: `Even at 100%${profile.filterOn ? " with the carbon filter" : ""} this fan delivers about ${profile.maxDeliverableCfm.toFixed(0)} CFM, below the ${profile.requiredCfm.toFixed(0)} CFM needed${profile.heatLimited ? " to clear the light heat" : ""}. Use a bigger fan or reduce ducting/filter resistance.`
      });
    } else if (profile.predictedHot) {
      alerts.push({
        title: `${room.name}: predicted to run hot`,
        detail: `With ${profile.heatWatts.toFixed(0)}W of lights on and the fan at ${profile.fanSpeed}%, the model settles near ${fmtTemp(profile.ventedTempF, displayTempUnit, 0)} — above the ${fmtTemp(profile.targetTempF, displayTempUnit, 0)} target. Raise the fan, switch on the carbon filter only when needed, or lower intake temp.`
      });
    }

    if (profile.volumeFt3 && profile.fanCapacityCfm && !profile.coolingImpossible) {
      const why = profile.heatLimited
        ? `clear ${profile.heatBtuPerHr.toFixed(0)} BTU/hr of light heat (ΔT ${tempDeltaToDisplay(profile.allowableRiseF, displayTempUnit, 1)} ${tempUnitLabel(displayTempUnit)})`
        : `${profile.targetAirChanges} air changes/min`;
      if (!profile.undersized && profile.recommendedFanSpeed < 25 && profile.fanSpeed > 60) {
        alerts.push({
          title: `${room.name}: fan may be oversized for current setting`,
          detail: `Holding the target needs about ${profile.recommendedFanSpeed.toFixed(0)}% of this fan, but configured speed is ${profile.fanSpeed}%. A controller stops it stripping moisture.`
        });
      }
      if (profile.fanSpeed < profile.recommendedFanSpeed * 0.85) {
        alerts.push({
          title: `${room.name}: ventilation below target`,
          detail: `Configured speed ${profile.fanSpeed}% is below the calculated ${profile.recommendedFanSpeed.toFixed(0)}%${profile.filterOn ? " (carbon filter attached)" : ""} needed to ${why}.`
        });
      }
    }

    if (setpoint?.lightKelvinMax) {
      const observed = latestLight ? number(latestLight.colorTempK) : NaN;
      const kelvin = Number.isFinite(observed) ? observed : lights.activeKelvin || NaN;
      const source = Number.isFinite(observed) ? "Latest light reading" : "Active fixture mix";
      if (Number.isFinite(kelvin) && (kelvin < setpoint.lightKelvinMin || kelvin > setpoint.lightKelvinMax)) {
        alerts.push({
          title: `${room.name}: light color outside target`,
          detail: `${source} is ${kelvin}K; ${room.stage} target is ${setpoint.lightKelvinMin}-${setpoint.lightKelvinMax}K.`
        });
      }
    }

    // Watering: only nags when the data is fresh — a stale weight log should
    // not generate water alerts for days.
    const dryback = dryBackInfo(room, state.logs);
    if (dryback && dryback.level === "water" && dryback.hoursOld <= 48) {
      alerts.push({ title: `${room.name}: pots are light — water day`, detail: dryback.advice });
    }

    if (latestLight) {
      const stageKey = normalizeStage(room.stage);
      const actualPhoto = reading(latestLight.photoperiod);
      const expectedPhoto = PHOTOPERIOD_HOURS[stageKey];
      const dliTarget = dliTargetForStage(stageKey, Number.isFinite(actualPhoto) ? actualPhoto : expectedPhoto);
      const dli = lightDliReading(latestLight);
      const dliStatus = dliTarget ? statusFor(dli, dliTarget.min, dliTarget.max) : "warn";
      if (dliTarget && (dliStatus === "low" || dliStatus === "high")) {
        alerts.push({
          title: `${room.name}: DLI ${dliStatus === "low" ? "below" : "above"} target`,
          detail: `Latest light reading is ${round(dli, 1)} mol/m2/d. ${room.stage} target is ${round(dliTarget.min, 1)}-${round(dliTarget.max, 1)} from ${dliTarget.ppfdMin}-${dliTarget.ppfdMax} PPFD at ${round(dliTarget.photoperiod, 1)}h.`
        });
      }
    }
  });

  (state.plants || []).forEach((plant) => {
    if (plant.status === "Quarantined") {
      const since = Array.isArray(plant.statusHistory) && plant.statusHistory.length ? plant.statusHistory[plant.statusHistory.length - 1].date : "";
      alerts.push({ title: `Plant ${plant.tag || ""} in quarantine`, detail: `Isolated${since ? ` since ${since}` : ""} — inspect and either release to Active or destroy. Quarantined plants spread pests if forgotten.` });
    }
  });

  state.inventory.forEach((item) => {
    if (number(item.quantity) <= number(item.reorderAt)) {
      alerts.push({ title: `Low inventory: ${item.name}`, detail: `${item.quantity} ${item.unit || ""} on hand; reorder at ${item.reorderAt}.` });
    }
  });

  state.tasks.forEach((task) => {
    if (task.status !== "Done" && task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString())) {
      alerts.push({ title: `Overdue task: ${task.title}`, detail: `${task.priority} priority due ${task.dueDate}.` });
    }
  });

  state.batches.forEach((batch) => {
    const entry = currentStageEntry(batch);
    const day = daysSinceDate(entry?.startDate || batch.startDate);
    if (!day) return;
    const stageKey = normalizeStage(batch.stage);
    // Trichome data beats calendar guesses once it exists.
    if (stageKey === "flower") {
      const ripeness = ripenessInfo(batch.id, state.logs);
      if (ripeness && ripeness.phase === "window") {
        alerts.push({ title: `${batch.name}: trichomes in the harvest window`, detail: ripeness.advice });
        return;
      }
      if (ripeness && ripeness.phase === "past-peak") {
        alerts.push({ title: `${batch.name}: trichomes past peak`, detail: ripeness.advice });
        return;
      }
    }
    if (stageKey === "flower" && day >= 49 && day < 56) {
      alerts.push({ title: `${batch.name}: ripening window`, detail: `Day ${day} of Flower. Start checking trichomes and plan flush/taper if your method uses one.` });
    } else if (stageKey === "flower" && day >= 56) {
      alerts.push({ title: `${batch.name}: harvest-readiness window`, detail: `Day ${day} of Flower. Log trichomes, pistils, aroma, and dry-back before harvest decisions.` });
    } else if (stageKey === "drying" && day > 14) {
      alerts.push({ title: `${batch.name}: drying running long`, detail: `Day ${day} of Drying. Check moisture and avoid overdrying.` });
    }
  });

  return alerts;
}

window.AppAlerts = {
  equipmentProfile,
  setElevation,
  setTempUnit,
  environmentStatus,
  resolvedTempF,
  formatTemp,
  collectAlerts,
  vpdForReading,
  vpdTargetForStage,
  targetGuide,
  lightFixtures,
  effectiveLights,
  feedTargets,
  mediumIsSoil,
  statusFor,
  reading,
  fanSuggestion,
  dliFromPpfd,
  dliTargetForStage,
  lightDliReading,
  bandsFor,
  dewpointC,
  dewpointF,
  moldRisk,
  dryBackInfo,
  ripenessInfo,
  flipPlan,
  stretchFraction
};
})();
