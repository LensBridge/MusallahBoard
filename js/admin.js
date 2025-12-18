import { requireAuth, clearSession } from "./auth.js";
import { createAdminService } from "./services/adminService.js";

const adminConfig = window.__MB_ADMIN_CONFIG__ || {};
const useMockData = adminConfig.useMock ?? !adminConfig.apiBase;
const dataService = createAdminService({
  apiBase: adminConfig.apiBase,
  useMock: useMockData,
});

const state = {
  events: [],
  posters: [],
  hidePastEvents: false,
  hideExpiredPosters: false,
  editingEventId: null,
  editingPosterId: null,
};

let eventFormRef = null;
let posterFormRef = null;
let syncEventTimeInputs = () => {};

document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  wireGlobalActions();
  await refreshAll();
});

async function refreshAll() {
  const modeLabel = useMockData ? "mock dataset" : "live API";
  setDashboardStatus(`Syncing ${modeLabel}...`);
  await Promise.all([loadEvents(), loadPosters()]);
  setDashboardStatus(`${modeLabel} synced and ready.`);
}

async function loadEvents() {
  try {
    const events = await dataService.fetchEvents();
    state.events = events;
    renderEvents();
    updateMetrics();
  } catch (error) {
    setDashboardStatus(`Unable to load events: ${error.message}`, "error");
  }
}

async function loadPosters() {
  try {
    const posters = await dataService.fetchPosters();
    state.posters = posters;
    renderPosters();
    updateMetrics();
  } catch (error) {
    setDashboardStatus(`Unable to load posters: ${error.message}`, "error");
  }
}

