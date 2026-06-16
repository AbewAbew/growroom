(() => {
function start() {
const { clearState, loadState, saveState } = window.AppStore;
const { createRenderer } = window.AppRender;
const { id, csvCell, dateInputValue, download, todayInputValue, normalizeStage, tempFromDisplay } = window.AppUtils;
const { logTypes, defaultSetpoints } = window.AppConfig;
const { playbookFor, playbookStageKey } = window.AppPlaybook;
const STAGE_LAMP_GAP_IN = { seedling: 30, propagation: 28, vegetative: 21, flower: 15 };

const stateRef = { state: loadState(), view: "rooms", activeRoomId: null, activeStation: "climate", modal: null, lampArrange: false, arrangeFrom: null };
const ui = createRenderer(stateRef);

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function formId(form) {
  return form?.getAttribute("id") || "";
}

function metricUnits() {
  return (stateRef.state.settings.unitSystem || "metric") === "metric";
}

function inputRoomLengthToMeters(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return metricUnits() ? String(parsed) : String(parsed / 3.28084);
}

function inputSmallLengthToInches(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return metricUnits() ? String(parsed / 2.54) : String(parsed);
}

function formatSmallLength(inches) {
  const parsed = Number(inches);
  if (!Number.isFinite(parsed)) return "";
  return metricUnits() ? `${Math.round(parsed * 2.54)}cm` : `${Math.round(parsed)}in`;
}

function upsert(collection, record) {
  if (record.id) {
    const index = stateRef.state[collection].findIndex((item) => item.id === record.id);
    if (index >= 0) stateRef.state[collection][index] = { ...stateRef.state[collection][index], ...record };
    else stateRef.state[collection].push(record);
  } else {
    record.id = id(collection.slice(0, -1) || collection);
    stateRef.state[collection].push(record);
  }
  return record.id;
}

function fillForm(form, record) {
  Object.entries(record).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });
}

function showToast(message) {
  ui.dom.toast.textContent = message;
  ui.dom.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => ui.dom.toast.classList.remove("show"), 2200);
}

// --- playbook -> tasks -------------------------------------------------
// Each active batch gets its current playbook phase's actions as real tasks,
// keyed by batch|stage|phase|title so they are created exactly once per
// phase: completing one keeps it completed, and moving to a new stage or
// phase brings in that phase's fresh checklist.
function batchWeek(batch) {
  const history = ensureStageHistory(batch);
  const current = [...history].reverse().find((entry) => entry.stage === batch.stage) || history[history.length - 1];
  const start = new Date(current?.startDate || batch.startDate || "");
  if (Number.isNaN(start.getTime())) return null;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const day = Math.max(0, Math.floor((todayDay - startDay) / 86400000)) + 1;
  return Math.max(1, Math.ceil(day / 7));
}

function syncPlaybookTasks() {
  const state = stateRef.state;
  let added = 0;
  state.batches
    .filter((batch) => batch.roomId && batch.stage !== "Complete")
    .forEach((batch) => {
      const stageKey = playbookStageKey(batch.stage);
      const week = batchWeek(batch);
      if (!week) return;
      const guide = playbookFor(stageKey, week);
      if (!guide || !Array.isArray(guide.actions)) return;
      guide.actions.forEach((action) => {
        const playbookKey = `${batch.id}|${stageKey}|${guide.from}|${action.t}`;
        if (state.tasks.some((task) => task.playbookKey === playbookKey)) return;
        state.tasks.push({
          id: id("task"),
          title: action.t,
          roomId: batch.roomId,
          batchId: batch.id,
          priority: "Normal",
          status: "Open",
          dueDate: todayInputValue(),
          notes: `Playbook · ${guide.phase}${action.d ? ` — ${action.d}` : ""}`,
          playbookKey
        });
        added += 1;
      });
    });
  return added;
}

function persist(message) {
  syncPlaybookTasks();
  saveState(stateRef.state);
  ui.render();
  if (message) showToast(message);
}

