(() => {
const { STORAGE_KEY, defaultSetpoints } = window.AppConfig;

// Some browsers (notably Chrome opening a file:// page) throw when touching
// localStorage. Fall back to an in-memory store so the app never breaks; we
// just lose persistence across reloads until the page is served over http.
const memory = {};
let persistent = true;

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    persistent = false;
    return key in memory ? memory[key] : null;
  }
}
function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    persistent = false;
    memory[key] = value;
  }
}
function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    persistent = false;
  }
  delete memory[key];
}

const blankState = () => ({
  rooms: [],
  batches: [],
  plants: [],
  logs: [],
  tasks: [],
  inventory: [],
  settings: { unitSystem: "metric", ppmScale: "500", tempUnit: "C", setpoints: JSON.parse(JSON.stringify(defaultSetpoints)) },
  // updatedAt stays empty until the first real save: a freshly booted client
  // must never look "newer" than data another device already saved.
  meta: { createdAt: new Date().toISOString(), updatedAt: "" }
});

function normalizeBatch(batch) {
  const fallbackDate = batch.startDate || new Date().toISOString().slice(0, 10);
  const fallbackStage = batch.stage || "Seedling";
  const history = Array.isArray(batch.stageHistory)
    ? batch.stageHistory
        .filter((entry) => entry && entry.stage && entry.startDate)
        .map((entry) => ({ stage: entry.stage, startDate: entry.startDate }))
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    : [];
  return {
    ...batch,
    stageHistory: history.length ? history : [{ stage: fallbackStage, startDate: fallbackDate }]
  };
}

// One normalization path for every source of state (localStorage, the server
// file, JSON import) so old saves migrate the same way everywhere.
function normalizeState(parsed) {
  const blank = blankState();
  const savedSetpoints = (parsed.settings || {}).setpoints || {};
  if (savedSetpoints.vegetative?.ppfdMin === 400) savedSetpoints.vegetative.ppfdMin = defaultSetpoints.vegetative.ppfdMin;
  if (savedSetpoints.flower?.ppfdMin === 700) savedSetpoints.flower.ppfdMin = defaultSetpoints.flower.ppfdMin;
  if (savedSetpoints.flower?.ppfdMax === 1000) savedSetpoints.flower.ppfdMax = defaultSetpoints.flower.ppfdMax;
  const mergedSetpoints = {};
  Object.keys(defaultSetpoints).forEach((stage) => {
    mergedSetpoints[stage] = { ...defaultSetpoints[stage], ...(savedSetpoints[stage] || {}) };
  });
  return {
    ...blank,
    ...parsed,
    batches: Array.isArray(parsed.batches) ? parsed.batches.map(normalizeBatch) : [],
    settings: {
      ...blank.settings,
      ...(parsed.settings || {}),
      unitSystem: (parsed.settings || {}).unitSystem || blank.settings.unitSystem,
      ppmScale: String((parsed.settings || {}).ppmScale || blank.settings.ppmScale),
      tempUnit: (parsed.settings || {}).tempUnit || blank.settings.tempUnit,
      setpoints: mergedSetpoints
    }
  };
}

function loadState() {
  try {
    const raw = safeGet(STORAGE_KEY) || safeGet("cultivation-control-v1");
    if (!raw) return blankState();
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn(error);
    return blankState();
  }
}

function saveLocal(state) {
  safeSet(STORAGE_KEY, JSON.stringify(state));
}

function saveState(state) {
  if (!state.meta) state.meta = { createdAt: new Date().toISOString() };
  state.meta.updatedAt = new Date().toISOString();
  saveLocal(state);
  queueServerSave(state);
}

function clearState() {
  safeRemove(STORAGE_KEY);
  safeRemove("cultivation-control-v1");
}

// --- server sync ------------------------------------------------------------
// Served over http(s), the app syncs whole-state JSON with /api/state —
// data/growdata.json on the local serve.js, Cloudflare KV on the deployed
// site. localStorage stays the synchronous boot cache; the server copy is
// shared across devices. Conflict rule is last-write-wins by meta.updatedAt,
// except that a state with content always beats an empty one.
const sync = {
  enabled: /^https?:$/.test(window.location.protocol),
  online: null, // null = not yet contacted, true/false afterwards
  lastSync: null,
  authFailed: false,
  keyDismissed: false, // user closed the connect dialog — don't auto-reopen
  saveTimer: null,
  pollTimer: null,
  hooks: null,
  pendingPush: false
};