function renderEvents() {
  const container = document.getElementById("eventList");
  if (!container) return;

  container.innerHTML = "";

  if (!state.events.length) {
    container.innerHTML = `<p class="muted">No events yet. Add one using the form.</p>`;
    return;
  }

  const now = Date.now();
  const filtered = state.hidePastEvents
    ? state.events.filter((event) => event.endTimestamp >= now)
    : state.events;
  const sorted = [...filtered].sort((a, b) => a.startTimestamp - b.startTimestamp);

  sorted.forEach((event) => {
    const card = document.createElement("article");
    card.className = "event-card";
    const audienceLabel = formatAudience(event.audience);
    card.innerHTML = `
      <h5>${event.name}</h5>
      <p class="meta">${formatEventWindow(event)}</p>
      <p class="meta">${event.location || "Location TBA"}</p>
      <p class="meta">Audience: ${audienceLabel}</p>
      <div class="actions">
        <button class="ghost-btn small" data-action="edit-event" data-id="${event.id}">Edit</button>
        <button class="ghost-btn small" data-action="delete-event" data-id="${event.id}">Remove</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function handleEventListClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  if (button.dataset.action === "delete-event") {
    deleteEvent(id);
    return;
  }
  if (button.dataset.action === "edit-event") {
    startEventEdit(id);
  }
}

function renderPosters() {
  const container = document.getElementById("posterList");
  if (!container) return;

  container.innerHTML = "";

  if (!state.posters.length) {
    container.innerHTML = `<p class="muted">No posters yet. Add one using the form.</p>`;
    return;
  }

  const now = Date.now();
  const filtered = state.hideExpiredPosters
    ? state.posters.filter((poster) => new Date(poster.endDate).getTime() >= now)
    : state.posters;

  filtered.forEach((poster) => {
    const card = document.createElement("div");
    card.className = "poster-card";
    const safeImage = poster.image || "";
    const activeWindow = formatActiveWindow(poster);
    const audienceLabel = formatAudience(poster.audience);
    card.innerHTML = `
      <img src="${safeImage}" alt="${poster.title}" onerror="this.style.display='none'" />
      <div class="poster-body">
        <h5>${poster.title}</h5>
        <p class="meta">${activeWindow}</p>
        <p class="meta">Audience: ${audienceLabel}</p>
        <p>${poster.duration} ms</p>
        <div class="actions">
          <button class="ghost-btn small" data-action="edit-poster" data-id="${poster.id}">Edit</button>
          <button class="ghost-btn small" data-action="delete-poster" data-id="${poster.id}">Remove</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function handlePosterListClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  if (button.dataset.action === "delete-poster") {
    deletePoster(id);
    return;
  }
  if (button.dataset.action === "edit-poster") {
    startPosterEdit(id);
  }
}

function wireGlobalActions() {
  document.getElementById("eventList")?.addEventListener("click", handleEventListClick);
  document.getElementById("posterList")?.addEventListener("click", handlePosterListClick);

  const signOutBtn = document.getElementById("signOutBtn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", () => {
      clearSession();
      window.location.replace("/signin/");
    });
  }

  const refreshBtn = document.getElementById("refreshDataBtn");
  refreshBtn?.addEventListener("click", refreshAll);

  const mockSyncBtn = document.getElementById("mockSyncBtn");
  if (mockSyncBtn) {
    if (useMockData) {
      mockSyncBtn.addEventListener("click", async () => {
        setDashboardStatus("Simulating sync...");
        const payload = await dataService.simulateSync();
        setDashboardStatus(
          `Mock sync complete at ${new Date(payload.syncedAt).toLocaleTimeString()}. Events: ${payload.events}, Posters: ${payload.posters}.`
        );
      });
    } else {
      mockSyncBtn.disabled = true;
      mockSyncBtn.textContent = "Live sync managed by API";
    }
  }

  const clearPastBtn = document.getElementById("clearPastBtn");
  clearPastBtn?.addEventListener("click", async () => {
    await dataService.clearPastEvents();
    await loadEvents();
    setDashboardStatus("Past events cleared.");
  });

  const hidePastEventsToggle = document.getElementById("hidePastEvents");
  hidePastEventsToggle?.addEventListener("change", (event) => {
    state.hidePastEvents = event.target.checked;
    renderEvents();
  });

  const hideExpiredPostersToggle = document.getElementById("hideExpiredPosters");
  hideExpiredPostersToggle?.addEventListener("change", (event) => {
    state.hideExpiredPosters = event.target.checked;
    renderPosters();
  });

  wireForms();
}

function wireForms() {
  const eventForm = document.getElementById("eventForm");
  if (eventForm) {
    eventFormRef = eventForm;
    const cancelBtn = document.getElementById("eventCancelEditBtn");
    const timeInputs = eventForm.querySelectorAll("[data-time-input]");
    const allDayToggle = eventForm.querySelector('input[name="allDay"]');
    const toggleTimeInputs = () => {
      const disabled = allDayToggle?.checked;
      timeInputs.forEach((input) => {
        input.disabled = Boolean(disabled);
        if (disabled) {
          input.value = "";
        }
      });
    };
    syncEventTimeInputs = toggleTimeInputs;
    toggleTimeInputs();
    allDayToggle?.addEventListener("change", toggleTimeInputs);

    cancelBtn?.addEventListener("click", () => {
      resetEventForm();
      setFormStatus("eventStatus", "Editing cancelled.", "");
    });

    eventForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(eventForm);
      const isEditing = Boolean(state.editingEventId);
      try {
        if (isEditing) {
          await dataService.updateEvent(state.editingEventId, parseEventPayload(formData));
          setFormStatus("eventStatus", "Event updated.", "success");
        } else {
          await dataService.createEvent(parseEventPayload(formData));
          setFormStatus("eventStatus", useMockData ? "Event saved locally. Ready to sync with API." : "Event saved.", "success");
        }
        await loadEvents();
        resetEventForm();
      } catch (error) {
        setFormStatus("eventStatus", error.message, "error");
      }
    });

    setEventFormMode();
  }

  const posterForm = document.getElementById("posterForm");
  if (posterForm) {
    posterFormRef = posterForm;
    const cancelBtn = document.getElementById("posterCancelEditBtn");
    cancelBtn?.addEventListener("click", () => {
      resetPosterForm();
      setFormStatus("posterStatus", "Editing cancelled.", "");
    });

    posterForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(posterForm);
      const isEditing = Boolean(state.editingPosterId);
      try {
        if (isEditing) {
          await dataService.updatePoster(state.editingPosterId, parsePosterPayload(formData));
          setFormStatus("posterStatus", "Poster updated.", "success");
        } else {
          await dataService.createPoster(parsePosterPayload(formData));
          setFormStatus("posterStatus", "Poster added to rotation.", "success");
        }
        await loadPosters();
        resetPosterForm();
      } catch (error) {
        setFormStatus("posterStatus", error.message, "error");
      }
    });

    setPosterFormMode();
  }
}