function saveManagedForm(form) {
  const formKey = formId(form);
  if (!form || !formKey) return false;

  if (formKey === "roomLogForm") {
    const data = formData(form);
    if (data.type === "health" && data.heightIn !== "") data.heightIn = inputSmallLengthToInches(data.heightIn);
    if (data.type === "light" && data.canopyDistance !== "") data.canopyDistance = inputSmallLengthToInches(data.canopyDistance);
    // Temperature fields are entered in the chosen unit; store canonical °F.
    const tu = stateRef.state.settings.tempUnit || "C";
    (logTypes[data.type]?.fields || []).forEach(([name, , type]) => {
      if (type === "temp" && data[name] !== "" && data[name] != null) {
        data[name] = String(tempFromDisplay(data[name], tu));
      }
    });
    data.id = id("log");
    data.createdAt = new Date().toISOString();
    stateRef.state.logs.push(data);
    if (data.type === "light" && data.roomId && data.canopyDistance !== "") {
      const distance = Number(data.canopyDistance);
      const room = findRoom(data.roomId);
      if (room && Number.isFinite(distance) && distance >= 0) {
        room.lightHeightIn = String(distance);
        room.lampAuto = false;
      }
    }
    persist("Reading logged");
    return true;
  }

  if (formKey === "roomEditForm") {
    const data = formData(form);
    ["lengthM", "widthM", "heightM"].forEach((key) => {
      if (data[key] !== "") data[key] = inputRoomLengthToMeters(data[key]);
    });
    ["potWidthIn", "potHeightIn"].forEach((key) => {
      if (data[key] !== "") data[key] = inputSmallLengthToInches(data[key]);
    });
    if (data.ambientTempF !== "" && data.ambientTempF != null) {
      data.ambientTempF = String(tempFromDisplay(data.ambientTempF, stateRef.state.settings.tempUnit || "C"));
    }
    // Gather the per-fixture wattage inputs (lightWatts.0, lightWatts.1, …) into
    // a lightWatts array; blanks fall back to the default watts/light.
    const wattKeys = Object.keys(data).filter((k) => /^lightWatts\.\d+$/.test(k));
    if (wattKeys.length) {
      const fallback = Number(data.lightWattsEach) || 0;
      const arr = [];
      wattKeys.forEach((k) => {
        const idx = Number(k.split(".")[1]);
        const w = Number(data[k]);
        arr[idx] = String(Number.isFinite(w) && data[k] !== "" ? w : fallback);
        delete data[k];
      });
      for (let i = 0; i < arr.length; i += 1) if (arr[i] == null) arr[i] = String(fallback);
      data.lightWatts = arr;
    }
    const isNew = !data.id;
    if (!data.id) delete data.id;
    const savedId = upsert("rooms", data);
    stateRef.modal = null;
    if (isNew || !stateRef.activeRoomId) stateRef.activeRoomId = savedId;
    persist("Room saved");
    return true;
  }

  if (formKey === "batchForm") {
    const data = formData(form);
    const existing = data.id ? stateRef.state.batches.find((batch) => batch.id === data.id) : null;
    if (!data.id) delete data.id;
    if (existing) {
      data.stageHistory = ensureStageHistory(existing);
      if (data.startDate && data.stageHistory.length === 1) data.stageHistory[0].startDate = data.startDate;
      if (data.stage && data.stage !== existing.stage) data.stageHistory = stageHistoryWithTransition(existing, data.stage, todayInputValue());
    } else {
      data.stageHistory = [{ stage: data.stage || "Seedling", startDate: data.startDate || todayInputValue() }];
    }
    upsert("batches", data);
    form.reset();
    persist("Batch saved");
    return true;
  }

  if (formKey === "stageTransitionForm") {
    const data = formData(form);
    const room = findRoom(data.roomId);
    const batch = stateRef.state.batches.find((item) => item.id === data.batchId);
    if (!room || !data.stage) return false;
    preserveManualLampGap(room);
    room.stage = data.stage;
    if (batch) {
      batch.stage = data.stage;
      batch.stageHistory = stageHistoryWithTransition(batch, data.stage, data.startDate || todayInputValue());
    }
    stateRef.modal = null;
    persist(batch ? "Stage transition saved" : "Room stage updated");
    return true;
  }

  if (formKey === "plantForm") {
    const data = formData(form);
    const copies = Math.max(1, Math.round(Number(data.copies)) || 1);
    delete data.copies;
    if (!data.id) delete data.id;
    if (!data.status) data.status = "Active";
    // a plant lives wherever its batch lives unless explicitly overridden
    if (!data.roomId && data.batchId) data.roomId = stateRef.state.batches.find((b) => b.id === data.batchId)?.roomId || "";
    if (data.id) {
      // status changes via the form also land in the history trail
      const existing = stateRef.state.plants.find((p) => p.id === data.id);
      if (existing && existing.status !== data.status) {
        data.statusHistory = [...(existing.statusHistory || []), { status: data.status, date: todayInputValue() }];
      }
      upsert("plants", data);
    } else if (copies > 1) {
      for (let i = 1; i <= copies; i += 1) {
        stateRef.state.plants.push({ ...data, id: id("plant"), tag: `${data.tag}-${i}`, statusHistory: [{ status: data.status, date: todayInputValue() }] });
      }
    } else {
      data.statusHistory = [{ status: data.status, date: todayInputValue() }];
      upsert("plants", data);
    }
    form.reset();
    persist(copies > 1 ? `${copies} plants registered` : "Plant saved");
    return true;
  }

  if (formKey === "inventoryForm") {
    const data = formData(form);
    if (!data.id) delete data.id;
    upsert("inventory", data);
    form.reset();
    persist("Item saved");
    return true;
  }

  if (formKey === "taskForm") {
    const data = formData(form);
    if (!data.id) delete data.id;
    upsert("tasks", data);
    form.reset();
    persist("Task saved");
    return true;
  }

  if (formKey === "harvestForm") {
    const data = formData(form);
    const existingId = data.id;
    if (!data.id) data.id = id("log");
    const record = { ...data, type: "harvest", createdAt: new Date().toISOString() };
    if (existingId) {
      const index = stateRef.state.logs.findIndex((log) => log.id === existingId);
      if (index >= 0) record.createdAt = stateRef.state.logs[index].createdAt || record.createdAt;
      if (index >= 0) stateRef.state.logs[index] = { ...stateRef.state.logs[index], ...record };
      else stateRef.state.logs.push(record);
    } else {
      stateRef.state.logs.push(record);
    }
    // a harvest entry for a specific plant closes that plant's lifecycle
    if (record.plantId) {
      const plant = stateRef.state.plants.find((p) => p.id === record.plantId);
      if (plant && plant.status !== "Harvested") {
        plant.status = "Harvested";
        plant.statusHistory = [...(plant.statusHistory || []), { status: "Harvested", date: todayInputValue() }];
      }
    }
    form.reset();
    persist("Harvest saved");
    return true;
  }

  if (formKey === "settingsForm") {
    // Setpoint temp inputs are shown in the unit the form rendered with; convert
    // them back to °F using that (pre-save) unit.
    const oldTempUnit = stateRef.state.settings.tempUnit || "C";
    const TEMP_SETPOINT_FIELDS = ["tempMin", "tempMax", "nightTempMin", "nightTempMax"];
    Object.entries(formData(form)).forEach(([key, value]) => {
      if (key === "unitSystem") {
        stateRef.state.settings.unitSystem = value;
        return;
      }
      if (key === "ppmScale") {
        stateRef.state.settings.ppmScale = value;
        return;
      }
      if (key === "elevationM") {
        stateRef.state.settings.elevationM = value;
        return;
      }
      if (key === "background") {
        stateRef.state.settings.background = value;
        return;
      }
      if (key === "tempUnit") {
        stateRef.state.settings.tempUnit = value === "F" ? "F" : "C";
        return;
      }
      const [stage, field] = key.split(".");
      if (stateRef.state.settings.setpoints[stage]) {
        stateRef.state.settings.setpoints[stage][field] = TEMP_SETPOINT_FIELDS.includes(field)
          ? Math.round(tempFromDisplay(value, oldTempUnit) * 10) / 10
          : Number(value);
      }
    });
    persist("Settings saved");
    return true;
  }

  return false;
}

