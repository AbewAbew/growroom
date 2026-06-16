(() => {
// Week-by-week cultivation playbook for photoperiod cannabis, indoor.
//
// Sources for the numbers used here (consensus across controlled-environment
// research and mainstream practice):
// - PPFD/DLI: chamber studies (Chandra et al.; Bugbee lab) show photosynthesis
//   scaling to ~800-1000 µmol/m²/s without CO2 enrichment; above that needs CO2.
// - VPD bands: standard leaf-VPD charts used in commercial CEA: clones 0.4-0.8,
//   veg 0.8-1.2, early flower 1.0-1.35, late flower 1.2-1.6 kPa.
// - Botrytis (bud rot): risk climbs sharply with RH > 55-60% in dense canopy,
//   especially lights-off when falling temperature pushes air toward dew point.
// - Stretch: photoperiod cultivars typically gain 50-100% height in the first
//   3 weeks of 12/12.
// - Drying: 15-21°C and 55-62% RH for 7-14 days (stems snap, not bend);
//   curing at ~62% RH with regular burping. Fast drying traps chlorophyll
//   and loses volatile terpenes.
// - Flushing pre-harvest is CONTESTED: a 2019 blind consumer/lab trial found
//   no quality difference. It is listed as optional, not required.
//
// Each entry: from = first week it applies to; the last entry whose `from`
// is <= the current week wins.

const GUIDES = {
  seedling: [
    {
      from: 1,
      phase: "Germination & emergence",
      focus: "Gentle, stable, lightly moist — never soaked.",
      why: "Seedlings have almost no roots and take most moisture through their leaves. Overwatering plus stagnant air causes damping-off (stem rot at the soil line), the #1 seedling killer.",
      climate: "22-26°C · RH 65-70% · VPD 0.4-0.8 kPa",
      light: "PPFD 100-300 · 18h on",
      feed: "Plain water, or EC 0.4-0.6 at pH 5.8-6.2. No real feeding yet.",
      actions: [
        { t: "Keep medium lightly moist, never wet", d: "Mist or small sips around the stem. Soaked medium suffocates new roots." },
        { t: "Hold light for ~100-300 PPFD", d: "Too close bleaches; too far makes leggy stretched seedlings." },
        { t: "Log temp + RH daily", d: "Stability matters more than perfection at this stage." }
      ],
      watch: [
        { t: "Leggy stretching", d: "Light is too weak or too far — lower it slightly or raise intensity." },
        { t: "Damping-off (pinched stem)", d: "Cut watering, add gentle airflow immediately." }
      ]
    },
    {
      from: 2,
      phase: "Rooting in",
      focus: "First true leaves out; roots chasing water downward.",
      why: "Letting the top of the medium dry slightly between waterings pulls roots deeper, building the root mass veg growth will run on.",
      climate: "22-26°C · RH 60-70% · VPD 0.5-0.9 kPa",
      light: "PPFD 200-300 · 18h on",
      feed: "Start light feed EC 0.6-0.8 once 2-3 true leaf pairs show.",
      actions: [
        { t: "Begin light feeding (EC 0.6-0.8)", d: "Cotyledons are spent — the plant now needs external nutrition." },
        { t: "Plan transplant when leaves reach pot edge", d: "Classic rule of thumb: leaf span ≈ root span." },
        { t: "Water in a circle away from the stem", d: "Encourages roots to spread outward." }
      ],
      watch: [
        { t: "Yellowing cotyledons", d: "Normal — they are being consumed. Pale NEW growth is the underfeeding signal." }
      ]
    }
  ],
  propagation: [
    {
      from: 1,
      phase: "Clone rooting",
      focus: "High humidity, low light, leaf turgor until roots form.",
      why: "Cuttings have no roots — they survive on leaf moisture. RH 75-85% (dome) keeps them alive until roots appear in 7-14 days.",
      climate: "22-25°C · RH 75-85% (dome) · keep medium warm ~24°C",
      light: "PPFD 100-200 · 18h on",
      feed: "Plain water / rooting solution. EC under 0.6.",
      actions: [
        { t: "Burp the dome 1-2x daily", d: "Fresh air prevents stem rot while keeping RH high." },
        { t: "Check for roots from day 7", d: "Gentle tug resistance or visible white roots at the plug." },
        { t: "Harden off gradually once rooted", d: "Crack the dome open more each day for 2-3 days before removing." }
      ],
      watch: [
        { t: "Wilting cuttings", d: "Dome RH too low or too much light." },
        { t: "Stem rot at the plug", d: "Too wet + no air exchange." }
      ]
    }
  ],
  vegetative: [
    {
      from: 1,
      phase: "Transplant & establish",
      focus: "Root expansion into the new pot before pushing growth.",
      why: "A wet-dry cycle makes roots hunt for water. Constant saturation is the most common beginner mistake — roots need oxygen as much as water.",
      climate: "22-28°C · RH 55-70% · VPD 0.8-1.1 kPa",
      light: "PPFD 300-450 · 18h on",
      feed: "EC 1.0-1.4 · pH 5.8-6.2 (coco/hydro) or 6.2-6.8 (soil)",
      actions: [
        { t: "Water in after transplant, then let it dry back", d: "Lift the pot — weight tells you when to water better than a schedule." },
        { t: "Raise PPFD gradually toward 450", d: "Jumping light levels stresses a fresh transplant." },
        { t: "Log plant height weekly", d: "The app draws growth to scale and tracks the rate for flip planning." }
      ],
      watch: [
        { t: "Droop for 1-2 days post-transplant", d: "Normal. Droop that persists = overwatering." }
      ]
    },
    {
      from: 2,
      phase: "Build structure",
      focus: "Create multiple main colas and an even canopy.",
      why: "Yield tracks light interception. Topping plus LST turns one dominant cola into 4-8 even tops, all sitting at the same PPFD.",
      climate: "22-28°C · RH 55-65% · VPD 0.9-1.2 kPa",
      light: "PPFD 400-600 · 18h on",
      feed: "EC 1.2-1.6 · watch runoff stays within ~0.5 of input",
      actions: [
        { t: "Top above node 4-6", d: "Cut the main tip once 5-7 nodes exist. Two new mains form; repeat later if you want more." },
        { t: "Start LST (tie branches outward)", d: "Low-stress training flattens the canopy without slowing growth." },
        { t: "Don't train within ~3 days of transplant", d: "One stress at a time." }
      ],
      watch: [
        { t: "Pale new growth", d: "Raise feed EC a step — veg appetite grows fast." }
      ]
    },
    {
      from: 3,
      phase: "Canopy fill — plan the flip",
      focus: "Fill the floor, then flip before you run out of headroom.",
      why: "Flower stretch adds 50-100% height in the first 3 weeks of 12/12. Flip when plants fill ~half the floor area — the tent view shows your height budget against the lamp.",
      climate: "22-28°C · RH 55-65% · VPD 1.0-1.2 kPa",
      light: "PPFD 450-600 · 18h on",
      feed: "EC 1.4-1.8",
      actions: [
        { t: "Keep training for a flat canopy", d: "Tuck or tie anything racing ahead." },
        { t: "Remove large inner fan leaves shading bud sites", d: "Light on bud sites now = bud structure later." },
        { t: "Flip to 12/12 when floor is ~50-60% covered", d: "Check remaining height: plant + stretch + lamp gap must fit the tent." }
      ],
      watch: [
        { t: "Daily wilting / very fast dry-back", d: "Likely rootbound — transplant or flip now." }
      ]
    }
  ],
  flower: [
    {
      from: 1,
      phase: "Stretch & transition (wk 1-3)",
      focus: "Manage the stretch; set the canopy you'll harvest.",
      why: "Plants typically gain 50-100% height after the flip. The lamp must keep retreating to hold its PPFD distance — auto-follow does this if your height logs are current.",
      climate: "22-28°C day · RH 50-60% → 50% · VPD 1.0-1.2 kPa",
      light: "PPFD 500-800, ramping · 12h on / 12h OFF unbroken dark",
      feed: "EC 1.6-2.0 · transition to bloom nutrients (more P/K)",
      actions: [
        { t: "Log height 2x/week through the stretch", d: "Keeps the to-scale view and the lamp's auto height honest." },
        { t: "Install trellis/support now", d: "Much harder to add once buds form." },
        { t: "Final defoliation + lollipop around day 21", d: "Strip lower growth that will never see light; it steals energy and traps humid air." },
        { t: "Protect the dark period", d: "Light leaks during the 12h dark cause reveg and hermaphroditism. Check with lights off inside the closed tent." }
      ],
      watch: [
        { t: "Tops growing into the light", d: "Bleached or 'foxtailed' tops — raise the lamp or supercrop the runaway branch." },
        { t: "Pollen sacs at nodes ('bananas')", d: "Stress hermaphroditism — remove them or the plant; seeds ruin the crop." }
      ]
    },
    {
      from: 4,
      phase: "Bulk (wk 4-6)",
      focus: "Stability. Buds swell on consistency, not changes.",
      why: "Without CO2 enrichment, photosynthesis saturates around 800-1000 PPFD — more light past that only adds heat stress. Dense buds + RH above ~55% is where botrytis (bud rot) starts.",
      climate: "24-27°C day · RH 45-50% · VPD 1.2-1.4 kPa · night ≤ 5°C cooler",
      light: "PPFD 700-1000 · 12/12",
      feed: "Peak EC 1.8-2.2 · runoff EC within ~0.5 of input, runoff pH 5.8-6.5",
      actions: [
        { t: "Log runoff EC/pH at every feed", d: "Rising runoff EC = salt buildup; increase runoff % to 15-20%. The Feed station flags drift." },
        { t: "Support heavy branches", d: "Yo-yos or trellis — a snapped branch in week 5 is lost yield." },
        { t: "Check under the canopy weekly", d: "Humid dead air pockets in dense growth are rot incubators." }
      ],
      watch: [
        { t: "Interveinal yellowing mid-canopy", d: "Classic mid-flower magnesium fade — 1-2 ml/L Epsom salt with a feed." },
        { t: "Lights-off RH above 55%", d: "Bud-rot territory. Dehumidify at night — the app's night targets and mold alert track this." }
      ]
    },
    {
      from: 7,
      phase: "Ripen (wk 7-8)",
      focus: "Finish chemistry: trichomes, color, aroma.",
      why: "A 2-5°C night drop late in flower promotes anthocyanin color and is widely used to push ripening. Nitrogen demand falls — keeping N high now delays senescence and harshens smoke.",
      climate: "20-26°C · RH 40-45% · VPD 1.2-1.6 kPa · night drop 2-5°C",
      light: "PPFD taper 10-15% optional · 12/12",
      feed: "EC taper to 1.4-1.8 · reduce N · plain-water 'flush' is OPTIONAL — blind trials found no quality difference; follow your method",
      actions: [
        { t: "Trichome check 2x/week with a 30-60x loupe", d: "Harvest window: mostly cloudy/milky heads with 10-30% amber. Clear = early (racy), heavy amber = sedative/degrading." },
        { t: "Stop all sprays", d: "Anything applied now ends up in the jar." },
        { t: "Prepare the dry space", d: "Target 15-21°C and 55-62% RH, dark, gentle indirect airflow — verify BEFORE chop day." }
      ],
      watch: [
        { t: "Bud rot (gray/brown mushy core)", d: "Inspect dense colas daily; cut out any rot WIDE and drop RH immediately." },
        { t: "Foxtails / new white pistils everywhere", d: "Heat or light stress — raise the lamp slightly." }
      ]
    },
    {
      from: 9,
      phase: "Harvest window (wk 9+)",
      focus: "Chop on trichomes, not on the calendar.",
      why: "Cultivars finish anywhere from 8-11 weeks. Trichome state is the only reliable signal; ambering accelerates in warm rooms.",
      climate: "Keep cool and dry: 18-24°C · RH 40-45%",
      light: "12/12 until chop",
      feed: "Water-only or light feed per your method",
      actions: [
        { t: "Chop when trichomes hit your target", d: "Milky-dominant + 10-30% amber is the standard quality window." },
        { t: "Stagger the harvest if lowers lag", d: "Take ripe tops first; give lower buds another 5-7 days of light." },
        { t: "Weigh wet per plant and log it", d: "Feeds the Harvest analytics (g/W, g/plant) for run-over-run comparison." }
      ],
      watch: [
        { t: "Rapid amber shift", d: "Warm rooms ripen fast — check every 2 days past week 9." }
      ]
    }
  ],
  drying: [
    {
      from: 1,
      phase: "Slow dry (day 1-14)",
      focus: "7-14 days, dark, 15-21°C, 55-62% RH.",
      why: "Chlorophyll breakdown and terpene retention need a slow, cool dry. A 3-day fast dry locks in the 'fresh hay' smell permanently.",
      climate: "15-21°C · RH 55-62% · dark · gentle INDIRECT airflow",
      light: "Dark room — light degrades THC",
      feed: "—",
      actions: [
        { t: "Hang whole plants or branches", d: "Slower than rack-drying trimmed buds = better result." },
        { t: "Check daily: snap test", d: "Done when pencil-thick stems SNAP instead of bending — typically day 7-14." },
        { t: "Never point a fan at the buds", d: "Air should move around the room, not across the flowers." }
      ],
      watch: [
        { t: "RH below 50%", d: "Will overdry in 3-4 days — add a humidifier or slow the exhaust." },
        { t: "RH above 65% or ammonia smell", d: "Mold risk — increase exchange immediately." }
      ]
    }
  ],
  curing: [
    {
      from: 1,
      phase: "Cure",
      focus: "Jars at ~62% RH, burped on schedule, minimum 2-4 weeks.",
      why: "Curing redistributes remaining moisture and continues chlorophyll breakdown — it is the difference between harsh and smooth. 58-65% RH in the jar is the standard window (62% packs exist for a reason).",
      climate: "Jars/bags at 58-65% RH, stored cool and dark",
      light: "Dark storage",
      feed: "—",
      actions: [
        { t: "Burp jars 1-2x daily for week 1", d: "Open 5-10 minutes to exchange air and release moisture." },
        { t: "Then burp weekly from week 2", d: "Hygrometer in the jar takes the guessing out." },
        { t: "Cure at least 2 weeks; 4-8 is better", d: "Patience here is free quality." }
      ],
      watch: [
        { t: "Ammonia smell on opening", d: "Jarred too wet — spread out and re-dry 12-24h, then re-jar." },
        { t: "Crispy buds + RH under 55%", d: "Add a 62% humidity pack to recover slowly." }
      ]
    }
  ],
  complete: [
    {
      from: 1,
      phase: "Run complete",
      focus: "Record results and review the run.",
      why: "The Harvest tab compares g/W, g/plant and g/m² across runs — the fastest way a new grower improves is comparing what changed between runs.",
      climate: "—", light: "—", feed: "—",
      actions: [
        { t: "Enter dry/waste weights in Harvest", d: "Completes the yield analytics for this run." },
        { t: "Note what you'd change next run", d: "Batch notes are the cheapest yield upgrade available." }
      ],
      watch: []
    }
  ]
};

// Returns the guide for a stage + week (last entry whose `from` <= week).
function playbookFor(stageKey, week) {
  const list = GUIDES[stageKey] || GUIDES.vegetative;
  const w = Math.max(1, Number(week) || 1);
  let pick = list[0];
  list.forEach((entry) => { if (entry.from <= w) pick = entry; });
  return pick;
}

// Canonical free-text stage -> GUIDES key. Finer than normalizeStage (which
// folds curing/complete into propagation) and shared by the task generator
// and the Today panel so their phase keys always agree.
function playbookStageKey(stage) {
  const s = String(stage || "").toLowerCase();
  if (s.includes("seed")) return "seedling";
  if (s.includes("prop") || s.includes("clone") || s.includes("cut")) return "propagation";
  if (s.includes("veg")) return "vegetative";
  if (s.includes("flower") || s.includes("bloom")) return "flower";
  if (s.includes("dry")) return "drying";
  if (s.includes("cur")) return "curing";
  if (s.includes("complete") || s.includes("done") || s.includes("finish")) return "complete";
  return "vegetative";
}

window.AppPlaybook = { GUIDES, playbookFor, playbookStageKey };
})();