function parseEventPayload(formData) {
  const name = formData.get("title")?.trim();
  const location = formData.get("location")?.trim();
  const audience = sanitizeAudience(formData.get("audience"));
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate") || startDate;
  const allDay = formData.get("allDay") === "on";
  const startTime = allDay ? "00:00" : formData.get("startTime") || "00:00";
  const endTime = allDay ? "23:59" : formData.get("endTime") || startTime;

  if (!name || !startDate) {
    throw new Error("Title and start date are required.");
  }

  return {
    name,
    location: location || "",
    audience,
    startTimestamp: toTimestamp(startDate, startTime),
    endTimestamp: toTimestamp(endDate, endTime),
    allDay,
  };
}

function parsePosterPayload(formData) {
  const title = formData.get("title")?.trim();
  const image = formData.get("image")?.trim();
  const duration = Number(formData.get("duration") || 8000);
  const audience = sanitizeAudience(formData.get("audience"));
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate") || startDate;

  if (!title || !image) {
    throw new Error("Title and image URL are required.");
  }

  if (!startDate || !endDate) {
    throw new Error("Poster start and end dates are required.");
  }

  if (new Date(startDate) > new Date(endDate)) {
    throw new Error("Poster end date must be after the start date.");
  }

  return {
    title,
    image,
    duration,
    audience,
    startDate,
    endDate,
  };
}

async function deleteEvent(id) {
  await dataService.deleteEvent(id);
  await loadEvents();
  setDashboardStatus("Event removed.");
}

async function deletePoster(id) {
  await dataService.deletePoster(id);
  await loadPosters();
  setDashboardStatus("Poster removed.");
}

function startEventEdit(id) {
  if (!eventFormRef) return;
  const target = state.events.find((event) => event.id === id);
  if (!target) return;
  state.editingEventId = id;
  populateEventForm(target);
  setEventFormMode();
  setFormStatus("eventStatus", `Editing "${target.name}"`, "");
}

function resetEventForm() {
  if (!eventFormRef) return;
  eventFormRef.reset();
  state.editingEventId = null;
  syncEventTimeInputs?.();
  setEventFormMode();
}

function setEventFormMode() {
  if (!eventFormRef) return;
  const submitBtn = eventFormRef.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("eventCancelEditBtn");
  if (state.editingEventId) {
    submitBtn.textContent = "Update Event";
    cancelBtn?.classList.remove("hidden");
  } else {
    submitBtn.textContent = "Save Event";
    cancelBtn?.classList.add("hidden");
  }
}

function populateEventForm(eventData) {
  const { elements } = eventFormRef;
  elements.title.value = eventData.name || "";
  elements.location.value = eventData.location || "";
  elements.audience.value = eventData.audience || "both";
  elements.startDate.value = formatDateInput(new Date(eventData.startTimestamp));
  elements.endDate.value = formatDateInput(new Date(eventData.endTimestamp));
  const allDay = Boolean(eventData.allDay);
  elements.allDay.checked = allDay;
  const startTime = formatTimeInput(new Date(eventData.startTimestamp));
  const endTime = formatTimeInput(new Date(eventData.endTimestamp));
  elements.startTime.value = allDay ? "" : startTime;
  elements.endTime.value = allDay ? "" : endTime;
  syncEventTimeInputs?.();
}