// Deployed servers (Cloudflare Pages with a GROW_KEY secret) require a shared
// passphrase in the x-grow-key header; the same passphrase on every device
// makes them share one grow log. The local serve.js ignores the header.
const SYNC_KEY_STORAGE = "grow-room-sync-key";

function authHeaders() {
  const key = safeGet(SYNC_KEY_STORAGE) || "";
  return key ? { "x-grow-key": key } : {};
}

function hasKey() {
  return !!safeGet(SYNC_KEY_STORAGE);
}

// --- sync UI: status chip + connect dialog ----------------------------------

function syncStatusModel() {
  if (!sync.enabled) return { kind: "local", text: "Local file mode" };
  if (sync.authFailed || !hasKey()) return { kind: "locked", text: "Sync locked — tap to connect" };
  if (sync.online === true) {
    const at = sync.lastSync
      ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(sync.lastSync)
      : "";
    return { kind: "ok", text: at ? `Cloud synced · ${at}` : "Cloud synced" };
  }
  if (sync.online === false) return { kind: "off", text: "Cloud unreachable — retrying" };
  return { kind: "wait", text: "Connecting…" };
}

function updateSyncUi() {
  const chip = document.getElementById("syncStatusBtn");
  if (!chip) return;
  if (!sync.enabled) {
    chip.style.display = "none";
    return;
  }
  const status = syncStatusModel();
  chip.style.display = "";
  chip.className = `sync-chip ${status.kind}`;
  chip.textContent = status.text;
  chip.title = status.kind === "locked"
    ? "Enter the sync passphrase so this device joins your shared grow log"
    : "Cloud sync status — click to sync now";
}

// Friendly connect dialog (replaces the old browser prompt, which was easy to
// dismiss by accident and never came back).
function openKeyModal(errorMessage = "") {
  closeKeyModal();
  const overlay = document.createElement("div");
  overlay.id = "syncKeyModal";
  overlay.className = "sync-modal-backdrop";

  const card = document.createElement("div");
  card.className = "sync-modal";

  const title = document.createElement("h3");
  title.textContent = "Connect cloud sync";
  const intro = document.createElement("p");
  intro.textContent = "Enter your sync passphrase. Use the same passphrase on every device (PC, phone, tablet) and they all share one grow log.";

  const error = document.createElement("p");
  error.className = "sync-modal-error";
  error.textContent = errorMessage;
  if (!errorMessage) error.style.display = "none";

  const input = document.createElement("input");
  input.id = "syncKeyInput";
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("autocapitalize", "none");
  input.placeholder = "your passphrase";

  const actions = document.createElement("div");
  actions.className = "sync-modal-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "ghost-button";
  cancel.textContent = "Not now";
  const save = document.createElement("button");
  save.type = "button";
  save.className = "primary-button";
  save.textContent = "Connect";

  const submit = () => {
    const key = input.value.trim();
    if (!key) {
      input.focus();
      return;
    }
    safeSet(SYNC_KEY_STORAGE, key);
    sync.authFailed = false;
    sync.keyDismissed = false;
    closeKeyModal();
    updateSyncUi();
    pullState("Connected — syncing your grow log");
  };
  save.addEventListener("click", submit);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submit();
  });
  cancel.addEventListener("click", () => {
    sync.keyDismissed = true;
    closeKeyModal();
    updateSyncUi();
    if (sync.hooks?.notify) sync.hooks.notify("Working offline — your data stays on this device");
  });

  actions.appendChild(cancel);
  actions.appendChild(save);
  card.appendChild(title);
  card.appendChild(intro);
  card.appendChild(error);
  card.appendChild(input);
  card.appendChild(actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  setTimeout(() => input.focus(), 50);
}

function closeKeyModal() {
  const existing = document.getElementById("syncKeyModal");
  if (existing) existing.remove();
}

function keyModalOpen() {
  return !!document.getElementById("syncKeyModal");
}

// 401 from the server: wrong or missing passphrase. Auto-open the dialog the
// first time; after a dismissal only the status chip / Settings reopen it.
function onAuthFailed() {
  sync.online = false;
  sync.authFailed = true;
  updateSyncUi();
  if (!sync.keyDismissed && !keyModalOpen()) {
    openKeyModal(hasKey() ? "That passphrase wasn't accepted — check it and try again." : "");
  }
}