function setView(view) {
  stateRef.view = view;
  stateRef.lampArrange = false;
  stateRef.arrangeFrom = null;
  ui.render();
}

function openRoom(roomId) {
  stateRef.activeRoomId = roomId;
  stateRef.activeStation = "climate";
  stateRef.lampArrange = false;
  stateRef.arrangeFrom = null;
  stateRef.view = "room";
  ui.render();
}

// Rebuilds the per-light wattage boxes in the room form from the current
// warm/cool counts, preserving any wattages already typed.
function rebuildLightWattsGrid(form) {
  if (!form) return;
  const wrap = form.querySelector("#lightWattsWrap");
  if (!wrap) return;
  const warm = form.elements.warmLightCount ? form.elements.warmLightCount.value : 0;
  const cool = form.elements.coolLightCount ? form.elements.coolLightCount.value : 0;
  const defaultW = form.elements.lightWattsEach ? form.elements.lightWattsEach.value : "";
  const existing = [];
  form.querySelectorAll('[name^="lightWatts."]').forEach((inp) => {
    existing[Number(inp.name.split(".")[1])] = inp.value;
  });
  wrap.innerHTML = window.AppRender.lightWattsGridInner(warm, cool, existing, defaultW);
}

function updateFanReadouts(room) {
  const setpoint = stateRef.state.settings.setpoints[normalizeStage(room.stage)];
  const profile = window.AppAlerts.equipmentProfile(room, setpoint);
  const r = document.querySelector("#fanRecommended");
  const c = document.querySelector("#fanCurrent");
  const ch = document.querySelector("#fanChanges");
  if (r) r.textContent = profile.recommendedFanSpeed ? `${profile.recommendedFanSpeed.toFixed(0)}%` : "—";
  if (c) c.textContent = `${Math.round(Number(room.fanSpeed) || 0)}%`;
  if (ch) ch.textContent = profile.actualAirChanges ? `${profile.actualAirChanges.toFixed(2)}/min` : "—";
}

function findRoom(roomId) {
  return stateRef.state.rooms.find((item) => item.id === roomId);
}

function activeBatchForRoom(roomId) {
  return stateRef.state.batches
    .filter((batch) => batch.roomId === roomId && batch.stage !== "Complete")
    .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))[0];
}

