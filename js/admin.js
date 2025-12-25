import { requireAuth, clearSession } from "./auth.js";
import { createAdminService } from "./services/adminService.js";

const adminConfig = window.__MB_ADMIN_CONFIG__ || {};
const useMockData = adminConfig.useMock ?? !adminConfig.apiBase;
const dataService = createAdminService({
  apiBase: adminConfig.apiBase,
  useMock: useMockData,
});

const DEFAULT_MONTH = formatMonthInputValue(new Date());
const SEED_CONTENT_SCHEDULES = [
  {
    id: 9001,
    month: DEFAULT_MONTH,
    weekOfMonth: 2,
    theme: "Mercy & exams",
    hadithReference: "Sahih al-Bukhari",
    verseReference: "Surah Ash-Sharh 94:6",
    notes: "Anchor during midterms. Pair with stress support poster.",
  },
  {
    id: 9002,
    month: DEFAULT_MONTH,
    weekOfMonth: 3,
    theme: "Sabr + gratitude",
    hadithReference: "Muslim 55",
    verseReference: "Surah Al-Baqarah 2:153",
    notes: "Use for community drive week.",
  },
];

const UPCOMING_FRIDAYS = getUpcomingFridays(8);
const SEED_FRIDAY_SCHEDULES = [
  {
    id: 9101,
    fridayDate: UPCOMING_FRIDAYS[0],
    prayerCount: 3,
    prayers: [
      { time: "12:30 PM", khatib: "Br. Zaed Ul Islam", location: "IB 110" },
      { time: "1:30 PM", khatib: "Sh. Hosam Helal", location: "IB 110" },
      { time: "2:30 PM", khatib: "Sh. Alaa El-Sayed", location: "DV 2080" },
    ],
  },
  {
    id: 9102,
    fridayDate: UPCOMING_FRIDAYS[1],
    prayerCount: 2,
    prayers: [
      { time: "12:30 PM", khatib: "TBA", location: "IB 110" },
      { time: "1:45 PM", khatib: "Community guest", location: "IB 110" },
    ],
  },
];

const STORAGE_KEYS = {
  contentSchedules: "mb.admin.contentSchedules",
  fridaySchedules: "mb.admin.fridaySchedules",
};

const state = {
  events: [],
  posters: [],
  contentSchedules: [],
  fridaySchedules: [],
  hidePastEvents: false,
  hideExpiredPosters: false,
  editingEventId: null,
  editingPosterId: null,
  editingContentId: null,
  editingFridayId: null,
};

let eventFormRef = null;
let posterFormRef = null;
let contentFormRef = null;
let fridayFormRef = null;
let syncEventTimeInputs = () => {};
let syncPrayerInputs = () => {};
let activeModalId = null;

document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  wireGlobalActions();
  await refreshAll();
});

async function refreshAll() {
  const modeLabel = useMockData ? "mock dataset" : "live API";
  setDashboardStatus(`Syncing ${modeLabel}...`);
  await Promise.all([loadEvents(), loadPosters()]);
  hydrateLocalSchedules();
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

function hydrateLocalSchedules() {
  state.contentSchedules = loadFromStorage(STORAGE_KEYS.contentSchedules, SEED_CONTENT_SCHEDULES);
  const rawFriday = loadFromStorage(STORAGE_KEYS.fridaySchedules, SEED_FRIDAY_SCHEDULES);
  state.fridaySchedules = rawFriday.map(upgradeFridayEntry);
  renderContentSchedules();
  renderFridaySchedules();
  setFridayDateOptions();
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
    confirmDeleteEvent(id);
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
    confirmDeletePoster(id);
    return;
  }
  if (button.dataset.action === "edit-poster") {
    startPosterEdit(id);
  }
}