function markOnline() {
  sync.online = true;
  sync.authFailed = false;
  sync.lastSync = new Date();
  updateSyncUi();
}

// --- transport ----------------------------------------------------------------

function queueServerSave(state) {
  if (!sync.enabled) return;
  sync.pendingPush = true;
  clearTimeout(sync.saveTimer);
  sync.saveTimer = setTimeout(() => pushState(state), 500);
}

function pushState(state) {
  fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(state)
  })
    .then((res) => {
      if (res.status === 401) return onAuthFailed();
      if (res.ok) {
        sync.pendingPush = false;
        markOnline();
      } else {
        sync.online = false;
        updateSyncUi();
      }
    })
    .catch(() => {
      sync.online = false;
      updateSyncUi();
    });
}

function newerThan(a, b) {
  return new Date(a?.meta?.updatedAt || 0) > new Date(b?.meta?.updatedAt || 0);
}

// A state with any real records. Timestamps only arbitrate between two states
// that both have content — emptiness never wins a conflict, so a blank client
// (new device, new browser, cleared storage) can never wipe the shared file.
function hasContent(state) {
  return ["rooms", "batches", "plants", "logs", "tasks", "inventory"].some(
    (key) => Array.isArray(state?.[key]) && state[key].length > 0
  );
}

// Adopting server state re-renders, which would wipe a half-filled form; if
// the user is mid-entry, skip this cycle and catch up on the next poll.
function userIsTyping() {
  const el = document.activeElement;
  if (el && el.id === "syncKeyInput") return false;
  return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

function pullState(adoptToast) {
  if (!sync.enabled || !sync.hooks) return;
  fetch("/api/state", { cache: "no-store", headers: authHeaders() })
    .then((res) => {
      if (res.status === 401) {
        onAuthFailed();
        return null;
      }
      if (res.status === 404) {
        // Server has nothing yet — seed it with this browser's data.
        markOnline();
        pushState(sync.hooks.getState());
        return null;
      }
      if (!res.ok) {
        sync.online = false;
        updateSyncUi();
        return null;
      }
      markOnline();
      return res.json();
    })
    .then((raw) => {
      if (!raw) return;
      const local = sync.hooks.getState();
      if (sync.pendingPush) {
        pushState(local); // a local save is still owed to the server — retry it
        return;
      }
      const localHas = hasContent(local);
      const serverHas = hasContent(raw);
      const adopt = () => {
        if (userIsTyping()) return; // catch up on the next poll instead
        const next = normalizeState(raw);
        saveLocal(next);
        sync.hooks.setState(next);
        if (adoptToast && sync.hooks.notify) sync.hooks.notify(adoptToast);
      };
      if (localHas && !serverHas) return pushState(local); // content beats blank
      if (!localHas && serverHas) return adopt(); // blank always defers to content
      if (newerThan(raw, local)) return adopt();
      if (newerThan(local, raw)) pushState(local); // local ran ahead (e.g. server was down)
    })
    .catch(() => {
      sync.online = false;
      updateSyncUi();
    });
}

// hooks: { getState, setState, notify } — wired by main.js after first render.
function initSync(hooks) {
  if (!sync.enabled) {
    updateSyncUi();
    return;
  }
  sync.hooks = hooks;
  const chip = document.getElementById("syncStatusBtn");
  if (chip) {
    chip.addEventListener("click", () => {
      if (sync.authFailed || !hasKey()) {
        sync.keyDismissed = false;
        openKeyModal();
      } else {
        if (hooks.notify) hooks.notify("Syncing…");
        pullState("Updated from the cloud");
      }
    });
  }
  updateSyncUi();
  pullState("Loaded your grow log from the cloud");
  sync.pollTimer = setInterval(() => pullState("Updated from another device"), 15000);
}

window.AppStore = {
  loadState,
  saveState,
  clearState,
  isPersistent: () => persistent,
  initSync,
  promptKey: () => {
    sync.keyDismissed = false;
    openKeyModal();
  },
  syncNow: () => pullState("Updated from the cloud"),
  syncInfo: () => ({
    enabled: sync.enabled,
    online: sync.online,
    lastSync: sync.lastSync,
    hasKey: hasKey(),
    authFailed: sync.authFailed
  })
};
})();
