(() => {
function id(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function prettyDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function dateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeStage(stage) {
  const value = String(stage || "").toLowerCase();
  if (value.includes("seed")) return "seedling";
  if (value.includes("veg")) return "vegetative";
  if (value.includes("flower")) return "flower";
  if (value.includes("dry")) return "drying";
  return "propagation";
}

function options(values, selected = "") {
  return values
    .map((value) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function download(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function countBy(items, key, labeler = (value) => value) {
  return items.reduce((acc, item) => {
    const label = labeler(item[key] || "Unspecified");
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

// --- temperature units ------------------------------------------------------
// Temperatures are stored internally in °F (setpoints, physics, alerts all use
// °F). These helpers convert to/from the user's chosen display unit so forms
// and readouts can show °C (default) or °F without touching storage.
function tempUnitLabel(unit) {
  return unit === "F" ? "°F" : "°C";
}
// Treat empty string / null / undefined as missing (Number("") is 0, not NaN).
function blankNum(value) {
  if (value === "" || value === null || value === undefined) return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}
// An absolute temperature in °F -> a number in the display unit (NaN if blank).
function tempToDisplay(tempF, unit, places = 0) {
  const f = blankNum(tempF);
  if (!Number.isFinite(f)) return NaN;
  const v = unit === "F" ? f : (f - 32) / 1.8;
  const factor = 10 ** places;
  return Math.round(v * factor) / factor;
}
// A value the user typed in the display unit -> °F for storage.
function tempFromDisplay(value, unit) {
  const v = blankNum(value);
  if (!Number.isFinite(v)) return NaN;
  return unit === "F" ? v : v * 1.8 + 32;
}
// A temperature DIFFERENCE in °F (e.g. a dew-point gap) -> display unit. A
// delta scales by 1.8 only, no 32 offset.
function tempDeltaToDisplay(deltaF, unit, places = 1) {
  const d = blankNum(deltaF);
  if (!Number.isFinite(d)) return NaN;
  const v = unit === "F" ? d : d / 1.8;
  const factor = 10 ** places;
  return Math.round(v * factor) / factor;
}
// Formatted absolute temperature with unit, e.g. "23 °C".
function fmtTemp(tempF, unit, places = 0) {
  const v = tempToDisplay(tempF, unit, places);
  return Number.isFinite(v) ? `${v} ${tempUnitLabel(unit)}` : "-";
}

window.AppUtils = {
  id,
  escapeHtml,
  prettyDate,
  dateInputValue,
  todayInputValue,
  number,
  clamp,
  normalizeStage,
  options,
  csvCell,
  download,
  countBy,
  tempUnitLabel,
  tempToDisplay,
  tempFromDisplay,
  tempDeltaToDisplay,
  fmtTemp
};
})();
