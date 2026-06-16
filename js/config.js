(() => {
const STORAGE_KEY = "cultivation-control-v2";

const stages = ["Seedling", "Propagation", "Vegetative", "Flower", "Drying", "Curing", "Complete"];
const plantStatuses = ["Active", "Quarantined", "Harvested", "Destroyed", "Transferred"];
const taskPriorities = ["Low", "Normal", "High", "Critical"];
const inventoryCategories = ["Nutrients", "Medium", "Pest control", "Sanitation", "Packaging", "Equipment", "Other"];

// Day bands apply with lights on; night bands with lights off. Night temps run
// a few degrees cooler (a 2-5°C lights-off drop is normal and, late in flower,
// beneficial), and night RH caps are tighter because falling temperature
// pushes air toward dew point — the bud-rot (botrytis) window.
const defaultSetpoints = {
  seedling: { tempMin: 70, tempMax: 78, humidityMin: 60, humidityMax: 70, nightTempMin: 66, nightTempMax: 75, nightHumidityMax: 70, co2Min: 400, co2Max: 800, lightKelvinMin: 5000, lightKelvinMax: 6500, ppfdMin: 100, ppfdMax: 300 },
  propagation: { tempMin: 72, tempMax: 78, humidityMin: 70, humidityMax: 85, nightTempMin: 68, nightTempMax: 76, nightHumidityMax: 85, co2Min: 400, co2Max: 800, lightKelvinMin: 5000, lightKelvinMax: 6500, ppfdMin: 100, ppfdMax: 300 },
  vegetative: { tempMin: 72, tempMax: 80, humidityMin: 55, humidityMax: 65, nightTempMin: 65, nightTempMax: 75, nightHumidityMax: 60, co2Min: 400, co2Max: 1000, lightKelvinMin: 4000, lightKelvinMax: 6500, ppfdMin: 250, ppfdMax: 600 },
  flower: { tempMin: 67, tempMax: 78, humidityMin: 40, humidityMax: 50, nightTempMin: 62, nightTempMax: 72, nightHumidityMax: 50, co2Min: 400, co2Max: 1000, lightKelvinMin: 2700, lightKelvinMax: 3500, ppfdMin: 500, ppfdMax: 1050 },
  drying: { tempMin: 60, tempMax: 68, humidityMin: 55, humidityMax: 62, nightTempMin: 60, nightTempMax: 68, nightHumidityMax: 62, co2Min: 400, co2Max: 800, lightKelvinMin: 0, lightKelvinMax: 0, ppfdMin: 0, ppfdMax: 0 }
};

const logTypes = {
  environment: {
    label: "Environment",
    fields: [
      ["roomId", "Room", "room"],
      ["lights", "Lights at reading", "select:On,Off"],
      ["tempF", "Air temp", "temp"],
      ["humidity", "Humidity (%)", "number"],
      ["co2Ppm", "CO2 (ppm)", "number"],
      ["vpdKpa", "VPD (kPa)", "number"],
      ["leafTempF", "Leaf temp", "temp"],
      ["fanSpeed", "Fan speed (%)", "number"],
      ["airflow", "Airflow notes", "text"]
    ]
  },
  light: {
    label: "Light",
    fields: [
      ["roomId", "Room", "room"],
      ["fixture", "Fixture or zone", "text"],
      ["ppfd", "PPFD", "number"],
      ["dli", "DLI", "number"],
      ["photoperiod", "Photoperiod (hours)", "number"],
      ["dimmer", "Dimmer (%)", "number"],
      ["colorTempK", "Observed color temp (K)", "number"],
      ["canopyDistance", "Light-to-canopy distance", "number"]
    ]
  },
  irrigation: {
    label: "Irrigation / Feed",
    fields: [
      ["roomId", "Room", "room"],
      ["batchId", "Batch", "batch"],
      ["gallons", "Volume (gal)", "number"],
      ["ph", "Input pH", "number"],
      ["ec", "Input EC", "number"],
      ["waterTempF", "Water temp", "temp"],
      ["runoffPh", "Runoff pH", "number"],
      ["runoffEc", "Runoff EC", "number"],
      ["recipe", "Recipe", "text"]
    ]
  },
  water: {
    label: "Watering / Pot weight",
    fields: [
      ["roomId", "Room", "room"],
      ["batchId", "Batch", "batch"],
      ["event", "Entry type", "select:Weight check,Watered (log post-water weight)"],
      ["potWeight", "Pot weight", "number"],
      ["runoffSeen", "Runoff came out", "select:No,Yes"]
    ]
  },
  medium: {
    label: "Medium / Root Zone",
    fields: [
      ["roomId", "Room", "room"],
      ["batchId", "Batch", "batch"],
      ["moisture", "Moisture (%)", "number"],
      ["mediumTempF", "Medium temp", "temp"],
      ["substratePh", "Substrate pH", "number"],
      ["substrateEc", "Substrate EC", "number"],
      ["amendment", "Amendment", "text"]
    ]
  },
  health: {
    label: "Plant Health / IPM",
    fields: [
      ["roomId", "Room", "room"],
      ["batchId", "Batch", "batch"],
      ["plantId", "Plant (optional)", "plant"],
      ["heightIn", "Height", "number"],
      ["canopy", "Canopy observation", "text"],
      ["pests", "Pests", "text"],
      ["disease", "Disease", "text"],
      ["severity", "Severity", "select:None,Low,Medium,High"],
      ["action", "Action taken", "text"]
    ]
  },
  ripeness: {
    label: "Ripeness / Trichomes",
    fields: [
      ["roomId", "Room", "room"],
      ["batchId", "Batch", "batch"],
      ["plantId", "Plant (optional)", "plant"],
      ["clearPct", "Clear trichomes (%)", "number"],
      ["cloudyPct", "Cloudy / milky (%)", "number"],
      ["amberPct", "Amber (%)", "number"],
      ["pistils", "Pistils", "select:Mostly white,Half darkened,Mostly brown & curled"],
      ["aroma", "Aroma", "text"]
    ]
  },
  work: {
    label: "Work / Compliance",
    fields: [
      ["roomId", "Room", "room"],
      ["category", "Category", "select:Sanitation,Pruning,Training,IPM,Compliance,Maintenance,Transfer,Other"],
      ["performedBy", "Performed by", "text"],
      ["duration", "Duration", "text"],
      ["lotReference", "Lot or manifest reference", "text"]
    ]
  },
  harvest: {
    label: "Harvest",
    fields: [
      ["batchId", "Batch", "batch"],
      ["plantId", "Plant (optional)", "plant"],
      ["wetWeight", "Wet weight", "number"],
      ["dryWeight", "Dry weight", "number"],
      ["wasteWeight", "Waste weight", "number"],
      ["sampleSent", "Testing sample sent", "select:No,Yes"],
      ["harvestCrew", "Crew", "text"]
    ]
  }
};

window.AppConfig = {
  STORAGE_KEY,
  stages,
  plantStatuses,
  taskPriorities,
  inventoryCategories,
  defaultSetpoints,
  logTypes
};
})();
