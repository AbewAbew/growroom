(() => {
const { inventoryCategories, logTypes, stages, taskPriorities, plantStatuses } = window.AppConfig;
const {
  collectAlerts,
  equipmentProfile,
  resolvedTempF,
  targetGuide,
  effectiveLights,
  feedTargets,
  vpdForReading,
  vpdTargetForStage,
  statusFor,
  reading,
  fanSuggestion,
  dliTargetForStage,
  lightDliReading,
  bandsFor,
  dewpointF,
  moldRisk,
  dryBackInfo,
  ripenessInfo,
  flipPlan,
  stretchFraction
} = window.AppAlerts;
const { playbookFor, playbookStageKey } = window.AppPlaybook;
const { escapeHtml, normalizeStage, options, prettyDate, todayInputValue, tempUnitLabel, tempToDisplay, tempDeltaToDisplay, fmtTemp } = window.AppUtils;
const { helpHtml, allTerms } = window.AppGlossary;

const ROOM_STATIONS = [
  { key: "climate", type: "environment", label: "Climate" },
  { key: "lights", type: "light", label: "Lights" },
  { key: "feed", type: "irrigation", label: "Feed / Water" },
  { key: "water", type: "water", label: "Watering" },
  { key: "root", type: "medium", label: "Root zone / Soil" },
  { key: "plant", type: "health", label: "Plant health" },
  { key: "ripen", type: "ripeness", label: "Ripeness" }
];

const PILL = { ok: "ok", warn: "warn", low: "bad", high: "bad" };

// LED floodlight body dimensions by wattage (face width × height in mm, the
// fixture slab only — mounting handle/bracket excluded), from the maker spec
// sheets. Used to draw each fixture to scale in the tent scene.
const FLOOD_DIMS_MM = {
  10: { w: 166, h: 107 },
  20: { w: 216, h: 152 },
  30: { w: 226, h: 167 },
  50: { w: 310, h: 220 },
  80: { w: 354, h: 245 },
  100: { w: 402, h: 295 },
  150: { w: 430, h: 330 },
  200: { w: 470, h: 360 },
  300: { w: 565, h: 457 },
  400: { w: 585, h: 559 }
};
const FLOOD_WATT_KEYS = Object.keys(FLOOD_DIMS_MM).map(Number).sort((a, b) => a - b);
// Nearest listed wattage → body size in cm (landscape: w ≥ h). null if no watts.
function floodBodyCm(watts) {
  const w = Number(watts) || 0;
  if (w <= 0) return null;
  let key = FLOOD_WATT_KEYS[0];
  let best = Infinity;
  FLOOD_WATT_KEYS.forEach((k) => {
    const d = Math.abs(k - w);
    if (d < best) { best = d; key = k; }
  });
  return { w: FLOOD_DIMS_MM[key].w / 10, h: FLOOD_DIMS_MM[key].h / 10 };
}

function rnd(value, places = 0) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function numberLike(value) {
  const parsed = parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function adviceText(status, label) {
  if (status === "warn") return `Log ${label.toLowerCase()}`;
  if (status === "low") return "Below target";
  if (status === "high") return "Above target";
  return "On target";
}

function metricRow(label, value, unit, min, max, places = 0) {
  const hasTarget = Number.isFinite(min) && Number.isFinite(max);
  const status = hasTarget ? statusFor(value, min, max) : Number.isFinite(value) ? "ok" : "warn";
  const target = hasTarget ? (min === max ? `${rnd(min, places)} ${unit}` : `${rnd(min, places)}-${rnd(max, places)} ${unit}`) : "no target";
  const current = rnd(value, places);
  const advice = !hasTarget ? (Number.isFinite(value) ? "Logged" : `Log ${label.toLowerCase()}`) : adviceText(status, label);
  return { label, target, current: current === null ? "—" : `${current} ${unit}`, status, advice };
}

// --- grow-room scene / plant visuals -------------------------------------

// Maps a free-text room stage to a visual archetype. This is finer-grained
// than normalizeStage (which collapses curing/complete into propagation) so
// the drawing can react to drying, curing, and finished states
function vizStage(raw) {
  const s = String(raw || "").toLowerCase();
  if (s.includes("seed")) return "seedling";
  if (s.includes("prop") || s.includes("clone")) return "propagation";
  if (s.includes("veg")) return "vegetative";
  if (s.includes("flower") || s.includes("bloom")) return "flower";
  if (s.includes("dry")) return "drying";
  if (s.includes("cur")) return "curing";
  if (s.includes("complete") || s.includes("done")) return "complete";
  return "vegetative";
}

function svgDefs(stage, p) {
  const leafStart = p.leaf;
  const leafEnd = p.leafDark;
  const stemColor = p.stem;
  const budColor = p.bud || "#bcd98c";
  const budTipColor = p.budTip || "#caa6d6";
  
  return `<defs>
    <linearGradient id="${stage}-leafGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${leafStart}" />
      <stop offset="100%" stop-color="${leafEnd}" />
    </linearGradient>
    <linearGradient id="${stage}-leafDarkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${leafEnd}" />
      <stop offset="100%" stop-color="#142617" />
    </linearGradient>
    <linearGradient id="${stage}-stemGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${stemColor}" />
      <stop offset="100%" stop-color="#193714" />
    </linearGradient>
    <radialGradient id="${stage}-budGrad" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="${budTipColor}" stop-opacity="0.9" />
      <stop offset="50%" stop-color="${budColor}" />
      <stop offset="100%" stop-color="#214427" />
    </radialGradient>
    <linearGradient id="${stage}-potGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3c3c3c" />
      <stop offset="15%" stop-color="#4c4c4c" />
      <stop offset="50%" stop-color="#2d2d2d" />
      <stop offset="85%" stop-color="#1a1a1a" />
      <stop offset="100%" stop-color="#111111" />
    </linearGradient>
    <linearGradient id="${stage}-potRimGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#242424" />
      <stop offset="50%" stop-color="#353535" />
      <stop offset="100%" stop-color="#181818" />
    </linearGradient>
  </defs>`;
}

const PLANT_PALETTES = {
  seedling: { leaf: "#8fd89b", leafDark: "#5cae6c", stem: "#6cae5c" },
  propagation: { leaf: "#79c98a", leafDark: "#4f9d5c", stem: "#5fa055" },
  vegetative: { leaf: "#54b365", leafDark: "#347a40", stem: "#4d8a3d" },
  flower: { leaf: "#4f9d57", leafDark: "#2f6a3a", stem: "#4a7a3a", bud: "#bcd98c", budTip: "#caa6d6", pistil: "#e6a463" },
  drying: { leaf: "#a08a52", leafDark: "#6f6038", stem: "#6b5a33" }
};

// A single serrated cannabis leaflet, tip at (0,-L), base at (0,0). Lanceolate
// (widest ~⅓ up, tapering to a point) with saw-tooth margins built from
// alternating notch/tooth points up the left edge and back down the right.
function serratedLeafletPath(L, W) {
  const n = 6; // teeth per side
  const hw = (t) => {
    const peak = 0.3;
    const b = t <= peak ? t / peak : 1 - (t - peak) / (1 - peak);
    return W * Math.max(0.04, b);
  };
  const pts = [[0, 0]];
  for (let i = 1; i <= n; i += 1) {
    const tn = (i - 0.5) / n;
    pts.push([-hw(tn) * 0.58, -L * tn]); // notch in
    pts.push([-hw(i / n), -L * (i / n)]); // tooth out
  }
  pts.push([0, -L]); // tip
  for (let i = n; i >= 1; i -= 1) {
    const tn = (i - 0.5) / n;
    pts.push([hw(i / n), -L * (i / n)]); // tooth out
    pts.push([hw(tn) * 0.58, -L * tn]); // notch in
  }
  pts.push([0, 0]);
  return "M" + pts.map((q) => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join(" L ") + " Z";
}

// The iconic 7-leaflet cannabis fan leaf: a long central leaflet flanked by
// progressively shorter, angled pairs, each with a pale central vein.
function fanLeafGroup(stage) {
  const spec = [[0, 1], [24, 0.88], [-24, 0.88], [50, 0.66], [-50, 0.66], [80, 0.42], [-80, 0.42]];
  return spec
    .map(([a, f]) => {
      const L = 27 * f;
      const W = 5 * f + 0.6;
      const grad = Math.abs(a) >= 50 ? `url(#${stage}-leafDarkGrad)` : `url(#${stage}-leafGrad)`;
      const d = serratedLeafletPath(L, W);
      const vein = `<line x1="0" y1="-0.5" x2="0" y2="${(-L * 0.9).toFixed(1)}" stroke="rgba(235,255,238,0.16)" stroke-width="0.4"/>`;
      return `<g transform="rotate(${a})"><path d="${d}" fill="${grad}" stroke="rgba(18,38,22,0.5)" stroke-width="0.35" stroke-linejoin="round"/>${vein}</g>`;
    })
    .join("");
}

function vegLeaves(stage, p, opts = {}) {
  const stem = `<path d="M50 150 C 47 112 53 72 50 ${opts.top ?? 30}" stroke="url(#${stage}-stemGrad)" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  const nodes = opts.nodes || [
    [122, -58, 1.2], [122, 58, 1.2],
    [99, -52, 1.05], [99, 52, 1.05],
    [76, -44, 0.9], [76, 44, 0.9],
    [54, -32, 0.72], [54, 32, 0.72],
    [34, 0, 0.62]
  ];
  const leaves = nodes
    .map(([y, rot, s]) => `<g transform="translate(50 ${y}) rotate(${rot}) scale(${s})">${fanLeafGroup(stage, p.leaf, p.leafDark)}</g>`)
    .join("");
  return stem + leaves;
}

function trainedLeaf(stage, x, y, rot, scale = 1) {
  const p = PLANT_PALETTES[stage] || PLANT_PALETTES.vegetative;
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">${fanLeafGroup(stage, p.leaf, p.leafDark)}</g>`;
}

function trainedBranches(stage) {
  return `<path d="M50 150 C 50 136, 50 120, 50 101" stroke="url(#${stage}-stemGrad)" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M50 105 C 38 104, 27 108, 14 116" stroke="url(#${stage}-stemGrad)" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M50 105 C 62 104, 73 108, 86 116" stroke="url(#${stage}-stemGrad)" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M50 117 C 35 118, 20 125, 6 136" stroke="url(#${stage}-stemGrad)" stroke-width="3.1" fill="none" stroke-linecap="round"/>
    <path d="M50 117 C 65 118, 80 125, 94 136" stroke="url(#${stage}-stemGrad)" stroke-width="3.1" fill="none" stroke-linecap="round"/>
    <path d="M50 112 C 42 115, 36 122, 30 133" stroke="url(#${stage}-stemGrad)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M50 112 C 58 115, 64 122, 70 133" stroke="url(#${stage}-stemGrad)" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
}

function trainedVegPlant(stage, p) {
  const leaves = [
    [12, 113, -72, 0.72], [24, 108, -52, 0.82], [36, 103, -31, 0.88],
    [64, 103, 31, 0.88], [76, 108, 52, 0.82], [88, 113, 72, 0.72],
    [7, 134, -83, 0.62], [24, 125, -51, 0.7], [40, 116, -24, 0.72],
    [60, 116, 24, 0.72], [76, 125, 51, 0.7], [93, 134, 83, 0.62],
    [50, 100, 0, 0.8], [50, 122, 180, 0.68]
  ].map(([x, y, rot, s]) => trainedLeaf(stage, x, y, rot, s)).join("");
  return trainedBranches(stage) + leaves;
}

// A cola: a stack of bud clusters (overlapping calyxes) tapering to a tip. In
// flower each cluster also gets curling pistil hairs and a dusting of frost.
function cola(stage, x, baseY, len, scale, p) {
  let s = "";
  const pistil = (p && p.pistil) || "#e6a463";
  const n = Math.max(4, Math.round(len / 5));
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const cy = baseY - t * len;
    const r = scale * (4.4 - t * 2.4);
    // two overlapping calyxes per node for a knobbly bud look
    s += `<ellipse cx="${(x - r * 0.32).toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(r * 0.82).toFixed(1)}" ry="${(r * 1.02).toFixed(1)}" fill="url(#${stage}-budGrad)"/>`;
    s += `<ellipse cx="${(x + r * 0.32).toFixed(1)}" cy="${(cy - 0.8).toFixed(1)}" rx="${(r * 0.76).toFixed(1)}" ry="${(r * 0.96).toFixed(1)}" fill="url(#${stage}-budGrad)"/>`;
    if (stage === "flower") {
      // pistil hairs curling out from the calyx
      s += `<path d="M${x.toFixed(1)} ${cy.toFixed(1)} q ${(-r * 0.7).toFixed(1)} ${(-r * 0.55).toFixed(1)} ${(-r * 1).toFixed(1)} ${(-r * 0.25).toFixed(1)}" stroke="${pistil}" stroke-width="0.5" fill="none" opacity="0.85"/>`;
      s += `<path d="M${x.toFixed(1)} ${cy.toFixed(1)} q ${(r * 0.7).toFixed(1)} ${(-r * 0.55).toFixed(1)} ${(r * 1).toFixed(1)} ${(-r * 0.25).toFixed(1)}" stroke="${pistil}" stroke-width="0.5" fill="none" opacity="0.85"/>`;
      // frost (trichomes)
      s += `<circle cx="${(x - r * 0.3).toFixed(1)}" cy="${(cy - r * 0.25).toFixed(1)}" r="0.5" fill="#ffffff" opacity="0.7"/>`;
      s += `<circle cx="${(x + r * 0.25).toFixed(1)}" cy="${(cy + r * 0.15).toFixed(1)}" r="0.4" fill="#eafcff" opacity="0.6"/>`;
    }
  }
  s += `<ellipse cx="${x}" cy="${(baseY - len).toFixed(1)}" rx="${(scale * 2).toFixed(1)}" ry="${(scale * 3.2).toFixed(1)}" fill="url(#${stage}-budGrad)"/>`;
  return s;
}

function flowerPlant(stage, p) {
  const leaves = [
    [13, 116, -72, 0.55], [25, 107, -52, 0.62], [38, 101, -26, 0.66],
    [62, 101, 26, 0.66], [75, 107, 52, 0.62], [87, 116, 72, 0.55],
    [9, 134, -80, 0.48], [28, 124, -48, 0.52], [72, 124, 48, 0.52], [91, 134, 80, 0.48]
  ].map(([x, y, rot, s]) => trainedLeaf(stage, x, y, rot, s)).join("");
  const buds = [
    [14, 101, 24, 0.62], [26, 94, 30, 0.72], [38, 89, 34, 0.78], [50, 86, 35, 0.82],
    [62, 89, 34, 0.78], [74, 94, 30, 0.72], [86, 101, 24, 0.62],
    [21, 116, 18, 0.5], [35, 110, 22, 0.54], [65, 110, 22, 0.54], [79, 116, 18, 0.5]
  ].map(([x, y, len, s]) => cola(stage, x, y, len, s, p)).join("");
  return trainedBranches(stage) + leaves + buds;
}

function seedlingPlant(stage, p) {
  return `<path d="M50 150 L50 122" stroke="url(#${stage}-stemGrad)" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="41" cy="122" rx="9" ry="4.6" fill="url(#${stage}-leafGrad)" transform="rotate(-16 41 122)"/>
    <ellipse cx="59" cy="122" rx="9" ry="4.6" fill="url(#${stage}-leafGrad)" transform="rotate(16 59 122)"/>
    <g transform="translate(50 118) scale(0.5)">${fanLeafGroup(stage, p.leaf, p.leafDark)}</g>`;
}

function dryingPlant(stage, p) {
  const stem = `<path d="M50 150 C 50 116 50 86 50 58" stroke="url(#${stage}-stemGrad)" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  const nodes = [[120, -122, 0.95], [120, 122, 0.95], [96, -132, 0.82], [96, 132, 0.82], [72, -150, 0.7], [72, 150, 0.7]];
  const leaves = nodes
    .map(([y, rot, s]) => `<g transform="translate(50 ${y}) rotate(${rot}) scale(${s})">${fanLeafGroup(stage, p.leaf, p.leafDark)}</g>`)
    .join("");
  return stem + leaves;
}

function plantFoliageSvg(stage) {
  const p = PLANT_PALETTES[stage] || PLANT_PALETTES.vegetative;
  let inner;
  if (stage === "seedling") inner = seedlingPlant(stage, p);
  else if (stage === "flower") inner = flowerPlant(stage, p);
  else if (stage === "drying") inner = dryingPlant(stage, p);
  else if (stage === "vegetative") inner = trainedVegPlant(stage, p);
  else inner = vegLeaves(stage, p);
  const defs = svgDefs(stage, p);
  return `<svg class="plant-svg" viewBox="0 0 100 150" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${defs}${inner}</svg>`;
}

const DEFAULT_UNLOGGED_PLANT_HEIGHT_IN = 4;
function plantStageHeightIn(stage, logged) {
  if (Number.isFinite(logged) && logged > 0) return logged;
  return DEFAULT_UNLOGGED_PLANT_HEIGHT_IN;
}

const STAGE_LAMP_GAP_IN = { seedling: 30, propagation: 28, vegetative: 21, flower: 15 };

const INCH_TO_M = 0.0254;

// Bucket-style pot dimensions from volume: real buckets are taller than wide
// (height ≈ 1.2 × top diameter) and taper ~7% — a 20 L bucket comes out near
// 29 cm across × 35 cm tall, matching a standard 5-gallon pail.
function potDims(liters) {
  const L = Number.isFinite(liters) && liters > 0 ? liters : 11;
  const volM3 = L / 1000;
  // V = π · (0.93 r)² · (2.4 r)  =>  r = cbrt(V / 2.076π)
  const r = Math.cbrt(volM3 / (2.076 * Math.PI));
  const diameterM = 2 * r;
  return { diameterM, heightM: 1.2 * diameterM };
}

// Pot dimensions for a room: measured width/height (stored in inches) win;
// litres is the fallback when no dimensions were entered. Returns the size in
// metres plus the volume in litres (entered or estimated from the dims).
function potDimsFromRoom(room) {
  const wIn = reading(room.potWidthIn);
  const hIn = reading(room.potHeightIn);
  const liters = reading(room.potLiters);
  if (Number.isFinite(wIn) && wIn > 0) {
    const diameterM = wIn * INCH_TO_M;
    const heightM = Number.isFinite(hIn) && hIn > 0 ? hIn * INCH_TO_M : 1.2 * diameterM;
    const r = diameterM / 2;
    const estLiters = Math.PI * (0.93 * r) ** 2 * heightM * 1000;
    return { diameterM, heightM, liters: Number.isFinite(liters) && liters > 0 ? liters : estLiters, measured: true };
  }
  const d = potDims(liters);
  return { ...d, liters: Number.isFinite(liters) && liters > 0 ? liters : 11, measured: false };
}

// Pot drawn with 3D depth: an elliptical open rim with visible soil inside,
// the tapered body below, and a base ellipse so it sits on the floor plane.
function potPaths(stage, bboxW, yTop, potWcm, potHcm) {
  const potTop = potWcm;
  const inset = (potTop - potTop * 0.8) / 2;
  const x0 = (bboxW - potWcm) / 2;
  const cx = potTop / 2;
  const rimRy = Math.max(1.6, potTop * 0.13); // ellipse depth of the open mouth
  const n = (v) => v.toFixed(1);
  return `<g transform="translate(${n(x0)} ${n(yTop)})">
    <ellipse cx="${n(cx)}" cy="${n(potHcm - 1)}" rx="${n(potTop * 0.4)}" ry="${n(rimRy * 0.7)}" fill="rgba(0,0,0,0.45)"/>
    <path d="M0 0 H ${n(potTop)} L ${n(potTop - inset)} ${n(potHcm)} H ${n(inset)} Z" fill="url(#${stage}-potGrad)"/>
    <path d="M ${n(inset)} ${n(potHcm)} Q ${n(cx)} ${n(potHcm + rimRy * 0.6)} ${n(potTop - inset)} ${n(potHcm)}" fill="url(#${stage}-potGrad)"/>
    <ellipse cx="${n(cx)}" cy="0" rx="${n(potTop / 2)}" ry="${n(rimRy)}" fill="url(#${stage}-potRimGrad)" stroke="#3a3a3a" stroke-width="0.5"/>
    <ellipse cx="${n(cx)}" cy="0" rx="${n(potTop * 0.42)}" ry="${n(rimRy * 0.78)}" fill="#241a10"/>
    <ellipse cx="${n(cx)}" cy="0.4" rx="${n(potTop * 0.38)}" ry="${n(rimRy * 0.62)}" fill="#2e2114"/>
    <ellipse cx="${n(cx - potTop * 0.12)}" cy="-0.4" rx="${n(potTop * 0.1)}" ry="${n(rimRy * 0.2)}" fill="rgba(255,255,255,0.05)"/>
    <rect x="${n(potTop * 0.38)}" y="${n(potHcm * 0.38)}" width="${n(potTop * 0.24)}" height="${n(potHcm * 0.3)}" rx="1.5" fill="#1b1c1b" stroke="#444" stroke-width="0.5" />
    <line x1="${n(potTop * 0.44)}" y1="${n(potHcm * 0.5)}" x2="${n(potTop * 0.56)}" y2="${n(potHcm * 0.5)}" stroke="#666" stroke-width="0.5" />
    <line x1="${n(potTop * 0.44)}" y1="${n(potHcm * 0.59)}" x2="${n(potTop * 0.52)}" y2="${n(potHcm * 0.59)}" stroke="#666" stroke-width="0.5" />
  </g>`;
}

const CANOPY_WIDTH_FACTOR = { seedling: 0.5, propagation: 0.62, vegetative: 1.45, flower: 1.35, drying: 0.52 };

// Plant + pot drawn in centimetre user units, returned as raw SVG body
// content with its bounding box, so it can be embedded straight into the
// full-scene SVG (or wrapped in a standalone <svg> by the helpers below).
function plantBody(stage, plantHeightM, pot) {
  const p = PLANT_PALETTES[stage] || PLANT_PALETTES.vegetative;
  const widthFactor = CANOPY_WIDTH_FACTOR[stage] ?? 0.7;
  const plantHcm = Math.max(2, plantHeightM * 100);
  const potWcm = pot.diameterM * 100;
  const potHcm = pot.heightM * 100;
  const plantWcm = Math.max(potWcm * 0.85, plantHcm * widthFactor);
  const bboxW = Math.max(plantWcm, potWcm);
  const totalH = plantHcm + potHcm;
  const inner = stage === "seedling" ? seedlingPlant(stage, p) : stage === "flower" ? flowerPlant(stage, p) : stage === "drying" ? dryingPlant(stage, p) : stage === "vegetative" ? trainedVegPlant(stage, p) : vegLeaves(stage, p);
  const sx = plantWcm / 100;
  const sy = plantHcm / 150;
  const foliage = `<g transform="translate(${((bboxW - plantWcm) / 2).toFixed(1)} 0) scale(${sx.toFixed(3)} ${sy.toFixed(3)})">${inner}</g>`;
  return { w: bboxW, h: totalH, body: `${foliage}${potPaths(stage, bboxW, plantHcm, potWcm, potHcm)}` };
}

function potOnlyBody(stage, pot) {
  const potWcm = pot.diameterM * 100;
  const potHcm = pot.heightM * 100;
  const bboxW = potWcm;
  const totalH = potHcm * 1.18;
  const mark = stage === "complete" ? "#9fcf7a" : "#caa6d6";
  const stub = `<circle cx="${(bboxW / 2).toFixed(1)}" cy="${(potHcm * 0.12).toFixed(1)}" r="${(potWcm * 0.13).toFixed(1)}" fill="${mark}"/>`;
  return { w: bboxW, h: totalH, body: `${stub}${potPaths(stage, bboxW, totalH - potHcm, potWcm, potHcm)}` };
}

function plantToScaleSvg(stage, plantHeightM, pot) {
  const p = PLANT_PALETTES[stage] || PLANT_PALETTES.vegetative;
  const { w, h, body } = plantBody(stage, plantHeightM, pot);
  return `<svg class="plant-svg" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${svgDefs(stage, p)}${body}</svg>`;
}

function potOnlySvg(stage, pot) {
  const p = PLANT_PALETTES[stage] || PLANT_PALETTES.vegetative;
  const { w, h, body } = potOnlyBody(stage, pot);
  return `<svg class="plant-svg" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${svgDefs(stage, p)}${body}</svg>`;
}

function lightTint(k) {
  const kk = Number.isFinite(k) && k > 0 ? k : 4000;
  const t = Math.max(0, Math.min(1, (kk - 2700) / (6500 - 2700)));
  const r = Math.round(255 + (207 - 255) * t);
  const g = Math.round(207 + (227 - 207) * t);
  const b = Math.round(143 + (255 - 143) * t);
  return `${r},${g},${b}`;
}

// Full-scene ISOMETRIC SVG of the grow tent: a 30°/30° corner cutaway like a
// technical drawing — two mylar walls and the floor diamond visible, open
// front, plants standing inside on the floor plane, the lamp as an iso slab.
// All user units are centimetres so everything stays true to scale (no
// perspective shrink — that is the point of isometric).
// Interactive hooks are unchanged: [data-station], [data-light-toggle],
// [data-lamp-drag], [data-lamp-auto], .scene-stage, .light-bar, .light-cone,
// [data-lamp-label].
function growSceneModel(room, lights, vstage, loggedHeight, setpoint, latestLight, formatLength = (inches) => `${Math.round(inches)}in`, opts = {}) {
  const tentH = Math.max(0.6, reading(room.heightM) || 2);
  const tentW = Math.max(0.4, reading(room.lengthM) || reading(room.widthM) || 1.2);
  const tentD = Math.max(0.4, reading(room.widthM) || tentW);
  const pot = potDimsFromRoom(room);
  const count = Math.max(0, Math.round(reading(room.plantCount)) || 0);
  const empty = vstage === "curing" || vstage === "complete";
  const heightIn = plantStageHeightIn(vstage, loggedHeight);
  let plantHM = empty ? 0 : heightIn * INCH_TO_M;
  const maxCanopy = Math.max(0.05, tentH * 0.9 - pot.heightM);
  plantHM = Math.min(plantHM, maxCanopy);
  const canopyTopM = pot.heightM + plantHM;

  const pct = (m) => (m / tentH) * 100;

  const recGapIn = STAGE_LAMP_GAP_IN[vstage];
  const ppfdMin = setpoint ? reading(setpoint.ppfdMin) : NaN;
  const ppfdMax = setpoint ? reading(setpoint.ppfdMax) : NaN;
  const ppfdText = Number.isFinite(ppfdMin) && Number.isFinite(ppfdMax) && ppfdMax ? `${ppfdMin}-${ppfdMax}` : null;
  const suggM = recGapIn && !empty ? Math.min(tentH * 0.93, Math.max(canopyTopM + 0.1, canopyTopM + recGapIn * INCH_TO_M)) : null;

  const auto = room.lampAuto !== false && suggM != null;
  const lhIn = reading(room.lightHeightIn);
  const lightBarM = auto
    ? suggM
    : Math.min(tentH * 0.93, Math.max(canopyTopM, canopyTopM + (Number.isFinite(lhIn) && lhIn > 0 ? lhIn * INCH_TO_M : recGapIn ? recGapIn * INCH_TO_M : tentH * 0.25)));
  const gapToCanopyM = lightBarM - canopyTopM;

  const tint = lightTint(lights.activeKelvin);
  const onFrac = lights.total ? lights.onCount / lights.total : 0;
  const coneOpacity = lights.onCount ? (0.26 + 0.5 * onFrac).toFixed(2) : "0";

  let advice = "";
  if (suggM != null) {
    const measured = latestLight ? reading(latestLight.ppfd) : NaN;
    if (Number.isFinite(measured) && ppfdText) {
      if (measured > ppfdMax) advice = `Measured PPFD ${Math.round(measured)} is above the ${ppfdText} ${vstage} target — raise the lamp or dim it.`;
      else if (measured < ppfdMin) advice = `Measured PPFD ${Math.round(measured)} is below the ${ppfdText} ${vstage} target — lower the lamp or raise intensity.`;
      else advice = `Measured PPFD ${Math.round(measured)} is within the ${ppfdText} ${vstage} target — good.`;
    }
  }
  const lampSuggest = suggM != null ? { pct: pct(suggM), gapIn: recGapIn, ppfdText, advice } : null;

  // ---- isometric projection (cm user units) ----
  const c30 = 0.866, s30 = 0.5;
  const W = tentW * 100, D = tentD * 100, H = tentH * 100;
  const ML = 20, MR = 10, MT = 18, MB = 8, SB = 13;
  const OX = ML + D * c30;            // screen x of tent origin (0,0)
  const OY = MT + H;                  // screen y of tent origin at floor level
  const VW = ML + (W + D) * c30 + MR;
  const VH = MT + H + (W + D) * s30 + SB + MB;
  const n2 = (v) => Number(v).toFixed(1);
  const PX = (x, y) => OX + (x - y) * c30;
  const PY = (x, y, z) => OY + (x + y) * s30 - z;
  const pt = (x, y, z) => `${n2(PX(x, y))},${n2(PY(x, y, z))}`;

  const zLamp = lightBarM * 100;
  const zCanopy = canopyTopM * 100;
  const scrogActive = vstage === "vegetative" || vstage === "flower";
  const zScrog = scrogActive
    ? Math.max(pot.heightM * 100 + 2, Math.min(zCanopy - 3, pot.heightM * 100 + 20.3))
    : null;

  const palette = PLANT_PALETTES[vstage] || PLANT_PALETTES.vegetative;
  const selStation = opts.selStation || "";
  const roomId = room.id || "";

  // ---- defs ----
  const defs = `<defs>
    ${svgDefs(vstage, palette).replace(/<\/?defs>/g, "")}
    <pattern id="mylar" width="9" height="9" patternUnits="userSpaceOnUse">
      <path d="M0 9 L9 0" stroke="rgba(255,255,255,0.035)" stroke-width="0.5"/>
      <path d="M0 0 L9 9" stroke="rgba(255,255,255,0.02)" stroke-width="0.5"/>
    </pattern>
    <linearGradient id="coneGradWarm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgb(${lightTint(reading(room.warmLightKelvin) || 3000)})" stop-opacity="0.4"/>
      <stop offset="55%" stop-color="rgb(${lightTint(reading(room.warmLightKelvin) || 3000)})" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="rgb(${lightTint(reading(room.warmLightKelvin) || 3000)})" stop-opacity="0.01"/>
    </linearGradient>
    <linearGradient id="coneGradCool" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgb(${lightTint(reading(room.coolLightKelvin) || 5000)})" stop-opacity="0.4"/>
      <stop offset="55%" stop-color="rgb(${lightTint(reading(room.coolLightKelvin) || 5000)})" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="rgb(${lightTint(reading(room.coolLightKelvin) || 5000)})" stop-opacity="0.01"/>
    </linearGradient>
    <radialGradient id="falloffGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgb(${tint})" stop-opacity="0.3"/>
      <stop offset="30%" stop-color="rgb(${tint})" stop-opacity="0.13"/>
      <stop offset="65%" stop-color="rgb(${tint})" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="rgb(${tint})" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="wallWash" cx="50%" cy="0%" r="90%">
      <stop offset="0%" stop-color="rgb(${tint})" stop-opacity="${(0.14 * onFrac).toFixed(2)}"/>
      <stop offset="100%" stop-color="rgb(${tint})" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wallL" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0c1310"/><stop offset="100%" stop-color="#15201a"/>
    </linearGradient>
    <linearGradient id="wallR" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0%" stop-color="#0a0f0c"/><stop offset="100%" stop-color="#121b15"/>
    </linearGradient>
    <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#101713"/><stop offset="100%" stop-color="#182219"/>
    </linearGradient>
    <linearGradient id="railGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#222e27"/><stop offset="100%" stop-color="#111813"/>
    </linearGradient>
    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#27332b"/><stop offset="100%" stop-color="#0d1310"/>
    </linearGradient>
    <linearGradient id="soilGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2b2114"/><stop offset="100%" stop-color="#16110a"/>
    </linearGradient>
  </defs>`;

  // ---- structure: floor diamond + two walls (open-corner cutaway) ----
  const floorPts = `${pt(0, 0, 0)} ${pt(W, 0, 0)} ${pt(W, D, 0)} ${pt(0, D, 0)}`;
  const wallLPts = `${pt(0, 0, 0)} ${pt(0, D, 0)} ${pt(0, D, H)} ${pt(0, 0, H)}`;
  const wallRPts = `${pt(0, 0, 0)} ${pt(W, 0, 0)} ${pt(W, 0, H)} ${pt(0, 0, H)}`;
  const structure = `
    <polygon points="${wallLPts}" fill="url(#wallL)" stroke="#1c2621" stroke-width="0.7"/>
    <polygon points="${wallLPts}" fill="url(#mylar)"/>
    <polygon points="${wallLPts}" fill="url(#wallWash)"/>
    <polygon points="${wallRPts}" fill="url(#wallR)" stroke="#1c2621" stroke-width="0.7"/>
    <polygon points="${wallRPts}" fill="url(#mylar)"/>
    <polygon points="${wallRPts}" fill="url(#wallWash)"/>
    <line x1="${n2(PX(0, 0))}" y1="${n2(PY(0, 0, 0))}" x2="${n2(PX(0, 0))}" y2="${n2(PY(0, 0, H))}" stroke="#243029" stroke-width="1"/>
    <polygon points="${floorPts}" fill="url(#floorGrad)" stroke="#1f2a22" stroke-width="0.7"/>
    <polygon points="${floorPts}" fill="url(#mylar)" opacity="0.6"/>
    ${lights.onCount ? `<ellipse cx="${n2(PX(W / 2, D / 2))}" cy="${n2(PY(W / 2, D / 2, 0))}" rx="${n2(W * c30 * 0.5)}" ry="${n2((W + D) * s30 * 0.3)}" fill="rgb(${tint})" opacity="${(0.1 * onFrac).toFixed(2)}"/>` : ""}`;

  const scrogNet = scrogActive ? (() => {
    const ix0 = W * 0.08, ix1 = W * 0.92, iy0 = D * 0.08, iy1 = D * 0.92;
    const spacing = 6.35; // 2.5 in eye-hook/string spacing from the ScrOG post
    let lines = "";
    for (let x = ix0; x <= ix1 + 0.1; x += spacing) {
      lines += `<line x1="${n2(PX(x, iy0))}" y1="${n2(PY(x, iy0, zScrog))}" x2="${n2(PX(x, iy1))}" y2="${n2(PY(x, iy1, zScrog))}" stroke="rgba(61,220,132,0.42)" stroke-width="0.45"/>`;
    }
    for (let y = iy0; y <= iy1 + 0.1; y += spacing) {
      lines += `<line x1="${n2(PX(ix0, y))}" y1="${n2(PY(ix0, y, zScrog))}" x2="${n2(PX(ix1, y))}" y2="${n2(PY(ix1, y, zScrog))}" stroke="rgba(61,220,132,0.42)" stroke-width="0.45"/>`;
    }
    const framePts = `${pt(ix0, iy0, zScrog)} ${pt(ix1, iy0, zScrog)} ${pt(ix1, iy1, zScrog)} ${pt(ix0, iy1, zScrog)}`;
    const labelX = PX(ix0, iy1), labelY = PY(ix0, iy1, zScrog);
    return `<g class="scrog-net" data-station="plant">
      <title>SCROG screen - low training net, about 8 in above the medium/base</title>
      <polygon points="${framePts}" fill="rgba(61,220,132,0.035)" stroke="rgba(61,220,132,0.8)" stroke-width="1.2"/>
      ${lines}
      <rect x="${n2(labelX - 19)}" y="${n2(labelY - 5)}" width="38" height="8.5" rx="4.2" fill="rgba(10,15,12,0.82)" stroke="rgba(61,220,132,0.42)" stroke-width="0.45"/>
      <text x="${n2(labelX)}" y="${n2(labelY + 1.1)}" text-anchor="middle" font-size="4.2" font-weight="700" fill="#3ddc84">SCROG NET</text>
    </g>`;
  })() : "";

  // ---- height ruler on the front-left vertical edge (0, D) ----
  let ruler = "";
  const rx = PX(0, D);
  for (let i = 1; i * 0.25 < tentH - 0.01; i += 1) {
    const m = i * 0.25;
    const y = PY(0, D, m * 100);
    const major = i % 2 === 0;
    ruler += `<line x1="${n2(rx - (major ? 6 : 3.5))}" y1="${n2(y)}" x2="${n2(rx)}" y2="${n2(y)}" stroke="rgba(136,160,148,${major ? 0.55 : 0.3})" stroke-width="0.7"/>`;
    if (major) {
      const label = opts.metric === false ? `${(m * 3.28084).toFixed(1)}ft` : `${m % 1 ? m.toFixed(2) : m}m`;
      ruler += `<text x="${n2(rx - 7.5)}" y="${n2(y + 1.7)}" text-anchor="end" font-size="4.4" fill="rgba(136,160,148,0.65)" font-weight="600">${label}</text>`;
    }
  }

  // ---- plants in a SQUARE GRID on the iso floor (cols ≈ rows, aligned) ----
  const cap = 12;
  const shown = Math.min(count, cap);
  const gridCols = Math.max(1, Math.ceil(Math.sqrt(shown)));
  const gridRows = Math.max(1, Math.ceil(shown / gridCols));
  const potL = Math.round(pot.liters);
  const potText = pot.measured
    ? `${formatLength(pot.diameterM / INCH_TO_M)}×${formatLength(pot.heightM / INCH_TO_M)} (~${potL}L)`
    : `${potL}L`;
  const potWcm = pot.diameterM * 100;
  // Pots sit at the centres of equal floor cells (like real bucket spacing),
  // not pinned to the tent corners.
  const plantX = (col) => (W * (col + 0.5)) / gridCols;
  const placeRow = (nRow, yRow, offset, spots) => {
    let out = "";
    for (let i = 0; i < nRow; i += 1) {
      const x = plantX(i);
      const jitter = 1 + ((((i + offset) * 53) % 7) - 3) / 100;
      const ph = empty ? 0 : plantHM * jitter;
      const { w, h, body } = empty ? potOnlyBody(vstage, pot) : plantBody(vstage, ph, pot);
      const sx = PX(x, yRow);
      const sy = PY(x, yRow, 0);
      spots.push({ x, yRow, sx, sy, potTopY: sy - pot.heightM * 100, potW: potWcm });
      out += `<ellipse cx="${n2(sx)}" cy="${n2(sy - 0.5)}" rx="${n2(potWcm * 0.62)}" ry="${n2(potWcm * 0.31)}" fill="rgba(0,0,0,0.35)"/>`;
      out += `<g class="svg-plant" transform="translate(${n2(sx - w / 2)} ${n2(sy - h)})"><title>${escapeHtml(vstage)} · pot ${potText}${ph ? ` · ${formatLength(ph / INCH_TO_M)}` : ""}</title><g class="plant-sway">${body}</g></g>`;
    }
    return out;
  };
  // Drip irrigation: manifold line along each row (straight in iso) with a
  // spur over every pot rim ending in an emitter stake.
  const dripRow = (spots, lw) => {
    if (!spots.length) return "";
    const yRow = spots[0].yRow;
    const xs = spots.map((sp) => sp.x);
    const xA = Math.min(...xs) - 9, xB = Math.max(...xs) + 9;
    let out = `<path d="M ${pt(xA, yRow, 0).replace(",", " ")} L ${pt(xB, yRow, 0).replace(",", " ")}" stroke="#141815" stroke-width="${n2(lw)}" fill="none" stroke-linecap="round"/>`;
    spots.forEach((sp) => {
      const ex = sp.sx + sp.potW * 0.2;
      const ay = PY(sp.x, yRow, 0);
      out += `<path d="M ${n2(sp.sx + 4)} ${n2(ay)} C ${n2(ex + 4)} ${n2(ay - 7)}, ${n2(ex + 2.5)} ${n2(sp.potTopY + 7)}, ${n2(ex)} ${n2(sp.potTopY + 0.8)}" stroke="#141815" stroke-width="${n2(lw * 0.62)}" fill="none"/>
        <line x1="${n2(ex)}" y1="${n2(sp.potTopY + 0.8)}" x2="${n2(ex - sp.potW * 0.12)}" y2="${n2(sp.potTopY + 3)}" stroke="#3b4a42" stroke-width="${n2(lw * 0.62)}" stroke-linecap="round"/>`;
    });
    return out;
  };
  let plantsSvg = "";
  let dripSvg = "";
  if (shown > 0) {
    let placed = 0;
    for (let r = 0; r < gridRows; r += 1) {
      const inRow = Math.min(gridCols, shown - placed);
      const yRow = (D * (r + 0.5)) / gridRows;
      const spots = [];
      plantsSvg += placeRow(inRow, yRow, placed, spots);
      dripSvg += dripRow(spots, r === gridRows - 1 ? 1.8 : 1.5);
      placed += inRow;
    }
    if (count > shown) plantsSvg += `<text x="${n2(PX(W, D) - 2)}" y="${n2(PY(W, D, 0) - 4)}" text-anchor="end" font-size="5" font-weight="700" fill="rgba(136,160,148,0.8)">+${count - shown} more</text>`;
  } else {
    plantsSvg = `<text x="${n2(PX(W / 2, D / 2))}" y="${n2(PY(W / 2, D / 2, H * 0.45))}" text-anchor="middle" font-size="5.2" fill="rgba(136,160,148,0.7)">No plants set — add a plant count and pot size in Edit room</text>`;
  }

  // ---- lamp: iso mounting frame with a SQUARE GRID of LED floodlights ----
  const lx0 = W * 0.16, lx1 = W * 0.84, ly0 = D * 0.16, ly1 = D * 0.84;
  const TH = 2.8; // slab thickness
  const zTop = zLamp + TH;
  const fix = lights.fixtures || [];
  const nFix = fix.length;
  const fCols = Math.max(1, Math.ceil(Math.sqrt(nFix)));
  const fRows = Math.max(1, Math.ceil(nFix / fCols));
  const cellW = (lx1 - lx0) / fCols;
  const cellD = (ly1 - ly0) / fRows;
  const side = Math.min(cellW, cellD) * 0.78; // square floodlight body
  const warmTint = lightTint(reading(room.warmLightKelvin) || 3000);
  const coolTint = lightTint(reading(room.coolLightKelvin) || 5000);
  // 120° beam angle: half-angle 60°, footprint grows by gap × tan(60°) per side
  const BEAM_TAN = Math.tan((60 * Math.PI) / 180);
  const spread = Math.max(0, zLamp - zCanopy) * BEAM_TAN;
  const beamFace = (gradId, p1, p2, p3, p4) => {
    const pts = `${p1} ${p2} ${p3} ${p4}`;
    return `<polygon class="light-cone" points="${pts}" data-pts0="${pts}" fill="url(#${gradId})" opacity="${coneOpacity}" pointer-events="none"/>`;
  };
  let fixturesSvg = "";
  let beamsSvg = "";
  for (let i = 0; i < nFix; i += 1) {
    const f = fix[i];
    const col = i % fCols, row = Math.floor(i / fCols);
    const fcx = lx0 + cellW * (col + 0.5);
    const fcy = ly0 + cellD * (row + 0.5);
    // Draw each fixture at its real body size (cm, landscape), but cap to the
    // grid cell — aspect-preserving — so big fixtures in a small tent shrink to
    // fit instead of overlapping. No watts set → fall back to the old square.
    const body = floodBodyCm(f.watts);
    let bodyW = side, bodyH = side;
    if (body) {
      const fit = Math.min(1, (cellW * 0.92) / body.w, (cellD * 0.92) / body.h);
      bodyW = body.w * fit;
      bodyH = body.h * fit;
    }
    const xa = fcx - bodyW / 2, xb = fcx + bodyW / 2;
    const ya = fcy - bodyH / 2, yb = fcy + bodyH / 2;
    const onFill = f.type === "warm" ? "#e8b86a" : "#cfe7f7";
    const glow = f.type === "warm" ? "rgba(232,184,106,0.8)" : "rgba(176,216,242,0.8)";
    const bodyFill = f.on ? (f.type === "warm" ? "#a87f3f" : "#8fb3cc") : "#0d1310";
    const arrCls = opts.arrange ? " arrange" : "";
    const fromCls = opts.arrange && opts.arrangeFrom === i ? " from" : "";
    fixturesSvg += `<g class="fixture-cell${f.on ? " on" : " off"}${arrCls}${fromCls}" data-light-toggle data-room="${roomId}" data-index="${f.index}">
      <title>${f.type} floodlight — ${opts.arrange ? "click two lights to swap places" : `${f.on ? "on" : "off"} (click to toggle)`}</title>
      <polygon points="${pt(xa, yb, zTop)} ${pt(xb, yb, zTop)} ${pt(xb, yb, zLamp)} ${pt(xa, yb, zLamp)}" fill="${bodyFill}" stroke="#1a251f" stroke-width="0.4"/>
      <polygon points="${pt(xb, ya, zTop)} ${pt(xb, yb, zTop)} ${pt(xb, yb, zLamp)} ${pt(xb, ya, zLamp)}" fill="${bodyFill}" stroke="#1a251f" stroke-width="0.4" opacity="0.8"/>
      <polygon points="${pt(xa, ya, zTop)} ${pt(xb, ya, zTop)} ${pt(xb, yb, zTop)} ${pt(xa, yb, zTop)}" fill="${f.on ? onFill : "#0a0f0c"}" stroke="${f.on ? glow : "#1a251f"}" stroke-width="0.6"${f.on ? ` style="filter:drop-shadow(0 0 3px ${glow})"` : ""}/>
      <text x="${n2(PX(fcx, fcy))}" y="${n2(PY(fcx, fcy, zTop) + 1.6)}" text-anchor="middle" font-size="4" font-weight="700" fill="${f.on ? "#1c2a14" : "#5a6e62"}">${f.type === "warm" ? "W" : "C"}</text>
    </g>`;
    if (f.on) {
      const gradId = f.type === "warm" ? "coneGradWarm" : "coneGradCool";
      const tintF = f.type === "warm" ? warmTint : coolTint;
      const Xa = Math.max(1, xa - spread), Xb = Math.min(W - 1, xb + spread);
      const Ya = Math.max(1, ya - spread), Yb = Math.min(D - 1, yb + spread);
      // first two points of each face are the TOP vertices (drag shifts them)
      beamsSvg += beamFace(gradId, pt(xa, yb, zLamp), pt(xb, yb, zLamp), pt(Xb, Yb, zCanopy), pt(Xa, Yb, zCanopy));
      beamsSvg += beamFace(gradId, pt(xb, ya, zLamp), pt(xb, yb, zLamp), pt(Xb, Yb, zCanopy), pt(Xb, Ya, zCanopy));
      beamsSvg += `<polygon class="cone-floor" points="${pt(Xa, Ya, zCanopy)} ${pt(Xb, Ya, zCanopy)} ${pt(Xb, Yb, zCanopy)} ${pt(Xa, Yb, zCanopy)}" fill="rgb(${tintF})" opacity="${(0.08 * onFrac).toFixed(2)}" pointer-events="none"/>`;
    }
  }
  const strap = (x, y) => `<line x1="${n2(PX(x, y))}" y1="${n2(PY(x, y, H))}" x2="${n2(PX(x, y))}" y2="${n2(PY(x, y, zTop))}" stroke="#2c3a31" stroke-width="1.6" stroke-dasharray="3.2 1.6"/>`;
  const handleX = PX(lx1, ly1), handleY = PY(lx1, ly1, zTop);
  const lampGroup = `<g class="light-bar${auto ? " auto" : ""}" data-z0="${n2(zLamp)}" data-hcm="${n2(H)}" data-canopy-z="${n2(zCanopy)}">
    <ellipse cx="${n2(PX((lx0 + lx1) / 2, (ly0 + ly1) / 2))}" cy="${n2(PY((lx0 + lx1) / 2, (ly0 + ly1) / 2, zLamp))}" rx="${n2((W + D) * c30 * 0.42)}" ry="${n2(H * 0.42)}" fill="url(#falloffGrad)" opacity="${(0.95 * onFrac).toFixed(2)}" pointer-events="none"/>
    ${strap(lx0, ly0)}${strap(lx1, ly0)}${strap(lx0, ly1)}${strap(lx1, ly1)}
    <polygon points="${pt(lx0, ly1, zTop)} ${pt(lx1, ly1, zTop)} ${pt(lx1, ly1, zLamp)} ${pt(lx0, ly1, zLamp)}" fill="#0d1310" stroke="#28372e" stroke-width="0.6" opacity="0.65"/>
    <polygon points="${pt(lx1, ly1, zTop)} ${pt(lx1, ly0, zTop)} ${pt(lx1, ly0, zLamp)} ${pt(lx1, ly1, zLamp)}" fill="#0a0e0b" stroke="#28372e" stroke-width="0.6" opacity="0.65"/>
    <polygon points="${pt(lx0, ly0, zTop)} ${pt(lx1, ly0, zTop)} ${pt(lx1, ly1, zTop)} ${pt(lx0, ly1, zTop)}" fill="url(#barGrad)" stroke="#28372e" stroke-width="0.7"/>
    ${fixturesSvg}
    <g class="lamp-handle${auto ? " auto" : ""}" data-lamp-drag="${roomId}">
      <title>Drag up/down to set light-to-canopy distance</title>
      <rect x="${n2(handleX - 17)}" y="${n2(handleY - 12)}" width="34" height="8.4" rx="4.2" fill="#1d2823" stroke="${auto ? "rgba(61,220,132,0.5)" : "#2a352f"}" stroke-width="0.7"/>
      <text x="${n2(handleX)}" y="${n2(handleY - 5.8)}" text-anchor="middle" font-size="4.4" font-weight="700" fill="#3ddc84">⇕ <tspan data-lamp-label>${auto ? "Auto" : formatLength(Math.max(0, gapToCanopyM / INCH_TO_M))}</tspan></text>
    </g>
  </g>`;

  const cone = beamsSvg;

  // ---- PPFD target marker (manual mode): dashed front edges at z = sugg ----
  let targetLine = "";
  if (!auto && lampSuggest) {
    const zS = suggM * 100;
    const tLabel = `◎ PPFD target${ppfdText ? ` · ${ppfdText} µmol` : ""}`;
    const lblX = PX(lx0, ly1), lblY = PY(lx0, ly1, zS);
    targetLine = `<g class="lamp-target-svg" data-lamp-auto="${roomId}">
      <title>PPFD target for ${escapeHtml(vstage)} — click to auto-follow</title>
      <polyline points="${pt(lx0, ly1, zS)} ${pt(lx1, ly1, zS)} ${pt(lx1, ly0, zS)}" fill="none" stroke="rgba(61,220,132,0.75)" stroke-width="0.8" stroke-dasharray="3 2.4"/>
      <rect x="${n2(lblX - tLabel.length * 2.6 - 8)}" y="${n2(lblY - 4.4)}" width="${n2(tLabel.length * 2.6 + 6)}" height="8.8" rx="4.4" fill="rgba(14,21,17,0.85)" stroke="rgba(61,220,132,0.4)" stroke-width="0.5"/>
      <text x="${n2(lblX - 5)}" y="${n2(lblY + 1.7)}" text-anchor="end" font-size="4.4" font-weight="700" fill="#3ddc84">${tLabel}</text>
    </g>`;
  }

  // ---- substrate slab below the floor (the box's visible thickness) ----
  const moisturePct = Number.isFinite(opts.moisturePct) ? Math.max(0, Math.min(100, opts.moisturePct)) : 0;
  const mx = W * (moisturePct / 100);
  const substrate = `<g class="svg-substrate${selStation === "root" ? " sel" : ""}" data-station="root">
    <title>Root zone — click to open</title>
    <polygon points="${pt(0, D, 0)} ${pt(W, D, 0)} ${pt(W, D, -SB)} ${pt(0, D, -SB)}" fill="url(#soilGrad)" stroke="#3a2f1d" stroke-width="0.6"/>
    <polygon points="${pt(W, 0, 0)} ${pt(W, D, 0)} ${pt(W, D, -SB)} ${pt(W, 0, -SB)}" fill="url(#soilGrad)" stroke="#3a2f1d" stroke-width="0.6" opacity="0.8"/>
    ${moisturePct ? `<polygon points="${pt(0, D, 0)} ${pt(mx, D, 0)} ${pt(mx, D, -SB)} ${pt(0, D, -SB)}" fill="rgba(61,220,132,0.22)"/>` : ""}
    <text x="${n2(PX(W / 2, D))}" y="${n2(PY(W / 2, D, -SB / 2) + 1.8)}" text-anchor="middle" font-size="5" font-weight="700" letter-spacing="0.8" fill="#cdb78f">ROOTS · ${escapeHtml(opts.rootText || "log")}</text>
  </g>`;

  // ---- frame: corner poles + top/bottom rails ----
  const pole = (x, y) => `<line x1="${n2(PX(x, y))}" y1="${n2(PY(x, y, 0))}" x2="${n2(PX(x, y))}" y2="${n2(PY(x, y, H))}" stroke="#2c3a31" stroke-width="2"/>`;
  const rail = (x1, y1, x2, y2, z) => `<line x1="${n2(PX(x1, y1))}" y1="${n2(PY(x1, y1, z))}" x2="${n2(PX(x2, y2))}" y2="${n2(PY(x2, y2, z))}" stroke="#2c3a31" stroke-width="1.8"/>`;
  const frame = `
    ${pole(0, D)}${pole(W, 0)}${pole(W, D)}
    ${rail(0, 0, W, 0, H)}${rail(0, 0, 0, D, H)}${rail(W, 0, W, D, H)}${rail(0, D, W, D, H)}
    ${rail(0, D, W, D, 0)}${rail(W, 0, W, D, 0)}`;

  // ---- top equipment: duct + carbon filter on the rails, exhaust fan ----
  const fanR = 6.2;
  const fanCx = PX(W * 0.6, 0), fanCy = PY(W * 0.6, 0, H * 0.86);
  const fanSvg = opts.hasFan ? `<g class="svg-fan">
    <title>Exhaust fan · ${opts.fanSpeed ?? 0}%</title>
    <circle cx="${n2(fanCx)}" cy="${n2(fanCy)}" r="${fanR}" fill="#0f1512" stroke="#3c4c44" stroke-width="0.8"/>
    <g transform="translate(${n2(fanCx)} ${n2(fanCy)})"><g class="svg-fan-blades" style="${(opts.fanSpeed ?? 0) > 0 ? `animation-duration:${Math.max(0.25, 2.5 - ((opts.fanSpeed ?? 0) / 100) * 2.2).toFixed(2)}s` : "animation:none"}">
      ${[0, 90, 180, 270].map((a) => `<path d="M0 -1 C -1.6 -${n2(fanR * 0.75)}, 1.6 -${n2(fanR * 0.75)}, 0 -1 Z" transform="rotate(${a})" fill="#62b6d6" stroke="#62b6d6" stroke-width="1.4"/>`).join("")}
    </g></g>
    <circle cx="${n2(fanCx)}" cy="${n2(fanCy)}" r="1.3" fill="#62b6d6"/>
    <text x="${n2(fanCx)}" y="${n2(fanCy + fanR + 5)}" text-anchor="middle" font-size="4.4" font-weight="700" fill="#62b6d6">${opts.fanSpeed ?? 0}%</text>
  </g>` : "";
  const filterX = PX(W * 0.22, 0.06 * D), filterY = PY(W * 0.22, 0.06 * D, H);
  const topEquip = `
    <rect x="${n2(filterX - 7)}" y="${n2(filterY - 9)}" width="14" height="7" rx="1.6" fill="#2e2417" stroke="#4d3c26" stroke-width="0.6"/>
    <rect x="${n2(filterX + 7)}" y="${n2(filterY - 7.6)}" width="18" height="4.2" rx="2.1" fill="#26332c"/>
    ${Array.from({ length: 4 }, (_, i) => `<line x1="${n2(filterX + 10 + i * 4)}" y1="${n2(filterY - 7.6)}" x2="${n2(filterX + 10 + i * 4)}" y2="${n2(filterY - 3.4)}" stroke="#1a241e" stroke-width="1"/>`).join("")}
    <text x="${n2(VW / 2)}" y="${n2(MT * 0.55)}" text-anchor="middle" font-size="4.8" font-weight="700" letter-spacing="0.6" fill="#88a094">${escapeHtml(String(opts.stageLabel || "").toUpperCase())} · ${tentW}×${tentD}×${tentH}M</text>
    ${fanSvg}`;

  // ---- interaction hit area (plant station) ----
  const hitRect = `<rect class="scene-stage${selStation === "plant" ? " sel" : ""}" data-station="plant" data-tent-h="${tentH}" data-canopy-pct="${pct(canopyTopM).toFixed(1)}" x="${n2(ML)}" y="${n2(MT)}" width="${n2(VW - ML - MR)}" height="${n2(H + (W + D) * s30)}" fill="transparent" rx="3"/>`;

  const svg = `<svg class="grow-scene" data-grow-scene viewBox="0 0 ${n2(VW)} ${n2(VH)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Isometric grow tent scene">
    ${defs}
    ${structure}
    ${ruler}
    ${cone}
    <g class="plants-layer">${plantsSvg}</g>
    ${scrogNet}
    <g class="drip-layer" pointer-events="none">${dripSvg}</g>
    ${hitRect}
    ${lampGroup}
    ${targetLine}
    ${substrate}
    ${frame}
    ${topEquip}
  </svg>`;

  return {
    aspect: `${n2(VW)} / ${n2(VH)}`,
    svg,
    tentH,
    tint,
    canopyPct: pct(canopyTopM),
    potLiters: potL,
    potText,
    auto,
    gapToCanopyIn: Math.max(0, Math.round(gapToCanopyM / INCH_TO_M)),
    plantHIn: Math.round(plantHM / INCH_TO_M),
    lampSuggest
  };
}

function createRenderer(stateRef) {
  const dom = bindDom();
  const names = {
    room: (id) => stateRef.state.rooms.find((item) => item.id === id)?.name || "Unassigned",
    batch: (id) => stateRef.state.batches.find((item) => item.id === id)?.name || "Unassigned",
    plant: (id) => stateRef.state.plants.find((item) => item.id === id)?.tag || ""
  };
  const unitSystem = () => stateRef.state.settings.unitSystem || "metric";
  const metricUnits = () => unitSystem() === "metric";
  const tempUnit = () => stateRef.state.settings.tempUnit || "C";
  const tUnit = () => tempUnitLabel(tempUnit());
  const tDisp = (tempF, places = 0) => tempToDisplay(tempF, tempUnit(), places);
  const roomLengthUnit = () => metricUnits() ? "m" : "ft";
  const smallLengthUnit = () => metricUnits() ? "cm" : "in";
  const roomLengthValue = (meters) => {
    const value = numberLike(meters);
    if (!Number.isFinite(value)) return "";
    return metricUnits() ? rnd(value, 2) : rnd(value * 3.28084, 2);
  };
  const smallLengthValue = (inches) => {
    const value = numberLike(inches);
    if (!Number.isFinite(value)) return "";
    return metricUnits() ? rnd(value * 2.54, 1) : rnd(value, 1);
  };
  const formatSmallLength = (inches, places = 0) => {
    const value = smallLengthValue(inches);
    return value === "" ? "-" : `${rnd(value, places)}${smallLengthUnit()}`;
  };

  function render() {
    window.AppAlerts.setElevation(stateRef.state.settings.elevationM);
    window.AppAlerts.setTempUnit(stateRef.state.settings.tempUnit);
    document.body.dataset.bg = stateRef.state.settings.background || "leaf";
    const view = stateRef.view || "rooms";
    if (view === "room" && !stateRef.state.rooms.some((room) => room.id === stateRef.activeRoomId)) stateRef.view = "rooms";
    const active = stateRef.view || "rooms";

    dom.views.forEach((node) => node.classList.toggle("active", node.id === `${active === "room" ? "room" : active}View`));
    dom.topnavItems.forEach((node) => node.classList.toggle("active", node.dataset.view === (active === "room" ? "rooms" : active)));

    if (active === "rooms") renderRooms();
    else if (active === "room") renderRoomView();
    else if (active === "batches") renderBatches();
    else if (active === "plants") renderPlants();
    else if (active === "tasks") renderTasks();
    else if (active === "harvest") renderHarvest();
    else if (active === "diagnose") renderDiagnose();
    else if (active === "inventory") renderInventory();
    else if (active === "settings") renderSettings();

    renderModal();
  }

  // --- helpers -------------------------------------------------------------

  function roomOptions(selected = "") {
    return '<option value="">Unassigned</option>' + stateRef.state.rooms.map((room) => `<option value="${room.id}"${room.id === selected ? " selected" : ""}>${escapeHtml(room.name)}</option>`).join("");
  }
  function batchOptions(selected = "") {
    return '<option value="">Unassigned</option>' + stateRef.state.batches.map((batch) => `<option value="${batch.id}"${batch.id === selected ? " selected" : ""}>${escapeHtml(batch.name)}</option>`).join("");
  }
  // Active plants first; retired (harvested/destroyed/transferred) listed but
  // marked, so old logs can still reference them.
  function plantOptions(selected = "") {
    const rank = { Active: 0, Quarantined: 1 };
    const sorted = [...stateRef.state.plants].sort((a, b) => (rank[a.status] ?? 2) - (rank[b.status] ?? 2) || String(a.tag).localeCompare(String(b.tag)));
    return '<option value="">Whole batch / none</option>' + sorted.map((p) => `<option value="${p.id}"${p.id === selected ? " selected" : ""}>${escapeHtml(p.tag || "untagged")}${p.status && p.status !== "Active" ? ` (${escapeHtml(p.status)})` : ""}</option>`).join("");
  }
  function fieldHtml([name, label, type], value = "") {
    let fieldLabel = label;
    let fieldValue = value;
    if (name === "heightIn" || name === "canopyDistance") {
      fieldLabel = `${label} (${smallLengthUnit()})`;
      fieldValue = smallLengthValue(value);
    }
    // Temperature fields: stored in °F, shown/entered in the chosen unit.
    if (type === "temp") {
      const tip = helpHtml(label);
      const d = tDisp(value, 1);
      const disp = Number.isFinite(d) ? d : "";
      return `<label>${label} (${tUnit()})${tip}<input name="${name}" type="number" step="any" value="${escapeHtml(disp)}" /></label>`;
    }
    // Pot weight is unit-agnostic in the math (dry-back is a ratio); the label
    // just nudges the grower to stay consistent.
    if (name === "potWeight") fieldLabel = `${label} (${metricUnits() ? "kg" : "lb"}, same scale every time)`;
    const tip = helpHtml(label);
    if (type === "room") return `<label>${label}<select name="${name}">${roomOptions(value)}</select></label>`;
    if (type === "batch") return `<label>${label}<select name="${name}">${batchOptions(value)}</select></label>`;
    if (type === "plant") return `<label>${label}<select name="${name}">${plantOptions(value)}</select></label>`;
    if (type.startsWith("select:")) return `<label>${fieldLabel}${tip}<select name="${name}">${options(type.replace("select:", "").split(","), fieldValue)}</select></label>`;
    return `<label>${fieldLabel}${tip}<input name="${name}" type="${type}" step="any" value="${escapeHtml(fieldValue)}" /></label>`;
  }
  // Plant count is derived from the registry when plants are registered (one
  // source of truth); the room's manual plantCount is only a fallback.
  function registeredPlants(room) {
    return stateRef.state.plants.filter((p) => p.roomId === room.id && (p.status === "Active" || p.status === "Quarantined" || !p.status));
  }
  function effectivePlantCount(room) {
    const n = registeredPlants(room).length;
    return n > 0 ? n : Math.max(0, Math.round(reading(room.plantCount)) || 0);
  }
  function latestOfType(roomId, type) {
    return [...stateRef.state.logs].reverse().find((log) => log.roomId === roomId && log.type === type);
  }
  function roomLogs(roomId) {
    return stateRef.state.logs.filter((log) => log.roomId === roomId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  function stationForLog(type) {
    return ROOM_STATIONS.find((station) => station.type === type) || { key: "other", label: logTypes[type]?.label || "Other" };
  }
  function logDayLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Undated";
    const now = new Date();
    const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((start(now) - start(date)) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date);
  }
  function logTimeLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }
  function measurements(log) {
    const skip = new Set(["id", "type", "createdAt", "notes", "roomId", "batchId", "plantId"]);
    const tempKeys = { tempF: "temp", leafTempF: "leaf temp", waterTempF: "water temp", mediumTempF: "medium temp" };
    return Object.entries(log).filter(([key, value]) => !skip.has(key) && value !== "" && value != null).map(([key, value]) => {
      if (key === "heightIn") return `height: ${formatSmallLength(value, metricUnits() ? 1 : 1)}`;
      if (key === "canopyDistance") return `canopy distance: ${formatSmallLength(value, metricUnits() ? 1 : 1)}`;
      if (tempKeys[key]) return `${tempKeys[key]}: ${fmtTemp(value, tempUnit(), 1)}`;
      if (key === "tempC") return `temp: ${fmtTemp(Number(value) * 1.8 + 32, tempUnit(), 1)}`;
      if (key === "leafTempC") return `leaf temp: ${fmtTemp(Number(value) * 1.8 + 32, tempUnit(), 1)}`;
      return `${key}: ${value}`;
    }).join("  ");
  }
  function lowInventory() {
    return stateRef.state.inventory.filter((item) => reading(item.quantity) <= reading(item.reorderAt) && (item.reorderAt ?? "") !== "");
  }
  function findBatch(batchId) {
    return stateRef.state.batches.find((batch) => batch.id === batchId);
  }
  function findRoom(roomId) {
    return stateRef.state.rooms.find((room) => room.id === roomId);
  }
  function stageHistory(batch) {
    if (!batch) return [];
    const fallback = [{ stage: batch.stage || "Seedling", startDate: batch.startDate || todayInputValue() }];
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
  function batchRoom(batchId) {
    const batch = findBatch(batchId);
    return batch ? findRoom(batch.roomId) : null;
  }
  function roomAreaM2(room) {
    const length = reading(room?.lengthM);
    const width = reading(room?.widthM);
    return Number.isFinite(length) && Number.isFinite(width) ? length * width : NaN;
  }
  function formatNumber(value, places = 1) {
    return Number.isFinite(value) ? rnd(value, places).toLocaleString(undefined, { maximumFractionDigits: places }) : "-";
  }
  function harvestMetrics(log) {
    const batch = findBatch(log.batchId);
    const room = batch ? findRoom(batch.roomId) : null;
    const dry = reading(log.dryWeight);
    // A plant-level entry is its own denominator; room-level watts/area ratios
    // would be misleading for a single plant, so they stay batch-only.
    const single = !!log.plantId;
    const plants = single ? 1 : reading(batch?.count) || reading(room?.plantCount);
    const watts = equipmentProfile(room || {}).totalWatts;
    const area = roomAreaM2(room);
    return {
      batch,
      room,
      dry,
      gramsPerWatt: Number.isFinite(dry) && watts && !single ? dry / watts : NaN,
      gramsPerPlant: Number.isFinite(dry) && plants ? dry / plants : NaN,
      gramsPerM2: Number.isFinite(dry) && area && !single ? dry / area : NaN
    };
  }
  function daysSinceDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return Math.max(0, Math.floor((end - start) / 86400000) + 1);
  }
  function batchTiming(batch) {
    const entry = currentStageEntry(batch);
    const day = daysSinceDate(entry?.startDate || batch?.startDate);
    if (!day) return null;
    const stageKey = normalizeStage(batch.stage);
    const week = Math.max(1, Math.ceil(day / 7));
    const stageLabel = batch.stage || entry?.stage || "Batch";
    let headline = `${stageLabel} Day ${day} (Week ${week})`;
    let advice = "Keep logging climate, feed, and plant health so this run can be compared at harvest.";
    let status = "ok";
    if (stageKey === "seedling") {
      if (day <= 7) advice = "Keep light gentle and avoid overwatering while roots establish.";
      else if (day <= 21) advice = "Watch root growth and prepare to move into stronger veg targets when the plant is ready.";
      else { advice = "Seedling run is getting long. Confirm roots and vigor, then move to veg when ready."; status = "warn"; }
    } else if (stageKey === "vegetative") {
      if (day <= 21) advice = "Build root mass and canopy structure before pushing flower.";
      else if (day <= 56) advice = "Train/prune for canopy fill, then flip when plant size and room coverage are right.";
      else { advice = "Long veg window. Check canopy fill and decide whether to flip or reset targets."; status = "warn"; }
    } else if (stageKey === "flower") {
      if (day < 21) advice = "Stretch window. Keep canopy distance and VPD controlled.";
      else if (day < 49) advice = "Bulk flower window. Keep DLI, VPD, runoff EC/pH, and RH stable.";
      else if (day < 56) { advice = "Ripening window. Start checking trichomes and plan flush/taper if your method uses one."; status = "warn"; }
      else if (day <= 70) { advice = "Harvest-readiness window. Log trichomes, pistils, aroma, and dry-back before deciding."; status = "warn"; }
      else { advice = "Past a common photoperiod harvest window. Check trichomes and cultivar notes closely."; status = "warn"; }
    } else if (stageKey === "drying") {
      if (day <= 14) advice = "Drying window. Keep temperature and RH stable and avoid rushing the dry.";
      else { advice = "Drying is running long. Check stem snap, bud moisture, and risk of overdrying."; status = "warn"; }
    }
    return { day, week, headline, advice, status, stageLabel, stageStartDate: entry?.startDate || batch?.startDate, history: stageHistory(batch) };
  }

  function scoreClass(score) {
    if (score === null) return "warn";
    if (score >= 80) return "ok";
    if (score >= 50) return "warn";
    return "bad";
  }
  function renderRoomLogRail(roomId) {
    const logs = roomLogs(roomId);
    if (!logs.length) {
      return `<aside class="room-log-rail panel">
        <div class="panel-head"><h4>Daily activity</h4><span class="muted small">0 logs</span></div>
        <div class="empty-log-rail">No room logs yet.</div>
      </aside>`;
    }

    const groups = [];
    logs.forEach((log) => {
      const day = logDayLabel(log.createdAt);
      let group = groups.find((item) => item.day === day);
      if (!group) {
        group = { day, logs: [] };
        groups.push(group);
      }
      group.logs.push(log);
    });

    const html = groups.map((group) => `<section class="log-day">
      <div class="log-day-head"><b>${escapeHtml(group.day)}</b><span>${group.logs.length} log${group.logs.length === 1 ? "" : "s"}</span></div>
      ${group.logs.map((log) => {
        const station = stationForLog(log.type);
        const summary = measurements(log) || log.notes || "Logged";
        return `<article class="log-entry log-${station.key}">
          <div class="log-entry-top">
            <span class="log-tag log-${station.key}">${escapeHtml(station.label)}</span>
            <time>${escapeHtml(logTimeLabel(log.createdAt))}</time>
          </div>
          <p>${escapeHtml(summary)}</p>
          ${log.notes ? `<small>${escapeHtml(log.notes)}</small>` : ""}
          <button class="icon-button" data-delete-log="${log.id}" title="Delete" type="button">×</button>
        </article>`;
      }).join("")}
    </section>`).join("");

    return `<aside class="room-log-rail panel">
      <div class="panel-head"><h4>Daily activity</h4><span class="muted small">${logs.length} log${logs.length === 1 ? "" : "s"}</span></div>
      <div class="log-days">${html}</div>
    </aside>`;
  }

  // --- rooms home ----------------------------------------------------------

  function renderRooms() {
    const rooms = stateRef.state.rooms;
    const low = lowInventory();
    const banner = low.length
      ? `<div class="banner">${low.length} inventory item${low.length > 1 ? "s" : ""} low: ${low.map((i) => escapeHtml(i.name)).join(", ")}. <button class="link-button" data-view="inventory" type="button">View</button></div>`
      : "";
    const dashboard = renderHomeDashboard();

    const cards = rooms.length
      ? rooms.map(renderRoomCard).join("")
      : `<button class="room-card add-card" data-start-grow type="button"><span class="add-plus">▶</span><span>Start your first grow</span></button>`;

    dom.roomsView.innerHTML = `
      <div class="page-head">
        <div><h1>Your rooms</h1><p class="muted">Pick a room to look, log, and adjust.</p></div>
        <div class="chip-row">
          <button class="primary-button" data-start-grow type="button">▶ Start a grow</button>
          <button class="ghost-button" data-add-room type="button">+ Add room</button>
        </div>
      </div>
      ${banner}
      ${renderTodayPanel()}
      ${dashboard}
      <div class="rooms-grid">
        ${cards}
        ${rooms.length ? `<button class="room-card add-card" data-add-room type="button"><span class="add-plus">+</span><span>Add room</span></button>` : ""}
      </div>`;
  }

  function renderHomeDashboard() {
    const alerts = collectAlerts(stateRef.state);
    const openTasks = stateRef.state.tasks.filter((task) => task.status !== "Done");
    const harvests = stateRef.state.logs.filter((log) => log.type === "harvest");
    const latestHarvest = harvests
      .map((log) => ({ log, metrics: harvestMetrics(log) }))
      .filter((item) => Number.isFinite(item.metrics.dry))
      .sort((a, b) => b.metrics.dry - a.metrics.dry)[0];
    const bestYield = latestHarvest ? `${formatNumber(latestHarvest.metrics.dry, 0)}g dry` : "-";
    const alertList = alerts.length
      ? alerts.slice(0, 6).map((alert) => `<li><b>${escapeHtml(alert.title)}</b><span>${escapeHtml(alert.detail || "")}</span></li>`).join("")
      : '<li class="muted">No active alerts. Keep logging readings to keep this useful.</li>';

    return `<section class="dashboard-grid">
      <div class="metric-card"><span>Rooms</span><b>${stateRef.state.rooms.length}</b><small>${stateRef.state.batches.length} batches tracked</small></div>
      <div class="metric-card ${alerts.length ? "bad" : "ok"}"><span>Alerts</span><b>${alerts.length}</b><small>${alerts.length ? "needs attention" : "clear"}</small></div>
      <div class="metric-card"><span>Open tasks</span><b>${openTasks.length}</b><small>${openTasks.filter((task) => task.priority === "Critical" || task.priority === "High").length} high priority</small></div>
      <div class="metric-card"><span>Best harvest</span><b>${escapeHtml(bestYield)}</b><small>${latestHarvest ? escapeHtml(names.batch(latestHarvest.log.batchId)) : "no harvest results"}</small></div>
      <div class="panel alert-panel">
        <div class="panel-head"><h4>Active guidance</h4><span class="muted small">${alerts.length} alert${alerts.length === 1 ? "" : "s"}</span></div>
        <ul class="alert-list">${alertList}</ul>
      </div>
    </section>`;
  }

  function renderRoomCard(room) {
    const guide = targetGuide(room, stateRef.state);
    const lights = effectiveLights(room);
    const env = latestOfType(room.id, "environment");
    const tempF = env ? resolvedTempF(env) : NaN;
    const rh = env ? reading(env.humidity) : NaN;
    const score = guide.score;
    const plants = effectivePlantCount(room);

    const stats = [
      Number.isFinite(tempF) ? fmtTemp(tempF, tempUnit(), 0) : `— ${tUnit()}`,
      Number.isFinite(rh) ? `${rnd(rh, 0)}% RH` : "—%",
      `${lights.onCount}/${lights.total} lights`,
      Number.isFinite(plants) ? `${plants} plants` : "0 plants"
    ];

    return `
      <button class="room-card" data-open-room="${room.id}" type="button">
        <div class="room-card-top">
          <div>
            <h3>${escapeHtml(room.name)}</h3>
            <span class="stage-pill">${escapeHtml(room.stage || "No stage")}</span>
          </div>
          <span class="score-badge ${scoreClass(score)}">${score === null ? "—" : `${score}%`}</span>
        </div>
        <div class="room-card-stats">${stats.map((s) => `<span>${escapeHtml(s)}</span>`).join("")}</div>
      </button>`;
  }

  function renderBatchTimingPanel(room) {
    const batches = stateRef.state.batches
      .filter((batch) => batch.roomId === room.id && batch.stage !== "Complete")
      .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
    const batch = batches[0];
    if (!batch) {
      return `<div class="panel">
        <div class="panel-head"><h4>Batch timing</h4><span class="muted small">no active batch</span></div>
        <p class="muted small">Assign a batch to this room with a start date to get day/week coaching.</p>
      </div>`;
    }
    const timing = batchTiming(batch);
    if (!timing) {
      return `<div class="panel">
        <div class="panel-head"><h4>Batch timing</h4><span class="muted small">${escapeHtml(batch.name || "Batch")}</span></div>
        <p class="muted small">Add a batch start date to calculate day/week coaching.</p>
      </div>`;
    }
    const timeline = timing.history.length
      ? `<div class="stage-timeline">${timing.history.map((entry) => {
          const active = entry.startDate === timing.stageStartDate && entry.stage === timing.stageLabel;
          return `<span class="stage-node${active ? " active" : ""}"><b>${escapeHtml(entry.stage)}</b><small>${escapeHtml(entry.startDate)}</small></span>`;
        }).join("")}</div>`
      : "";
    return `<div class="panel">
      <div class="panel-head"><h4>Batch timing</h4><span class="chip ${timing.status}">${escapeHtml(batch.name || "Batch")}</span></div>
      <div class="timing-card">
        <b>${escapeHtml(timing.headline)}</b>
        <span>${escapeHtml(timing.advice)}</span>
        ${timeline}
        <small class="muted">Clock is based on ${escapeHtml(timing.stageLabel)} start date: ${escapeHtml(timing.stageStartDate || "")}. Batch started ${escapeHtml(batch.startDate || "")}.</small>
      </div>
    </div>`;
  }

  // --- playbook --------------------------------------------------------------

  function roomActiveBatch(room) {
    return stateRef.state.batches
      .filter((batch) => batch.roomId === room.id && batch.stage !== "Complete")
      .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))[0] || null;
  }

  function playbookActionsHtml(guide, room, batch) {
    const btn = (title) => `<button class="mini-button" data-playbook-task data-title="${escapeHtml(title)}" data-room="${room?.id || ""}" data-batch="${batch?.id || ""}" type="button" title="Add to tasks">+ Task</button>`;
    return `<ul class="pb-list">${guide.actions.map((a) => `<li><div><b>${escapeHtml(a.t)}</b><span>${escapeHtml(a.d)}</span></div>${btn(a.t)}</li>`).join("")}</ul>`;
  }

  function renderPlaybookPanel(room) {
    const batch = roomActiveBatch(room);
    const timing = batch ? batchTiming(batch) : null;
    const stageKey = vizStage(room.stage);
    const week = timing ? timing.week : 1;
    const guide = playbookFor(stageKey, week);
    const watchHtml = guide.watch.length
      ? `<div class="pb-watch"><b>Watch for</b><ul class="pb-list small">${guide.watch.map((w) => `<li><div><b>${escapeHtml(w.t)}</b><span>${escapeHtml(w.d)}</span></div></li>`).join("")}</ul></div>`
      : "";
    return `<div class="panel">
      <div class="panel-head"><h4>Playbook — ${escapeHtml(guide.phase)}</h4><span class="muted small">${timing ? `week ${week}` : "week 1 (no batch date)"}</span></div>
      <p class="pb-focus">${escapeHtml(guide.focus)}</p>
      <p class="muted small">${escapeHtml(guide.why)}</p>
      <div class="pb-targets">
        <span class="chip">🌡 ${escapeHtml(guide.climate)}</span>
        <span class="chip">💡 ${escapeHtml(guide.light)}</span>
        <span class="chip">🧪 ${escapeHtml(guide.feed)}</span>
      </div>
      ${playbookActionsHtml(guide, room, batch)}
      ${watchHtml}
    </div>`;
  }

  // Plants of this room's active batch, managed inline — the room is the hub,
  // the Plants tab is just the registry.
  function renderRoomPlantsPanel(room) {
    const batch = roomActiveBatch(room);
    const plants = stateRef.state.plants
      .filter((p) => (batch && p.batchId === batch.id) || (!batch && p.roomId === room.id))
      .sort((a, b) => String(a.tag).localeCompare(String(b.tag)));
    const rows = plants.length
      ? plants.map((p) => {
          const counts = plantLogCounts(p.id);
          return `<li class="room-plant-row">
            <b>${escapeHtml(p.tag || "untagged")}</b>
            <span class="chip ${PLANT_STATUS_CHIP[p.status] || ""}">${escapeHtml(p.status || "Active")}</span>
            <span class="muted small">${counts.health} health log${counts.health === 1 ? "" : "s"}</span>
            <select class="plant-status-select" data-plant-status="${p.id}">${options(plantStatuses, p.status || "Active")}</select>
          </li>`;
        }).join("")
      : '<li class="muted small">No plants registered for this room yet.</li>';
    return `<div class="panel">
      <div class="panel-head"><h4>Plants${batch ? ` — ${escapeHtml(batch.name || "batch")}` : ""}</h4><span class="muted small">${plants.length}</span></div>
      <ul class="room-plant-list">${rows}</ul>
      <div class="chip-row">
        <input id="quickPlantTag" class="quick-plant-input" placeholder="New tag e.g. P-005" />
        <button class="mini-button" data-quick-add-plant data-room="${room.id}" data-batch="${batch ? batch.id : ""}" type="button">+ Add plant</button>
        <button class="mini-button" data-diagnose-room="${room.id}" type="button">🔍 Diagnose a problem</button>
        <button class="link-button" data-view="plants" type="button">Open registry</button>
      </div>
    </div>`;
  }

  function renderTodayPanel() {
    const items = stateRef.state.batches
      .filter((batch) => batch.stage !== "Complete" && batch.roomId)
      .map((batch) => ({ batch, room: findRoom(batch.roomId), timing: batchTiming(batch) }))
      .filter((item) => item.room && item.timing);
    if (!items.length) {
      return `<div class="panel today-panel">
        <div class="panel-head"><h4>Today</h4></div>
        <p class="muted small">Create a batch with a start date and assign it to a room — the playbook will tell you what to do each week of the run.</p>
      </div>`;
    }
    const cards = items.map(({ batch, room, timing }) => {
      const stageKey = playbookStageKey(batch.stage || room.stage);
      const guide = playbookFor(stageKey, timing.week);
      // The checklist is the batch's real tasks (auto-created from the
      // playbook each phase, plus anything added by hand) — checking one
      // marks the task Done.
      const batchTasks = stateRef.state.tasks.filter((t) => t.batchId === batch.id);
      const phasePrefix = `${batch.id}|${stageKey}|${guide.from}|`;
      const phaseTasks = batchTasks.filter((t) => t.playbookKey && t.playbookKey.startsWith(phasePrefix));
      const phaseDone = phaseTasks.filter((t) => t.status === "Done").length;
      const open = batchTasks.filter((t) => t.status !== "Done").slice(0, 5);
      const checklist = open.length
        ? open.map((t) => `<li class="today-task"><label><input type="checkbox" data-toggle-task="${t.id}" />${escapeHtml(t.title)}</label>${t.playbookKey ? '<span class="chip">playbook</span>' : ""}</li>`).join("")
        : `<li class="muted small">All caught up for this phase.</li>`;
      return `<div class="today-card">
        <div class="today-card-head">
          <button class="link-button" data-open-room="${room.id}" type="button"><b>${escapeHtml(room.name)}</b></button>
          <span class="chip ${timing.status}">${escapeHtml(timing.headline)}</span>
        </div>
        <span class="muted small">${escapeHtml(guide.phase)} — ${escapeHtml(guide.focus)}</span>
        <ul class="pb-list compact today-checklist">${checklist}</ul>
        ${phaseTasks.length ? `<span class="muted small">${phaseDone}/${phaseTasks.length} playbook items done this phase</span>` : ""}
      </div>`;
    }).join("");
    return `<div class="panel today-panel">
      <div class="panel-head"><h4>Today</h4><span class="muted small">${items.length} active batch${items.length === 1 ? "" : "es"}</span></div>
      <div class="today-grid">${cards}</div>
    </div>`;
  }

  // --- trends ----------------------------------------------------------------

  function seriesFor(roomId, type, days, getter) {
    const cutoff = Date.now() - days * 86400000;
    return stateRef.state.logs
      .filter((log) => log.roomId === roomId && log.type === type && new Date(log.createdAt).getTime() >= cutoff)
      .map((log) => ({ t: new Date(log.createdAt).getTime(), v: getter(log) }))
      .filter((p) => Number.isFinite(p.v))
      .sort((a, b) => a.t - b.t);
  }

  function sparkSvg(series, lo, hi) {
    const w = 120, h = 30, pad = 2.5;
    if (!series.length) return `<svg class="spark" viewBox="0 0 ${w} ${h}"><text x="${w / 2}" y="${h / 2 + 3}" text-anchor="middle" font-size="8" fill="#88a094">no readings</text></svg>`;
    const vs = series.map((p) => p.v);
    let min = Math.min(...vs, Number.isFinite(lo) ? lo : Infinity);
    let max = Math.max(...vs, Number.isFinite(hi) ? hi : -Infinity);
    if (min === max) { min -= 1; max += 1; }
    const X = (i) => (series.length === 1 ? w / 2 : pad + ((w - 2 * pad) * i) / (series.length - 1));
    const Y = (v) => h - pad - ((v - min) / (max - min)) * (h - 2 * pad);
    const band = Number.isFinite(lo) && Number.isFinite(hi)
      ? `<rect x="0" y="${Y(hi).toFixed(1)}" width="${w}" height="${Math.max(1, Y(lo) - Y(hi)).toFixed(1)}" fill="rgba(61,220,132,0.12)"/>`
      : "";
    const pts = series.map((p, i) => `${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
    const last = series[series.length - 1];
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${band}<polyline points="${pts}" fill="none" stroke="#3ddc84" stroke-width="1.4" stroke-linejoin="round"/><circle cx="${X(series.length - 1).toFixed(1)}" cy="${Y(last.v).toFixed(1)}" r="2" fill="#3ddc84"/></svg>`;
  }

  function inRangePct(series, lo, hi) {
    if (!series.length || !Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    return Math.round((100 * series.filter((p) => p.v >= lo && p.v <= hi).length) / series.length);
  }

  function renderTrendsPanel(room, setpoint, stageKey) {
    const ft = feedTargets(room, stageKey, stateRef.state.settings);
    const vpdBand = vpdTargetForStage(setpoint);
    const days = 7;
    const metrics = [
      { label: "Air temp", unit: tUnit(), series: seriesFor(room.id, "environment", days, (l) => tDisp(resolvedTempF(l), 1)), lo: tDisp(setpoint?.tempMin, 1), hi: tDisp(setpoint?.tempMax, 1) },
      { label: "Humidity", unit: "%", series: seriesFor(room.id, "environment", days, (l) => reading(l.humidity)), lo: setpoint?.humidityMin, hi: setpoint?.humidityMax },
      { label: "VPD", unit: "kPa", series: seriesFor(room.id, "environment", days, (l) => vpdForReading(l)), lo: vpdBand?.min, hi: vpdBand?.max },
      { label: "Runoff EC", unit: "mS/cm", series: seriesFor(room.id, "irrigation", days, (l) => reading(l.runoffEc)), lo: ft.ec.min, hi: ft.ec.max + 0.5 },
      { label: "Substrate pH", unit: "", series: seriesFor(room.id, "medium", days, (l) => reading(l.substratePh)), lo: ft.ph.min, hi: ft.ph.max },
      { label: "Pot weight", unit: metricUnits() ? "kg" : "lb", series: seriesFor(room.id, "water", days, (l) => reading(l.potWeight)) }
    ];
    const scored = metrics.map((m) => ({ ...m, pct: inRangePct(m.series, m.lo, m.hi) }));
    const withData = scored.filter((m) => m.pct !== null);
    const overall = withData.length ? Math.round(withData.reduce((s, m) => s + m.pct, 0) / withData.length) : null;
    const rows = scored.map((m) => {
      const pctChip = m.pct === null
        ? '<span class="chip">—</span>'
        : `<span class="chip ${m.pct >= 80 ? "ok" : m.pct >= 50 ? "warn" : "bad"}">${m.pct}% in range</span>`;
      const lastV = m.series.length ? `${rnd(m.series[m.series.length - 1].v, 2)} ${m.unit}` : "—";
      return `<div class="trend-row"><div class="trend-label"><b>${escapeHtml(m.label)}</b>${helpHtml(m.label)}<small>${m.series.length} reading${m.series.length === 1 ? "" : "s"} · last ${escapeHtml(String(lastV))}</small></div>${sparkSvg(m.series, m.lo, m.hi)}${pctChip}</div>`;
    }).join("");
    return `<div class="panel">
      <div class="panel-head"><h4>Trends · last 7 days</h4>${overall !== null ? `<span class="chip ${overall >= 80 ? "ok" : overall >= 50 ? "warn" : "bad"}">report card: ${overall}%</span>` : '<span class="muted small">log readings to build trends</span>'}</div>
      <div class="trend-rows">${rows}</div>
      <p class="muted small">Green band = target range. The report card is the share of this week's readings inside their target bands — drift shows here before it becomes an alert.</p>
    </div>`;
  }

  // --- room workspace ------------------------------------------------------

  function buildStationModels(room) {
    const state = stateRef.state;
    const stageKey = normalizeStage(room.stage);
    const setpoint = state.settings.setpoints[stageKey];
    const lights = effectiveLights(room);
    const ft = feedTargets(room, stageKey, state.settings);
    const vpdBand = vpdTargetForStage(setpoint);

    const env = latestOfType(room.id, "environment");
    const light = latestOfType(room.id, "light");
    const feed = latestOfType(room.id, "irrigation");
    const med = latestOfType(room.id, "medium");
    const health = latestOfType(room.id, "health");
    const water = latestOfType(room.id, "water");
    const ripe = latestOfType(room.id, "ripeness");
    const dryback = dryBackInfo(room, state.logs);
    const activeBatch = state.batches
      .filter((b) => b.roomId === room.id && b.stage !== "Complete")
      .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))[0];
    const ripeness = activeBatch ? ripenessInfo(activeBatch.id, state.logs) : null;

    const photoMin = ft.photoperiod ? ft.photoperiod - 0.5 : undefined;
    const photoMax = ft.photoperiod ? ft.photoperiod + 0.5 : undefined;
    const actualPhotoperiod = light ? reading(light.photoperiod) : NaN;
    const dliTarget = dliTargetForStage(stageKey, Number.isFinite(actualPhotoperiod) ? actualPhotoperiod : ft.photoperiod);
    const observedKelvin = light ? reading(light.colorTempK) : NaN;
    const currentKelvin = Number.isFinite(observedKelvin) ? observedKelvin : lights.activeKelvin || NaN;
    const textRow = (label, value) => ({ label, target: "watch", current: value || "none", status: value ? "high" : "ok", advice: value ? "Review" : "Clear" });

    // climate is judged against day or night bands depending on the reading
    const envBands = bandsFor(env, setpoint) || setpoint || {};
    const isNight = env?.lights === "Off";
    const dewF = env ? dewpointF(env) : NaN;
    const tempFNow = env ? resolvedTempF(env) : NaN;
    const dewSpread = Number.isFinite(tempFNow) && Number.isFinite(dewF) ? tempFNow - dewF : NaN;
    const spreadDisp = tempDeltaToDisplay(dewSpread, tempUnit(), 1);
    const dewRow = {
      label: "Dew-point gap",
      target: `≥ ${tempDeltaToDisplay(5, tempUnit(), 1)} ${tUnit()}`,
      current: Number.isFinite(spreadDisp) ? `${spreadDisp} ${tUnit()}` : "—",
      status: !Number.isFinite(dewSpread) ? "warn" : dewSpread <= 3.5 ? "low" : dewSpread <= 5 ? "warn" : "ok",
      advice: !Number.isFinite(dewSpread) ? "Log temp + RH" : dewSpread <= 3.5 ? "Condensation risk — dehumidify" : dewSpread <= 5 ? "Getting humid — watch lights-off" : "Safe margin"
    };

    return {
      climate: {
        latest: env,
        rows: [
          metricRow(`Air temp${isNight ? " (night)" : ""}`, tDisp(tempFNow, 1), tUnit(), tDisp(envBands?.tempMin, 1), tDisp(envBands?.tempMax, 1), 1),
          metricRow(`Humidity${isNight ? " (night)" : ""}`, env ? reading(env.humidity) : NaN, "%", envBands?.humidityMin, envBands?.humidityMax),
          metricRow("CO2", env ? reading(env.co2Ppm) : NaN, "ppm", setpoint?.co2Min, setpoint?.co2Max),
          metricRow("VPD", vpdForReading(env), "kPa", vpdBand ? vpdBand.min : undefined, vpdBand ? vpdBand.max : undefined, 2),
          dewRow
        ]
      },
      lights: {
        latest: light,
        rows: [
          metricRow("Photoperiod", light ? reading(light.photoperiod) : NaN, "h", photoMin, photoMax, 1),
          metricRow("Color temp", currentKelvin, "K", setpoint?.lightKelvinMin, setpoint?.lightKelvinMax),
          metricRow("PPFD", light ? reading(light.ppfd) : NaN, "umol", dliTarget?.ppfdMin, dliTarget?.ppfdMax),
          metricRow("DLI", lightDliReading(light), "mol/m2/d", dliTarget?.min, dliTarget?.max, 1)
        ]
      },
      feed: {
        latest: feed,
        rows: [
          metricRow("Input pH", feed ? reading(feed.ph) : NaN, "", ft.ph.min, ft.ph.max, 2),
          metricRow("Input EC", feed ? reading(feed.ec) : NaN, "mS/cm", ft.ec.min, ft.ec.max, 2),
          metricRow("Input PPM", feed ? reading(feed.ec) * ft.ppm.scale : NaN, "ppm", ft.ppm.min, ft.ppm.max),
          metricRow("Runoff pH", feed ? reading(feed.runoffPh) : NaN, "", ft.ph.min, ft.ph.max, 2)
        ]
      },
      root: {
        latest: med,
        rows: [
          metricRow("Substrate pH", med ? reading(med.substratePh) : NaN, "", ft.ph.min, ft.ph.max, 2),
          metricRow("Substrate EC", med ? reading(med.substrateEc) : NaN, "mS/cm", ft.ec.min, ft.ec.max, 2),
          metricRow("Substrate PPM", med ? reading(med.substrateEc) * ft.ppm.scale : NaN, "ppm", ft.ppm.min, ft.ppm.max),
          metricRow("Moisture", med ? reading(med.moisture) : NaN, "%")
        ]
      },
      plant: {
        latest: health,
        rows: [
          metricRow("Plants in room", effectivePlantCount(room), "", undefined, undefined),
          metricRow("Height", health ? smallLengthValue(health.heightIn) : NaN, smallLengthUnit(), undefined, undefined, 1),
          textRow("Pests", health?.pests),
          textRow("Disease", health?.disease)
        ]
      },
      water: {
        latest: water,
        rows: [
          metricRow("Pot weight", water ? reading(water.potWeight) : NaN, metricUnits() ? "kg" : "lb", undefined, undefined, 2),
          {
            label: "Dry-back",
            target: dryback ? `water at ~${dryback.threshold}%` : "log pot weights",
            current: dryback && Number.isFinite(dryback.pct) ? `${rnd(dryback.pct, 0)} %` : dryback?.learning ? "calibrating" : "—",
            status: !dryback ? "warn" : dryback.level === "water" ? "high" : dryback.level === "soon" ? "warn" : dryback.learning ? "warn" : "ok",
            advice: dryback ? dryback.advice : "Weigh a pot right after watering, then daily — the app learns the wet/dry range."
          },
          {
            label: "Last watered",
            target: dryback?.soil ? "soil: real wet-dry cycle" : "coco: don't fully dry",
            current: dryback?.daysSinceWater !== null && dryback?.daysSinceWater !== undefined ? `${rnd(dryback.daysSinceWater, 1)} d ago` : "—",
            status: dryback?.daysSinceWater === null || dryback?.daysSinceWater === undefined ? "warn" : "ok",
            advice: dryback?.daysSinceWater === null || dryback?.daysSinceWater === undefined ? 'Save a "Watered" entry with the post-water weight' : "Lift-test agrees? Log today's weight"
          }
        ]
      },
      ripen: {
        latest: ripe,
        rows: [
          metricRow("Cloudy / milky", ripe ? reading(ripe.cloudyPct) : NaN, "%", stageKey === "flower" ? 50 : undefined, stageKey === "flower" ? 90 : undefined),
          metricRow("Amber", ripe ? reading(ripe.amberPct) : NaN, "%", stageKey === "flower" ? 10 : undefined, stageKey === "flower" ? 30 : undefined),
          metricRow("Clear", ripe ? reading(ripe.clearPct) : NaN, "%", undefined, undefined),
          {
            label: "Harvest window",
            target: "10-30% amber",
            current: ripeness?.window
              ? `~${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(ripeness.window.start)} – ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(ripeness.window.end)}`
              : ripeness?.phase === "window" ? "open now" : ripeness?.phase === "past-peak" ? "closing" : "—",
            status: !ripeness ? "warn" : ripeness.phase === "window" ? "ok" : ripeness.phase === "past-peak" ? "high" : "warn",
            advice: ripeness ? ripeness.advice : "Log a trichome check (30-60x loupe) — two checks a few days apart project the window"
          }
        ]
      }
    };
  }

  function worstClass(rows) {
    if (rows.some((r) => r.status === "low" || r.status === "high")) return "bad";
    if (rows.some((r) => r.status === "warn")) return "warn";
    return "ok";
  }

  function renderRoomView() {
    const state = stateRef.state;
    const room = state.rooms.find((item) => item.id === stateRef.activeRoomId);
    if (!room) {
      stateRef.view = "rooms";
      renderRooms();
      return;
    }
    if (!ROOM_STATIONS.some((s) => s.key === stateRef.activeStation)) stateRef.activeStation = "climate";

    const stageKey = normalizeStage(room.stage);
    const setpoint = state.settings.setpoints[stageKey];
    const lights = effectiveLights(room);
    const profile = equipmentProfile(room, setpoint);
    const guide = targetGuide(room, state);
    const fanSpeed = Math.round(Number(room.fanSpeed) || 0);
    const models = buildStationModels(room);

    const env = models.climate.latest;
    const climateText = env ? `${fmtTemp(resolvedTempF(env), tempUnit(), 0)} / ${rnd(reading(env.humidity), 0) ?? "—"}%` : "log";
    const feed = models.feed.latest;
    const feedText = feed ? `pH ${rnd(reading(feed.ph), 1) ?? "—"}` : "log";
    const med = models.root.latest;
    const moisture = med ? reading(med.moisture) : NaN;
    const rootText = Number.isFinite(moisture) ? `${rnd(moisture, 0)}%` : "log";
    const sel = (key) => (stateRef.activeStation === key ? " sel" : "");

    // plant scene (to-scale against tent height)
    const vstage = vizStage(room.stage);
    const latestHealth = latestOfType(room.id, "health");
    const loggedHeight = latestHealth ? reading(latestHealth.heightIn) : NaN;
    const plantCount = effectivePlantCount(room);
    const scene = growSceneModel(room, lights, vstage, loggedHeight, setpoint, latestOfType(room.id, "light"), formatSmallLength, {
      selStation: stateRef.activeStation,
      fanSpeed,
      hasFan: !!profile.fanCapacityCfm,
      stageLabel: room.stage || "",
      rootText,
      moisturePct: moisture,
      metric: metricUnits(),
      arrange: !!stateRef.lampArrange,
      arrangeFrom: stateRef.arrangeFrom ?? null
    });

    // selected station
    const station = ROOM_STATIONS.find((s) => s.key === stateRef.activeStation);
    const model = models[station.key];
    const detailRows = model.rows.map((row) => `<tr><td>${escapeHtml(row.label)}${helpHtml(row.label)}</td><td>${escapeHtml(row.target)}</td><td class="now">${escapeHtml(row.current)}</td><td><span class="dot ${PILL[row.status]}"></span>${escapeHtml(row.advice)}</td></tr>`).join("");

    // inline log form
    const firstBatch = state.batches.find((b) => b.roomId === room.id);
    const activeBatch = state.batches
      .filter((b) => b.roomId === room.id && b.stage !== "Complete")
      .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))[0];
    const activeTiming = activeBatch ? batchTiming(activeBatch) : null;
    const prefill = { roomId: room.id, batchId: firstBatch ? firstBatch.id : "" };
    if (station.type === "light") {
      if (lights.activeKelvin) prefill.colorTempK = String(lights.activeKelvin);
      if (feedTargets(room, stageKey, state.settings).photoperiod) prefill.photoperiod = String(feedTargets(room, stageKey, state.settings).photoperiod);
      if (scene.gapToCanopyIn) prefill.canopyDistance = String(scene.gapToCanopyIn);
    }
    const formFields = logTypes[station.type].fields.filter(([n]) => n !== "roomId");
    const formMarkup = [];
    for (let i = 0; i < formFields.length; i += 2) {
      formMarkup.push(`<div class="form-row">${formFields.slice(i, i + 2).map((f) => fieldHtml(f, prefill[f[0]] ?? "")).join("")}</div>`);
    }

    // recent logs (station type) for this room
    const recent = roomLogs(room.id).filter((l) => l.type === station.type).slice(0, 6);
    const recentHtml = recent.length
      ? recent.map((l) => `<li><span class="log-time">${prettyDate(l.createdAt)}</span><span class="log-meas">${escapeHtml(measurements(l) || l.notes || "logged")}</span><button class="icon-button" data-delete-log="${l.id}" title="Delete" type="button">×</button></li>`).join("")
      : '<li class="muted">No readings logged yet.</li>';

    const suggestions = roomSuggestions(room, guide, lights, profile, setpoint, fanSpeed, models.lights.latest, stageKey);
    const trainingPanel = renderTrainingGuidance(stageKey, activeTiming);
    const logRailHtml = renderRoomLogRail(room.id);

    // in-tent climate monitor (control unit) — live readout of the latest env log
    const MON_LABELS = { "Air temp": "TEMP", "Humidity": "RH", "CO2": "CO2", "VPD": "VPD" };
    const monitorHtml = `<button class="tent-monitor${sel("climate")}" data-station="climate" type="button" title="Latest climate reading — click to open Climate station">
      ${models.climate.rows.map((row) => `<span class="mon-cell"><small>${MON_LABELS[row.label] || escapeHtml(row.label)}</small><b class="${PILL[row.status]}">${escapeHtml(row.current)}</b></span>`).join("")}
      <span class="mon-led ${worstClass(models.climate.rows)}"></span>
    </button>`;

    dom.roomView.innerHTML = `
      <div class="room-top">
        <button class="back-button" data-view="rooms" type="button">‹ Rooms</button>
        <div class="room-title">
          <h1>${escapeHtml(room.name)}</h1>
          <label class="inline-stage">Stage
            <select data-room-stage data-room="${room.id}">${options(stages, room.stage)}</select>
          </label>
        </div>
        <div class="room-top-right">
          <span class="score-badge ${scoreClass(guide.score)}">${guide.score === null ? "—" : `${guide.score}% on target`}</span>
          <button class="ghost-button" data-edit-room="${room.id}" type="button">Edit room</button>
        </div>
      </div>

      <div class="room-layout">
        <div class="room-hero">
          <section class="room-stage-col">
            <div class="room-viz tent ${lights.onCount ? "lights-on" : "lights-off"}" style="aspect-ratio:${scene.aspect}; --light-color-rgb:${scene.tint}; --fan-speed-pct:${fanSpeed}%; --wind-duration:${fanSpeed > 0 ? (6.5 - (fanSpeed / 100) * 5.0).toFixed(2) : 0}s;">
              ${scene.svg}
              <div class="tent-particles">
                <span class="particle p1"></span>
                <span class="particle p2"></span>
                <span class="particle p3"></span>
                <span class="particle p4"></span>
                <span class="particle p5"></span>
                <span class="particle p6"></span>
                <span class="particle p7"></span>
                <span class="particle p8"></span>
              </div>
              ${monitorHtml}
              <span class="plant-zone-tag">${plantCount} plant${plantCount === 1 ? "" : "s"} · ${escapeHtml(vstage)} · ${escapeHtml(scene.potText)} pots${scene.plantHIn ? ` · ${formatSmallLength(scene.plantHIn)} tall` : ""}</span>
            </div>

            <div class="panel">
              <div class="panel-head"><h4>Lighting</h4><span class="chip">${lights.onCount}/${lights.total} on · ${lights.activeWatts || 0}W · ${lights.activeKelvin || "—"}K</span></div>
              ${scene.lampSuggest ? `<div class="fan-suggest">
                <div class="fan-suggest-head"><b>Target PPFD${scene.lampSuggest.ppfdText ? ` · ${scene.lampSuggest.ppfdText} µmol/m²/s` : ""}</b><span class="chip ${scene.auto ? "ok" : "warn"}">${scene.auto ? "auto" : "manual"}</span></div>
                <span class="muted small">${escapeHtml(vstage.charAt(0).toUpperCase() + vstage.slice(1))} target for this stage (edit ranges in Settings). The lamp ${scene.auto ? `auto-follows it — now <b>${formatSmallLength(scene.gapToCanopyIn)}</b> above canopy and rises as the plant grows.` : `is set manually to <b>${formatSmallLength(scene.gapToCanopyIn)}</b> above canopy.`}</span>
                ${!scene.auto ? `<div class="fan-suggest-head"><span class="muted small">PPFD-suggested canopy distance: ${formatSmallLength(scene.lampSuggest.gapIn)}</span><button class="mini-button" data-lamp-auto="${room.id}" type="button">Auto-follow</button></div>` : ""}
                ${scene.lampSuggest.advice ? `<ul class="rec-list"><li>${escapeHtml(scene.lampSuggest.advice)}</li></ul>` : ""}
              </div>` : ""}
              <div class="chip-row">
                <button class="mini-button" data-arrange-lights="${room.id}" type="button">${stateRef.lampArrange ? "Done arranging" : "Arrange lights"}</button>
                ${stateRef.lampArrange ? '<span class="chip warn">click two floodlights to swap their places</span>' : ""}
              </div>
              <p class="muted small">Floodlights sit in a square grid with 120° beams — their lit footprint on the canopy follows the hang height. Drag the ⇕ handle to set light-to-canopy distance; click a light to switch it on/off, or use Arrange to mix warm/cool placement. Plant size is set only by the height you log in Plant health.</p>
            </div>
          </section>

          <section class="room-log-col">
            <div class="station-tabs">
              ${ROOM_STATIONS.map((s) => `<button class="station-tab${s.key === stateRef.activeStation ? " active" : ""}" data-station="${s.key}" type="button"><span class="dot ${worstClass(models[s.key].rows)}"></span><b>${s.label}</b><small>${escapeHtml(models[s.key].rows[0].current)}</small></button>`).join("")}
            </div>

            <div class="panel">
              <div class="panel-head"><h4>${escapeHtml(station.label)}</h4><span class="muted small">${model.latest ? prettyDate(model.latest.createdAt) : "no reading"}</span></div>
              <table class="data-table"><thead><tr><th>Reading</th><th>Target</th><th>Now</th><th>Status</th></tr></thead><tbody>${detailRows}</tbody></table>
            </div>

            <form class="panel log-form" id="roomLogForm" data-room="${room.id}" action="javascript:void(0)">
              <div class="panel-head">
                <h4>Log ${escapeHtml(station.label)}</h4>
                <span class="log-tag log-${station.key}">${escapeHtml(station.label)}</span>
              </div>
              <input type="hidden" name="type" value="${station.type}" />
              <input type="hidden" name="roomId" value="${room.id}" />
              ${formMarkup.join("")}
              <label>Notes<input name="notes" placeholder="optional" /></label>
              <button class="primary-button" type="button" data-save-form="roomLogForm">Save reading</button>
            </form>
          </section>
        </div>

        <div class="room-cards">
          <div class="panel">
            <div class="panel-head"><h4>Ventilation</h4><span class="chip">target <b id="fanRecommended">${profile.recommendedFanSpeed ? `${profile.recommendedFanSpeed.toFixed(0)}%` : "—"}</b></span></div>
            ${ventilationBody(room, profile)}
            <input class="slider" type="range" min="0" max="100" step="5" value="${fanSpeed}" data-fan-speed data-room="${room.id}" />
            <div class="chip-row"><span class="chip">speed <b id="fanCurrent">${fanSpeed}%</b></span><span class="chip">airflow <b id="fanChanges">${profile.actualAirChanges ? `${profile.actualAirChanges.toFixed(2)}/min` : "—"}</b></span></div>
            ${fanSuggestionHtml(room, env, setpoint, fanSpeed)}
          </div>

          ${renderBatchTimingPanel(room)}

          ${renderRoomPlantsPanel(room)}

          ${renderPlaybookPanel(room)}

          ${renderTrendsPanel(room, setpoint, stageKey)}

          ${renderFlipPlanner(room, stageKey)}

          ${trainingPanel}

          ${suggestions.length ? `<div class="panel"><div class="panel-head"><h4>Recommendations</h4></div><ul class="rec-list">${suggestions.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul></div>` : ""}

          ${logRailHtml}
        </div>
      </div>`;
  }

  // Suggests when to flip to flower so the post-flip stretch fits the tent.
  function renderFlipPlanner(room, stageKey) {
    if (!["seedling", "propagation", "vegetative"].includes(stageKey)) return "";
    if (!reading(room.heightM)) return "";
    const latestHealth = latestOfType(room.id, "health");
    const curIn = latestHealth ? reading(latestHealth.heightIn) : NaN;
    const curCm = Number.isFinite(curIn) ? curIn * 2.54 : NaN;
    const plan = flipPlan(room, curCm);
    if (!plan) return "";
    const fmtCm = (cm) => formatSmallLength(cm / 2.54); // formatSmallLength takes inches
    const sfPct = Math.round(plan.sf * 100);
    const trainLabel = { none: "no training", scrog: "ScrOG", lst: "LST/topping" }[room.training || "none"] || "no training";
    let chip = "";
    let chipText = "keep vegging";
    let msg = "";
    if (plan.level === "nodata") {
      chip = "warn"; chipText = "log height";
      msg = `Log a plant height in the Plant-health station to get flip timing. With ~${fmtCm(plan.usableCm)} of usable height at ${sfPct}% stretch, the recommended flip height is about ${fmtCm(plan.flipHeightCm)}.`;
    } else if (plan.level === "late") {
      chip = "bad"; chipText = "flip overdue";
      msg = `At ${sfPct}% stretch, ${fmtCm(plan.currentCm)} would finish ~${fmtCm(plan.projectedFinalCm)} — over your ~${fmtCm(plan.usableCm)} usable height. Flip ASAP, or super-crop / train hard to hold it off the lamp.`;
    } else if (plan.level === "flip") {
      chip = "ok"; chipText = "flip now";
      msg = `Flip now — at ${sfPct}% stretch, ${fmtCm(plan.currentCm)} should finish ~${fmtCm(plan.projectedFinalCm)}, filling your ~${fmtCm(plan.usableCm)} usable height.`;
    } else if (plan.level === "soon") {
      chip = "warn"; chipText = "almost";
      msg = `Almost — flip around ${fmtCm(plan.flipHeightCm)} (${fmtCm(plan.flipHeightCm - plan.currentCm)} to go). Now ${fmtCm(plan.currentCm)}.`;
    } else {
      msg = `Keep vegging — flip around ${fmtCm(plan.flipHeightCm)} (${fmtCm(plan.flipHeightCm - plan.currentCm)} to go). Now ${fmtCm(plan.currentCm)}.`;
    }
    const rows = [
      ["Usable height", fmtCm(plan.usableCm), "tent − pot − lamp gap"],
      ["Flip at", fmtCm(plan.flipHeightCm), `${sfPct}% stretch · ${trainLabel}`],
      ["Plant now", Number.isFinite(plan.currentCm) ? fmtCm(plan.currentCm) : "—", "latest logged height"],
      ["Projected final", Number.isFinite(plan.projectedFinalCm) ? fmtCm(plan.projectedFinalCm) : "—", "after the flower stretch"]
    ];
    return `<div class="panel">
      <div class="panel-head"><h4>Flip planner</h4><span class="chip ${chip}">${escapeHtml(chipText)}</span></div>
      <table class="data-table"><tbody>${rows.map((r) => `<tr><td>${escapeHtml(r[0])}</td><td class="now">${escapeHtml(r[1])}</td><td class="muted small">${escapeHtml(r[2])}</td></tr>`).join("")}</tbody></table>
      <p class="muted small">${escapeHtml(msg)}${room.training === "scrog" ? " With a ScrOG, also flip when the screen is ~60-80% filled — the net spreads the stretch sideways." : ""}</p>
    </div>`;
  }

  function renderTrainingGuidance(stageKey, timing) {
    const day = timing?.day || null;
    const week = timing?.week || null;
    const flowerStretch = stageKey === "flower" && (!day || day <= 21);
    if (!["vegetative", "flower"].includes(stageKey)) return "";

    const items = stageKey === "vegetative"
      ? [
          "Build a flat, symmetrical plant before the screen: top once to split the main cola, then train the main arms outward.",
          "Keep the screen low, no more than about 8 in / 20 cm above the medium or plant base, so lower growth can be brought into the canopy.",
          "Use LST ties or soft anchors to spread 4 main arms evenly; stop topping and give the plant about a week before switching to 12/12."
        ]
      : flowerStretch
        ? [
            `Stretch window${day ? `: Flower day ${day}` : ""}. Keep tucking arms under the net and move each branch one square at a time.`,
            "Let a shoot rise 2-3 in above the screen, then gently pull it back under and guide it to the next empty square.",
            "Keep filling empty screen space until about 2-3 weeks into flower; after stretch, aim for an even layer of 6-8 in bud sites above the screen."
          ]
        : [
            `Flower canopy${week ? `: Week ${week}` : ""}. Main SCROG work should be mostly finished after stretch.`,
            "Hold the canopy even, avoid forcing hardened stems, and keep lower shaded growth cleaned up so airflow stays strong.",
            "Use the net as support for heavy colas now; focus on stable DLI, VPD, runoff EC/pH, and mold prevention."
          ];

    const stageLabel = stageKey === "vegetative" ? "Veg SCROG setup" : flowerStretch ? "Flower stretch tucking" : "Post-stretch canopy";
    return `<div class="panel training-panel">
      <div class="panel-head"><h4>Training guidance</h4><span class="chip ok">${stageLabel}</span></div>
      <div class="training-grid">
        <div class="training-card"><b>SCROG target</b><span>Wide, level canopy under the light footprint. Avoid one tall center cola.</span></div>
        <div class="training-card"><b>Screen height</b><span>Low net, about 8 in / 20 cm max above the medium/base.</span></div>
        <div class="training-card"><b>Method</b><span>Top, bend, tie, and tuck slowly. Do not let the screen become only skeletal support.</span></div>
      </div>
      <ul class="rec-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>`;
  }

  function roomSuggestions(room, guide, lights, profile, setpoint, fanSpeed, latestLight, stageKey) {
    const tips = [];
    const byLabel = Object.fromEntries(guide.rows.map((row) => [row.label, row]));
    const temp = byLabel["Air temp"];
    const rh = byLabel["Humidity (RH)"];
    if (temp?.status === "high") tips.push(`Air temp above target (${temp.current}). Raise fan${lights.onCount > 1 ? " or switch off a fixture" : ""}.`);
    else if (temp?.status === "low") tips.push(`Air temp below target (${temp.current}). Lower fan or add heat.`);
    if (rh?.status === "high") tips.push(`Humidity above target (${rh.current}). Increase exhaust or dehumidify.`);
    else if (rh?.status === "low") tips.push(`Humidity below target (${rh.current}). Reduce exhaust or add humidity.`);
    if (profile.recommendedFanSpeed && fanSpeed < profile.recommendedFanSpeed * 0.85) tips.push(`Fan below the ~${profile.recommendedFanSpeed.toFixed(0)}% needed for ${profile.targetAirChanges} air changes/min.`);
    if (!lights.onCount && lights.total) tips.push("All fixtures are off — switch one on if this room is in a lit stage.");
    const actualPhoto = latestLight ? reading(latestLight.photoperiod) : NaN;
    const expectedPhoto = feedTargets(room, stageKey, stateRef.state.settings).photoperiod;
    const dliTarget = dliTargetForStage(stageKey, Number.isFinite(actualPhoto) ? actualPhoto : expectedPhoto);
    const dli = lightDliReading(latestLight);
    if (dliTarget && Number.isFinite(dli)) {
      if (dli < dliTarget.min) {
        tips.push(`DLI is low (${rnd(dli, 1)} mol/m2/d). At ${rnd(dliTarget.photoperiod, 1)}h, target ${rnd(dliTarget.min, 1)}-${rnd(dliTarget.max, 1)} by raising PPFD toward ${dliTarget.ppfdMin}-${dliTarget.ppfdMax}.`);
      } else if (dli > dliTarget.max) {
        tips.push(`DLI is high (${rnd(dli, 1)} mol/m2/d). At ${rnd(dliTarget.photoperiod, 1)}h, target ${rnd(dliTarget.min, 1)}-${rnd(dliTarget.max, 1)} by lowering PPFD, dimming, or raising the fixture.`);
      }
    } else if (latestLight && Number.isFinite(reading(latestLight.ppfd)) && !Number.isFinite(reading(latestLight.photoperiod))) {
      tips.push("Log photoperiod with PPFD so the app can calculate DLI automatically.");
    }
    return tips;
  }

  const DUCT_LABELS = {
    none: "open / no ducting",
    short: "short & straight",
    typical: "typical (a few bends)",
    long: "long / several bends"
  };

  const ENCLOSURE_LABELS = {
    tent: "thin tent / Mylar",
    wood: "wood / plywood box",
    insulated: "insulated walls"
  };

  // Heat-load + filter/ducting breakdown for the Ventilation panel.
  function ventilationBody(room, profile) {
    if (!profile.volumeFt3) return '<p class="muted small">Add room length, width, and height to size the fan.</p>';

    const ductLabel = DUCT_LABELS[room.ductingSetup] || "typical";
    const encLabel = ENCLOSURE_LABELS[room.enclosureType] || "tent";
    const wattsLine = profile.totalWatts
      ? `${profile.activeWatts.toFixed(0)} W of light on${profile.activeWatts < profile.totalWatts ? ` (of ${profile.totalWatts} W installed)` : ""}`
      : "no light wattage set";
    const heatLine = !profile.totalWatts
      ? "Add watts per light (Edit room) to include the LED heat load."
      : profile.heatingRegime
      ? `Heating regime — your room (${fmtTemp(profile.ambientTempF, tempUnit(), 0)}) is below the ${fmtTemp(profile.targetTempF, tempUnit(), 0)} target, so the ${profile.heatBtuPerHr.toFixed(0)} BTU/hr from the lights warms the tent toward target. The ${escapeHtml(encLabel)} walls shed the surplus, so the fan only needs the fresh-air/humidity minimum — don't over-exhaust or you blow away the heat and dry the tent.`
      : profile.coolingImpossible
      ? `Lights on now: ${profile.heatBtuPerHr.toFixed(0)} BTU/hr of heat. Intake air (${fmtTemp(profile.ambientTempF, tempUnit(), 0)}) is at/above the ${fmtTemp(profile.targetTempF, tempUnit(), 0)} target, so exhaust alone can't cool — cool the room or add active cooling.`
      : `Cooling regime — lights add ${profile.heatBtuPerHr.toFixed(0)} BTU/hr. To hold ≤${fmtTemp(profile.targetTempF, tempUnit(), 0)} with ${fmtTemp(profile.ambientTempF, tempUnit(), 0)} intake (ΔT ${tempDeltaToDisplay(profile.allowableRiseF, tempUnit(), 1)} ${tUnit()}), the fan must add ~${profile.heatCfm.toFixed(0)} CFM beyond what the walls shed.`;

    const regimeChip = !profile.totalWatts
      ? ""
      : profile.heatingRegime
      ? '<span class="chip ok">heating — lights warming</span>'
      : profile.coolingImpossible
      ? '<span class="chip bad">intake too warm to cool</span>'
      : '<span class="chip warn">cooling — venting heat</span>';

    const fC = (c) => fmtTemp(c * 1.8 + 32, tempUnit(), 1);
    // a temperature DIFFERENCE given in °C, shown in the chosen unit
    const riseDisp = (c) => (tempUnit() === "F" ? c * 1.8 : c).toFixed(1);
    const prediction = profile.totalWatts
      ? `<div class="vent-predict">
          <div class="panel-head"><h4>Heat prediction</h4><span class="muted small">${escapeHtml(wattsLine)} · ${escapeHtml(encLabel)}</span></div>
          <div class="vent-scenarios">
            <div class="vent-scenario">
              <span>Fan off (sealed)</span><b>+${riseDisp(profile.passiveRiseC)} ${tUnit()}</b><small>settles ~${fC(profile.passiveTempC)}</small>
            </div>
            <div class="vent-scenario${!profile.predictedHot ? " active" : ""}">
              <span>Fan at ${profile.fanSpeed.toFixed(0)}%</span><b>+${riseDisp(profile.ventedRiseC)} ${tUnit()}</b><small>settles ~${fC(profile.ventedTempC)}</small>
            </div>
          </div>
          <p class="muted small">Steady-state estimate from light heat, ${escapeHtml(encLabel)} wall loss, and current airflow — it moves the moment you switch lights on/off. ${profile.sealedRateCPerHr > 0 ? `If the fan fails, bare air climbs ~${riseDisp(profile.sealedRateCPerHr)} ${tUnit()}/hr at first (thermal mass slows this).` : ""}</p>
          ${profile.densityRatio < 0.999 && profile.heatLimited ? `<p class="muted small">Altitude ${profile.elevationM.toFixed(0)} m: air is ~${((1 - profile.densityRatio) * 100).toFixed(0)}% thinner (heat factor ${profile.heatConstant.toFixed(2)} vs 1.08 at sea level), so heat removal needs proportionally more CFM — already in the targets above.</p>` : ""}
        </div>`
      : "";

    const needChip = `<span class="chip ${profile.heatLimited ? "warn" : ""}">need ≈ ${profile.requiredCfm.toFixed(0)} CFM${profile.totalWatts ? (profile.heatLimited ? " · cooling-limited" : " · fresh-air-limited") : ""}</span>${regimeChip}`;

    const cfmAt = (speed, derate) => (profile.fanCapacityCfm * (speed / 100) * derate).toFixed(0);
    const scenarios = profile.fanCapacityCfm
      ? `<div class="vent-scenarios">
          <div class="vent-scenario${!profile.filterOn ? " active" : ""}">
            <span>No filter</span><b>${profile.speedNoFilter.toFixed(0)}%</b><small>≈ ${cfmAt(profile.speedNoFilter, profile.derateNoFilter)} CFM</small>
          </div>
          <div class="vent-scenario${profile.filterOn ? " active" : ""}">
            <span>Carbon filter</span><b>${profile.speedWithFilter.toFixed(0)}%</b><small>≈ ${cfmAt(profile.speedWithFilter, profile.derateWithFilter)} CFM</small>
          </div>
        </div>
        <div class="chip-row vent-controls">
          <button class="mini-button${profile.filterOn ? " active" : ""}" data-toggle-filter="${room.id}" type="button">${profile.filterOn ? "● Carbon filter ON" : "○ Carbon filter off"}</button>
          <span class="chip">ducting: ${escapeHtml(ductLabel)}</span>
          ${profile.undersized ? '<span class="chip bad">fan undersized for this config</span>' : ""}
        </div>`
      : '<p class="muted small">Add fan capacity (CFM) in Edit room to get a speed target.</p>';

    return `
      <p class="muted small">Tent ${profile.volumeM3.toFixed(2)} m³ (${profile.volumeFt3.toFixed(0)} ft³). Air-exchange needs ${profile.exchangeCfm.toFixed(0)} CFM (${profile.targetAirChanges}/min). ${heatLine}</p>
      <div class="chip-row">${needChip}</div>
      ${profile.coolingImpossible ? `<p class="muted small"><span class="chip bad">no exhaust cooling</span> Intake air is at/above your tent target — exhaust moves heat out but can't pull the tent below the air feeding it. Cool the room the tent sits in, or add active cooling.</p>` : ""}
      ${prediction}
      ${scenarios}
      <p class="muted small">Targets pick the larger of heat-removal and air-exchange, then add back what a carbon filter (~25%) and ${escapeHtml(ductLabel)} ducting take away. Switch the filter on for flower; set ducting in Edit room.</p>`;
  }

  function fanSuggestionHtml(room, env, setpoint, fanSpeed) {
    const fan = fanSuggestion(room, env, setpoint);
    if (!fan) return "";
    const off = Math.abs(fan.speed - fanSpeed) >= 5;
    return `<div class="fan-suggest">
      <div class="fan-suggest-head"><b>Set controller to ≈ ${fan.speed}%</b>${off ? `<button class="mini-button" data-apply-fan data-room="${room.id}" data-speed="${fan.speed}" type="button">Apply</button>` : '<span class="chip ok">matches</span>'}</div>
      <span class="muted small">≈ ${Math.round(fan.cfm)} CFM, ${fan.airChanges.toFixed(2)} changes/min${fan.oversized ? " · fan is oversized — a controller stops it drying the tent" : ""}.</span>
      ${fan.reasons.length ? `<ul class="rec-list">${fan.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>` : ""}
    </div>`;
  }

  // --- batches -------------------------------------------------------------

  function renderBatches() {
    const batches = stateRef.state.batches;
    const rows = batches.length
      ? batches.map((b) => {
          const timing = batchTiming(b);
          return `<tr><td><b>${escapeHtml(b.name)}</b><br><span class="muted small">${escapeHtml(b.licenseLot || "")}</span></td><td>${escapeHtml(b.cultivar || "")}</td><td><span class="stage-pill">${escapeHtml(b.stage || "")}</span></td><td>${timing ? `${escapeHtml(timing.stageLabel)} Day ${timing.day}<br><span class="muted small">Week ${timing.week} from ${escapeHtml(timing.stageStartDate || "")}</span>` : "-"}</td><td>${escapeHtml(b.count || "0")}</td><td>${escapeHtml(names.room(b.roomId))}</td><td class="row-actions"><button class="mini-button" data-edit-batch="${b.id}" type="button">Edit</button><button class="mini-button danger" data-delete="batches" data-id="${b.id}" type="button">Delete</button></td></tr>`;
        }).join("")
      : '<tr><td colspan="7" class="muted">No batches yet.</td></tr>';
    dom.batchesView.innerHTML = `
      <div class="page-head"><div><h1>Batches</h1><p class="muted">Registry of lots/runs. Day-to-day management lives in the room view — start new runs with ▶ Start a grow on the Rooms page.</p></div></div>
      <div class="split">
        <form class="panel" id="batchForm" action="javascript:void(0)">
          <div class="panel-head"><h4>Add / edit batch</h4></div>
          <input type="hidden" name="id" />
          <label>Batch name<input name="name" required placeholder="LOT-2026-001" /></label>
          <div class="form-row"><label>Cultivar<input name="cultivar" /></label><label>License lot<input name="licenseLot" /></label></div>
          <div class="form-row"><label>Stage<select name="stage">${options(stages)}</select></label><label>Room<select name="roomId">${roomOptions()}</select></label></div>
          <div class="form-row"><label>Start date<input name="startDate" type="date" value="${todayInputValue()}" /></label><label>Plant count<input name="count" type="number" value="0" /></label></div>
          <label>Notes<input name="notes" /></label>
          <button class="primary-button" type="button" data-save-form="batchForm">Save batch</button>
        </form>
        <div class="panel">
          <div class="panel-head"><h4>All batches</h4><span class="muted small">${batches.length}</span></div>
          <table class="data-table"><thead><tr><th>Batch</th><th>Cultivar</th><th>Stage</th><th>Timing</th><th>Count</th><th>Room</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        </div>
      </div>`;
  }

  // --- plants ----------------------------------------------------------------

  const PLANT_STATUS_CHIP = { Active: "ok", Quarantined: "warn", Harvested: "info", Destroyed: "bad", Transferred: "" };

  function plantLogCounts(plantId) {
    let health = 0, harvest = 0;
    stateRef.state.logs.forEach((log) => {
      if (log.plantId !== plantId) return;
      if (log.type === "health") health += 1;
      if (log.type === "harvest") harvest += 1;
    });
    return { health, harvest };
  }

  function renderPlants() {
    const plants = [...stateRef.state.plants].sort((a, b) => {
      const rank = { Active: 0, Quarantined: 1 };
      return (rank[a.status] ?? 2) - (rank[b.status] ?? 2) || String(a.tag).localeCompare(String(b.tag));
    });
    const activeN = plants.filter((p) => p.status === "Active").length;
    const quarantinedN = plants.filter((p) => p.status === "Quarantined").length;

    const rows = plants.length
      ? plants.map((p) => {
          const counts = plantLogCounts(p.id);
          const lastMove = Array.isArray(p.statusHistory) && p.statusHistory.length
            ? p.statusHistory[p.statusHistory.length - 1]
            : null;
          const statusSel = `<select class="plant-status-select" data-plant-status="${p.id}">${options(plantStatuses, p.status || "Active")}</select>`;
          return `<tr>
            <td><b>${escapeHtml(p.tag || "untagged")}</b>${p.strain ? `<br><span class="muted small">${escapeHtml(p.strain)}</span>` : ""}</td>
            <td>${escapeHtml(names.batch(p.batchId))}<br><span class="muted small">${escapeHtml(names.room(p.roomId))}</span></td>
            <td><span class="chip ${PLANT_STATUS_CHIP[p.status] || ""}">${escapeHtml(p.status || "Active")}</span>${lastMove ? `<br><span class="muted small">since ${escapeHtml(lastMove.date || "")}</span>` : ""}</td>
            <td>${statusSel}</td>
            <td>${counts.health} health${counts.harvest ? ` · ${counts.harvest} harvest` : ""}</td>
            <td class="row-actions"><button class="mini-button" data-edit-plant="${p.id}" type="button">Edit</button><button class="mini-button danger" data-delete="plants" data-id="${p.id}" type="button">Delete</button></td>
          </tr>`;
        }).join("")
      : '<tr><td colspan="6" class="muted">No plants registered yet. Tag your plants to track them individually through health checks and harvest.</td></tr>';

    dom.plantsView.innerHTML = `
      <div class="page-head"><div><h1>Plants</h1><p class="muted">Tag-level registry for lookups and lifecycle records. Everyday status changes are quicker in the room view&#39;s Plants panel.</p></div></div>
      <div class="dashboard-grid plants-stats">
        <div class="metric-card"><span>Registered</span><b>${plants.length}</b><small>plants on record</small></div>
        <div class="metric-card ${quarantinedN ? "bad" : "ok"}"><span>Quarantined</span><b>${quarantinedN}</b><small>${quarantinedN ? "isolated — inspect before release" : "none isolated"}</small></div>
        <div class="metric-card"><span>Active</span><b>${activeN}</b><small>in production</small></div>
      </div>
      <div class="split">
        <form class="panel" id="plantForm" action="javascript:void(0)">
          <div class="panel-head"><h4>Add / edit plant</h4></div>
          <input type="hidden" name="id" />
          <div class="form-row"><label>Plant tag<input name="tag" required placeholder="P-001 or state tag ID" /></label><label>Strain / cultivar<input name="strain" /></label></div>
          <div class="form-row"><label>Batch<select name="batchId">${batchOptions()}</select></label><label>Room<select name="roomId">${roomOptions()}</select></label></div>
          <div class="form-row"><label>Status<select name="status">${options(plantStatuses, "Active")}</select></label><label>Planted date<input name="plantedDate" type="date" value="${todayInputValue()}" /></label></div>
          <div class="form-row"><label>Copies (bulk add)<input name="copies" type="number" min="1" step="1" value="1" /></label><span class="form-hint">Copies &gt; 1 creates numbered tags (P-001-1, P-001-2, …) with the same batch/room — quick registry for a whole batch.</span></div>
          <label>Notes<input name="notes" /></label>
          <button class="primary-button" type="button" data-save-form="plantForm">Save plant</button>
        </form>
        <div class="panel">
          <div class="panel-head"><h4>All plants</h4><span class="muted small">${plants.length}</span></div>
          <table class="data-table"><thead><tr><th>Tag</th><th>Batch / Room</th><th>Status</th><th>Move to</th><th>Logs</th><th></th></tr></thead><tbody>${rows}</tbody></table>
          <p class="muted small">Changing status records the date (quarantine isolation, harvest, destruction, transfer — the usual seed-to-sale lifecycle). Harvest logs tied to a plant mark it Harvested automatically.</p>
        </div>
      </div>`;
  }

  // --- diagnose --------------------------------------------------------------

  const { SYMPTOMS, CATEGORIES, leafSvg, rankForRoom, IMG_DIR, HI_DIR, HI_RES, getDetailedGuide } = window.AppDiagnose;
  const DX_CAT_CLASS = { Deficiency: "warn", "Toxicity / Burn": "warn", "pH / Lockout": "bad", Environment: "info", Watering: "info", Pest: "bad", Disease: "bad", "Stress / Other": "warn" };

  // Real reference photo (local) layered over the drawn fallback; if the file
  // is missing or a symptom has no photo, the SVG leaf shows through.
  function dxPhoto(file, alt) {
    return `<img class="dx-photo" src="${IMG_DIR}${encodeURIComponent(file)}" alt="${escapeHtml(alt)}" loading="lazy" onerror="this.classList.add('missing')" />`;
  }
  function dxCountBadge(s) {
    const n = (s.imgs || []).length;
    return n > 1 ? `<span class="dx-count">📷 ${n}</span>` : "";
  }
  // One image tile: a specific photo (or the symptom's lead) layered over the
  // drawn SVG fallback.
  function dxImage(s, file) {
    const imgs = s.imgs || [];
    const pick = file || imgs[0];
    return `<div class="dx-thumb">${leafSvg(s.viz)}${pick ? dxPhoto(pick, s.name) : ""}</div>`;
  }

  function renderDiagnose() {
    const dx = stateRef.diagnose || (stateRef.diagnose = { q: "", cat: "", roomId: "", open: null });
    // room context for log-aware ranking
    const rooms = stateRef.state.rooms;
    if (dx.roomId && !rooms.some((r) => r.id === dx.roomId)) dx.roomId = "";
    const room = dx.roomId ? findRoom(dx.roomId) : null;
    const ranked = room ? rankForRoom(room, stateRef.state) : null;

    const q = (dx.q || "").trim().toLowerCase();
    let list = SYMPTOMS.filter((s) => {
      if (dx.cat && s.category !== dx.cat) return false;
      if (!q) return true;
      return [s.name, s.category, s.location, s.looks, s.cause].join(" ").toLowerCase().includes(q);
    });
    if (ranked) {
      list = [...list].sort((a, b) => (ranked.scores[b.slug] || 0) - (ranked.scores[a.slug] || 0) || a.name.localeCompare(b.name));
    } else {
      list = [...list].sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name));
    }

    const roomOpts = '<option value="">No room context</option>' + rooms.map((r) => `<option value="${r.id}"${dx.roomId === r.id ? " selected" : ""}>${escapeHtml(r.name)}</option>`).join("");
    const catChips = `<button class="dx-cat${dx.cat === "" ? " active" : ""}" data-dx-cat="" type="button">All</button>` +
      CATEGORIES.map((c) => `<button class="dx-cat${dx.cat === c ? " active" : ""}" data-dx-cat="${escapeHtml(c)}" type="button">${escapeHtml(c)}</button>`).join("");

    // context banner from the room's readings
    let contextBanner = "";
    if (ranked) {
      const f = ranked.flags;
      const notes = [];
      if (f.phLow) notes.push(`pH ${rnd(ranked.ph, 1)} is below ${ranked.phLo} — lockout & deficiencies more likely`);
      if (f.phHigh) notes.push(`pH ${rnd(ranked.ph, 1)} is above ${ranked.phHi} — iron/micro lockout more likely`);
      if (f.ecHigh) notes.push(`feed EC is high — nutrient burn/toxicity more likely`);
      if (f.ecLow) notes.push(`feed EC is low — underfeeding more likely`);
      if (f.hot) notes.push(`room is hot — heat stress & mites more likely`);
      if (f.cold) notes.push(`room is cold — purpling & P/Mg uptake issues`);
      if (f.humidHigh) notes.push(`humidity is high — mildew & bud rot more likely`);
      if (f.wet) notes.push(`medium is very wet — overwatering, gnats, root rot`);
      contextBanner = notes.length
        ? `<div class="banner dx-context">Using <b>${escapeHtml(room.name)}</b>'s latest readings: ${notes.map(escapeHtml).join(" · ")}. Likely matches are sorted to the top.</div>`
        : `<div class="banner dx-context">Using <b>${escapeHtml(room.name)}</b>'s readings — nothing out of range right now, so results are in normal order.</div>`;
    }

    const cards = list.length
      ? list.map((s) => {
          const score = ranked ? ranked.scores[s.slug] || 0 : 0;
          return `<button class="dx-card${score >= 3 ? " likely" : ""}" data-dx-open="${s.slug}" type="button">
            ${dxImage(s)}${dxCountBadge(s)}
            <div class="dx-card-body">
              <div class="dx-card-top"><b>${escapeHtml(s.name)}</b>${score >= 3 ? '<span class="chip bad">likely here</span>' : ""}</div>
              <span class="chip ${DX_CAT_CLASS[s.category] || ""}">${escapeHtml(s.category)}</span>
              <small class="muted">${escapeHtml(s.location)}</small>
              <p>${escapeHtml(s.looks)}</p>
            </div>
          </button>`;
        }).join("")
      : '<p class="muted">No symptoms match that search.</p>';

    dom.diagnoseView.innerHTML = `
      <div class="page-head"><div><h1>Diagnose</h1><p class="muted">Match what you see on the plant to a likely cause and fix. Pick a room to rank by its actual readings.</p></div></div>
      <div class="dx-controls">
        <input class="dx-search" id="dxSearch" placeholder="Search symptoms… (yellow, spots, curling, mites)" value="${escapeHtml(dx.q || "")}" />
        <select class="dx-room" data-dx-room>${roomOpts}</select>
      </div>
      <div class="dx-cats">${catChips}</div>
      ${contextBanner}
      <div class="dx-grid">${cards}</div>
      ${renderDiagnoseModal()}`;

    const search = document.getElementById("dxSearch");
    if (search) {
      search.oninput = () => { stateRef.diagnose.q = search.value; renderDiagnoseGrid(); };
    }
  }

  // lightweight re-render of just the grid on search (keeps focus in the box)
  function renderDiagnoseGrid() {
    const dx = stateRef.diagnose;
    const room = dx.roomId ? findRoom(dx.roomId) : null;
    const ranked = room ? rankForRoom(room, stateRef.state) : null;
    const q = (dx.q || "").trim().toLowerCase();
    let list = SYMPTOMS.filter((s) => {
      if (dx.cat && s.category !== dx.cat) return false;
      if (!q) return true;
      return [s.name, s.category, s.location, s.looks, s.cause].join(" ").toLowerCase().includes(q);
    });
    list = ranked
      ? [...list].sort((a, b) => (ranked.scores[b.slug] || 0) - (ranked.scores[a.slug] || 0) || a.name.localeCompare(b.name))
      : [...list].sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name));
    const grid = dom.diagnoseView.querySelector(".dx-grid");
    if (!grid) return;
    grid.innerHTML = list.length
      ? list.map((s) => {
          const score = ranked ? ranked.scores[s.slug] || 0 : 0;
          return `<button class="dx-card${score >= 3 ? " likely" : ""}" data-dx-open="${s.slug}" type="button">${dxImage(s)}${dxCountBadge(s)}<div class="dx-card-body"><div class="dx-card-top"><b>${escapeHtml(s.name)}</b>${score >= 3 ? '<span class="chip bad">likely here</span>' : ""}</div><span class="chip ${DX_CAT_CLASS[s.category] || ""}">${escapeHtml(s.category)}</span><small class="muted">${escapeHtml(s.location)}</small><p>${escapeHtml(s.looks)}</p></div></button>`;
        }).join("")
      : '<p class="muted">No symptoms match that search.</p>';
  }

  function renderDiagnoseModal() {
    const dx = stateRef.diagnose;
    if (!dx || !dx.open) return "";
    const s = SYMPTOMS.find((x) => x.slug === dx.open);
    if (!s) return "";
    const imgs = s.imgs || [];
    const idx = Math.min(dx.imgIdx || 0, Math.max(0, imgs.length - 1));
    const hero = imgs.length ? dxImage(s, imgs[idx]) : dxImage(s);
    const strip = imgs.length > 1
      ? `<div class="dx-strip">${imgs.map((f, i) => `<button class="dx-strip-thumb${i === idx ? " active" : ""}" data-dx-img="${i}" type="button"><img src="${IMG_DIR}${encodeURIComponent(f)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" /></button>`).join("")}</div>`
      : "";
    const counter = imgs.length > 1 ? `<span class="dx-img-count">${idx + 1} / ${imgs.length}</span>` : "";
    const heroZoom = imgs.length ? ` data-dx-zoom="${escapeHtml(imgs[idx])}" title="Click to view full size"` : "";
    const zoomHint = imgs.length ? '<span class="dx-zoom-hint">⤢ enlarge</span>' : "";
    // lightbox loads the full-resolution image; if a high-res file is missing
    // it falls back to the standard one. Shown at natural size (scrollable).
    const hiName = (HI_RES && HI_RES[dx.zoom]) || dx.zoom;
    const hiSrc = `${HI_DIR}${encodeURIComponent(hiName)}`;
    const smSrc = `${IMG_DIR}${encodeURIComponent(dx.zoom)}`;
    const lightbox = dx.zoom
      ? `<div class="dx-lightbox">
          <div class="dx-lightbox-backdrop" data-dx-zoom-close></div>
          <img class="dx-lightbox-img" src="${hiSrc}" data-fallback="${escapeHtml(smSrc)}" alt="${escapeHtml(s.name)}" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.removeAttribute('data-fallback');}" />
          <button class="dx-lightbox-close" data-dx-zoom-close type="button">×</button>
        </div>`
      : "";
    const detailedGuideHtml = getDetailedGuide(s.slug);
    const detailedSection = detailedGuideHtml
      ? `<div class="dx-section dx-detailed-guide">
          <hr class="dx-divider" />
          <b>Detailed Guide & Treatment</b>
          <div class="dx-guide-content">${detailedGuideHtml}</div>
         </div>`
      : "";
    return `<div class="modal-backdrop" data-dx-close></div>
      <div class="modal dx-modal" role="dialog" aria-modal="true">
        <button class="icon-button modal-x" data-dx-close type="button">×</button>
        <div class="dx-modal-hero"${heroZoom}>${hero}${counter}${zoomHint}</div>
        ${strip}
        <h2>${escapeHtml(s.name)}</h2>
        <div class="dx-modal-tags"><span class="chip ${DX_CAT_CLASS[s.category] || ""}">${escapeHtml(s.category)}</span><span class="chip">${escapeHtml(s.location)}</span></div>
        <div class="dx-section"><b>What it looks like</b><p>${escapeHtml(s.looks)}</p></div>
        <div class="dx-section"><b>Likely cause</b><p>${escapeHtml(s.cause)}</p></div>
        <div class="dx-section dx-fix"><b>What to do</b><p>${escapeHtml(s.fix)}</p></div>
        ${detailedSection}
      </div>${lightbox}`;
  }

  // --- tasks ---------------------------------------------------------------

  function renderTasks() {
    const tasks = [...stateRef.state.tasks].sort((a, b) => {
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return ad - bd;
    });
    const today = new Date(new Date().toDateString());
    const rows = tasks.length
      ? tasks.map((task) => {
          const overdue = task.status !== "Done" && task.dueDate && new Date(task.dueDate) < today;
          const priorityClass = task.priority === "Critical" || task.priority === "High" ? "bad" : task.priority === "Normal" ? "warn" : "ok";
          return `<tr${task.status === "Done" ? ' class="task-done"' : ""}>
            <td><label class="task-check"><input type="checkbox" data-toggle-task="${task.id}"${task.status === "Done" ? " checked" : ""} /><b>${escapeHtml(task.title || "Untitled task")}</b></label>${task.playbookKey ? ' <span class="chip">playbook</span>' : ""}${task.notes ? `<br><span class="muted small">${escapeHtml(task.notes)}</span>` : ""}</td>
            <td><span class="chip ${priorityClass}">${escapeHtml(task.priority || "Normal")}</span></td>
            <td>${escapeHtml(task.dueDate || "-")}${overdue ? ' <span class="chip bad">overdue</span>' : ""}</td>
            <td>${escapeHtml(task.status || "Open")}</td>
            <td>${escapeHtml(names.room(task.roomId))}<br><span class="muted small">${escapeHtml(names.batch(task.batchId))}</span></td>
            <td class="row-actions"><button class="mini-button" data-edit-task="${task.id}" type="button">Edit</button><button class="mini-button danger" data-delete="tasks" data-id="${task.id}" type="button">Delete</button></td>
          </tr>`;
        }).join("")
      : '<tr><td colspan="6" class="muted">No tasks yet.</td></tr>';

    dom.tasksView.innerHTML = `
      <div class="page-head"><div><h1>Tasks</h1><p class="muted">Work reminders that feed the home alert dashboard when overdue.</p></div></div>
      <div class="split">
        <form class="panel" id="taskForm" action="javascript:void(0)">
          <div class="panel-head"><h4>Add / edit task</h4></div>
          <input type="hidden" name="id" />
          <label>Task title<input name="title" required placeholder="Inspect trichomes" /></label>
          <div class="form-row"><label>Room<select name="roomId">${roomOptions()}</select></label><label>Batch<select name="batchId">${batchOptions()}</select></label></div>
          <div class="form-row"><label>Priority<select name="priority">${options(taskPriorities, "Normal")}</select></label><label>Status<select name="status">${options(["Open", "In progress", "Done"], "Open")}</select></label></div>
          <label>Due date<input name="dueDate" type="date" value="${todayInputValue()}" /></label>
          <label>Notes<input name="notes" /></label>
          <button class="primary-button" type="button" data-save-form="taskForm">Save task</button>
        </form>
        <div class="panel">
          <div class="panel-head"><h4>All tasks</h4><span class="muted small">${tasks.length}</span></div>
          <table class="data-table"><thead><tr><th>Task</th><th>Priority</th><th>Due</th><th>Status</th><th>Scope</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        </div>
      </div>`;
  }

  // --- harvest -------------------------------------------------------------

  function renderHarvest() {
    const harvests = stateRef.state.logs
      .filter((log) => log.type === "harvest")
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const harvestModels = harvests.map((log) => ({ log, metrics: harvestMetrics(log) }));
    const bestGpW = harvestModels
      .filter((item) => Number.isFinite(item.metrics.gramsPerWatt))
      .sort((a, b) => b.metrics.gramsPerWatt - a.metrics.gramsPerWatt)[0];
    const totalDry = harvestModels.reduce((sum, item) => sum + (Number.isFinite(item.metrics.dry) ? item.metrics.dry : 0), 0);
    const avgGpW = harvestModels.filter((item) => Number.isFinite(item.metrics.gramsPerWatt));
    const avgGpWValue = avgGpW.length ? avgGpW.reduce((sum, item) => sum + item.metrics.gramsPerWatt, 0) / avgGpW.length : NaN;
    const rows = harvestModels.length
      ? harvestModels.map(({ log, metrics }) => `<tr>
          <td><b>${escapeHtml(names.batch(log.batchId))}</b><br><span class="muted small">${log.plantId ? `plant ${escapeHtml(names.plant(log.plantId) || "?")}` : escapeHtml(metrics.batch?.cultivar || "")}</span></td>
          <td>${escapeHtml(metrics.room?.name || "Unassigned")}</td>
          <td>${formatNumber(reading(log.wetWeight), 0)}g</td>
          <td class="now">${formatNumber(metrics.dry, 0)}g</td>
          <td>${formatNumber(metrics.gramsPerWatt, 2)}</td>
          <td>${formatNumber(metrics.gramsPerPlant, 1)}g</td>
          <td>${formatNumber(metrics.gramsPerM2, 0)}g</td>
          <td class="row-actions"><button class="mini-button" data-edit-harvest="${log.id}" type="button">Edit</button><button class="mini-button danger" data-delete-log="${log.id}" type="button">Delete</button></td>
        </tr>`).join("")
      : '<tr><td colspan="8" class="muted">No harvest results yet.</td></tr>';

    dom.harvestView.innerHTML = `
      <div class="page-head"><div><h1>Harvest</h1><p class="muted">Record finished batch weights and compare yield efficiency.</p></div></div>
      <div class="result-grid">
        <div class="metric-card"><span>Total dry</span><b>${formatNumber(totalDry, 0)}g</b><small>${harvests.length} harvest logs</small></div>
        <div class="metric-card"><span>Avg g/W</span><b>${formatNumber(avgGpWValue, 2)}</b><small>dry weight per fixture watt</small></div>
        <div class="metric-card"><span>Best g/W</span><b>${bestGpW ? formatNumber(bestGpW.metrics.gramsPerWatt, 2) : "-"}</b><small>${bestGpW ? escapeHtml(names.batch(bestGpW.log.batchId)) : "no completed run"}</small></div>
      </div>
      <div class="split wide-split">
        <form class="panel" id="harvestForm" action="javascript:void(0)">
          <div class="panel-head"><h4>Add / edit harvest</h4></div>
          <input type="hidden" name="id" />
          <div class="form-row"><label>Batch<select name="batchId" required>${batchOptions()}</select></label><label>Plant (optional)<select name="plantId">${plantOptions()}</select></label></div>
          <div class="form-row"><label>Wet weight (g)<input name="wetWeight" type="number" step="any" /></label><label>Dry weight (g)<input name="dryWeight" type="number" step="any" /></label></div>
          <div class="form-row"><label>Waste weight (g)<input name="wasteWeight" type="number" step="any" /></label><label>Testing sample sent<select name="sampleSent">${options(["No", "Yes"], "No")}</select></label></div>
          <label>Crew<input name="harvestCrew" /></label>
          <label>Notes<input name="notes" /></label>
          <button class="primary-button" type="button" data-save-form="harvestForm">Save harvest</button>
        </form>
        <div class="panel">
          <div class="panel-head"><h4>Harvest results</h4><span class="muted small">${harvests.length}</span></div>
          <table class="data-table"><thead><tr><th>Batch</th><th>Room</th><th>Wet${helpHtml("Wet weight")}</th><th>Dry</th><th>g/W${helpHtml("g/W")}</th><th>g/plant${helpHtml("g/plant")}</th><th>g/m2${helpHtml("g/m2")}</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        </div>
      </div>`;
  }

  // --- inventory -----------------------------------------------------------

  function renderInventory() {
    const items = stateRef.state.inventory;
    const rows = items.length
      ? items.map((it) => {
          const lowFlag = reading(it.quantity) <= reading(it.reorderAt) && (it.reorderAt ?? "") !== "";
          return `<tr><td><b>${escapeHtml(it.name)}</b>${lowFlag ? ' <span class="chip bad">low</span>' : ""}</td><td>${escapeHtml(it.category || "")}</td><td>${escapeHtml(it.quantity || "0")} ${escapeHtml(it.unit || "")}</td><td>${escapeHtml(it.reorderAt || "")}</td><td>${escapeHtml(it.vendor || "")}</td><td class="row-actions"><button class="mini-button" data-edit-inventory="${it.id}" type="button">Edit</button><button class="mini-button danger" data-delete="inventory" data-id="${it.id}" type="button">Delete</button></td></tr>`;
        }).join("")
      : '<tr><td colspan="6" class="muted">No inventory yet.</td></tr>';
    dom.inventoryView.innerHTML = `
      <div class="page-head"><div><h1>Inventory</h1><p class="muted">Nutrients, media, consumables and low-stock flags.</p></div></div>
      <div class="split">
        <form class="panel" id="inventoryForm" action="javascript:void(0)">
          <div class="panel-head"><h4>Add / edit item</h4></div>
          <input type="hidden" name="id" />
          <label>Item name<input name="name" required /></label>
          <div class="form-row"><label>Category<select name="category">${options(inventoryCategories)}</select></label><label>Vendor<input name="vendor" /></label></div>
          <div class="form-row"><label>Quantity<input name="quantity" type="number" step="any" value="0" /></label><label>Unit<input name="unit" /></label></div>
          <label>Reorder at<input name="reorderAt" type="number" step="any" value="0" /></label>
          <button class="primary-button" type="button" data-save-form="inventoryForm">Save item</button>
        </form>
        <div class="panel">
          <div class="panel-head"><h4>All items</h4><span class="muted small">${items.length}</span></div>
          <table class="data-table"><thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Reorder</th><th>Vendor</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        </div>
      </div>`;
  }

  // --- settings ------------------------------------------------------------

  function renderSettings() {
    const setpoints = stateRef.state.settings.setpoints;
    const unitOptions = options(["metric", "imperial"], unitSystem());
    const ppmOptions = options(["500", "700"], String(stateRef.state.settings.ppmScale || "500"));
    const unitPanel = `
      <fieldset class="panel">
        <legend>Measurements</legend>
        <label>Height and length units
          <select name="unitSystem">${unitOptions}</select>
        </label>
        <label>PPM / TDS scale
          <select name="ppmScale">${ppmOptions}</select>
        </label>
        <label>Site elevation (m above sea level)${helpHtml("Altitude")}
          <input name="elevationM" type="number" step="any" value="${escapeHtml(stateRef.state.settings.elevationM ?? "0")}" placeholder="0" />
        </label>
        <label>Temperature unit
          <select name="tempUnit">
            <option value="C"${(stateRef.state.settings.tempUnit || "C") === "C" ? " selected" : ""}>Celsius (°C)</option>
            <option value="F"${stateRef.state.settings.tempUnit === "F" ? " selected" : ""}>Fahrenheit (°F)</option>
          </select>
        </label>
        <label>Background
          <select name="background">
            <option value="leaf"${(stateRef.state.settings.background || "leaf") === "leaf" ? " selected" : ""}>Leaf pattern</option>
            <option value="plain"${stateRef.state.settings.background === "plain" ? " selected" : ""}>Plain (fastest)</option>
          </select>
        </label>
        <p class="muted small">Metric shows room dimensions in metres and plant/light distances in centimetres. Imperial shows room dimensions in feet and plant/light distances in inches.</p>
        <p class="muted small">Choose the PPM conversion scale used by your TDS meter. EC targets stay the source of truth.</p>
        <p class="muted small">Elevation thins the air: at altitude each CFM carries less heat, so the ventilation targets scale up automatically. Addis Ababa ≈ 2350 m.</p>
      </fieldset>`;
    const fieldsets = Object.entries(setpoints).map(([stage, v]) => `
      <fieldset class="panel">
        <legend>${stage.charAt(0).toUpperCase() + stage.slice(1)}</legend>
        <div class="form-row"><label>Temp min ${tUnit()}${helpHtml("Air temp")}<input name="${stage}.tempMin" type="number" step="any" value="${Number.isFinite(tDisp(v.tempMin, 1)) ? tDisp(v.tempMin, 1) : ""}" /></label><label>Temp max ${tUnit()}<input name="${stage}.tempMax" type="number" step="any" value="${Number.isFinite(tDisp(v.tempMax, 1)) ? tDisp(v.tempMax, 1) : ""}" /></label></div>
        <div class="form-row"><label>RH min %${helpHtml("Humidity")}<input name="${stage}.humidityMin" type="number" step="any" value="${v.humidityMin ?? ""}" /></label><label>RH max %<input name="${stage}.humidityMax" type="number" step="any" value="${v.humidityMax ?? ""}" /></label></div>
        <div class="form-row"><label>Night temp min ${tUnit()}<input name="${stage}.nightTempMin" type="number" step="any" value="${Number.isFinite(tDisp(v.nightTempMin, 1)) ? tDisp(v.nightTempMin, 1) : ""}" /></label><label>Night temp max ${tUnit()}<input name="${stage}.nightTempMax" type="number" step="any" value="${Number.isFinite(tDisp(v.nightTempMax, 1)) ? tDisp(v.nightTempMax, 1) : ""}" /></label></div>
        <div class="form-row"><label>Night RH max %<input name="${stage}.nightHumidityMax" type="number" step="any" value="${v.nightHumidityMax ?? ""}" /></label><span class="form-hint">Night bands judge lights-off readings. A tight night RH cap is the bud-rot guard: falling temps push humid air to dew point.</span></div>
        <div class="form-row"><label>CO2 min${helpHtml("CO2")}<input name="${stage}.co2Min" type="number" step="any" value="${v.co2Min ?? ""}" /></label><label>CO2 max<input name="${stage}.co2Max" type="number" step="any" value="${v.co2Max ?? ""}" /></label></div>
        <div class="form-row"><label>Light K min${helpHtml("Color temp")}<input name="${stage}.lightKelvinMin" type="number" step="any" value="${v.lightKelvinMin ?? ""}" /></label><label>Light K max<input name="${stage}.lightKelvinMax" type="number" step="any" value="${v.lightKelvinMax ?? ""}" /></label></div>
        <div class="form-row"><label>PPFD min${helpHtml("PPFD")}<input name="${stage}.ppfdMin" type="number" step="any" value="${v.ppfdMin ?? ""}" /></label><label>PPFD max<input name="${stage}.ppfdMax" type="number" step="any" value="${v.ppfdMax ?? ""}" /></label></div>
      </fieldset>`).join("");

    dom.settingsView.innerHTML = `
      <div class="page-head"><div><h1>Settings</h1><p class="muted">Stage targets drive the room guidance, alerts, and recommendations.</p></div></div>
      <form id="settingsForm" class="setpoint-grid" action="javascript:void(0)">${unitPanel}${fieldsets}<button class="primary-button" type="button" data-save-form="settingsForm">Save settings</button></form>
      ${(() => {
        const info = window.AppStore.syncInfo();
        if (!info.enabled) return "";
        const status = info.authFailed || !info.hasKey
          ? '<span class="chip warn">Locked — passphrase needed</span>'
          : info.online
          ? `<span class="chip ok">Connected${info.lastSync ? ` · last sync ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(info.lastSync)}` : ""}</span>`
          : info.online === false
          ? '<span class="chip bad">Cloud unreachable</span>'
          : '<span class="chip">Connecting…</span>';
        return `<div class="panel data-tools">
        <div class="panel-head"><h4>Cloud sync</h4>${status}</div>
        <p class="muted small">All your devices share one grow log through the cloud. Enter the same passphrase on each device once — it is remembered after that.</p>
        <div class="chip-row">
          <button class="ghost-button" id="syncKeyBtn" type="button">Enter / change passphrase</button>
          <button class="ghost-button" id="syncNowBtn" type="button">Sync now</button>
        </div>
      </div>`;
      })()}
      <div class="panel data-tools">
        <div class="panel-head"><h4>Data</h4></div>
        <p class="muted small">Records live in this browser. Export JSON for backups.</p>
        <div class="chip-row">
          <button class="ghost-button" id="seedDemoBtn" type="button">Load demo data</button>
          <button class="ghost-button" id="resetSetpointsBtn" type="button">Reset targets to recommended</button>
          <button class="ghost-button" id="exportCsvBtn" type="button">Export logs CSV</button>
          <button class="ghost-button danger" id="clearDataBtn" type="button">Clear all data</button>
        </div>
      </div>
      <div class="panel glossary-panel">
        <div class="panel-head"><h4>Grower's glossary</h4><span class="muted small">${allTerms().length} terms — these power the ? tooltips around the app</span></div>
        <dl class="glossary-list">
          ${allTerms().map(({ term, tip }) => `<div class="glossary-item"><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(tip)}</dd></div>`).join("")}
        </dl>
      </div>`;
  }

  // --- room add/edit modal -------------------------------------------------

  function renderStageTransitionModal() {
    const modal = stateRef.modal || {};
    const room = stateRef.state.rooms.find((item) => item.id === modal.roomId);
    const batch = stateRef.state.batches.find((item) => item.id === modal.batchId);
    const previousStage = modal.previousStage || room?.stage || batch?.stage || "Current";
    const nextStage = modal.nextStage || previousStage;
    const date = modal.date || todayInputValue();
    dom.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-close-modal></div>
      <div class="modal" role="dialog" aria-modal="true">
        <button class="icon-button modal-x" data-close-modal type="button">×</button>
        <h2>Save stage transition</h2>
        <form id="stageTransitionForm" class="room-edit-form" action="javascript:void(0)">
          <input type="hidden" name="roomId" value="${escapeHtml(room?.id || "")}" />
          <input type="hidden" name="batchId" value="${escapeHtml(batch?.id || "")}" />
          <input type="hidden" name="stage" value="${escapeHtml(nextStage)}" />
          <div class="transition-summary">
            <div><span>From</span><b>${escapeHtml(previousStage)}</b></div>
            <div><span>To</span><b>${escapeHtml(nextStage)}</b></div>
          </div>
          <label>Effective date<input name="startDate" type="date" required value="${escapeHtml(date)}" /></label>
          <p class="muted small">This starts the day counter for ${escapeHtml(nextStage)}. ${batch ? `Active batch: ${escapeHtml(batch.name || "Batch")}.` : "No active batch is assigned, so only the room stage will change."}</p>
          <div class="modal-actions">
            <button class="ghost-button" data-close-modal type="button">Cancel</button>
            <button class="primary-button" type="button" data-save-form="stageTransitionForm">Save transition</button>
          </div>
        </form>
      </div>`;
    dom.modalRoot.classList.add("open");
  }

  // --- "Start a grow" wizard ------------------------------------------------
  // One guided flow for the real-world event "I started N plants of strain X
  // in tent Y today": room -> batch -> auto-tagged plants, no re-entry.

  function renderStartGrowModal() {
    const m = stateRef.modal;
    const d = m.draft || {};
    const step = m.step || 1;
    const stepChip = (n, label) => `<span class="wiz-step${step === n ? " active" : step > n ? " done" : ""}"><b>${n}</b>${label}</span>`;
    const steps = `<div class="wizard-steps">${stepChip(1, "Room")}${stepChip(2, "Batch")}${stepChip(3, "Plants")}</div>`;

    let body = "";
    if (step === 1) {
      const roomChoices = '<option value="__new__"' + (!d.roomId ? " selected" : "") + ">+ Create a new room / tent</option>" +
        stateRef.state.rooms.map((r) => `<option value="${r.id}"${d.roomId === r.id ? " selected" : ""}>${escapeHtml(r.name)}</option>`).join("");
      const isNew = !d.roomId;
      body = `
        <label>Where is this grow happening?<select name="roomChoice" data-wizard-room-choice>${roomChoices}</select></label>
        ${isNew ? `
        <label>Room / tent name<input name="roomName" required value="${escapeHtml(d.roomName || "")}" placeholder="1.2m Tent" /></label>
        <div class="form-row"><label>Length (${roomLengthUnit()})<input name="lengthM" type="number" step="any" value="${escapeHtml(d.lengthM || "")}" placeholder="${metricUnits() ? "1.2" : "4"}" /></label><label>Width (${roomLengthUnit()})<input name="widthM" type="number" step="any" value="${escapeHtml(d.widthM || "")}" placeholder="${metricUnits() ? "1.2" : "4"}" /></label></div>
        <div class="form-row"><label>Height (${roomLengthUnit()})<input name="heightM" type="number" step="any" value="${escapeHtml(d.heightM || "")}" placeholder="${metricUnits() ? "2" : "6.5"}" /></label><label>Pot width (${smallLengthUnit()})<input name="potWidthIn" type="number" step="any" value="${escapeHtml(d.potWidthIn || "")}" placeholder="${metricUnits() ? "30" : "12"}" /></label></div>
        <p class="muted small">Just the basics — fans and lights can be added later via Edit room.</p>` : `<p class="muted small">Using the existing room setup (size, pots, lights, fan).</p>`}`;
    } else if (step === 2) {
      const year = new Date().getFullYear();
      const suggested = d.batchName || `LOT-${year}-${String(stateRef.state.batches.length + 1).padStart(3, "0")}`;
      body = `
        <div class="form-row"><label>Batch / lot name<input name="batchName" required value="${escapeHtml(suggested)}" /></label><label>Strain / cultivar<input name="cultivar" value="${escapeHtml(d.cultivar || "")}" placeholder="e.g. Medicinal A" /></label></div>
        <div class="form-row"><label>Starting stage<select name="stage">${options(stages.slice(0, 4), d.stage || "Seedling")}</select></label><label>Start date<input name="startDate" type="date" value="${escapeHtml(d.startDate || todayInputValue())}" /></label></div>
        <p class="muted small">The start date drives the day/week playbook coaching, so set it to when these plants actually began this stage.</p>`;
    } else {
      const count = Math.max(1, Math.round(Number(d.plantCount)) || 4);
      const prefix = d.tagPrefix || "P";
      const preview = Array.from({ length: Math.min(count, 4) }, (_, i) => `${prefix}-${String(i + 1).padStart(3, "0")}`).join(", ") + (count > 4 ? ", …" : "");
      const roomName = d.roomId ? names.room(d.roomId) : d.roomName || "new room";
      body = `
        <div class="form-row"><label>How many plants?<input name="plantCount" type="number" min="1" step="1" value="${count}" /></label><label>Tag prefix<input name="tagPrefix" value="${escapeHtml(prefix)}" /></label></div>
        <p class="muted small">Each plant gets its own tagged record (${escapeHtml(preview)}) for individual health and harvest tracking.</p>
        <div class="wizard-summary">
          <b>Ready to start:</b>
          <span>${count} × ${escapeHtml(d.cultivar || "plants")} · batch <b>${escapeHtml(d.batchName || "")}</b> · ${escapeHtml(d.stage || "Seedling")} from ${escapeHtml(d.startDate || todayInputValue())} · in <b>${escapeHtml(roomName)}</b></span>
        </div>`;
    }

    dom.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-close-modal></div>
      <div class="modal" role="dialog" aria-modal="true">
        <button class="icon-button modal-x" data-close-modal type="button">×</button>
        <h2>Start a grow</h2>
        ${steps}
        <form id="startGrowForm" class="room-edit-form" action="javascript:void(0)">
          ${body}
          <div class="modal-actions">
            ${step > 1 ? '<button class="ghost-button" data-wizard-back type="button">‹ Back</button>' : ""}
            ${step < 3
              ? '<button class="primary-button" data-wizard-next type="button">Next ›</button>'
              : '<button class="primary-button" data-wizard-finish type="button">▶ Start grow</button>'}
          </div>
        </form>
      </div>`;
    dom.modalRoot.classList.add("open");
  }

  function renderModal() {
    if (!stateRef.modal) {
      dom.modalRoot.innerHTML = "";
      dom.modalRoot.classList.remove("open");
      return;
    }
    if (stateRef.modal.type === "startGrow") return renderStartGrowModal();
    if (stateRef.modal.type === "stageTransition") return renderStageTransitionModal();
    const room = stateRef.modal.id ? stateRef.state.rooms.find((r) => r.id === stateRef.modal.id) : {};
    const v = (key, fallback = "") => escapeHtml(room?.[key] ?? fallback);
    const dim = (key, fallback = "") => escapeHtml(room?.[key] == null || room?.[key] === "" ? fallback : roomLengthValue(room[key]));
    const sdim = (key, fallback = "") => escapeHtml(room?.[key] == null || room?.[key] === "" ? fallback : smallLengthValue(room[key]));
    dom.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-close-modal></div>
      <div class="modal" role="dialog" aria-modal="true">
        <button class="icon-button modal-x" data-close-modal type="button">×</button>
        <h2>${room?.id ? "Edit room" : "Add room"}</h2>
        <form id="roomEditForm" class="room-edit-form" action="javascript:void(0)">
          <input type="hidden" name="id" value="${v("id")}" />
          <label>Room / tent name<input name="name" required value="${v("name")}" placeholder="1.2m Flower Tent" /></label>
          <div class="form-row"><label>Current stage<select name="stage">${options(stages, room?.stage)}</select></label><label>Plants (fallback if none registered)<input name="plantCount" type="number" value="${v("plantCount", "0")}" /></label></div>
          <div class="form-row"><label>Length (${roomLengthUnit()})<input name="lengthM" type="number" step="any" value="${dim("lengthM")}" placeholder="${metricUnits() ? "1.2" : "4"}" /></label><label>Width (${roomLengthUnit()})<input name="widthM" type="number" step="any" value="${dim("widthM")}" placeholder="${metricUnits() ? "1.2" : "4"}" /></label></div>
          <div class="form-row"><label>Height (${roomLengthUnit()})<input name="heightM" type="number" step="any" value="${dim("heightM")}" placeholder="${metricUnits() ? "2" : "6.5"}" /></label><label>Medium<input name="medium" value="${v("medium")}" placeholder="Coco, soil, rockwool" /></label></div>
          <div class="form-row"><label>Pot width / diameter (${smallLengthUnit()})<input name="potWidthIn" type="number" step="any" value="${sdim("potWidthIn")}" placeholder="${metricUnits() ? "30" : "12"}" /></label><label>Pot height (${smallLengthUnit()})<input name="potHeightIn" type="number" step="any" value="${sdim("potHeightIn")}" placeholder="${metricUnits() ? "36" : "14"}" /></label></div>
          <div class="form-row"><label>Pot volume (L, optional)<input name="potLiters" type="number" step="any" value="${v("potLiters")}" placeholder="20" /></label><label>Default watts / light<input name="lightWattsEach" type="number" step="any" value="${v("lightWattsEach")}" placeholder="100" /></label></div>
          <div class="form-row"><label>Fan diameter (in)<input name="fanDiameterIn" type="number" step="any" value="${v("fanDiameterIn")}" /></label><label>Fan capacity (CFM)<input name="fanCapacityCfm" type="number" step="any" value="${v("fanCapacityCfm")}" /></label></div>
          <div class="form-row"><label>Fan speed (%)<input name="fanSpeed" type="number" step="any" value="${v("fanSpeed", "50")}" /></label><label>Target air changes/min<input name="targetAirChangesPerMin" type="number" step="any" value="${v("targetAirChangesPerMin", "1")}" /></label></div>
          <div class="form-row"><label>Room / intake air temp (${tUnit()})${helpHtml("Air temp")}<input name="ambientTempF" type="number" step="any" value="${Number.isFinite(tDisp(room?.ambientTempF ?? 75, 1)) ? tDisp(room?.ambientTempF ?? 75, 1) : ""}" /></label><label>Carbon filter<select name="carbonFilter">${options(["No", "Yes"], room?.carbonFilter || "No")}</select></label></div>
          <div class="form-row"><label>Exhaust ducting<select name="ductingSetup">
            <option value="none"${room?.ductingSetup === "none" ? " selected" : ""}>Open / no ducting</option>
            <option value="short"${room?.ductingSetup === "short" ? " selected" : ""}>Short &amp; straight</option>
            <option value="typical"${(room?.ductingSetup || "typical") === "typical" ? " selected" : ""}>Typical (a few bends)</option>
            <option value="long"${room?.ductingSetup === "long" ? " selected" : ""}>Long / several bends</option>
          </select></label><label>Enclosure walls<select name="enclosureType">
            <option value="tent"${(room?.enclosureType || "tent") === "tent" ? " selected" : ""}>Thin tent / Mylar</option>
            <option value="wood"${room?.enclosureType === "wood" ? " selected" : ""}>Wood / plywood box</option>
            <option value="insulated"${room?.enclosureType === "insulated" ? " selected" : ""}>Insulated walls</option>
          </select></label></div>
          <div class="form-row"><span class="form-hint">Intake temp + LED watts size the fan for heat removal; the filter and ducting add resistance the target speed compensates for. Enclosure walls set how fast heat leaks out, which drives the temperature prediction.</span></div>
          <div class="form-row"><label>Warm lights<input name="warmLightCount" type="number" value="${v("warmLightCount", "0")}" /></label><label>Warm Kelvin<input name="warmLightKelvin" type="number" value="${v("warmLightKelvin", "3000")}" /></label></div>
          <div class="form-row"><label>Cool lights<input name="coolLightCount" type="number" value="${v("coolLightCount", "0")}" /></label><label>Cool Kelvin<input name="coolLightKelvin" type="number" value="${v("coolLightKelvin", "5000")}" /></label></div>
          <div id="lightWattsWrap">${lightWattsGridInner(room?.warmLightCount, room?.coolLightCount, room?.lightWatts, room?.lightWattsEach)}</div>
          <div class="form-row"><label>Training<select name="training">
            <option value="none"${(room?.training || "none") === "none" ? " selected" : ""}>None</option>
            <option value="scrog"${room?.training === "scrog" ? " selected" : ""}>ScrOG (screen)</option>
            <option value="lst"${room?.training === "lst" ? " selected" : ""}>LST / topping</option>
          </select></label><label>Expected stretch %${helpHtml("stretch")}<input name="stretchPct" type="number" step="any" value="${v("stretchPct")}" placeholder="100" /></label></div>
          <div class="form-row"><span class="form-hint">The Flip planner uses these: how much taller the plant gets after flipping to flower (≈100% ≈ doubles; lower if you ScrOG/train). Blank uses the training default — None 100%, ScrOG 50%, LST 70%.</span></div>
          <div class="form-row"><span class="form-hint">Measured pot width/height draws the buckets at exact scale (volume alone estimates bucket-shaped dims). Plant size comes from the height you log in Plant health. The lamp isn't set here — it auto-follows the stage's PPFD target in the room view (drag it to override).</span></div>
          <div class="modal-actions">
            ${room?.id ? `<button class="ghost-button danger" data-delete-room="${room.id}" type="button">Delete room</button>` : ""}
            <button class="primary-button" type="button" data-save-form="roomEditForm">${room?.id ? "Save room" : "Create room"}</button>
          </div>
        </form>
      </div>`;
    dom.modalRoot.classList.add("open");
  }

  return { dom, render, names, measurements };
}

// Per-fixture wattage grid for the room form. Standalone/pure so it can be
// re-rendered live (from main.js) the moment the warm/cool counts change — no
// save-and-reopen needed, and it works in Add room and Edit room alike.
function lightWattsGridInner(warm, cool, wattsArr, defaultW) {
  const w = Math.max(0, Math.round(Number(warm) || 0));
  const c = Math.max(0, Math.round(Number(cool) || 0));
  const total = w + c;
  if (total <= 0) {
    return '<div class="form-row"><span class="form-hint">Enter a Warm and/or Cool light count above — a wattage box for each fixture appears here so you can mix different lights (e.g. a 50 W and a 100 W).</span></div>';
  }
  const arr = Array.isArray(wattsArr) ? wattsArr : [];
  const ph = escapeHtml(defaultW || "100");
  let cells = "";
  for (let i = 0; i < total; i += 1) {
    const type = i < w ? "warm" : "cool";
    const raw = arr[i];
    const val = raw != null && raw !== "" ? escapeHtml(raw) : "";
    cells += `<label class="light-watt-cell">Light ${i + 1} <small>(${type})</small><input name="lightWatts.${i}" type="number" step="any" value="${val}" placeholder="${ph}" /></label>`;
  }
  return `<div class="form-row"><span class="form-hint">Per-light wattage — mix different lights freely. Each box is one fixture; blank uses the default above.</span></div><div class="light-watts-grid">${cells}</div>`;
}

window.AppRender = { createRenderer, lightWattsGridInner };
})();

function bindDom() {
  const views = Array.from(document.querySelectorAll(".view"));
  return {
    views,
    topnavItems: Array.from(document.querySelectorAll(".topnav-item")),
    roomsView: document.querySelector("#roomsView"),
    roomView: document.querySelector("#roomView"),
    batchesView: document.querySelector("#batchesView"),
    plantsView: document.querySelector("#plantsView"),
    diagnoseView: document.querySelector("#diagnoseView"),
    tasksView: document.querySelector("#tasksView"),
    harvestView: document.querySelector("#harvestView"),
    inventoryView: document.querySelector("#inventoryView"),
    settingsView: document.querySelector("#settingsView"),
    modalRoot: document.querySelector("#modalRoot"),
    toast: document.querySelector("#toast"),
    exportJsonBtn: document.querySelector("#exportJsonBtn"),
    importJsonInput: document.querySelector("#importJsonInput")
  };
}
