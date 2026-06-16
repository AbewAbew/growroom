(() => {
// Cannabis symptom / diagnosis library. Descriptions are written here in plain
// language (not copied verbatim). Each entry points at a local reference photo
// in scraped_symptoms/ (the grower's personal image set); if a file is missing,
// a drawn SVG leaf illustration stands in.
//
// location = where on the plant the tell shows (new vs old growth is the single
//            biggest clue). stages = lowercase normalizeStage keys where common.
// signals  = log conditions that make this MORE likely, used to rank results
//            against a room's readings: phLow, phHigh, ecHigh, ecLow, hot, cold,
//            humidHigh, wet, lightClose. img = file under scraped_symptoms/.

const CATEGORIES = ["Deficiency", "Toxicity / Burn", "pH / Lockout", "Environment", "Watering", "Pest", "Disease", "Stress / Other"];

const SYMPTOMS = [
  // ---- deficiencies ----
  { slug: "nitrogen-deficiency", name: "Nitrogen deficiency", category: "Deficiency", location: "Old / lower leaves", stages: ["seedling", "vegetative", "flower"],
    imgs: ["cannabis-nitrogen-deficiency-bottom.jpg", "almost-nitrogen-deficiency-too-pale.jpg", "flowering-nitrogen-deficiency.jpg", "medium_nitogen-deficient-flowering.jpg", "nitogen-deficient-flowering.jpg", "nitrogen-deficiency-wilted-leaf.jpg", "nitrogen-deficiency-yellow-leaf.jpg", "nitrogen-deficiency-yellow-leaves-piled.jpg"],
    looks: "Lower, older leaves turn uniformly pale then yellow and drop, the yellowing climbing up the plant. The whole leaf fades, not just between the veins.",
    cause: "Not enough nitrogen — or, in the last weeks of flower, a normal natural fade as the plant moves N from leaves into buds.",
    fix: "In veg/early flower, feed a nitrogen-rich nutrient and confirm root-zone pH is in range. In late flower, mild fade is expected — don't push N or you delay ripening.",
    signals: { ecLow: true }, viz: { tone: "yellow", mark: "none" } },
  { slug: "phosphorus-deficiency", name: "Phosphorus deficiency", category: "Deficiency", location: "Old / lower leaves", stages: ["vegetative", "flower"],
    imgs: ["phosphorus-deficiency-leaf-spots-curling.jpg", "phosphorus-deficiency-bagseed-haze.jpg", "phosphorus-deficiency-bagseed-haze2.jpg", "phosphorus-deficiency-leaf-curling.jpg", "phosphorus-deficiency-vegetative.jpg", "red-stems-may-be-first-sign-of-marijuana-phosphorus-deficiency.jpg", "stages-of-phosphorus-deficiency.jpg"],
    looks: "Older leaves go dark blue-green with bronze/purple blotches; stems and petioles often turn red-purple. Spots can look almost metallic.",
    cause: "Low phosphorus, frequently triggered by cold roots (under ~15°C) or by pH out of range locking P out.",
    fix: "Warm the root zone, verify pH, and use a bloom (higher-P) nutrient. Cold nights are a common hidden cause.",
    signals: { cold: true, phLow: true }, viz: { tone: "purple", mark: "spots" } },
  { slug: "potassium-deficiency", name: "Potassium deficiency", category: "Deficiency", location: "Old / lower leaves", stages: ["vegetative", "flower"],
    imgs: ["potassium-deficiency-yellow-brown-edges-not-nutrient-burn.jpg", "cannabis-potassium-deficiency-lower-leaves-yellow.jpg", "marijuana-potassium-deficiency-yellow-edges-tips.jpg", "potassium-deficiency-first-signs-brown-edges.jpg", "potassium-deficiency-marijuana-brown-tips.jpg", "potassium-deficiency-weed-yellow-brown-edges.jpg", "potassium-deficiency-young-cannabis.jpg"],
    looks: "Older-leaf tips and edges scorch yellow-to-brown and curl while the leaf center stays green. Looks like burn but starts at the margins of OLD growth.",
    cause: "Low potassium, often alongside pH issues or after heavy nitrogen feeding.",
    fix: "Check and correct pH, ease off excess N, and supplement K (bloom nutrients are K-rich).",
    signals: { phLow: true, phHigh: true }, viz: { tone: "green", mark: "edge" } },
  { slug: "calcium-deficiency", name: "Calcium deficiency", category: "Deficiency", location: "New / upper leaves", stages: ["seedling", "vegetative", "flower"],
    imgs: ["cannabis-calcium-deficiency.jpg", "beginning-of-calcium-deficiency-from-low-ph.jpg", "brown-burnt-spots-calcium-deficiency-low-ph.jpg", "calcium-deficiency-caused-by-low-ph.jpg", "calcium-deficiency-caused-by-low-ph-at-roots.jpg", "calcium-deficiency-caused-by-low-ph-flowering-stage.jpg", "calcium-deficiency-flowering-caused-by-acidic-soil.jpg", "calcium-deficiency-leaf.jpg"],
    looks: "New growth is distorted, hooked or crinkled with small dead brown spots; tips can die back. Often paired with magnesium issues.",
    cause: "Low calcium — very common in coco and with RO/soft water, or when pH is too low to take Ca up.",
    fix: "Add a Cal-Mag supplement and hold pH around 6.2-6.5 in soil / 5.8-6.2 in coco-hydro.",
    signals: { ecLow: true, phLow: true }, viz: { tone: "green", mark: "spots-new" } },
  { slug: "magnesium-deficiency", name: "Magnesium deficiency", category: "Deficiency", location: "Old / middle leaves", stages: ["vegetative", "flower"],
    imgs: ["marijuana-magnesium-deficiency.jpg", "medium_cannabis-magnesium-deficiency.jpg", "medium_magnesium-deficiency.jpg", "medium_magnesium-info-marijuana.jpg", "mg-magnesium-deficiency.jpg", "red-stem-magnesium-deficiency-yellowing.jpg"],
    looks: "Interveinal yellowing on older and middle leaves — veins stay green while the tissue between yellows; tips may brown and curl. The classic mid-flower 'fade'.",
    cause: "Low magnesium, or pH too low to absorb it. Very common around weeks 4-6 of flower.",
    fix: "Add Cal-Mag or 1-2 ml/L Epsom salt with a feed, and confirm pH. Comes on fast in heavy bloom.",
    signals: { phLow: true }, viz: { tone: "green", mark: "interveinal" } },
  { slug: "sulfur-deficiency", name: "Sulfur deficiency", category: "Deficiency", location: "New / upper leaves", stages: ["vegetative", "flower"],
    imgs: ["medium_sulphur-deficiency.jpg", "medium_sulphur-deficiency2.jpg", "medium_sulphur-info-marijuana.jpg"],
    looks: "Newer leaves go uniformly pale/yellow (like nitrogen, but on NEW growth instead of old), growth slows, leaves can stiffen.",
    cause: "Low sulfur or pH lockout.",
    fix: "Check pH and use a nutrient containing sulfur (many cal-mag and base nutrients do).",
    signals: { phHigh: true }, viz: { tone: "yellow", mark: "new" } },
  { slug: "iron-deficiency", name: "Iron deficiency", category: "Deficiency", location: "New / upper leaves", stages: ["seedling", "vegetative", "flower"],
    imgs: ["iron-deficiency-yellow-new-leaves.jpg", "iron-deficiency-outdoors-too-much-nutrients.jpg"],
    looks: "Bright, almost neon yellow on the NEWEST top growth, with thin green veins still showing. Starts at the top — opposite of nitrogen.",
    cause: "Almost always pH lockout (pH above ~6.5), not a true lack of iron.",
    fix: "Lower root-zone pH into range — iron frees up quickly. Recheck runoff pH.",
    signals: { phHigh: true }, viz: { tone: "yellow-new", mark: "interveinal" } },
  { slug: "zinc-deficiency", name: "Zinc deficiency", category: "Deficiency", location: "New / upper leaves", stages: ["vegetative", "flower"],
    imgs: ["medium_zinc-deficiency-cannabis.jpg", "medium_zinc-deficiency-marijuana.jpeg"],
    looks: "New leaves come in small and twisted with interveinal yellow banding; growing tips bunch up and look stunted. New growth may stay crinkled.",
    cause: "Zinc lockout, usually pH too high.",
    fix: "Correct pH and ensure a full-spectrum micronutrient is in the feed.",
    signals: { phHigh: true }, viz: { tone: "pale", mark: "spots-new" } },
  { slug: "manganese-deficiency", name: "Manganese deficiency", category: "Deficiency", location: "New / middle leaves", stages: ["vegetative", "flower"],
    imgs: ["medium_manganese-info-marijuana.jpg"],
    looks: "Interveinal yellowing that starts at the base of younger leaves with small dead/brown speckles; veins stay green. Like iron, but with spotting.",
    cause: "Manganese lockout, typically pH above ~6.5.",
    fix: "Bring pH into range and supply micronutrients. Often appears with iron/zinc issues.",
    signals: { phHigh: true }, viz: { tone: "yellow-new", mark: "interveinal" } },
  { slug: "boron-deficiency", name: "Boron deficiency", category: "Deficiency", location: "New growth", stages: ["seedling", "vegetative", "flower"],
    imgs: ["medium_boron-deficiency.jpg", "medium_boron-deficiency2.jpg"],
    looks: "New growth shows brown/yellow spotting, thick distorted tips, and growing tips that die back; new leaves come in abnormal and brittle.",
    cause: "Boron lockout — very often from low humidity / underwatering or pH out of range, rarely an actual lack of boron.",
    fix: "Fix watering and humidity, correct pH; a balanced micronutrient supplies boron.",
    signals: {}, viz: { tone: "green", mark: "spots-new" } },
  { slug: "copper-deficiency", name: "Copper deficiency", category: "Deficiency", location: "New leaves / tips", stages: ["vegetative", "flower"],
    imgs: ["copper-deficiency-yellow-tips-leaves.jpg", "copper-deficiency-cannabis-flowering.jpg", "copper-deficiency-flowering.jpg"],
    looks: "Leaves turn dark with bluish/purple undertones while tips and edges go pale yellow or near-white and can look shiny/metallic; growth slows.",
    cause: "Rare on its own — usually pH lockout at the roots.",
    fix: "Set pH into range and make sure micronutrients are present.",
    signals: { phHigh: true }, viz: { tone: "purple", mark: "tips" } },
  { slug: "molybdenum-deficiency", name: "Molybdenum deficiency", category: "Deficiency", location: "Middle leaves", stages: ["vegetative", "flower"],
    imgs: ["medium_molybdenum-deficiency-cole-train.jpg", "medium_molybdenum-deficiency.jpg", "medium_molybdenum-deficiency2.jpg"],
    looks: "Often starts as magnesium-like interveinal yellowing on middle leaves, then edges go orange/pink/red. Uncommon.",
    cause: "pH lockout, worse in acidic soil — a true deficiency is rare.",
    fix: "Correct pH (Mo locks out below ~6.0 in soil) and feed balanced nutrients.",
    signals: { phLow: true }, viz: { tone: "yellow", mark: "interveinal" } },

  // ---- toxicity / burn ----
  { slug: "nutrient-burn", name: "Nutrient burn (overfeeding)", category: "Toxicity / Burn", location: "Leaf tips", stages: ["seedling", "vegetative", "flower"],
    imgs: ["nutrient-burn-leaf-tips.jpg", "extreme-nutrient-burn-curling.jpg", "light-burn-yellow-tips-not-nutrient-burn.jpg", "marijuana-nutrient-burn-tip-curled.jpg", "nute-burn-brown-tips-leaves.jpg", "nute-burn-seedling.jpg", "nutrient-burnt-tips.jpg", "nutrient-tip-burn.jpg"],
    looks: "Leaf TIPS turn yellow then crispy brown and point downward; over time the burn creeps inward from the very tip. Tips look almost dipped in brown.",
    cause: "Nutrient concentration too high (EC/PPM too strong) for the plant.",
    fix: "Lower your feed EC, flush the medium with pH'd plain water, then resume weaker. Seedlings burn easily.",
    signals: { ecHigh: true }, viz: { tone: "green", mark: "tips" } },
  { slug: "nitrogen-toxicity", name: "Nitrogen toxicity (the claw)", category: "Toxicity / Burn", location: "Whole plant", stages: ["vegetative", "flower"],
    imgs: ["flowering-nitrogen-toxicicity-claw-leaves-marijuana.jpg", "buds-bent-leaves-nitrogen-toxic2.jpg", "dark-green-leaves-nitrogen-toxic.jpg", "dry-soil-nitrogen-toxicity.jpg", "flowering-marijuana-leaf-curled-down-too-much-nitrogen.jpg", "marijuana-droopy-leaves-nitrogen-toxic.jpg", "medium_nitogen-too-much.jpg", "nitrogen-toxic-dark-leaves-flowering.jpg"],
    looks: "Dark, glossy green leaves that curl/claw downward at the tips like talons; stems can be weak.",
    cause: "Too much nitrogen, especially heading into flower when N demand drops.",
    fix: "Cut back nitrogen, flush if severe, and switch toward bloom nutrients in flower.",
    signals: { ecHigh: true }, viz: { tone: "darkgreen", mark: "claw" } },

  // ---- pH / lockout ----
  { slug: "ph-lockout", name: "pH lockout (multiple symptoms at once)", category: "pH / Lockout", location: "Whole plant", stages: ["seedling", "vegetative", "flower"],
    imgs: ["ph-fluctuations-cannabis.jpg", "incorrect-ph-cannabis.jpg", "ph-fluctuations-marijuana-label.jpg", "ph-fluctuations-marijuana.jpg"],
    looks: "Several different 'deficiencies' appear together even though you're feeding — yellowing, spotting and burn at once that don't respond to more nutrients.",
    cause: "Root-zone pH is out of range, so nutrients are present but can't be absorbed. The #1 cause of mystery deficiencies.",
    fix: "Set input pH to 5.5-6.5 (coco/hydro) or 6.0-7.0 (soil), check RUNOFF pH, and flush if runoff is far off. Fix pH before adding anything.",
    signals: { phLow: true, phHigh: true }, viz: { tone: "mixed", mark: "spots" } },

  // ---- environment ----
  { slug: "light-burn", name: "Light burn / light bleaching", category: "Environment", location: "Top leaves nearest the light", stages: ["vegetative", "flower"],
    imgs: ["led-grow-light-burn-too-close-top-leaves-turn-yellow.jpg", "bleached-top-cannabis.jpg", "cannabis-heat-stress-light-burn-bleaching-plus-spots-on-leaves-symptoms.jpg", "cannabis-led-light-burn-brown-spots-leaves.jpg", "cannabis-light-bleaching-white-bud-tip.jpg", "droopy-colas-from-grow-light-being-too-close.jpg", "led-burnt-bud.jpg", "led-burnt-cannabis-bud-crispy.jpg"],
    looks: "The uppermost leaves and bud tips closest to the lamp yellow or bleach near-white but stay firm (not mushy); edges may crisp. Lower canopy looks fine.",
    cause: "Light too intense or too close — PPFD past what the plant can use, or the lamp hung too low.",
    fix: "Raise the lamp or dim it. In this app, drag the lamp up or let it auto-follow the stage PPFD target; check the light-to-canopy distance.",
    signals: { lightClose: true }, viz: { tone: "bleached", mark: "tips" } },
  { slug: "heat-stress", name: "Heat stress", category: "Environment", location: "Top / whole plant", stages: ["seedling", "vegetative", "flower"],
    imgs: ["leaf-edges-tipped-up-from-heat.jpg", "cannabis-heat-stress-thirsty.jpg", "dont-look-at-foxtail-from-heat-when-deciding-when-to-harvest-marijuana.jpg", "edges-curling-up-sm_0.jpg", "foxtail-caused-by-heat.jpg", "heat-burn-appear-overnight-flowering.jpg", "just-edges-curling-marijuana-sm_0.jpg", "re-vegging-plant-wrinkled-leaves-look-like-heat-stress.jpg"],
    looks: "Leaves taco/canoe upward at the edges, go dry and crispy; in flower you get airy 'foxtail' growth from the colas.",
    cause: "Air temperature too high and/or not enough airflow; often worst directly under the light.",
    fix: "Lower the temperature, raise the lamp, and increase exhaust/airflow. Watch lights-on temps especially.",
    signals: { hot: true }, viz: { tone: "green", mark: "taco" } },
  { slug: "cold-stress", name: "Cold stress", category: "Environment", location: "Whole plant", stages: ["seedling", "vegetative", "flower"],
    imgs: ["examples-clones-red-stem.jpg"],
    looks: "Purple or red hues spread through leaves and stems, growth stalls, and phosphorus/magnesium uptake suffers.",
    cause: "Temperatures too low, especially at night / lights-off.",
    fix: "Warm the space, particularly the dark period; protect the root zone from cold floors.",
    signals: { cold: true }, viz: { tone: "purple", mark: "none" } },
  { slug: "wind-burn", name: "Wind burn", category: "Environment", location: "Leaves in the fan's path", stages: ["seedling", "vegetative", "flower"],
    imgs: ["wind-burned-leaves-clawing.jpg", "cannabis-wind-leaf-damage.jpg", "wind-burn.jpg", "wind-leaf-damage-spots-cannabis.jpg", "wind-leaf-damage-spots.jpg"],
    looks: "Clawing, twisting and tip-burn that looks like a nutrient problem — but only on the leaves directly in front of a fan.",
    cause: "A fan blowing hard, constantly, on the same foliage.",
    fix: "Redirect the fan to move air around the canopy rather than straight at the plants.",
    signals: {}, viz: { tone: "green", mark: "claw" } },

  // ---- watering ----
  { slug: "overwatering", name: "Overwatering", category: "Watering", location: "Whole plant", stages: ["seedling", "vegetative", "flower"],
    imgs: ["over-watered-cannabis.jpg", "27-day-old-seedling-stunted-from-overwatering.jpg", "medium_cannabis-drooping-overwatered.JPG", "medium_marijuana-drooping-overwatered.JPG", "medium_over-watering.jpg", "over-watered-marijuana-plant.jpg", "over-watered-no-drainage.jpg", "overwatered-marijuana-seedling.jpg"],
    looks: "Leaves droop while looking swollen and firm, curling down from the stem; growth is slow and the medium stays heavy and wet.",
    cause: "Watering too often — roots can't get oxygen. The most common beginner mistake.",
    fix: "Water less often and allow a real dry-back (lift the pot to judge weight). Improve drainage and surface airflow.",
    signals: { wet: true }, viz: { tone: "green", mark: "droop" } },
  { slug: "underwatering", name: "Underwatering", category: "Watering", location: "Whole plant", stages: ["seedling", "vegetative", "flower"],
    imgs: ["underwatered-wilting-droopy-cannabis.jpg", "example-underwatered-cannabis.jpg", "extremely-underwatered-cannabis-plant.jpg", "male-plant-root-problem-chronic-under-watering.jpg", "medium_underwatering-marijuana-plant.jpg", "medium_weed-under-watered.jpg", "under-watered-cannabis.jpg", "under-watered-marijuana-plant.jpg"],
    looks: "Leaves go limp, thin and papery and droop, then perk back up within an hour or two of watering.",
    cause: "Not enough water or too long between waterings; very light, dry pots.",
    fix: "Water more consistently to a proper dry-back, and water until ~15-20% runs out the bottom.",
    signals: {}, viz: { tone: "green", mark: "droop" } },

  // ---- pests ----
  { slug: "spider-mites", name: "Spider mites", category: "Pest", location: "Leaf undersides", stages: ["vegetative", "flower"],
    imgs: [],
    looks: "Tiny pale/yellow speckles (stippling) across leaves; fine silky webbing in bad cases; minute moving dots on the underside.",
    cause: "Spider mites — explode in hot, dry conditions and spread fast.",
    fix: "Isolate, rinse, and treat undersides with insecticidal soap or neem (lights off); repeat every few days. Predatory mites work well. Raise humidity slightly.",
    signals: { hot: true }, viz: { tone: "green", mark: "stipple" } },
  { slug: "fungus-gnats", name: "Fungus gnats", category: "Pest", location: "Soil surface / roots", stages: ["seedling", "vegetative", "flower"],
    imgs: [],
    looks: "Small black flies hopping around the medium surface; tiny clear larvae in the top layer; seedlings and roots weaken.",
    cause: "Fungus gnats breeding in constantly wet topsoil.",
    fix: "Let the top inch dry hard between waterings, add yellow sticky traps, and treat the medium with BTi (mosquito bits). A sand top layer helps.",
    signals: { wet: true }, viz: { tone: "soil", mark: "gnats" } },
  { slug: "thrips", name: "Thrips", category: "Pest", location: "Upper leaf surface", stages: ["vegetative", "flower"],
    imgs: ["thrips-leaf-damage-jennybee698.jpg"],
    looks: "Silvery or bronze shiny scars/patches on leaves with tiny black specks (frass); fast, slender insects.",
    cause: "Thrips rasping the leaf surface.",
    fix: "Blue/yellow sticky traps, neem or spinosad, and predatory mites; remove badly damaged leaves.",
    signals: {}, viz: { tone: "silver", mark: "stipple" } },
  { slug: "aphids-whiteflies", name: "Aphids / whiteflies", category: "Pest", location: "Leaf undersides & stems", stages: ["vegetative", "flower"],
    imgs: [],
    looks: "Clusters of soft insects on undersides and new shoots; sticky 'honeydew' and black sooty mold; clouds of white flies puff up when disturbed.",
    cause: "Sap-sucking aphids or whiteflies.",
    fix: "Insecticidal soap/neem on undersides, sticky traps, and beneficial insects (ladybugs, parasitic wasps).",
    signals: {}, viz: { tone: "green", mark: "spots" } },
  { slug: "broad-russet-mites", name: "Broad / russet mites", category: "Pest", location: "New growth", stages: ["vegetative", "flower"],
    imgs: ["example-of-drooping-top-leaves-caused-by-broad-mite-damage-marijuana.jpg"],
    looks: "New growth is twisted, glossy, curled and stunted but with NO webbing; damage mimics a nutrient or virus problem. Mites are nearly invisible without a scope.",
    cause: "Broad or russet mites — aggressive and easily misdiagnosed.",
    fix: "Act fast and hard: isolate, rotate miticides by mode of action, predatory mites; sanitize tools. Don't wait for confirmation if new growth keeps curling.",
    signals: {}, viz: { tone: "green", mark: "twist" } },

  // ---- diseases ----
  { slug: "powdery-mildew", name: "Powdery mildew", category: "Disease", location: "Leaf surfaces", stages: ["vegetative", "flower"],
    imgs: ["marijuana-powdery-white-mildew-bad-leaf.jpg", "MoldPM_Web-1001.jpg", "MoldPM_Web-1004.jpg", "bad-wpm-white-powdery-mildew-mold-on-cannabis-leaves-mid.jpg", "cannabis-white-powdery-mold-on-leaf.jpg", "marijuana-buds-with-white-powdery-mildew.jpg", "white-powdery-mold-closeup-marijuana-buds.jpg", "white-powdery-mold-stem.jpg"],
    looks: "Patches of white, flour-like powder on top of leaves that wipe off with a finger; spreads to stems and buds.",
    cause: "Fungal — thrives in high humidity with poor airflow and crowded canopies.",
    fix: "Drop humidity, boost airflow and spacing, bag-remove affected leaves (don't shake spores), and treat. Never let infected buds dry with the crop.",
    signals: { humidHigh: true }, viz: { tone: "green", mark: "powder" } },
  { slug: "bud-rot", name: "Bud rot (botrytis)", category: "Disease", location: "Inside dense buds", stages: ["flower", "drying"],
    imgs: ["bud-rot-inside.jpg", "bad-case-bud-rot.jpg", "brown-crispy-bud-rot-med.jpg", "bud-rot-botrytis.jpg", "bud-rot-cannabis-cola.jpg", "bud-rot-cola-the-day-after-closeup.jpg", "bud-rot-cola-the-day-after.jpg", "bud-rot-damage.jpg"],
    looks: "Gray/brown mushy decay in the core of a cola; a single leaf poking from a bud goes dry/dead — pull it and the rot is inside. Spreads fast.",
    cause: "Botrytis — driven by high humidity and condensation, especially dense buds in cool, humid lights-off air.",
    fix: "Remove affected buds WIDE (into healthy tissue) into a bag, drop RH below ~50%, and increase air movement. The app's bud-rot alert watches the dew-point gap for you.",
    signals: { humidHigh: true }, viz: { tone: "bud", mark: "rot" } },
  { slug: "root-rot", name: "Root rot (pythium)", category: "Disease", location: "Roots", stages: ["seedling", "vegetative", "flower"],
    imgs: ["root-rot-slimy-roots.jpg", "aerogarden-cannabis-plant-example-dwc-root-rot.jpg", "bad-root-rot-before.jpg", "bad-root-rot-closeup.jpg", "brown-tinge-on-marijuana-roots-first-sign-of-root-rot.jpg", "curling-leaves-from-cannabis-root-rot.jpg", "effects-of-root-rot.jpg", "example-marijuana-root-rot-brown-above-the-waterline.jpg"],
    looks: "Plant wilts and yellows even though the medium is wet; roots turn brown, slimy and smell foul instead of white and firm.",
    cause: "Pathogens in an oxygen-starved, warm, overwatered or stagnant root zone.",
    fix: "Increase oxygen (airstones / dry-back), cool the res below ~22°C, clean the system, and add beneficial bacteria (Bacillus/Trichoderma).",
    signals: { wet: true }, viz: { tone: "roots", mark: "rot" } },
  { slug: "leaf-septoria", name: "Leaf septoria (yellow leaf spot)", category: "Disease", location: "Lower / older leaves first", stages: ["vegetative", "flower"],
    imgs: ["yellow-spots-tmv-or-weird-disease-virus-cannabis-yellow-leaf-spot-leaf-septoria-started-at-one-and-half-month-old.jpg"],
    looks: "Yellow and brown round spots (often with a tan center) appear on lower/older leaves first and spread upward; starts in warm, wet conditions.",
    cause: "Septoria fungus, favored by heat, humidity, and water splashing onto foliage.",
    fix: "Remove affected leaves, improve airflow, avoid wetting leaves, keep nutrition solid, and use a fungicide if it spreads.",
    signals: { humidHigh: true }, viz: { tone: "green", mark: "spots" } },
  { slug: "tmv", name: "Mosaic virus (TMV-type)", category: "Disease", location: "New & whole plant", stages: ["vegetative", "flower"],
    imgs: ["mosaic-pattern-on-cannabis-leaves-caused-by-tmv.jpg", "could-it-be-tmv-marijuana.jpg", "marijuana-tmv-mosaic-virus-twisted-leaf.jpg", "not-tmv-mosaic-stripes-on-leaves.jpg", "plant-with-mosaic-stripes-but-no-tmv.jpg", "possibly-tmv-tobacco-mosaic-virus.jpg", "possibly-tmv-yellow-streaks-cannabis-leaves.jpg", "tmv-tobacco-mosaic-virus-marijuana-plant.jpg"],
    looks: "A mottled light/dark mosaic with twisted, wrinkled or striped leaves that matches no deficiency and doesn't resolve with feeding.",
    cause: "A mosaic-type virus spread by handling, dirty tools, and tobacco contact. (True cannabis TMV is debated, but mosaic viruses do occur.)",
    fix: "No cure — isolate or cull, sanitize hands and tools, and never handle plants right after tobacco. Prevention only.",
    signals: {}, viz: { tone: "mixed", mark: "spots" } },
  { slug: "beet-curly-top-virus", name: "Beet curly top virus", category: "Disease", location: "Whole plant", stages: ["vegetative", "flower"],
    imgs: ["beet-curly-top-virus-cannabis-symptoms-Leaf-curling-associated-with-infection-of-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University.jpg", "closeup-of-beet-curly-top-virus-cannabis-symptoms-Leaf-curling-associated-with-infection-of-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University.jpg", "example-of-beet-curly-top-virus-cannabis-symptoms-Leaf-curling-associated-with-infection-of-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University.jpg", "Beet-curly-top-virus-infection-showing-both-yellowing-and-strong-leaf-curling-by-Whitney-Cranshaw-of-Colorado-State-University-1.jpg", "Bisymptomatic-hemp-plant-infected-with-beet-curly-top-by-Whitney-Cranshaw-of-Colorado-State-University-1.jpg", "beet-curly-top-virus-BCTV-Hybrigeminivirus-Beet-curly-top-virus-Leaf-curling-associated-with-infection-of-cannabis-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University-6.jpg", "beet-curly-top-virus-BCTV-Hybrigeminivirus-Beet-curly-top-virus-Leaf-curling-associated-with-infection-of-cannabis-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University-8.jpg", "beet-curly-top-virus-BCTV-Hybrigeminivirus-Beet-curly-top-virus-Leaf-curling-associated-with-infection-of-cannabis-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University-9.jpg"],
    looks: "Severe upward leaf curling with yellowing and stunting; growth looks twisted and crinkled, often worse on one side.",
    cause: "Beet curly top virus, spread by beet leafhoppers — mainly an outdoor problem in arid regions.",
    fix: "No cure — remove infected plants and control leafhoppers (row covers, insect control). Prevention only.",
    signals: {}, viz: { tone: "green", mark: "twist" } },

  // ---- stress / other ----
  { slug: "re-vegging", name: "Re-vegging (light leak)", category: "Stress / Other", location: "Bud sites / new growth", stages: ["flower"],
    imgs: ["re-vegging-cannabis-plant.jpg", "cannabis-re-veg-after-harvest-odd-round-leaves.jpg", "cannabis-re-veg-bud-clone.jpg", "clone-of-budding-plant-reveg.jpg", "example-monstercropped-plant-getting-bushy-GDTRFB95.jpg", "re-veg-almost-done-flowering.jpg", "re-veg-monster-crop.jpg", "re-vegging-plant-wrinkled-leaves-look-like-heat-stress.jpg"],
    looks: "A flowering plant grows odd smooth-edged, single-finger leaves out of the bud sites, buds stall, and growth twists and wrinkles.",
    cause: "The plant received light during its 12-hour dark period (a light leak or lights-on at night) and started reverting toward veg.",
    fix: "Give a strict, uninterrupted 12h dark period — seal light leaks and check inside the tent with lights off. It will resume flowering over a few weeks.",
    signals: {}, viz: { tone: "green", mark: "twist" } },
  { slug: "hermies", name: "Hermies / pollen sacs / nanners", category: "Stress / Other", location: "Buds", stages: ["flower"],
    imgs: ["clear-hermie-pic.jpg", "bananas-middle-bud.jpg", "cannabis-hermie-yellow-nanner-banana.jpg", "closeup-example-of-herm-cannabis-banana-arrow.jpg", "green-hermie-banana.jpg", "herm-marijuana-bud-burnt-by-heat-and-too-much-light-ready-to-harvest-immediately.jpg", "hermaphodite-hermie-pollen-sacs-partway-through-flowering.jpg", "hermaphrodite-cannabis.jpg"],
    looks: "Pollen sacs (round balls) or yellow banana-shaped 'nanners' appear among the pistils on a female's buds.",
    cause: "Stress — heat, light leaks, an irregular light schedule, or genetics — pushing a female plant to self-pollinate.",
    fix: "Remove sacs/nanners early and fix the stressor (heat, light schedule, light leaks). Pollen ruins seedless buds, so isolate badly hermied plants.",
    signals: { hot: true }, viz: { tone: "bud", mark: "spots" } }
];

// ---- fallback leaf illustration (shown only when a photo is missing) ----
const LEAF = "M50 8 C 46 26 40 30 30 30 C 40 34 44 40 42 54 C 36 50 30 52 24 60 C 34 60 40 66 40 78 C 44 70 47 72 50 92 C 53 72 56 70 60 78 C 60 66 66 60 76 60 C 70 52 64 50 58 54 C 56 40 60 34 70 30 C 60 30 54 26 50 8 Z";
const TONES = {
  green: "#4f9d57", darkgreen: "#2f5d34", yellow: "#d6c24a", "yellow-new": "#e3df6a",
  pale: "#bcd08a", purple: "#7d5b9c", bleached: "#e9e6c4", silver: "#a9b6ad",
  mixed: "#8a9d4f", soil: "#5a4630", bud: "#7c8f4a", roots: "#b8a07a"
};
function leafSvg(viz) {
  const tone = TONES[viz?.tone] || TONES.green;
  const mark = viz?.mark || "none";
  let overlay = "";
  if (mark === "tips") overlay = `<circle cx="50" cy="12" r="4" fill="#7a4420"/><circle cx="28" cy="32" r="3" fill="#7a4420"/><circle cx="72" cy="32" r="3" fill="#7a4420"/>`;
  else if (mark === "edge") overlay = `<path d="${LEAF}" fill="none" stroke="#c9a13a" stroke-width="4" opacity="0.6"/>`;
  else if (mark === "interveinal") overlay = `<g stroke="#2f6a3a" stroke-width="2" opacity="0.85"><line x1="50" y1="18" x2="50" y2="86"/><line x1="50" y1="40" x2="30" y2="34"/><line x1="50" y1="40" x2="70" y2="34"/><line x1="50" y1="58" x2="28" y2="60"/><line x1="50" y1="58" x2="72" y2="60"/></g>`;
  else if (mark === "spots" || mark === "spots-new") overlay = `<g fill="#5a3214" opacity="0.75"><circle cx="42" cy="40" r="3"/><circle cx="60" cy="50" r="2.5"/><circle cx="48" cy="62" r="3.5"/><circle cx="56" cy="34" r="2"/></g>`;
  else if (mark === "powder") overlay = `<g fill="#e8efe4" opacity="0.85"><circle cx="44" cy="42" r="6"/><circle cx="58" cy="52" r="5"/><circle cx="50" cy="60" r="4"/></g>`;
  else if (mark === "stipple") overlay = `<g fill="#dcd77a" opacity="0.9">${Array.from({ length: 22 }, (_, i) => `<circle cx="${30 + ((i * 17) % 40)}" cy="${28 + ((i * 29) % 50)}" r="0.9"/>`).join("")}</g>`;
  else if (mark === "claw" || mark === "droop" || mark === "taco" || mark === "twist") overlay = `<path d="M50 50 q -18 14 -22 30 M50 54 q 18 12 22 28" fill="none" stroke="#1c3a22" stroke-width="2" opacity="0.5"/>`;
  else if (mark === "rot") overlay = `<g fill="#3a2a1a" opacity="0.8"><circle cx="50" cy="55" r="10"/><circle cx="44" cy="48" r="5"/></g>`;
  else if (mark === "gnats") overlay = `<g fill="#1a1a1a">${[0, 1, 2, 3, 4].map((i) => `<circle cx="${28 + ((i * 23) % 45)}" cy="${30 + ((i * 31) % 48)}" r="1.4"/>`).join("")}</g>`;
  const transform = mark === "taco" ? "scale(0.86,1) translate(8,0)" : "";
  return `<svg class="dx-leaf-svg" viewBox="0 0 100 100" aria-hidden="true"><g transform="${transform}"><path d="${LEAF}" fill="${tone}"/></g>${overlay}</svg>`;
}

// ---- log-aware ranking: which symptoms are likeliest in THIS room ----
function rankForRoom(room, state) {
  const A = window.AppAlerts, U = window.AppUtils;
  const reading = A.reading;
  const stageKey = U.normalizeStage(room.stage);
  const soil = /soil/i.test(room.medium || "") && !/soilless/i.test(room.medium || "");
  const phLo = soil ? 6.0 : 5.5, phHi = soil ? 7.0 : 6.5;
  const latest = (type) => [...state.logs].reverse().find((l) => l.roomId === room.id && l.type === type);
  const med = latest("medium"), feed = latest("irrigation"), env = latest("environment");
  const ph = med && Number.isFinite(reading(med.substratePh)) ? reading(med.substratePh) : feed ? reading(feed.runoffPh) : NaN;
  const ec = med && Number.isFinite(reading(med.substrateEc)) ? reading(med.substrateEc) : feed ? reading(feed.ec) : NaN;
  const tempF = env ? A.resolvedTempF(env) : NaN;
  const rh = env ? reading(env.humidity) : NaN;
  const moisture = med ? reading(med.moisture) : NaN;
  const flags = {
    phLow: Number.isFinite(ph) && ph < phLo,
    phHigh: Number.isFinite(ph) && ph > phHi,
    ecHigh: Number.isFinite(ec) && ec > 2.4,
    ecLow: Number.isFinite(ec) && ec < 0.8,
    hot: Number.isFinite(tempF) && tempF > 85,
    cold: Number.isFinite(tempF) && tempF < 62,
    humidHigh: Number.isFinite(rh) && rh > 60,
    wet: Number.isFinite(moisture) && moisture > 80,
    lightClose: Number.isFinite(reading(room.lightHeightIn)) && reading(room.lightHeightIn) < 12
  };
  const scores = {};
  SYMPTOMS.forEach((s) => {
    let score = 0;
    const sig = s.signals || {};
    Object.keys(flags).forEach((k) => { if (sig[k] && flags[k]) score += 3; });
    if (s.stages && s.stages.includes(stageKey)) score += 1;
    scores[s.slug] = score;
  });
  return { scores, flags, ph, ec, phLo, phHi, soil };
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseMarkdownToHtml(md) {
  if (!md) return "";
  let html = md;

  html = html.replace(/\r/g, "");
  html = html.replace(/\*\*\*([^\*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^\*]+)\*/g, "<em>$1</em>");
  html = html.replace(/!\[(.*?)\]\((?:scraped_symptoms_high_res\/|scraped_symptoms\/)?(.*?)\)/g, (match, alt, filename) => {
    return `<div class="dx-detail-img-container"><img class="dx-detail-img" src="scraped_symptoms_high_res/${encodeURIComponent(filename)}" alt="${escapeHtml(alt || 'Detail Image')}" loading="lazy" /></div>`;
  });
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
  html = html.replace(/^#### (.*?)$/gm, "<h4>$1</h4>");
  html = html.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*?)$/gm, "<h1>$1</h1>");
  html = html.replace(/^> (.*?)$/gm, "<blockquote>$1</blockquote>");

  const listLines = html.split("\n");
  let inList = false;
  for (let i = 0; i < listLines.length; i++) {
    let line = listLines[i].trim();
    if (line.startsWith("* ")) {
      let content = line.substring(2);
      if (!inList) {
        listLines[i] = "<ul>\n<li>" + content + "</li>";
        inList = true;
      } else {
        listLines[i] = "<li>" + content + "</li>";
      }
    } else {
      if (inList) {
        listLines[i - 1] += "\n</ul>";
        inList = false;
      }
    }
  }
  if (inList) {
    listLines[listLines.length - 1] += "\n</ul>";
  }
  html = listLines.join("\n");

  const tableLines = html.split("\n");
  let inTable = false;
  for (let i = 0; i < tableLines.length; i++) {
    let line = tableLines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      let cells = line.split("|").slice(1, -1).map(c => c.trim());
      if (!inTable) {
        tableLines[i] = "<table class=\"dx-table\">\n<thead>\n<tr>" + cells.map(c => `<th>${c}</th>`).join("") + "</tr>\n</thead>\n<tbody>";
        inTable = true;
      } else if (cells.every(c => c.match(/^:?-+:?$/))) {
        tableLines[i] = "";
      } else {
        tableLines[i] = "<tr>" + cells.map(c => `<td>${c}</td>`).join("") + "</tr>";
      }
    } else {
      if (inTable) {
        tableLines[i - 1] += "\n</tbody>\n</table>";
        inTable = false;
      }
    }
  }
  if (inTable) {
    tableLines[tableLines.length - 1] += "\n</tbody>\n</table>";
  }
  html = tableLines.join("\n");

  html = html.split(/\n\n+/).map(block => {
    block = block.trim();
    if (!block) return "";
    if (block.startsWith("<h") || block.startsWith("<ul") || block.startsWith("<div") || block.startsWith("<ul>") || block.startsWith("<h1>") || block.startsWith("<h2>") || block.startsWith("<h3>") || block.startsWith("<h4>") || block.startsWith("<h5>") || block.startsWith("<h6>") || block.startsWith("<blockquote>") || block.startsWith("<table")) {
      return block;
    }
    return `<p>${block.replace(/\n/g, "<br>")}</p>`;
  }).join("\n\n");

  return html;
}

let GUIDES_CACHE = {};

async function loadDetailedGuides() {
  try {
    const res = await fetch("/symptoms_guide.md");
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const text = await res.text();
    
    const cleanText = text.replace(/\r\n/g, "\n");
    const sections = cleanText.split(/\n## /);
    
    const slugToHeadings = {
      "nitrogen-deficiency": ["Nitrogen Deficiency"],
      "phosphorus-deficiency": ["Phosphorus Deficiency", "Solution For Cannabis Phosphorus Deficiency"],
      "potassium-deficiency": ["Potassium Deficiency"],
      "calcium-deficiency": ["Calcium Deficiency"],
      "magnesium-deficiency": ["Magnesium Deficiency", "Solution For Magnesium Deficiency in Cannabis"],
      "sulfur-deficiency": ["Sulfur Deficiency"],
      "iron-deficiency": ["Iron Deficiency"],
      "zinc-deficiency": ["Zinc Deficiency"],
      "manganese-deficiency": ["Manganese Deficiency"],
      "boron-deficiency": ["Boron Deficiency"],
      "copper-deficiency": ["Copper Deficiency"],
      "molybdenum-deficiency": ["Molybdenum Deficiency"],
      "nutrient-burn": ["Nutrient Burn"],
      "nitrogen-toxicity": ["Nitrogen Toxicity"],
      "ph-lockout": ["pH Fluctuations"],
      "light-burn": ["Light Burn or Light Stress"],
      "heat-stress": ["Heat Stress"],
      "cold-stress": ["Cold Stress"],
      "wind-burn": ["Wind Burn"],
      "overwatering": ["Over-Watering", "Overwatered Marijuana Plants"],
      "underwatering": ["Under-watering"],
      "spider-mites": ["Spider Mites"],
      "fungus-gnats": ["Fungus Gnats"],
      "thrips": ["Thrips"],
      "aphids-whiteflies": ["Aphids and Whiteflies"],
      "broad-russet-mites": ["Broad Mites", "Broad / russet mites"],
      "powdery-mildew": ["Powdery Mildew", "White Powdery Mildew"],
      "root-rot": ["Root Rot", "Root Problems"],
      "leaf-septoria": ["Leaf Septoria / Yellow Leaf Spot"],
      "tmv": ["Tobacco Mosaic Virus (TMV)"],
      "beet-curly-top-virus": ["Beet Curly Top Virus"],
      "re-vegging": ["Accidental Re-Vegging"],
      "hermies": ["Hermies, Pollen Sacs &#038; Bananas", "Hermies, Pollen Sacs & Bananas"]
    };

    Object.keys(slugToHeadings).forEach(slug => {
      GUIDES_CACHE[slug] = "";
    });
    
    sections.forEach(section => {
      const lines = section.split("\n");
      const heading = lines[0].trim();
      const contentMd = lines.slice(1).join("\n").trim();
      if (!contentMd) return;
      
      for (const [slug, headings] of Object.entries(slugToHeadings)) {
        if (headings.some(h => heading.toLowerCase().includes(h.toLowerCase()) || h.toLowerCase().includes(heading.toLowerCase()))) {
          const parsedHtml = parseMarkdownToHtml(contentMd);
          GUIDES_CACHE[slug] = (GUIDES_CACHE[slug] || "") + parsedHtml;
          break;
        }
      }
    });
    
    console.log("Symptom guides loaded. Cache size:", Object.keys(GUIDES_CACHE).length);
  } catch (err) {
    console.error("Failed to load detailed guides:", err);
  }
}

function getDetailedGuide(slug) {
  return GUIDES_CACHE[slug] || "";
}

const HI_RES = {
  "cannabis-nitrogen-deficiency-bottom.jpg": "cannabis-nitrogen-deficiency-bottom.jpg",
  "almost-nitrogen-deficiency-too-pale.jpg": "almost-nitrogen-deficiency-too-pale.jpg",
  "flowering-nitrogen-deficiency.jpg": "flowering-nitrogen-deficiency.jpg",
  "nitogen-deficient-flowering.jpg": "nitogen-deficient-flowering.jpg",
  "nitrogen-deficiency-wilted-leaf.jpg": "nitrogen-deficiency-wilted-leaf.jpg",
  "nitrogen-deficiency-yellow-leaf.jpg": "nitrogen-deficiency-yellow-leaf.jpg",
  "nitrogen-deficiency-yellow-leaves-piled.jpg": "nitrogen-deficiency-yellow-leaves-piled.jpg",
  "phosphorus-deficiency-leaf-spots-curling.jpg": "phosphorus-deficiency-leaf-spots-curling.jpg",
  "phosphorus-deficiency-bagseed-haze.jpg": "phosphorus-deficiency-bagseed-haze.jpg",
  "phosphorus-deficiency-bagseed-haze2.jpg": "phosphorus-deficiency-bagseed-haze2.jpg",
  "phosphorus-deficiency-leaf-curling.jpg": "phosphorus-deficiency-leaf-curling.jpg",
  "phosphorus-deficiency-vegetative.jpg": "phosphorus-deficiency-vegetative.jpg",
  "red-stems-may-be-first-sign-of-marijuana-phosphorus-deficiency.jpg": "red-stems-may-be-first-sign-of-marijuana-phosphorus-deficiency.jpg",
  "stages-of-phosphorus-deficiency.jpg": "stages-of-phosphorus-deficiency.jpg",
  "potassium-deficiency-yellow-brown-edges-not-nutrient-burn.jpg": "potassium-deficiency-yellow-brown-edges-not-nutrient-burn.jpg",
  "cannabis-potassium-deficiency-lower-leaves-yellow.jpg": "cannabis-potassium-deficiency-lower-leaves-yellow.jpg",
  "marijuana-potassium-deficiency-yellow-edges-tips.jpg": "marijuana-potassium-deficiency-yellow-edges-tips.jpg",
  "potassium-deficiency-first-signs-brown-edges.jpg": "potassium-deficiency-first-signs-brown-edges.jpg",
  "potassium-deficiency-marijuana-brown-tips.jpg": "potassium-deficiency-marijuana-brown-tips.jpg",
  "potassium-deficiency-weed-yellow-brown-edges.jpg": "potassium-deficiency-weed-yellow-brown-edges.jpg",
  "potassium-deficiency-young-cannabis.jpg": "potassium-deficiency-young-cannabis.jpg",
  "cannabis-calcium-deficiency.jpg": "cannabis-calcium-deficiency.jpg",
  "beginning-of-calcium-deficiency-from-low-ph.jpg": "beginning-of-calcium-deficiency-from-low-ph.jpg",
  "brown-burnt-spots-calcium-deficiency-low-ph.jpg": "brown-burnt-spots-calcium-deficiency-low-ph.jpg",
  "calcium-deficiency-caused-by-low-ph.jpg": "calcium-deficiency-caused-by-low-ph.jpg",
  "calcium-deficiency-caused-by-low-ph-at-roots.jpg": "calcium-deficiency-caused-by-low-ph-at-roots.jpg",
  "calcium-deficiency-caused-by-low-ph-flowering-stage.jpg": "calcium-deficiency-caused-by-low-ph-flowering-stage.jpg",
  "calcium-deficiency-flowering-caused-by-acidic-soil.jpg": "calcium-deficiency-flowering-caused-by-acidic-soil.jpg",
  "calcium-deficiency-leaf.jpg": "calcium-deficiency-leaf.jpg",
  "marijuana-magnesium-deficiency.jpg": "marijuana-magnesium-deficiency.jpg",
  "mg-magnesium-deficiency.jpg": "mg-magnesium-deficiency.jpg",
  "red-stem-magnesium-deficiency-yellowing.jpg": "red-stem-magnesium-deficiency-yellowing.jpg",
  "iron-deficiency-yellow-new-leaves.jpg": "iron-deficiency-yellow-new-leaves.jpg",
  "copper-deficiency-yellow-tips-leaves.jpg": "copper-deficiency-yellow-tips-leaves.jpg",
  "copper-deficiency-cannabis-flowering.jpg": "copper-deficiency-cannabis-flowering.jpg",
  "copper-deficiency-flowering.jpg": "copper-deficiency-flowering.jpg",
  "nutrient-burn-leaf-tips.jpg": "nutrient-burn-leaf-tips.jpg",
  "extreme-nutrient-burn-curling.jpg": "extreme-nutrient-burn-curling.jpg",
  "light-burn-yellow-tips-not-nutrient-burn.jpg": "light-burn-yellow-tips-not-nutrient-burn.jpg",
  "marijuana-nutrient-burn-tip-curled.jpg": "marijuana-nutrient-burn-tip-curled.jpg",
  "nute-burn-brown-tips-leaves.jpg": "nute-burn-brown-tips-leaves.jpg",
  "nute-burn-seedling.jpg": "nute-burn-seedling.jpg",
  "nutrient-burnt-tips.jpg": "nutrient-burnt-tips.jpg",
  "nutrient-tip-burn.jpg": "nutrient-tip-burn.jpg",
  "flowering-nitrogen-toxicicity-claw-leaves-marijuana.jpg": "flowering-nitrogen-toxicicity-claw-leaves-marijuana.jpg",
  "buds-bent-leaves-nitrogen-toxic2.jpg": "buds-bent-leaves-nitrogen-toxic2.jpg",
  "dark-green-leaves-nitrogen-toxic.jpg": "dark-green-leaves-nitrogen-toxic.jpg",
  "dry-soil-nitrogen-toxicity.jpg": "dry-soil-nitrogen-toxicity.jpg",
  "flowering-marijuana-leaf-curled-down-too-much-nitrogen.jpg": "flowering-marijuana-leaf-curled-down-too-much-nitrogen.jpg",
  "marijuana-droopy-leaves-nitrogen-toxic.jpg": "marijuana-droopy-leaves-nitrogen-toxic.jpg",
  "nitrogen-toxic-dark-leaves-flowering.jpg": "nitrogen-toxic-dark-leaves-flowering.jpg",
  "ph-fluctuations-cannabis.jpg": "ph-fluctuations-cannabis.jpg",
  "incorrect-ph-cannabis.jpg": "incorrect-ph-cannabis.jpg",
  "ph-fluctuations-marijuana.jpg": "ph-fluctuations-marijuana.jpg",
  "led-grow-light-burn-too-close-top-leaves-turn-yellow.jpg": "led-grow-light-burn-too-close-top-leaves-turn-yellow.jpg",
  "bleached-top-cannabis.jpg": "bleached-top-cannabis.jpg",
  "cannabis-heat-stress-light-burn-bleaching-plus-spots-on-leaves-symptoms.jpg": "cannabis-heat-stress-light-burn-bleaching-plus-spots-on-leaves-symptoms.jpg",
  "cannabis-led-light-burn-brown-spots-leaves.jpg": "cannabis-led-light-burn-brown-spots-leaves.jpg",
  "cannabis-light-bleaching-white-bud-tip.jpg": "cannabis-light-bleaching-white-bud-tip.jpg",
  "droopy-colas-from-grow-light-being-too-close.jpg": "droopy-colas-from-grow-light-being-too-close.jpg",
  "led-burnt-bud.jpg": "led-burnt-bud.jpg",
  "led-burnt-cannabis-bud-crispy.jpg": "led-burnt-cannabis-bud-crispy.jpg",
  "leaf-edges-tipped-up-from-heat.jpg": "leaf-edges-tipped-up-from-heat.jpg",
  "cannabis-heat-stress-thirsty.jpg": "cannabis-heat-stress-thirsty.jpg",
  "dont-look-at-foxtail-from-heat-when-deciding-when-to-harvest-marijuana.jpg": "dont-look-at-foxtail-from-heat-when-deciding-when-to-harvest-marijuana.jpg",
  "foxtail-caused-by-heat.jpg": "foxtail-caused-by-heat.jpg",
  "heat-burn-appear-overnight-flowering.jpg": "heat-burn-appear-overnight-flowering.jpg",
  "re-vegging-plant-wrinkled-leaves-look-like-heat-stress.jpg": "re-vegging-plant-wrinkled-leaves-look-like-heat-stress.jpg",
  "examples-clones-red-stem.jpg": "examples-clones-red-stem.jpg",
  "wind-burned-leaves-clawing.jpg": "wind-burned-leaves-clawing.jpg",
  "cannabis-wind-leaf-damage.jpg": "cannabis-wind-leaf-damage.jpg",
  "wind-burn.jpg": "wind-burn.jpg",
  "wind-leaf-damage-spots-cannabis.jpg": "wind-leaf-damage-spots-cannabis.jpg",
  "wind-leaf-damage-spots.jpg": "wind-leaf-damage-spots.jpg",
  "over-watered-cannabis.jpg": "over-watered-cannabis.jpg",
  "27-day-old-seedling-stunted-from-overwatering.jpg": "27-day-old-seedling-stunted-from-overwatering.jpg",
  "over-watered-marijuana-plant.jpg": "over-watered-marijuana-plant.jpg",
  "over-watered-no-drainage.jpg": "over-watered-no-drainage.jpg",
  "underwatered-wilting-droopy-cannabis.jpg": "underwatered-wilting-droopy-cannabis.jpg",
  "example-underwatered-cannabis.jpg": "example-underwatered-cannabis.jpg",
  "extremely-underwatered-cannabis-plant.jpg": "extremely-underwatered-cannabis-plant.jpg",
  "male-plant-root-problem-chronic-under-watering.jpg": "male-plant-root-problem-chronic-under-watering.jpg",
  "under-watered-cannabis.jpg": "under-watered-cannabis.jpg",
  "under-watered-marijuana-plant.jpg": "under-watered-marijuana-plant.jpg",
  "thrips-leaf-damage-jennybee698.jpg": "thrips-leaf-damage-jennybee698.jpg",
  "example-of-drooping-top-leaves-caused-by-broad-mite-damage-marijuana.jpg": "example-of-drooping-top-leaves-caused-by-broad-mite-damage-marijuana.jpg",
  "bad-wpm-white-powdery-mildew-mold-on-cannabis-leaves-mid.jpg": "bad-wpm-white-powdery-mildew-mold-on-cannabis-leaves-mid.jpg",
  "cannabis-white-powdery-mold-on-leaf.jpg": "cannabis-white-powdery-mold-on-leaf.jpg",
  "marijuana-buds-with-white-powdery-mildew.jpg": "marijuana-buds-with-white-powdery-mildew.jpg",
  "white-powdery-mold-stem.jpg": "white-powdery-mold-stem.jpg",
  "bud-rot-inside.jpg": "bud-rot-inside.jpg",
  "bad-case-bud-rot.jpg": "bad-case-bud-rot.jpg",
  "bud-rot-botrytis.jpg": "bud-rot-botrytis.jpg",
  "bud-rot-cannabis-cola.jpg": "bud-rot-cannabis-cola.jpg",
  "bud-rot-cola-the-day-after-closeup.jpg": "bud-rot-cola-the-day-after-closeup.jpg",
  "bud-rot-cola-the-day-after.jpg": "bud-rot-cola-the-day-after.jpg",
  "bud-rot-damage.jpg": "bud-rot-damage.jpg",
  "root-rot-slimy-roots.jpg": "root-rot-slimy-roots.jpg",
  "aerogarden-cannabis-plant-example-dwc-root-rot.jpg": "aerogarden-cannabis-plant-example-dwc-root-rot.jpg",
  "bad-root-rot-before.jpg": "bad-root-rot-before.jpg",
  "bad-root-rot-closeup.jpg": "bad-root-rot-closeup.jpg",
  "brown-tinge-on-marijuana-roots-first-sign-of-root-rot.jpg": "brown-tinge-on-marijuana-roots-first-sign-of-root-rot.jpg",
  "curling-leaves-from-cannabis-root-rot.jpg": "curling-leaves-from-cannabis-root-rot.jpg",
  "effects-of-root-rot.jpg": "effects-of-root-rot.jpg",
  "example-marijuana-root-rot-brown-above-the-waterline.jpg": "example-marijuana-root-rot-brown-above-the-waterline.jpg",
  "yellow-spots-tmv-or-weird-disease-virus-cannabis-yellow-leaf-spot-leaf-septoria-started-at-one-and-half-month-old.jpg": "yellow-spots-tmv-or-weird-disease-virus-cannabis-yellow-leaf-spot-leaf-septoria-started-at-one-and-half-month-old.jpg",
  "mosaic-pattern-on-cannabis-leaves-caused-by-tmv.jpg": "mosaic-pattern-on-cannabis-leaves-caused-by-tmv.jpg",
  "could-it-be-tmv-marijuana.jpg": "could-it-be-tmv-marijuana.jpg",
  "marijuana-tmv-mosaic-virus-twisted-leaf.jpg": "marijuana-tmv-mosaic-virus-twisted-leaf.jpg",
  "not-tmv-mosaic-stripes-on-leaves.jpg": "not-tmv-mosaic-stripes-on-leaves.jpg",
  "plant-with-mosaic-stripes-but-no-tmv.jpg": "plant-with-mosaic-stripes-but-no-tmv.jpg",
  "possibly-tmv-tobacco-mosaic-virus.jpg": "possibly-tmv-tobacco-mosaic-virus.jpg",
  "tmv-tobacco-mosaic-virus-marijuana-plant.jpg": "tmv-tobacco-mosaic-virus-marijuana-plant.jpg",
  "beet-curly-top-virus-cannabis-symptoms-Leaf-curling-associated-with-infection-of-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University.jpg": "beet-curly-top-virus-cannabis-symptoms-Leaf-curling-associated-with-infection-of-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University.jpg",
  "closeup-of-beet-curly-top-virus-cannabis-symptoms-Leaf-curling-associated-with-infection-of-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University.jpg": "closeup-of-beet-curly-top-virus-cannabis-symptoms-Leaf-curling-associated-with-infection-of-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University.jpg",
  "example-of-beet-curly-top-virus-cannabis-symptoms-Leaf-curling-associated-with-infection-of-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University.jpg": "example-of-beet-curly-top-virus-cannabis-symptoms-Leaf-curling-associated-with-infection-of-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University.jpg",
  "Beet-curly-top-virus-infection-showing-both-yellowing-and-strong-leaf-curling-by-Whitney-Cranshaw-of-Colorado-State-University-1.jpg": "Beet-curly-top-virus-infection-showing-both-yellowing-and-strong-leaf-curling-by-Whitney-Cranshaw-of-Colorado-State-University-1.jpg",
  "Bisymptomatic-hemp-plant-infected-with-beet-curly-top-by-Whitney-Cranshaw-of-Colorado-State-University-1.jpg": "Bisymptomatic-hemp-plant-infected-with-beet-curly-top-by-Whitney-Cranshaw-of-Colorado-State-University-1.jpg",
  "beet-curly-top-virus-BCTV-Hybrigeminivirus-Beet-curly-top-virus-Leaf-curling-associated-with-infection-of-cannabis-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University-6.jpg": "beet-curly-top-virus-BCTV-Hybrigeminivirus-Beet-curly-top-virus-Leaf-curling-associated-with-infection-of-cannabis-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University-6.jpg",
  "beet-curly-top-virus-BCTV-Hybrigeminivirus-Beet-curly-top-virus-Leaf-curling-associated-with-infection-of-cannabis-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University-8.jpg": "beet-curly-top-virus-BCTV-Hybrigeminivirus-Beet-curly-top-virus-Leaf-curling-associated-with-infection-of-cannabis-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University-8.jpg",
  "beet-curly-top-virus-BCTV-Hybrigeminivirus-Beet-curly-top-virus-Leaf-curling-associated-with-infection-of-cannabis-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University-9.jpg": "beet-curly-top-virus-BCTV-Hybrigeminivirus-Beet-curly-top-virus-Leaf-curling-associated-with-infection-of-cannabis-hemp-by-beet-curly-top-virus-by-Whitney-Cranshaw-of-Colorado-State-University-9.jpg",
  "re-vegging-cannabis-plant.jpg": "re-vegging-cannabis-plant.jpg",
  "cannabis-re-veg-after-harvest-odd-round-leaves.jpg": "cannabis-re-veg-after-harvest-odd-round-leaves.jpg",
  "cannabis-re-veg-bud-clone.jpg": "cannabis-re-veg-bud-clone.jpg",
  "clone-of-budding-plant-reveg.jpg": "clone-of-budding-plant-reveg.jpg",
  "example-monstercropped-plant-getting-bushy-GDTRFB95.jpg": "example-monstercropped-plant-getting-bushy-GDTRFB95.jpg",
  "re-veg-almost-done-flowering.jpg": "re-veg-almost-done-flowering.jpg",
  "re-veg-monster-crop.jpg": "re-veg-monster-crop.jpg",
  "clear-hermie-pic.jpg": "clear-hermie-pic.jpg",
  "bananas-middle-bud.jpg": "bananas-middle-bud.jpg",
  "cannabis-hermie-yellow-nanner-banana.jpg": "cannabis-hermie-yellow-nanner-banana.jpg",
  "green-hermie-banana.jpg": "green-hermie-banana.jpg",
  "herm-marijuana-bud-burnt-by-heat-and-too-much-light-ready-to-harvest-immediately.jpg": "herm-marijuana-bud-burnt-by-heat-and-too-much-light-ready-to-harvest-immediately.jpg",
  "hermaphodite-hermie-pollen-sacs-partway-through-flowering.jpg": "hermaphodite-hermie-pollen-sacs-partway-through-flowering.jpg"
};

window.AppDiagnose = { SYMPTOMS, CATEGORIES, leafSvg, rankForRoom, HI_RES, IMG_DIR: "scraped_symptoms_high_res/", HI_DIR: "scraped_symptoms_high_res/", loadDetailedGuides, getDetailedGuide };
})();