function ensureStageHistory(batch) {
  if (!batch) return [];
  const fallback = [{ stage: batch.stage || "Seedling", startDate: batch.startDate || todayInputValue() }];
  const history = Array.isArray(batch.stageHistory) ? batch.stageHistory : fallback;
  return history
    .filter((entry) => entry && entry.stage && entry.startDate)
    .map((entry) => ({ stage: entry.stage, startDate: entry.startDate }))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

function stageHistoryWithTransition(batch, stage, startDate) {
  const history = ensureStageHistory(batch);
  const date = startDate || todayInputValue();
  const last = history[history.length - 1];
  if (last && last.stage === stage) {
    return history.map((entry, index) => (index === history.length - 1 ? { ...entry, startDate: date } : entry));
  }
  return [...history, { stage, startDate: date }].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

function preserveManualLampGap(room) {
  const currentStageKey = normalizeStage(room.stage);
  const currentAutoGap = STAGE_LAMP_GAP_IN[currentStageKey];
  const existingGap = Number(room.lightHeightIn);
  const keepGap = room.lampAuto !== false && currentAutoGap
    ? currentAutoGap
    : Number.isFinite(existingGap) && existingGap > 0
      ? existingGap
      : currentAutoGap || 18;
  room.lightHeightIn = String(keepGap);
  room.lampAuto = false;
}

function attachEvents() {
  document.body.addEventListener("click", (event) => {
    const t = event.target;

    const viewBtn = t.closest("[data-view]");
    if (viewBtn) return setView(viewBtn.dataset.view);

    const openRoomBtn = t.closest("[data-open-room]");
    if (openRoomBtn) return openRoom(openRoomBtn.dataset.openRoom);

    if (t.closest("[data-add-room]")) {
      stateRef.modal = { type: "roomEdit", id: null };
      return ui.render();
    }
    if (t.closest("[data-start-grow]")) {
      stateRef.modal = { type: "startGrow", step: 1, draft: {} };
      return ui.render();
    }

    // --- Start-a-grow wizard navigation ---
    const collectWizard = () => {
      const form = document.getElementById("startGrowForm");
      if (!form) return;
      const data = Object.fromEntries(new FormData(form).entries());
      const draft = stateRef.modal.draft;
      if ("roomChoice" in data) draft.roomId = data.roomChoice === "__new__" ? "" : data.roomChoice;
      ["roomName", "lengthM", "widthM", "heightM", "potWidthIn", "batchName", "cultivar", "stage", "startDate", "plantCount", "tagPrefix"].forEach((key) => {
        if (key in data) draft[key] = data[key];
      });
    };
    if (t.closest("[data-wizard-next]")) {
      collectWizard();
      const d = stateRef.modal.draft;
      if (stateRef.modal.step === 1 && !d.roomId && !String(d.roomName || "").trim()) {
        return showToast("Pick a room or name the new one");
      }
      if (stateRef.modal.step === 2 && !String(d.batchName || "").trim()) {
        return showToast("Name the batch");
      }
      stateRef.modal.step += 1;
      return ui.render();
    }
    if (t.closest("[data-wizard-back]")) {
      collectWizard();
      stateRef.modal.step = Math.max(1, stateRef.modal.step - 1);
      return ui.render();
    }
    if (t.closest("[data-wizard-finish]")) {
      collectWizard();
      const d = stateRef.modal.draft;
      const n = Math.max(1, Math.round(Number(d.plantCount)) || 4);
      const prefix = String(d.tagPrefix || "P").trim() || "P";
      const startDate = d.startDate || todayInputValue();
      // room: reuse or create with unit-converted dimensions
      let roomId = d.roomId;
      if (!roomId) {
        roomId = id("room");
        stateRef.state.rooms.push({
          id: roomId,
          name: String(d.roomName || "New room").trim(),
          stage: d.stage || "Seedling",
          plantCount: String(n),
          lengthM: d.lengthM ? inputRoomLengthToMeters(d.lengthM) : "",
          widthM: d.widthM ? inputRoomLengthToMeters(d.widthM) : "",
          heightM: d.heightM ? inputRoomLengthToMeters(d.heightM) : "",
          potWidthIn: d.potWidthIn ? inputSmallLengthToInches(d.potWidthIn) : "",
          warmLightCount: "0",
          coolLightCount: "0",
          notes: ""
        });
      } else {
        const room = findRoom(roomId);
        if (room) {
          room.stage = d.stage || room.stage;
          room.plantCount = String(n);
        }
      }
      // batch with stage history for the playbook clock
      const batchId = id("batch");
      stateRef.state.batches.push({
        id: batchId,
        name: String(d.batchName || "").trim(),
        cultivar: d.cultivar || "",
        stage: d.stage || "Seedling",
        roomId,
        startDate,
        count: String(n),
        stageHistory: [{ stage: d.stage || "Seedling", startDate }],
        notes: ""
      });
      // auto-tagged plant records
      for (let i = 1; i <= n; i += 1) {
        stateRef.state.plants.push({
          id: id("plant"),
          tag: `${prefix}-${String(i).padStart(3, "0")}`,
          strain: d.cultivar || "",
          batchId,
          roomId,
          status: "Active",
          plantedDate: startDate,
          statusHistory: [{ status: "Active", date: todayInputValue() }],
          notes: ""
        });
      }
      stateRef.modal = null;
      stateRef.activeRoomId = roomId;
      stateRef.activeStation = "climate";
      stateRef.view = "room";
      persist(`Grow started — ${n} plants in ${findRoom(roomId)?.name || "room"}`);
      return;
    }

    // --- Diagnose tool ---
    const dxOpen = t.closest("[data-dx-open]");
    if (dxOpen) {
      stateRef.diagnose = { ...(stateRef.diagnose || {}), open: dxOpen.dataset.dxOpen, imgIdx: 0 };
      return ui.render();
    }
    const dxImg = t.closest("[data-dx-img]");
    if (dxImg) {
      stateRef.diagnose = { ...(stateRef.diagnose || {}), imgIdx: Number(dxImg.dataset.dxImg) || 0 };
      return ui.render();
    }
    if (t.closest("[data-dx-zoom-close]")) {
      if (stateRef.diagnose) stateRef.diagnose.zoom = null;
      return ui.render();
    }
    const dxZoom = t.closest("[data-dx-zoom]");
    if (dxZoom) {
      stateRef.diagnose = { ...(stateRef.diagnose || {}), zoom: dxZoom.dataset.dxZoom };
      return ui.render();
    }
    if (t.closest("[data-dx-close]")) {
      if (stateRef.diagnose) stateRef.diagnose.open = null;
      return ui.render();
    }
    const dxCat = t.closest("[data-dx-cat]");
    if (dxCat) {
      stateRef.diagnose = { ...(stateRef.diagnose || {}), cat: dxCat.dataset.dxCat };
      return ui.render();
    }
    const dxRoomBtn = t.closest("[data-diagnose-room]");
    if (dxRoomBtn) {
      stateRef.diagnose = { ...(stateRef.diagnose || { q: "", cat: "" }), roomId: dxRoomBtn.dataset.diagnoseRoom, open: null };
      stateRef.view = "diagnose";
      return ui.render();
    }

    // quick-add a plant from the room's Plants panel
    const quickAdd = t.closest("[data-quick-add-plant]");
    if (quickAdd) {
      const input = document.getElementById("quickPlantTag");
      const tag = String(input?.value || "").trim();
      if (!tag) return showToast("Type a tag for the new plant");
      stateRef.state.plants.push({
        id: id("plant"),
        tag,
        strain: "",
        batchId: quickAdd.dataset.batch || "",
        roomId: quickAdd.dataset.room || "",
        status: "Active",
        plantedDate: todayInputValue(),
        statusHistory: [{ status: "Active", date: todayInputValue() }],
        notes: ""
      });
      return persist(`Plant ${tag} added`);
    }
    const editRoom = t.closest("[data-edit-room]");
    if (editRoom) {
      stateRef.modal = { type: "roomEdit", id: editRoom.dataset.editRoom };
      return ui.render();
    }
    if (t.closest("[data-close-modal]")) {
      stateRef.modal = null;
      return ui.render();
    }
    const deleteRoom = t.closest("[data-delete-room]");
    if (deleteRoom) {
      if (!window.confirm("Delete this room? Its logs stay in storage but detach.")) return;
      stateRef.state.rooms = stateRef.state.rooms.filter((r) => r.id !== deleteRoom.dataset.deleteRoom);
      stateRef.modal = null;
      stateRef.view = "rooms";
      return persist("Room deleted");
    }

    // Playbook action -> task: one click adds the guidance item as a task due
    // today, scoped to the room/batch it came from.
    const pbTask = t.closest("[data-playbook-task]");
    if (pbTask) {
      stateRef.state.tasks.push({
        id: id("task"),
        title: pbTask.dataset.title || "Playbook task",
        roomId: pbTask.dataset.room || "",
        batchId: pbTask.dataset.batch || "",
        priority: "Normal",
        status: "Open",
        dueDate: todayInputValue(),
        notes: "From playbook"
      });
      return persist("Task added from playbook");
    }

    // Toggle arrange mode: while active, clicking two floodlights swaps their
    // grid positions (type + on/off travel together) to mix colour temps.
    const arrangeBtn = t.closest("[data-arrange-lights]");
    if (arrangeBtn) {
      stateRef.lampArrange = !stateRef.lampArrange;
      stateRef.arrangeFrom = null;
      return ui.render();
    }

    // Light fixtures sit inside the plant station zone, so handle their toggle
    // before the generic [data-station] selector below.
    const lightBtn = t.closest("[data-light-toggle]");
    if (lightBtn) {
      const room = findRoom(lightBtn.dataset.room);
      if (room) {
        const fixtures = window.AppAlerts.lightFixtures(room);
        const i = Number(lightBtn.dataset.index);
        if (stateRef.lampArrange) {
          if (stateRef.arrangeFrom == null) {
            stateRef.arrangeFrom = i;
            return ui.render();
          }
          const from = stateRef.arrangeFrom;
          stateRef.arrangeFrom = null;
          if (from === i) return ui.render();
          const layout = fixtures.map((f) => f.type);
          const lightsOn = fixtures.map((f) => f.on);
          const watts = fixtures.map((f) => String(f.watts));
          [layout[from], layout[i]] = [layout[i], layout[from]];
          [lightsOn[from], lightsOn[i]] = [lightsOn[i], lightsOn[from]];
          [watts[from], watts[i]] = [watts[i], watts[from]];
          room.lightLayout = layout;
          room.lightsOn = lightsOn;
          room.lightWatts = watts;
          return persist("Lights swapped");
        }
        const lightsOn = fixtures.map((f) => f.on);
        lightsOn[i] = !lightsOn[i];
        room.lightsOn = lightsOn;
        return persist();
      }
    }

    // Re-enable lamp auto-follow (PPFD target). Handled before the station
    // selector since the target line lives inside the plant zone.
    const lampAutoBtn = t.closest("[data-lamp-auto]");
    if (lampAutoBtn) {
      const room = findRoom(lampAutoBtn.dataset.lampAuto);
      if (room) {
        room.lampAuto = true;
        return persist("Lamp auto-follows the PPFD target");
      }
    }
    // The drag handle is inside the plant zone; ignore its click so a drag
    // (or a stray click on it) never toggles the station.
    if (t.closest("[data-lamp-drag]")) return;

    // Checklist checkbox: toggles a task between Open and Done.
    const toggleTask = t.closest("[data-toggle-task]");
    if (toggleTask) {
      const task = stateRef.state.tasks.find((item) => item.id === toggleTask.dataset.toggleTask);
      if (task) {
        task.status = task.status === "Done" ? "Open" : "Done";
        return persist(task.status === "Done" ? "Task done" : "Task reopened");
      }
    }

    const delLog = t.closest("[data-delete-log]");
    if (delLog) {
      stateRef.state.logs = stateRef.state.logs.filter((l) => l.id !== delLog.dataset.deleteLog);
      return persist("Reading deleted");
    }

    const stationBtn = t.closest("[data-station]");
    if (stationBtn && stateRef.view === "room") {
      stateRef.activeStation = stationBtn.dataset.station;
      return ui.render();
    }

    const applyFan = t.closest("[data-apply-fan]");
    if (applyFan) {
      const room = findRoom(applyFan.dataset.room);
      if (room) {
        room.fanSpeed = applyFan.dataset.speed;
        return persist(`Fan set to ${applyFan.dataset.speed}%`);
      }
    }

    const toggleFilter = t.closest("[data-toggle-filter]");
    if (toggleFilter) {
      const room = findRoom(toggleFilter.dataset.toggleFilter);
      if (room) {
        room.carbonFilter = String(room.carbonFilter) === "Yes" ? "No" : "Yes";
        return persist(room.carbonFilter === "Yes" ? "Carbon filter on — fan target raised for the airflow loss" : "Carbon filter off");
      }
    }

    const editBatch = t.closest("[data-edit-batch]");
    if (editBatch) {
      const record = stateRef.state.batches.find((b) => b.id === editBatch.dataset.editBatch);
      const form = document.querySelector("#batchForm");
      if (record && form) fillForm(form, record);
      return;
    }
    const editPlant = t.closest("[data-edit-plant]");
    if (editPlant) {
      const record = stateRef.state.plants.find((p) => p.id === editPlant.dataset.editPlant);
      const form = document.querySelector("#plantForm");
      if (record && form) fillForm(form, record);
      return;
    }
    const editInv = t.closest("[data-edit-inventory]");
    if (editInv) {
      const record = stateRef.state.inventory.find((it) => it.id === editInv.dataset.editInventory);
      const form = document.querySelector("#inventoryForm");
      if (record && form) fillForm(form, record);
      return;
    }
    const editTask = t.closest("[data-edit-task]");
    if (editTask) {
      const record = stateRef.state.tasks.find((task) => task.id === editTask.dataset.editTask);
      const form = document.querySelector("#taskForm");
      if (record && form) fillForm(form, record);
      return;
    }
    const editHarvest = t.closest("[data-edit-harvest]");
    if (editHarvest) {
      const record = stateRef.state.logs.find((log) => log.id === editHarvest.dataset.editHarvest && log.type === "harvest");
      const form = document.querySelector("#harvestForm");
      if (record && form) fillForm(form, record);
      return;
    }
    const del = t.closest("[data-delete]");
    if (del) {
      stateRef.state[del.dataset.delete] = stateRef.state[del.dataset.delete].filter((item) => item.id !== del.dataset.id);
      return persist("Deleted");
    }

    const explicitSave = t.closest("[data-save-form]");
    if (explicitSave) {
      event.preventDefault();
      const form = explicitSave.dataset.saveForm
        ? document.getElementById(explicitSave.dataset.saveForm)
        : explicitSave.closest("form");
      if (!form) return;
      if (!form.reportValidity()) return;
      return saveManagedForm(form);
    }

    const submitButton = t.closest('button[type="submit"]');
    if (submitButton?.form && ["roomLogForm", "roomEditForm", "batchForm", "stageTransitionForm", "plantForm", "inventoryForm", "taskForm", "harvestForm", "settingsForm"].includes(formId(submitButton.form))) {
      event.preventDefault();
      if (!submitButton.form.reportValidity()) return;
      return saveManagedForm(submitButton.form);
    }

    if (t.closest("#syncKeyBtn")) return window.AppStore.promptKey();
    if (t.closest("#syncNowBtn")) {
      showToast("Syncing…");
      return window.AppStore.syncNow();
    }
    if (t.closest("#seedDemoBtn")) return seedDemoData();
    if (t.closest("#resetSetpointsBtn")) {
      if (!window.confirm("Replace your stage targets with the recommended defaults? Logs and rooms are not affected.")) return;
      stateRef.state.settings.setpoints = JSON.parse(JSON.stringify(defaultSetpoints));
      return persist("Targets reset to recommended");
    }
    if (t.closest("#exportCsvBtn")) return exportCsv();
    if (t.closest("#clearDataBtn")) {
      if (!window.confirm("Clear all local data from this browser?")) return;
      clearState();
      stateRef.state = loadState();
      stateRef.view = "rooms";
      return persist("All data cleared");
    }
  });

  document.body.addEventListener("input", (event) => {
    const fan = event.target.closest("[data-fan-speed]");
    if (fan) {
      const room = findRoom(fan.dataset.room);
      if (room) {
        room.fanSpeed = fan.value;
        updateFanReadouts(room);
      }
    }
    // Typing a warm/cool light count rebuilds the per-light wattage boxes live
    // (in both Add room and Edit room) — no save-and-reopen needed.
    const countField = event.target.closest('#roomEditForm [name="warmLightCount"], #roomEditForm [name="coolLightCount"]');
    if (countField) rebuildLightWattsGrid(countField.closest("form"));
  });

  document.body.addEventListener("change", (event) => {
    const fan = event.target.closest("[data-fan-speed]");
    if (fan) return persist("Fan speed updated");
    // Diagnose: choosing a room re-ranks symptoms against its readings
    const dxRoomSel = event.target.closest("[data-dx-room]");
    if (dxRoomSel) {
      stateRef.diagnose = { ...(stateRef.diagnose || {}), roomId: dxRoomSel.value };
      return ui.render();
    }
    // wizard step 1: switching between "new room" and an existing room needs a
    // re-render to show/hide the new-room fields
    const wizRoom = event.target.closest("[data-wizard-room-choice]");
    if (wizRoom && stateRef.modal?.type === "startGrow") {
      stateRef.modal.draft.roomId = wizRoom.value === "__new__" ? "" : wizRoom.value;
      return ui.render();
    }
    // lifecycle transition from the Plants table: select a new status, the
    // change is dated into the plant's status history
    const plantStatusSel = event.target.closest("[data-plant-status]");
    if (plantStatusSel) {
      const plant = stateRef.state.plants.find((p) => p.id === plantStatusSel.dataset.plantStatus);
      if (plant && plant.status !== plantStatusSel.value) {
        if (plantStatusSel.value === "Destroyed" && !window.confirm(`Mark plant ${plant.tag || ""} as Destroyed? This records a dated lifecycle event.`)) {
          plantStatusSel.value = plant.status || "Active";
          return;
        }
        plant.status = plantStatusSel.value;
        plant.statusHistory = [...(plant.statusHistory || []), { status: plant.status, date: todayInputValue() }];
        return persist(`Plant ${plant.tag || ""} → ${plant.status}`);
      }
      return;
    }
    const stageSel = event.target.closest("[data-room-stage]");
    if (stageSel) {
      const room = findRoom(stageSel.dataset.room);
      if (room) {
        const nextStage = stageSel.value;
        if (nextStage === room.stage) return;
        const batch = activeBatchForRoom(room.id);
        if (!batch) {
          preserveManualLampGap(room);
          room.stage = nextStage;
          return persist("Room stage updated");
        }
        stateRef.modal = {
          type: "stageTransition",
          roomId: room.id,
          batchId: batch.id,
          previousStage: room.stage || batch.stage,
          nextStage,
          date: todayInputValue()
        };
        return ui.render();
      }
    }
  });

  document.body.addEventListener("submit", (event) => {
    const form = event.target;
    if (["roomLogForm", "roomEditForm", "batchForm", "stageTransitionForm", "plantForm", "inventoryForm", "taskForm", "harvestForm", "settingsForm"].includes(formId(form))) {
      event.preventDefault();
      return saveManagedForm(form);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    // Esc closes, in order: the image lightbox, the symptom modal, then any
    // other open modal.
    if (stateRef.diagnose && stateRef.diagnose.zoom) {
      stateRef.diagnose.zoom = null;
      return ui.render();
    }
    if (stateRef.diagnose && stateRef.diagnose.open) {
      stateRef.diagnose.open = null;
      return ui.render();
    }
    if (stateRef.modal) {
      stateRef.modal = null;
      ui.render();
    }
  });

  // --- draggable lamp -----------------------------------------------------
  // Drag the handle up/down to set light-to-canopy distance.
  let lampDrag = null;

  document.body.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-lamp-drag]");
    if (!handle) return;
    // Isometric scene: the lamp moves along the vertical z axis, which maps
    // 1:1 to screen Y. Drag is delta-based — pixels are converted to scene
    // centimetres via the SVG's viewBox scale.
    const svg = handle.closest("svg[data-grow-scene]");
    const bar = handle.closest(".light-bar");
    if (!svg || !bar) return;
    event.preventDefault();
    const vb = svg.viewBox.baseVal;
    const sRect = svg.getBoundingClientRect();
    lampDrag = {
      bar,
      cones: Array.from(svg.querySelectorAll(".light-cone")),
      label: svg.querySelector("[data-lamp-label]"),
      unitsPerPx: vb && sRect.height ? vb.height / sRect.height : 1,
      startY: event.clientY,
      z0: Number(bar.dataset.z0) || 0,           // committed lamp height (cm)
      hCm: Number(bar.dataset.hcm) || 200,       // tent height (cm)
      canopyZ: Number(bar.dataset.canopyZ) || 0, // canopy top (cm)
      roomId: handle.dataset.lampDrag,
      gapInches: null,
      moved: false
    };
    bar.classList.add("dragging");
    try { handle.setPointerCapture(event.pointerId); } catch (_) {}
  });

  document.body.addEventListener("pointermove", (event) => {
    if (!lampDrag) return;
    const dzRaw = (lampDrag.startY - event.clientY) * lampDrag.unitsPerPx; // up = +z
    const z = Math.max(lampDrag.canopyZ, Math.min(0.93 * lampDrag.hCm, lampDrag.z0 + dzRaw));
    const dz = z - lampDrag.z0;
    lampDrag.moved = true;
    lampDrag.gapInches = Math.max(0, Math.round((z - lampDrag.canopyZ) / 2.54));
    // shift the whole lamp group (straps, slab, fixtures, handle); screen y is
    // inverted relative to z
    lampDrag.bar.setAttribute("transform", `translate(0 ${(-dz).toFixed(1)})`);
    if (lampDrag.label) lampDrag.label.textContent = formatSmallLength(lampDrag.gapInches);
    // cone faces: first two points of each polygon are the top vertices
    (lampDrag.cones || []).forEach((c) => {
      const pairs = (c.dataset.pts0 || "").trim().split(/\s+/).map((p) => p.split(",").map(Number));
      if (pairs.length < 4) return;
      const pts = pairs.map(([x, y], i) => `${x},${(i < 2 ? y - dz : y).toFixed(1)}`).join(" ");
      c.setAttribute("points", pts);
    });
  });

  function endLampDrag() {
    if (!lampDrag) return;
    const { bar, roomId, gapInches, moved } = lampDrag;
    bar.classList.remove("dragging");
    lampDrag = null;
    const room = findRoom(roomId);
    if (room && moved && Number.isFinite(gapInches)) {
      room.lightHeightIn = String(gapInches);
      room.lampAuto = false; // dragging switches the lamp to manual
      persist(`Lamp set to ${formatSmallLength(gapInches)} above canopy (manual)`);
    }
  }
  document.body.addEventListener("pointerup", endLampDrag);
  document.body.addEventListener("pointercancel", endLampDrag);

  ui.dom.exportJsonBtn.addEventListener("click", () => {
    download(`grow-room-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(stateRef.state, null, 2), "application/json");
  });
  ui.dom.importJsonInput.addEventListener("change", importJson);
}

function exportCsv() {
  const { csvCell } = window.AppUtils;
  const header = ["createdAt", "type", "room", "measurements", "notes"];
  const rows = stateRef.state.logs.map((log) => [log.createdAt, logTypes[log.type]?.label || log.type, ui.names.room(log.roomId), ui.measurements(log), log.notes || ""]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  download(`grow-room-logs-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
}

function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      stateRef.state = { ...loadState(), ...imported };
      stateRef.state.batches = Array.isArray(stateRef.state.batches)
        ? stateRef.state.batches.map((batch) => ({ ...batch, stageHistory: ensureStageHistory(batch) }))
        : [];
      persist("Data imported");
    } catch (error) {
      console.error(error);
      showToast("Import failed: invalid JSON");
    }
  };
  reader.readAsText(file);
}