function renderContentSchedules() {
  const container = document.getElementById("contentList");
  if (!container) return;

  container.innerHTML = "";

  if (!state.contentSchedules.length) {
    container.innerHTML = `<p class="muted">No scheduled content yet.</p>`;
    return;
  }

  const sorted = [...state.contentSchedules].sort(sortByMonthWeek);

  sorted.forEach((item) => {
    const card = document.createElement("article");
    card.className = "schedule-card";
    const monthLabel = formatMonthLabel(item.month);
    const hadithLine = item.hadithReference ? `<p class="schedule-meta">Hadith: ${item.hadithReference}</p>` : "";
    const verseLine = item.verseReference ? `<p class="schedule-meta">Verse: ${item.verseReference}</p>` : "";
    const notesLine = item.notes ? `<p class="schedule-meta">${item.notes}</p>` : "";
    card.innerHTML = `
      <div class="schedule-header">
        <div>
          <div class="pill">Week ${item.weekOfMonth} - ${monthLabel}</div>
          <h5 class="schedule-title">${item.theme || "Weekly picks"}</h5>
          ${hadithLine}
          ${verseLine}
          ${notesLine}
        </div>
        <div class="schedule-actions">
          <button class="ghost-btn small" data-action="edit-content" data-id="${item.id}">Edit</button>
          <button class="ghost-btn small" data-action="delete-content" data-id="${item.id}">Remove</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function handleContentListClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  if (button.dataset.action === "delete-content") {
    confirmDeleteContent(id);
    return;
  }
  if (button.dataset.action === "edit-content") {
    startContentEdit(id);
  }
}

function renderFridaySchedules() {
  const container = document.getElementById("fridayList");
  if (!container) return;

  container.innerHTML = "";

  if (!state.fridaySchedules.length) {
    container.innerHTML = `<p class="muted">No Friday prayers scheduled yet.</p>`;
    return;
  }

  const sorted = [...state.fridaySchedules].sort(sortByMonthWeek);

  sorted.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "schedule-card";
    const dateLabel = entry.fridayDate ? formatDateLabel(entry.fridayDate) : "Friday (date TBA)";
    const count = clampPrayerCount(entry.prayerCount);
    const countLabel = count === 0 ? "No Friday prayer" : `${count} Friday prayer${count > 1 ? "s" : ""}`;
    const prayers = (entry.prayers || []).slice(0, count);
    const prayerLines =
      count === 0
        ? `<p class="prayer-meta">Marked as a week off.</p>`
        : prayers
            .map((prayer, index) => {
              const time = prayer.time || "Time TBA";
              const khatib = prayer.khatib || "Khatib TBA";
              const location = prayer.location || "Location TBA";
              return `<p class="prayer-meta">#${index + 1} ${time} | ${khatib} | ${location}</p>`;
            })
            .join("");

    card.innerHTML = `
      <div class="schedule-header">
        <div>
          <div class="pill">${dateLabel}</div>
          <h5 class="schedule-title">${countLabel}</h5>
          ${prayerLines}
        </div>
        <div class="schedule-actions">
          <button class="ghost-btn small" data-action="edit-friday" data-id="${entry.id}">Edit</button>
          <button class="ghost-btn small" data-action="delete-friday" data-id="${entry.id}">Remove</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function handleFridayListClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  if (button.dataset.action === "delete-friday") {
    confirmDeleteFriday(id);
    return;
  }
  if (button.dataset.action === "edit-friday") {
    startFridayEdit(id);
  }
}

function wireGlobalActions() {
  document.getElementById("eventList")?.addEventListener("click", handleEventListClick);
  document.getElementById("posterList")?.addEventListener("click", handlePosterListClick);
  document.getElementById("contentList")?.addEventListener("click", handleContentListClick);
  document.getElementById("fridayList")?.addEventListener("click", handleFridayListClick);

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    const target = button.dataset.closeModal;
    button.addEventListener("click", () => closeModal(target));
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal.id);
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllModals();
    }
  });

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

  const eventCreateBtn = document.getElementById("eventCreateBtn");
  eventCreateBtn?.addEventListener("click", () => {
    resetEventForm();
    setFormStatus("eventStatus", "", "");
    setModalTitle("eventModalTitle", "Create event");
    openModal("eventModal");
  });

  const posterCreateBtn = document.getElementById("posterCreateBtn");
  posterCreateBtn?.addEventListener("click", () => {
    resetPosterForm();
    setFormStatus("posterStatus", "", "");
    setModalTitle("posterModalTitle", "Create poster");
    openModal("posterModal");
  });

  const contentCreateBtn = document.getElementById("contentCreateBtn");
  contentCreateBtn?.addEventListener("click", () => {
    resetContentForm();
    setFormStatus("contentStatus", "", "");
    setModalTitle("contentModalTitle", "Schedule Hadith + Verse");
    openModal("contentModal");
  });

  const fridayCreateBtn = document.getElementById("fridayCreateBtn");
  fridayCreateBtn?.addEventListener("click", () => {
    resetFridayForm();
    setFormStatus("fridayStatus", "", "");
    setModalTitle("fridayModalTitle", "Schedule Friday Prayers");
    openModal("fridayModal");
  });

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
        closeModal("eventModal");
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
        closeModal("posterModal");
      } catch (error) {
        setFormStatus("posterStatus", error.message, "error");
      }
    });

    setPosterFormMode();
  }

  const contentForm = document.getElementById("contentForm");
  if (contentForm) {
    contentFormRef = contentForm;
    const cancelBtn = document.getElementById("contentCancelEditBtn");
    cancelBtn?.addEventListener("click", () => {
      resetContentForm();
      setFormStatus("contentStatus", "Editing cancelled.", "");
    });

    contentForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(contentForm);
      const isEditing = Boolean(state.editingContentId);
      try {
        const payload = parseContentPayload(formData);
        if (isEditing) {
          state.contentSchedules = state.contentSchedules.map((item) => (item.id === state.editingContentId ? { ...item, ...payload } : item));
          setFormStatus("contentStatus", "Content schedule updated.", "success");
        } else {
          state.contentSchedules.push({ id: createLocalId(), ...payload });
          setFormStatus("contentStatus", "Content scheduled.", "success");
        }
        persistContentSchedules();
        renderContentSchedules();
        resetContentForm();
        closeModal("contentModal");
      } catch (error) {
        setFormStatus("contentStatus", error.message, "error");
      }
    });

    setContentFormMode();
  }

  const fridayForm = document.getElementById("fridayForm");
  if (fridayForm) {
    fridayFormRef = fridayForm;
    const cancelBtn = document.getElementById("fridayCancelEditBtn");
    const countSelect = document.getElementById("prayerCountSelect");
    const buildPrayerInputs = () => {
      const container = document.getElementById("prayerInputs");
      if (!container) return;
      const count = clampPrayerCount(Number(countSelect?.value) || 0);
      container.innerHTML = "";
      for (let index = 0; index < count; index += 1) {
        const block = document.createElement("div");
        block.className = "prayer-block";
        block.innerHTML = `
          <h5>Prayer ${index + 1}</h5>
          <label>
            Time
            <input type="time" name="prayer_${index}_time" />
          </label>
          <label>
            Khatib
            <input type="text" name="prayer_${index}_khatib" placeholder="TBA" />
          </label>
          <label>
            Location
            <input type="text" name="prayer_${index}_location" placeholder="Room / hall" />
          </label>
        `;
        container.appendChild(block);
      }
    };
    setFridayDateOptions();
    syncPrayerInputs = buildPrayerInputs;
    buildPrayerInputs();
    countSelect?.addEventListener("change", buildPrayerInputs);

    cancelBtn?.addEventListener("click", () => {
      resetFridayForm();
      setFormStatus("fridayStatus", "Editing cancelled.", "");
    });

    fridayForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(fridayForm);
      const isEditing = Boolean(state.editingFridayId);
      try {
        const payload = parseFridayPayload(formData);
        if (isEditing) {
          state.fridaySchedules = state.fridaySchedules.map((entry) => (entry.id === state.editingFridayId ? { ...entry, ...payload } : entry));
          setFormStatus("fridayStatus", "Friday schedule updated.", "success");
        } else {
          state.fridaySchedules.push({ id: createLocalId(), ...payload });
          setFormStatus("fridayStatus", "Friday schedule saved.", "success");
        }
        persistFridaySchedules();
        renderFridaySchedules();
        resetFridayForm();
        closeModal("fridayModal");
      } catch (error) {
        setFormStatus("fridayStatus", error.message, "error");
      }
    });

    setFridayFormMode();
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

function parseContentPayload(formData) {
  const month = formData.get("month") || DEFAULT_MONTH;
  const weekOfMonth = Number(formData.get("weekOfMonth")) || 1;
  if (!month) {
    throw new Error("Month is required.");
  }
  return {
    month,
    weekOfMonth,
    theme: formData.get("theme")?.trim() || "Weekly picks",
    hadithReference: formData.get("hadithReference")?.trim() || "",
    verseReference: formData.get("verseReference")?.trim() || "",
    notes: formData.get("notes")?.trim() || "",
  };
}

function parseFridayPayload(formData) {
  const fridayDate = formData.get("fridayDate");
  const prayerCount = clampPrayerCount(Number(formData.get("prayerCount") || 0));
  if (!fridayDate) {
    throw new Error("Friday date is required.");
  }
  const prayers = [];
  for (let index = 0; index < prayerCount; index += 1) {
    prayers.push({
      time: formData.get(`prayer_${index}_time`) || "",
      khatib: formData.get(`prayer_${index}_khatib`)?.trim() || "",
      location: formData.get(`prayer_${index}_location`)?.trim() || "",
    });
  }
  return {
    fridayDate,
    prayerCount,
    prayers,
  };
}

async function confirmDeleteEvent(id) {
  const target = state.events.find((event) => event.id === id);
  const label = target?.name || "this event";
  if (!window.confirm(`Remove ${label}?`)) return;
  await deleteEvent(id);
}

async function deleteEvent(id) {
  await dataService.deleteEvent(id);
  await loadEvents();
  setDashboardStatus("Event removed.");
}

async function confirmDeletePoster(id) {
  const target = state.posters.find((poster) => poster.id === id);
  const label = target?.title || "this poster";
  if (!window.confirm(`Remove ${label}?`)) return;
  await deletePoster(id);
}

function confirmDeleteContent(id) {
  const target = state.contentSchedules.find((item) => item.id === id);
  const label = target ? `Week ${target.weekOfMonth} - ${formatMonthLabel(target.month)}` : "this schedule";
  if (!window.confirm(`Remove ${label}?`)) return;
  state.contentSchedules = state.contentSchedules.filter((item) => item.id !== id);
  persistContentSchedules();
  renderContentSchedules();
}

function confirmDeleteFriday(id) {
  const target = state.fridaySchedules.find((item) => item.id === id);
  const label = target ? formatDateLabel(target.fridayDate) : "this schedule";
  if (!window.confirm(`Remove ${label}?`)) return;
  state.fridaySchedules = state.fridaySchedules.filter((item) => item.id !== id);
  persistFridaySchedules();
  renderFridaySchedules();
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
  setModalTitle("eventModalTitle", "Edit event");
  openModal("eventModal");
}

function resetEventForm() {
  if (!eventFormRef) return;
  eventFormRef.reset();
  state.editingEventId = null;
  syncEventTimeInputs?.();
  setEventFormMode();
  setModalTitle("eventModalTitle", "Create event");
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
  setModalTitle("posterModalTitle", "Edit poster");
  openModal("posterModal");
}

function resetPosterForm() {
  if (!posterFormRef) return;
  posterFormRef.reset();
  state.editingPosterId = null;
  setPosterFormMode();
  setModalTitle("posterModalTitle", "Create poster");
}

function setPosterFormMode() {
  if (!posterFormRef) return;
  const submitBtn = posterFormRef.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("posterCancelEditBtn");
  if (state.editingPosterId) {
    submitBtn.textContent = "Update Poster";
    cancelBtn?.classList.remove("hidden");
  } else {
    submitBtn.textContent = "Save Poster";
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

function startContentEdit(id) {
  if (!contentFormRef) return;
  const target = state.contentSchedules.find((item) => item.id === id);
  if (!target) return;
  state.editingContentId = id;
  populateContentForm(target);
  setContentFormMode();
  setFormStatus("contentStatus", `Editing Week ${target.weekOfMonth} (${formatMonthLabel(target.month)})`, "");
  setModalTitle("contentModalTitle", "Edit weekly picks");
  openModal("contentModal");
}

function resetContentForm() {
  if (!contentFormRef) return;
  contentFormRef.reset();
  const monthField = contentFormRef.querySelector('input[name="month"]');
  const weekField = contentFormRef.querySelector('select[name="weekOfMonth"]');
  if (monthField) monthField.value = DEFAULT_MONTH;
  if (weekField) weekField.value = "1";
  state.editingContentId = null;
  setContentFormMode();
  setModalTitle("contentModalTitle", "Schedule Hadith + Verse");
}

function setContentFormMode() {
  if (!contentFormRef) return;
  const submitBtn = contentFormRef.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("contentCancelEditBtn");
  if (state.editingContentId) {
    submitBtn.textContent = "Update Content";
    cancelBtn?.classList.remove("hidden");
  } else {
    submitBtn.textContent = "Save Content";
    cancelBtn?.classList.add("hidden");
  }
}

function populateContentForm(data) {
  const { elements } = contentFormRef;
  elements.month.value = data.month || DEFAULT_MONTH;
  elements.weekOfMonth.value = data.weekOfMonth || 1;
  elements.theme.value = data.theme || "";
  elements.hadithReference.value = data.hadithReference || "";
  elements.verseReference.value = data.verseReference || "";
  elements.notes.value = data.notes || "";
}

function startFridayEdit(id) {
  if (!fridayFormRef) return;
  const target = state.fridaySchedules.find((item) => item.id === id);
  if (!target) return;
  state.editingFridayId = id;
  setFridayDateOptions(target.fridayDate);
  populateFridayForm(target);
  setFridayFormMode();
  setFormStatus("fridayStatus", `Editing ${formatDateLabel(target.fridayDate)}`, "");
  setModalTitle("fridayModalTitle", "Edit Friday Prayers");
  openModal("fridayModal");
}

function resetFridayForm() {
  if (!fridayFormRef) return;
  fridayFormRef.reset();
  const countSelect = fridayFormRef.querySelector("#prayerCountSelect");
  if (countSelect) countSelect.value = "3";
  state.editingFridayId = null;
  setFridayFormMode();
  syncPrayerInputs?.();
  setModalTitle("fridayModalTitle", "Schedule Friday Prayers");
  setFridayDateOptions();
  const dateSelect = fridayFormRef.querySelector("#fridayDateSelect");
  if (dateSelect && dateSelect.options.length) {
    dateSelect.value = dateSelect.options[0].value;
  }
}

function setFridayFormMode() {
  if (!fridayFormRef) return;
  const submitBtn = fridayFormRef.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("fridayCancelEditBtn");
  if (state.editingFridayId) {
    submitBtn.textContent = "Update Friday prayers";
    cancelBtn?.classList.remove("hidden");
  } else {
    submitBtn.textContent = "Save Friday prayers";
    cancelBtn?.classList.add("hidden");
  }
}

function populateFridayForm(entry) {
  const { elements } = fridayFormRef;
  const countSelect = fridayFormRef.querySelector("#prayerCountSelect");
  const dateSelect = fridayFormRef.querySelector("#fridayDateSelect");
  const countValue = clampPrayerCount(entry.prayerCount);
  if (countSelect) {
    countSelect.value = `${countValue}`;
  }
  setFridayDateOptions(entry.fridayDate);
  if (dateSelect && entry.fridayDate) {
    const exists = Array.from(dateSelect.options).some((opt) => opt.value === entry.fridayDate);
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = entry.fridayDate;
      opt.textContent = formatDateLabel(entry.fridayDate);
      dateSelect.appendChild(opt);
    }
    dateSelect.value = entry.fridayDate;
  }
  syncPrayerInputs?.();
  const count = clampPrayerCount(entry.prayerCount);
  for (let index = 0; index < count; index += 1) {
    const prayer = entry.prayers?.[index] || {};
    const timeField = fridayFormRef.querySelector(`input[name="prayer_${index}_time"]`);
    const khatibField = fridayFormRef.querySelector(`input[name="prayer_${index}_khatib"]`);
    const locationField = fridayFormRef.querySelector(`input[name="prayer_${index}_location"]`);
    if (timeField) timeField.value = prayer.time || "";
    if (khatibField) khatibField.value = prayer.khatib || "";
    if (locationField) locationField.value = prayer.location || "";
  }
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

function persistContentSchedules() {
  saveToStorage(STORAGE_KEYS.contentSchedules, state.contentSchedules);
}

function persistFridaySchedules() {
  saveToStorage(STORAGE_KEYS.fridaySchedules, state.fridaySchedules);
}

function setFridayDateOptions(selectedDate) {
  const select = document.getElementById("fridayDateSelect");
  if (!select) return;
  const dates = getUpcomingFridays(16);
  select.innerHTML = "";
  dates.forEach((dateStr) => {
    const option = document.createElement("option");
    option.value = dateStr;
    option.textContent = formatDateLabel(dateStr);
    select.appendChild(option);
  });
  if (selectedDate && !dates.includes(selectedDate)) {
    const option = document.createElement("option");
    option.value = selectedDate;
    option.textContent = `${formatDateLabel(selectedDate)} (archived)`;
    select.appendChild(option);
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  activeModalId = modalId;
  document.body.classList.add("modal-open");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  if (activeModalId === modalId) {
    activeModalId = null;
  }
  if (!document.querySelector(".modal.open")) {
    document.body.classList.remove("modal-open");
  }
}

function closeAllModals() {
  document.querySelectorAll(".modal.open").forEach((modal) => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  });
  activeModalId = null;
  document.body.classList.remove("modal-open");
}

function setModalTitle(elementId, text) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = text;
  }
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

function formatMonthInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthValue) {
  if (!monthValue) return "Month TBA";
  const [yearStr, monthStr] = monthValue.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const date = new Date(year || new Date().getFullYear(), monthIndex >= 0 ? monthIndex : 0, 1);
  if (Number.isNaN(date.getTime())) return monthValue;
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
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

function formatDateLabel(dateStr) {
  if (!dateStr) return "Friday (date TBA)";
  const date = parseLocalDate(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sortByMonthWeek(a, b) {
  if (a.fridayDate || b.fridayDate) {
    const da = a.fridayDate ? parseLocalDate(a.fridayDate).getTime() : 0;
    const db = b.fridayDate ? parseLocalDate(b.fridayDate).getTime() : 0;
    return da - db;
  }
  const monthA = a.month || "";
  const monthB = b.month || "";
  if (monthA !== monthB) {
    return monthA.localeCompare(monthB);
  }
  return (a.weekOfMonth || 0) - (b.weekOfMonth || 0);
}

function clampPrayerCount(value) {
  if (Number.isNaN(value)) return 0;
  return Math.min(3, Math.max(0, value));
}

function loadFromStorage(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return deepClone(fallback);
    return deepClone(JSON.parse(raw));
  } catch (error) {
    console.warn(`Unable to load ${key} from storage`, error);
    return deepClone(fallback);
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Unable to save ${key} to storage`, error);
  }
}

