(() => {
// Grower's glossary. Every entry is one or two sentences in plain language,
// with the ideal direction or target where one exists. Rendered as small "?"
// tooltips next to metric labels and form fields, plus a full list in
// Settings. Terms are keyed by canonical name; ALIASES map the many label
// spellings used around the app onto those keys.

const TERMS = {
  "air temp": "Air temperature at canopy height. Together with humidity it sets VPD. A 2-5°C drop at lights-off is healthy; big swings stress the plant.",
  "humidity (rh)": "Relative humidity — how much moisture the air holds. Seedlings like it high (65-70%), flower likes it low (40-50%); dense buds above ~55-60% RH risk bud rot.",
  "vpd": "Vapor pressure deficit — how hard the air pulls water out of the leaves. Higher = the air feels drier to the plant. Targets: ~0.4-0.8 kPa for clones/seedlings, 0.8-1.2 veg, 1.2-1.5 flower.",
  "co2": "Carbon dioxide — plant fuel. Ambient 400-800 ppm is fine for most grows; enriching past 1000 ppm only pays off with very high light and a sealed room.",
  "dew point": "The temperature where air moisture condenses into water. If buds cool to within a few degrees of it (small dew-point gap), they get wet — prime bud-rot conditions. Bigger gap = safer.",
  "leaf temp": "Leaf surface temperature, usually 1-2° below air temp. Used for accurate VPD; a cheap infrared thermometer reads it in seconds.",
  "ph": "Acidity of the water/feed. It controls which nutrients the roots can absorb — out of range means lockout. Target 5.8-6.2 in coco/hydro, 6.2-6.8 in soil.",
  "ec": "Electrical conductivity — the total dissolved nutrient strength of a feed. Higher = stronger feed. Roughly 0.4-0.8 mS/cm for seedlings, rising to ~2.0+ at peak flower.",
  "ppm": "The same measurement as EC on a different scale (≈ EC × 500 or × 700 depending on your meter brand — set yours in Settings). Higher = stronger feed.",
  "runoff": "The water that drains out of the pot after feeding. Its pH and EC reveal what is really happening at the roots: runoff EC climbing above input EC means salts are building up — feed more volume so 15-20% runs off.",
  "lockout": "Nutrients are present in the medium but chemically unavailable because root-zone pH is off. Looks like several deficiencies at once. Fix the pH, not the feed strength.",
  "substrate ph/ec": "pH/EC measured in the root zone itself (probe, slurry, or runoff) — what the roots actually experience, which drifts from what you pour in. Trend this to catch salt buildup early.",
  "ppfd": "Photosynthetic photon flux density — how much usable light actually lands on the canopy (µmol/m²/s). More = more growth, up to ~800-1000 without added CO2; beyond that is just heat.",
  "dli": "Daily light integral — the total light delivered per day (PPFD × hours on). The best single number for \"is this plant getting enough light\".",
  "photoperiod": "Hours of light per day. 18h keeps photoperiod plants in veg; switching to 12h light / 12h uninterrupted dark triggers flowering.",
  "color temp": "Light color in Kelvin: lower K (2700-3500) is warm/red and suits flower; higher K (5000-6500) is cool/blue and suits seedlings and veg.",
  "dimmer": "Fixture power %. Run it low for young plants and raise it through flower — steadier than moving the lamp constantly.",
  "canopy distance": "Gap between the light and the plant tops. Too close = bleaching and heat stress on the top buds; too far = stretching and weak PPFD.",
  "light burn": "Bleached or yellowing tops closest to the lamp while the rest of the plant stays green. Not a deficiency — raise the light.",
  "fan speed": "Exhaust fan power — sets the air exchange rate. Enough to clear heat, humidity, and refresh CO2; not so much it strips all moisture from the tent.",
  "air changes": "How many times per minute the fan replaces the tent's full air volume. About 1/min is a common target.",
  "cfm": "Cubic feet per minute — a fan's airflow capacity. Tent volume × target air changes = the CFM you need.",
  "negative pressure": "Exhaust pulling slightly more air than the intake lets in, so the tent walls bow gently inward. Keeps smell exiting through the carbon filter instead of the zips.",
  "carbon filter": "An activated-carbon canister on the exhaust that scrubs odor. Replace it when smell starts sneaking through.",
  "dry-back": "How much of the watered-in weight the pot has lost since the last watering. Roots need this oxygen break — water again at roughly 60% dry-back in soil, ~35% in coco. Lifting the pot (or logging its weight) beats any fixed schedule.",
  "fertigation": "Feeding and watering in one — nutrients dissolved in every irrigation. Standard practice in coco and hydro.",
  "cal-mag": "Calcium + magnesium supplement. Near-mandatory with coco, RO, or soft water. Ca deficiency shows as rusty spots on new growth; Mg as yellowing between the veins of older leaves.",
  "flush": "Feeding plain water for the final 1-2 weeks before harvest. Contested: blind taste trials found no difference, so treat it as optional method, not gospel.",
  "medium": "What the roots grow in: soil (buffered and forgiving, feed lightly), coco (fast, feed every watering, needs Cal-Mag), or hydro (fastest growth, least forgiving of mistakes).",
  "coco": "Coconut-husk growing medium: drains fast, holds lots of air, wants pH 5.8-6.2 and daily fertigation with Cal-Mag. Treat it like hydro, not like soil.",
  "perlite": "The white volcanic glass mixed into media for drainage and root oxygen. More perlite = faster dry-back.",
  "hydro": "Growing in water or inert media with all nutrition from the feed. Fast growth and fast problems — pH/EC discipline is non-negotiable.",
  "moisture %": "Volumetric water content of the medium from a soil-moisture probe. A useful trend line between pot-weight checks.",
  "medium temp": "Root-zone temperature. Roots want 18-24°C (65-75°F). Cold roots lock out phosphorus; warm soggy roots invite root rot.",
  "water temp": "Irrigation water temperature — target ~18-21°C (65-70°F). Cold water shocks roots; warm water holds less oxygen and breeds pythium.",
  "topping": "Cutting the main growing tip just above a node so two new mains form. Turns one dominant cola into an even multi-cola canopy. Veg only.",
  "lst": "Low-stress training — bending and tying branches outward so every top sits level and gets equal light. No cutting, no growth stall.",
  "supercrop": "Pinching and softening a stem until it folds over without snapping. Emergency height control for a branch racing into the light.",
  "scrog": "Screen of green — a net stretched over the canopy; every shoot gets tucked under it until the flip. Maximizes light interception, the #1 yield lever.",
  "lollipop": "Stripping the shaded bottom third of each plant around the flip. Those larfy lowers steal energy and trap humid air under the canopy.",
  "defoliation": "Removing large fan leaves that shade bud sites. Light on a bud site now = bud structure later. Take a few at a time, not half the plant in one sitting.",
  "canopy": "The top layer of leaves and buds that catches the light. A flat, even canopy puts every top at the same PPFD — that is most of what training is for.",
  "cola": "A main flowering stem — the long stacked bud at the end of a branch. Training exists to make many even colas instead of one big one.",
  "node": "Where leaves and branches meet the stem. The gap between nodes (internode) shows stretch: short internodes = a compact, light-efficient plant.",
  "stretch": "The growth surge after flipping to 12/12 — plants typically gain 50-100% height in the first 3 weeks of flower. Budget tent headroom for it before you flip.",
  "flip": "Switching the lights to 12h on / 12h uninterrupted dark to start flowering. Time it by space: current height + stretch + lamp gap must fit the tent.",
  "veg": "The vegetative phase before flowering (18h light). The size, structure, and root mass built here set the ceiling on yield.",
  "clone": "A cutting rooted into an exact genetic copy of its mother. Needs 75-85% humidity and gentle light until roots show (7-14 days).",
  "mother plant": "A plant kept permanently in veg as the source of clones — identical genetics run after run.",
  "hardening off": "Easing rooted clones or seedlings into normal humidity and stronger light over a few days instead of all at once.",
  "damping off": "Fungal stem-rot at the soil line that kills seedlings overnight — the #1 seedling killer. Caused by soaked medium plus still air.",
  "trichome": "The frosty resin glands on buds where THC and terpenes live. Their color under a loupe — clear → cloudy → amber — is THE harvest clock.",
  "trichome colors": "Ripeness stages: clear = immature (racy, weaker), cloudy/milky = peak THC, amber = THC degrading toward sedative. The standard window is cloudy-dominant with 10-30% amber.",
  "pistils": "The white hairs on buds that darken and curl inward as flowers mature. A rough ripeness clue — trichomes are the accurate one.",
  "loupe": "A 30-60x pocket magnifier for reading trichome color. The cheapest quality tool in growing.",
  "foxtail": "Towers of new growth spiking out of otherwise-finished buds — usually heat or light stress on the tops. Raise the lamp.",
  "hermie": "A stressed female growing male pollen sacs (\"nanners\"/\"bananas\"). One missed nanner can seed the whole room — remove the sacs or the plant.",
  "reveg": "A flowering plant slipping back into vegetative growth because light leaked into the dark period. Check for leaks from inside the closed tent, lights off.",
  "sinsemilla": "Seedless flower — what indoor growing is built around. Keep males and hermies away from flowering females.",
  "autoflower": "A cannabis type that flowers on age rather than light schedule, finishing ~10-12 weeks from seed. This app's playbook assumes photoperiod plants.",
  "feminized": "Seeds bred to produce ~99% female plants, so you are not hunting and culling males at the flip.",
  "bud rot": "Botrytis — gray mold that liquefies buds from the inside out. Driven by RH above ~55-60% in dense canopy, worst at lights-off. Cut wide around any rot and dehumidify immediately.",
  "powdery mildew": "White flour-like patches on leaves. Loves humidity and stagnant air. Improve airflow and treat at first sight — it spreads by spore.",
  "root rot": "Brown, slimy, sour-smelling roots from warm, oxygen-poor, constantly wet root zones. Keep water cool and let pots actually dry back.",
  "ipm": "Integrated pest management — prevention first: quarantine anything new, sticky traps, weekly under-leaf checks, beneficial insects before sprays. Never spray buds in flower.",
  "quarantine": "Isolating a suspect plant so pests or disease cannot spread. Cheap insurance — but a forgotten quarantine plant is a pest factory.",
  "nute burn": "Crispy yellow-brown leaf tips from overfeeding. Tips only = early warning; back the feed EC off a step before it marches down the leaf.",
  "the claw": "Nitrogen toxicity — glossy dark-green leaves with talon-curled tips. Common when veg nutrients overstay into flower. Ease off the N.",
  "heat stress": "Leaves folding upward into tacos in hot rooms or under too much light. Fix temperature and airflow before blaming the feed.",
  "senescence": "The natural late-flower fade — the plant moves nitrogen out of its leaves into the buds and the leaves yellow. Expected and healthy; don't \"fix\" it with more N.",
  "chlorophyll": "The green pigment that makes harsh \"fresh hay\" smoke when drying is rushed. A slow, cool, dark dry lets it break down properly.",
  "terpenes": "The aromatic oils that give each cultivar its smell and shape its effect. Volatile — preserved by slow drying and cool curing, destroyed by heat.",
  "thc/cbd": "The main cannabinoids: THC is the intoxicating one; CBD is non-intoxicating and softens THC's edge. The ratio is genetics; ripeness at harvest tunes THC's character.",
  "wet weight": "Weight at chop versus after drying. Buds lose 75-80% of their weight in the dry — wet weight ÷ 4 to 5 ≈ expected dry yield.",
  "g/w": "Grams of dry flower per watt of light — the standard efficiency score for an indoor run. 1.0+ g/W is a strong result.",
  "g/plant": "Dry grams per plant. Compare runs at the same plant count — fewer, bigger, well-trained plants often beat many small ones.",
  "g/m2": "Dry yield per square metre of canopy. Measures how well you filled and lit the space, independent of room size.",
  "cure": "Storing dried buds in jars at ~62% RH for 2-8 weeks. Redistributes moisture and finishes chlorophyll breakdown — the difference between harsh and smooth.",
  "burp": "Opening cure jars briefly to exchange air and release moisture — 1-2x daily the first week, then weekly. A jar hygrometer takes out the guessing.",
  "cultivar": "The named variety (\"strain\") being grown. Flowering time, stretch, feed appetite, and final effect are mostly set by it — log yours so runs can be compared.",
  "altitude": "Height above sea level. Thin high-altitude air carries less heat per cubic foot, so an exhaust fan must move more air to remove the same heat — the ventilation targets scale up automatically once you set your elevation."
};

// label (normalized) → TERMS key. The lookup also falls back to a longest-
// match contains scan, so "Night RH max %" still finds "rh".
const ALIASES = {
  "air temp": "air temp", "temp": "air temp", "air temperature": "air temp", "temp min": "air temp", "temp max": "air temp", "night temp min": "air temp", "night temp max": "air temp",
  "humidity": "humidity (rh)", "rh": "humidity (rh)", "humidity (rh)": "humidity (rh)", "rh min": "humidity (rh)", "rh max": "humidity (rh)", "night rh max": "humidity (rh)",
  "vpd": "vpd", "vpd (leaf)": "vpd",
  "co2": "co2", "co2 min": "co2", "co2 max": "co2",
  "dew-point gap": "dew point", "dew point": "dew point",
  "leaf temp": "leaf temp",
  "input ph": "ph", "ph": "ph",
  "input ec": "ec", "ec": "ec",
  "input ppm": "ppm", "ppm": "ppm", "ppm / tds scale": "ppm", "substrate ppm": "ppm",
  "runoff ph": "runoff", "runoff ec": "runoff", "runoff": "runoff",
  "substrate ph": "substrate ph/ec", "substrate ec": "substrate ph/ec",
  "ppfd": "ppfd", "ppfd min": "ppfd", "ppfd max": "ppfd",
  "dli": "dli",
  "photoperiod": "photoperiod",
  "color temp": "color temp", "observed color temp": "color temp", "light color": "color temp", "light k": "color temp", "kelvin": "color temp",
  "dimmer": "dimmer",
  "canopy distance": "canopy distance", "light-to-canopy distance": "canopy distance",
  "fan speed": "fan speed",
  "moisture": "moisture %",
  "medium temp": "medium temp",
  "water temp": "water temp",
  "pot weight": "dry-back", "dry-back": "dry-back", "last watered": "dry-back",
  "recipe": "fertigation", "volume": "fertigation",
  "amendment": "cal-mag",
  "pests": "ipm", "disease": "ipm",
  "height": "canopy",
  "wet weight": "wet weight", "dry weight": "wet weight", "waste weight": "wet weight", "wet": "wet weight", "dry": "wet weight",
  "g/w": "g/w", "g/plant": "g/plant", "g/m2": "g/m2",
  "clear trichomes": "trichome colors", "cloudy/milky": "trichome colors", "cloudy / milky": "trichome colors", "amber": "trichome colors", "clear": "trichome colors", "harvest window": "trichome colors",
  "pistils": "pistils",
  "aroma": "terpenes",
  "cultivar": "cultivar", "strain": "cultivar",
  "fixture or zone": "ppfd",
  "altitude": "altitude", "site elevation": "altitude", "elevation": "altitude"
};

const SCAN_KEYS = Object.keys(ALIASES).sort((a, b) => b.length - a.length);

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeLabel(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/\(night\)/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[°%]/g, " ")
    .replace(/\b(f|c|kpa|ms\/cm|umol|µmol\/m²\/s|mol\/m2\/d|k|h|in|cm|kg|lb)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tipFor(label) {
  const norm = normalizeLabel(label);
  if (!norm) return "";
  const direct = ALIASES[norm];
  if (direct) return TERMS[direct] || "";
  const hit = SCAN_KEYS.find((key) => norm === key || norm.startsWith(`${key} `) || norm.endsWith(` ${key}`) || norm.includes(` ${key} `));
  return hit ? TERMS[ALIASES[hit]] || "" : "";
}

// "?" badge with a hover/tap tooltip, or "" when the label has no entry.
function helpHtml(label) {
  const tip = tipFor(label);
  if (!tip) return "";
  return `<span class="term-help" tabindex="0" role="note" aria-label="${esc(tip)}" data-tip="${esc(tip)}">?</span>`;
}

function allTerms() {
  return Object.entries(TERMS)
    .map(([term, tip]) => ({ term, tip }))
    .sort((a, b) => a.term.localeCompare(b.term));
}

window.AppGlossary = { TERMS, tipFor, helpHtml, allTerms };
})();