function startPosterEdit(id) {
  if (!posterFormRef) return;
  const target = state.posters.find((poster) => poster.id === id);
  if (!target) return;
  state.editingPosterId = id;
  populatePosterForm(target);
  setPosterFormMode();
  setFormStatus("posterStatus", `Editing "${target.title}"`, "");
}

function resetPosterForm() {
  if (!posterFormRef) return;
  posterFormRef.reset();
  state.editingPosterId = null;
  setPosterFormMode();
}

function setPosterFormMode() {
  if (!posterFormRef) return;
  const submitBtn = posterFormRef.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("posterCancelEditBtn");
  if (state.editingPosterId) {
    submitBtn.textContent = "Update Poster";
    cancelBtn?.classList.remove("hidden");
  } else {
    submitBtn.textContent = "Add Poster";
    cancelBtn?.classList.add("hidden");
  }
}

function populatePosterForm(poster) {
  const { elements } = posterFormRef;
  elements.title.value = poster.title || "";
  elements.startDate.value = poster.startDate || "";
  elements.endDate.value = poster.endDate || poster.startDate || "";
  elements.audience.value = poster.audience || "both";
  elements.image.value = poster.image || "";
  elements.duration.value = poster.duration || 8000;
}

function updateMetrics() {
  const events = [...state.events];
  const posters = [...state.posters];
  document.getElementById("eventTotal").textContent = events.length;
  document.getElementById("posterTotal").textContent = posters.length;

  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfWeek = startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000;

  const todayCount = events.filter((event) => isSameDay(event.startTimestamp, startOfDay.getTime())).length;
  const weekCount = events.filter((event) => event.startTimestamp <= endOfWeek && event.endTimestamp >= startOfDay.getTime()).length;

  document.getElementById("todayCount").textContent = todayCount;
  document.getElementById("weekCount").textContent = weekCount;

  const nextEvent = events
    .filter((event) => event.endTimestamp >= now)
    .sort((a, b) => a.startTimestamp - b.startTimestamp)[0];

  const nextEventLabel = document.getElementById("nextEventLabel");
  if (nextEvent) {
    nextEventLabel.textContent = `Next: ${nextEvent.name} • ${formatDate(new Date(nextEvent.startTimestamp))}`;
  } else {
    nextEventLabel.textContent = "No upcoming events";
  }
}

function setFormStatus(elementId, message, variant = "") {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.dataset.variant = variant;
}

function setDashboardStatus(message, variant) {
  const el = document.getElementById("dashboardStatus");
  if (!el) return;
  el.textContent = message;
  el.dataset.variant = variant || "";
}

function toTimestamp(dateStr, timeStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = (timeStr || "00:00").split(":").map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0).getTime();
}

function formatEventWindow(event) {
  const start = new Date(event.startTimestamp);
  const end = new Date(event.endTimestamp || event.startTimestamp);
  if (event.allDay) {
    return `${formatDate(start)} • All day`;
  }
  if (isSameDay(event.startTimestamp, event.endTimestamp)) {
    return `${formatDate(start)} • ${formatTime(start)} - ${formatTime(end)}`;
  }
  return `${formatDate(start)} → ${formatDate(end)}`;
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(date) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSameDay(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function sanitizeAudience(raw) {
  const value = (raw || "both").toLowerCase();
  return ["brothers", "sisters", "both"].includes(value) ? value : "both";
}

function formatAudience(value) {
  const label = (value || "both").toLowerCase();
  if (label === "brothers") return "Brothers";
  if (label === "sisters") return "Sisters";
  return "Both";
}

function formatActiveWindow(poster) {
  if (!poster.startDate || !poster.endDate) {
    return "Active window: Not scheduled";
  }
  return `Active window: ${formatPosterDate(poster.startDate)} → ${formatPosterDate(poster.endDate)}`;
}

function formatPosterDate(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeInput(date) {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}