function getUpcomingFridays(count = 12, referenceDate = new Date()) {
  const dates = [];
  const cursor = new Date(referenceDate);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getDay() !== 5) {
    cursor.setDate(cursor.getDate() + 1);
  }
  for (let i = 0; i < count; i += 1) {
    dates.push(formatDateInput(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

function upgradeFridayEntry(entry) {
  if (entry.fridayDate) return entry;
  if (entry.month && entry.weekOfMonth) {
    const derived = deriveFridayDateFromMonthWeek(entry.month, entry.weekOfMonth);
    return {
      ...entry,
      fridayDate: derived,
    };
  }
  return {
    ...entry,
    fridayDate: entry.fridayDate || "",
  };
}

function deriveFridayDateFromMonthWeek(monthValue, weekOfMonth = 1) {
  const [yearStr, monthStr] = (monthValue || "").split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (Number.isNaN(year) || Number.isNaN(monthIndex)) {
    return "";
  }
  const start = new Date(year, monthIndex, 1);
  while (start.getDay() !== 5 && start.getMonth() === monthIndex) {
    start.setDate(start.getDate() + 1);
  }
  start.setDate(start.getDate() + 7 * Math.max(0, (weekOfMonth || 1) - 1));
  if (start.getMonth() !== monthIndex) {
    start.setMonth(monthIndex + 1, 0); // last day of month
  }
  return formatDateInput(start);
}

function deepClone(data) {
  return JSON.parse(JSON.stringify(data));
}

function createLocalId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function parseLocalDate(dateStr) {
  const parts = (dateStr || "").split("-").map(Number);
  if (parts.length < 3) return new Date(dateStr);
  const [year, month, day] = parts;
  return new Date(year, (month || 1) - 1, day || 1);
}