function seedDemoData() {
  const roomA = id("room");
  const roomB = id("room");
  const batchA = id("batch");
  stateRef.state.rooms = [
    { id: roomA, name: "1.2m Flower Tent", stage: "Flower", plantCount: "4", lengthM: "1.2", widthM: "1.2", heightM: "2", potLiters: "20", potWidthIn: "11.8", potHeightIn: "14.2", fanDiameterIn: "8", fanCapacityCfm: "853.44", fanSpeed: "65", targetAirChangesPerMin: "1", ambientTempF: "72", carbonFilter: "Yes", ductingSetup: "typical", enclosureType: "tent", warmLightCount: "2", warmLightKelvin: "3000", coolLightCount: "2", coolLightKelvin: "5000", lightWattsEach: "100", lightHeightIn: "15", medium: "Coco/perlite", notes: "" },
    { id: roomB, name: "Veg Tent", stage: "Vegetative", plantCount: "6", lengthM: "1", widthM: "1", heightM: "2", potLiters: "11", fanDiameterIn: "6", fanCapacityCfm: "400", fanSpeed: "45", targetAirChangesPerMin: "1", coolLightCount: "2", coolLightKelvin: "5000", warmLightCount: "0", warmLightKelvin: "3000", lightWattsEach: "120", lightHeightIn: "21", medium: "Coco/perlite", notes: "" }
  ];
  stateRef.state.batches = [{ id: batchA, name: "LOT-2026-001", cultivar: "Medicinal A", licenseLot: "MM-001", stage: "Flower", roomId: roomA, startDate: todayInputValue(), count: "4", notes: "" }];
  stateRef.state.plants = [1, 2, 3, 4].map((n) => ({
    id: id("plant"),
    tag: `P-00${n}`,
    strain: "Medicinal A",
    batchId: batchA,
    roomId: roomA,
    status: n === 4 ? "Quarantined" : "Active",
    plantedDate: todayInputValue(),
    statusHistory: [{ status: n === 4 ? "Quarantined" : "Active", date: todayInputValue() }],
    notes: n === 4 ? "Spotted leaf damage — isolated for inspection" : ""
  }));
  stateRef.state.logs = [
    { id: id("log"), type: "environment", createdAt: new Date(Date.now() - 86400000).toISOString(), roomId: roomA, lights: "Off", tempC: "24.4", humidity: "52", co2Ppm: "650", vpdKpa: "", leafTempC: "23.3", airflow: "", notes: "" },
    { id: id("log"), type: "environment", createdAt: new Date().toISOString(), roomId: roomA, lights: "On", tempC: "27.8", humidity: "62", co2Ppm: "700", leafTempC: "25.6", airflow: "", notes: "Warm and humid after lights-on" },
    { id: id("log"), type: "light", createdAt: new Date().toISOString(), roomId: roomA, fixture: "4 floods", ppfd: "780", dli: "", photoperiod: "12", dimmer: "", colorTempK: "4000", canopyDistance: "18", notes: "" },
    { id: id("log"), type: "irrigation", createdAt: new Date().toISOString(), roomId: roomA, batchId: batchA, gallons: "2", ph: "5.9", ec: "2.0", waterTempF: "68", runoffPh: "6.1", runoffEc: "2.3", recipe: "Bloom A/B", notes: "" },
    { id: id("log"), type: "medium", createdAt: new Date().toISOString(), roomId: roomA, batchId: batchA, moisture: "55", mediumTempF: "70", substratePh: "6.0", substrateEc: "1.9", amendment: "", notes: "" },
    { id: id("log"), type: "harvest", createdAt: new Date(Date.now() - 1209600000).toISOString(), batchId: batchA, wetWeight: "1780", dryWeight: "412", wasteWeight: "120", sampleSent: "Yes", harvestCrew: "Demo", notes: "Example completed run for yield metrics" }
  ];
  stateRef.state.inventory = [{ id: id("inventory"), name: "Bloom A", category: "Nutrients", vendor: "Supplier", quantity: "2", unit: "gal", reorderAt: "3" }];
  stateRef.state.tasks = [{ id: id("task"), title: "Check flower RH after lights-on", roomId: roomA, batchId: batchA, priority: "High", dueDate: todayInputValue(), status: "Open", notes: "Watch for RH spike in first hour." }];
  stateRef.activeRoomId = roomA;
  persist("Demo data loaded");
}

function warnIfNotPersistent() {
  if (window.AppStore.isPersistent()) return;
  const bar = document.createElement("div");
  bar.className = "storage-warning";
  bar.innerHTML = "Your browser is blocking storage on a <b>file://</b> page, so changes work now but won't survive a reload. Run it from a local server to keep data &mdash; e.g. <code>python -m http.server 4173</code> then open <code>http://localhost:4173</code>.";
  document.body.appendChild(bar);
}

  window.AppDiagnose.loadDetailedGuides();
  attachEvents();
  const autoTasks = syncPlaybookTasks();
  if (autoTasks) saveState(stateRef.state);
  ui.render();
  if (autoTasks) showToast(`${autoTasks} playbook task${autoTasks === 1 ? "" : "s"} added to this week's checklist`);
  warnIfNotPersistent();
  window.AppStore.initSync({
    getState: () => stateRef.state,
    setState: (next) => {
      stateRef.state = next;
      if (syncPlaybookTasks()) saveState(stateRef.state);
      ui.render();
    },
    notify: showToast
  });
}

window.AppMain = { start };
})();
