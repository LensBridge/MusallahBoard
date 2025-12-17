export const FRAME_TYPES = {
  WEEK_AT_GLANCE: "weekAtGlance",
  TODAY: "today",
  NEXT_PRAYER: "nextPrayer",
  POSTER: "poster",
  QUOTES: "quotes",
};

const frameBuilders = new Map();

export function registerFrameBuilder(type, builder) {
  frameBuilders.set(type, builder);
}

export function initSlideshow({
  frameDefinitions = [],
  context = {},
  containerId = "slideshowContainer",
  indicatorsId = "slideIndicators",
  autoRefreshMs = 60000,
}) {
  const container = document.getElementById(containerId);
  const indicatorsContainer = document.getElementById(indicatorsId);
  if (!container || !indicatorsContainer) return;

  const track = document.createElement("div");
  track.className = "slides-track";

  const frames = frameDefinitions
    .map((definition) => buildFrame(definition, context))
    .filter(Boolean);

  // Clear old tracks but keep indicators container
  Array.from(container.children).forEach((child) => {
    if (child.id !== indicatorsId) child.remove();
  });
  container.appendChild(track);

  frames.forEach((frame) => track.appendChild(frame.element));

  // Build indicators
  indicatorsContainer.innerHTML = "";
  frames.forEach((_frame, index) => {
    const indicator = document.createElement("div");
    indicator.className = "slide-indicator" + (index === 0 ? " active" : "");
    indicator.addEventListener("click", () => goToSlide(index));
    indicatorsContainer.appendChild(indicator);
  });

  let currentIndex = 0;
  let slideTimer = null;
  let durations = frames.map((frame) => getFrameDuration(frame));

  function showSlide(index) {
    currentIndex = index;
    const percent = -index * 100;
    track.style.transform = `translateX(${percent}%)`;

    Array.from(indicatorsContainer.children).forEach((indicator, i) => {
      indicator.classList.toggle("active", i === index);
    });
  }

  function scheduleNextSlide() {
    if (slideTimer) clearTimeout(slideTimer);
    const duration = durations[currentIndex] || 10000;
    slideTimer = setTimeout(() => {
      cycleSlides();
      scheduleNextSlide();
    }, duration);
  }

  function cycleSlides() {
    if (!frames.length) return;
    const nextIndex = (currentIndex + 1) % frames.length;
    showSlide(nextIndex);
  }

  function goToSlide(index) {
    showSlide(index);
    scheduleNextSlide();
  }

  function refreshFrames() {
    frames.forEach((frame) => frame.refresh?.());
    durations = frames.map((frame) => getFrameDuration(frame));
  }

  showSlide(0);
  scheduleNextSlide();
  if (autoRefreshMs) {
    setInterval(refreshFrames, autoRefreshMs);
  }

  // Return a small API in case we need to hook into it later (e.g., when backend pushes updates)
  return {
    refresh: refreshFrames,
    goToSlide,
  };
}

function buildFrame(definition, context) {
  const builder = frameBuilders.get(definition.type);
  if (!builder) {
    console.warn(`No frame builder registered for type ${definition.type}`);
    return null;
  }
  return builder(definition, context);
}

function getFrameDuration(frame) {
  if (typeof frame.getDuration === "function") {
    return frame.getDuration();
  }
  if (typeof frame.durationMs === "number") {
    return frame.durationMs;
  }
  return 10000;
}

// =====================================================
// Frame Builders
// =====================================================
function buildWeekAtGlanceFrame(definition, context) {
  const slide = document.createElement("div");
  slide.className = "slide week-glance-slide";
  slide.innerHTML = `
    <div class="week-glance-container">
      <h2 class="widget-title">Your Week at a Glance</h2>
      <div class="week-grid" data-role="week-grid"></div>
    </div>
  `;

  const weekGrid = slide.querySelector('[data-role="week-grid"]');
  const frameState = { eventCount: 0 };

  const render = () => {
    if (!weekGrid) return;
    weekGrid.innerHTML = "";
    frameState.eventCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentDay = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - currentDay);
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      const dayEvents = getEventsForDay(context.events || [], dayDate);
      const isToday = dayDate.toDateString() === today.toDateString();

      const dayRow = document.createElement("div");
      dayRow.className = "day-row" + (isToday ? " today" : "");

      const dayHeader = document.createElement("div");
      dayHeader.className = "day-header";
      dayHeader.innerHTML = `<div class="day-name">${weekDays[i]}</div><div class="day-date">${dayDate.getDate()}</div>`;
      dayRow.appendChild(dayHeader);

      const dayContent = document.createElement("div");
      dayContent.className = "day-content";

      if (dayEvents.length === 0) {
        const noEventsPlaceholder = document.createElement("div");
        noEventsPlaceholder.className = "no-events-placeholder";
        noEventsPlaceholder.textContent = "Stay tuned";
        dayContent.appendChild(noEventsPlaceholder);
      } else {
        const eventsContainer = document.createElement("div");
        eventsContainer.className = "day-events";

        const scrollContainer = document.createElement("div");
        scrollContainer.className = "day-events-scroll-container";

        const primaryEvent = getPrimaryEvent(dayEvents);
        dayEvents.forEach((event) => {
          const eventCard = document.createElement("div");
          const isPrimary = event.id === primaryEvent?.id;
          eventCard.className = `event-card ${isPrimary ? "primary" : "secondary"}`;
          const displayTime = formatEventTimeDisplay(
            event.startTimestamp,
            event.endTimestamp,
            event.allDay
          );
          eventCard.innerHTML = `
            <div class="event-time">${displayTime}</div>
            <div class="event-name">${event.name}</div>
            <div class="event-location">${event.location || ""}</div>
          `;
          scrollContainer.appendChild(eventCard);
        });

        eventsContainer.appendChild(scrollContainer);

        // Enable marquee effect if needed
        setTimeout(() => {
          if (scrollContainer.scrollWidth > eventsContainer.clientWidth) {
            const originalCards = scrollContainer.innerHTML;
            scrollContainer.innerHTML = originalCards + originalCards;
            scrollContainer.classList.add("auto-scroll");
          } else {
            scrollContainer.classList.remove("auto-scroll");
          }
        }, 100);

        dayContent.appendChild(eventsContainer);
      }

      dayRow.appendChild(dayContent);
      weekGrid.appendChild(dayRow);
      frameState.eventCount += dayEvents.length;
    }

    if (context.onWeekMetrics) {
      context.onWeekMetrics(frameState.eventCount);
    }
  };

  render();

  return {
    id: definition.id,
    element: slide,
    refresh: render,
    getDuration: () => calculateWeekDuration(frameState.eventCount),
  };
}

function buildTodayFrame(definition, context) {
  const slide = document.createElement("div");
  slide.className = "slide today-slide";
  slide.innerHTML = `
    <div class="today-container">
      <h2 class="widget-title">Coming up Today</h2>
      <div class="today-events" data-role="today-events"></div>
    </div>
  `;

  const todayEventsContainer = slide.querySelector('[data-role="today-events"]');
  const frameState = { visibleEvents: 0 };

  const render = () => {
    if (!todayEventsContainer) return;
    todayEventsContainer.innerHTML = "";
    frameState.visibleEvents = 0;

    const today = new Date();
    const events = getEventsForDay(context.events || [], today).sort(
      (a, b) => a.startTimestamp - b.startTimestamp
    );

    if (events.length === 0) {
      todayEventsContainer.innerHTML =
        '<div class="no-events-today">Stay Tuned!<br><span style="font-size: 0.6em; opacity: 0.8;">Check back soon for upcoming events</span></div>';
      return;
    }

    const now = Date.now();
    const happeningNow = [];
    const comingSoon = [];

    events.forEach((event) => {
      if (event.startTimestamp <= now && event.endTimestamp >= now) {
        happeningNow.push(event);
      } else if (event.startTimestamp > now) {
        comingSoon.push(event);
      }
    });

    if (happeningNow.length === 0 && comingSoon.length === 0) {
      todayEventsContainer.innerHTML =
        '<div class="no-events-today">Stay Tuned!<br><span style="font-size: 0.6em; opacity: 0.8;">Check back soon for upcoming events</span></div>';
      return;
    }

    const widget = document.createElement("div");
    widget.className = "today-signage-display";

    if (happeningNow.length > 0) {
      const event = happeningNow[0];
      const minutesLeft = Math.max(0, Math.floor((event.endTimestamp - now) / (1000 * 60)));
      const nowSection = document.createElement("div");
      nowSection.className = "signage-tier happening-now-tier";
      nowSection.innerHTML = `
        <div class="tier-label">Happening Now</div>
        <div class="tier-content">
          <div class="event-name-large">${event.name}</div>
          <div class="event-meta-large">
            <div class="event-location-large">${event.location || "TBA"}</div>
            <div class="event-ends-in">${minutesLeft > 0 ? `${minutesLeft} min remaining` : "Ending soon"}</div>
          </div>
        </div>
      `;
      widget.appendChild(nowSection);
    }

    if (comingSoon.length > 0) {
      const soonSection = document.createElement("div");
      soonSection.className =
        "signage-tier coming-soon-tier" + (happeningNow.length === 0 ? " primary" : "");
      soonSection.innerHTML += `<div class="tier-label">${happeningNow.length === 0 ? "Up Next" : "Coming Up"}</div>`;

      const eventsList = document.createElement("div");
      eventsList.className = "upcoming-events-list";

      comingSoon.slice(0, 5).forEach((event, index) => {
        const timeUntil = Math.floor((event.startTimestamp - now) / (1000 * 60));
        const timeText = formatTimeUntil(timeUntil);
        const displayTime = formatEventTimeDisplay(
          event.startTimestamp,
          event.endTimestamp,
          event.allDay
        );

        const eventItem = document.createElement("div");
        eventItem.className = `upcoming-event-item${
          index === 0 && happeningNow.length === 0 ? " primary" : ""
        }`;

        eventItem.innerHTML = `
          <div class="upcoming-event-time">${displayTime}</div>
          <div class="upcoming-event-info">
            <div class="upcoming-event-name">${event.name}</div>
            <div class="upcoming-event-in">${timeText}</div>
          </div>
          <div class="upcoming-event-location">${event.location || "TBA"}</div>
        `;

        eventsList.appendChild(eventItem);
      });

      soonSection.appendChild(eventsList);
      widget.appendChild(soonSection);
    }

    todayEventsContainer.appendChild(widget);
    frameState.visibleEvents = happeningNow.length + Math.min(comingSoon.length, 5);
    if (context.onTodayMetrics) {
      context.onTodayMetrics(frameState.visibleEvents);
    }
  };

  render();

  return {
    id: definition.id,
    element: slide,
    refresh: render,
    getDuration: () => calculateTodayDuration(frameState.visibleEvents),
  };
}

function buildNextPrayerFrame(definition) {
  const slide = document.createElement("div");
  slide.className = "slide next-prayer-slide";
  slide.innerHTML = `
    <div class="next-prayer-container">
      <div class="next-prayer-label">Next Prayer</div>
      <div class="next-prayer-name" id="nextPrayerDisplayName">--</div>
      <div class="countdown-timer-large" id="countdownTimerLarge">--:--:--</div>
    </div>
  `;

  return {
    id: definition.id,
    element: slide,
    durationMs: typeof definition.duration === "number" ? definition.duration : 12000,
  };
}

function buildPosterFrame(definition, context) {
  const poster =
    (context.posters || []).find((p) => p.id === definition.posterId) ||
    (context.posters || [])[0] ||
    null;

  const slide = document.createElement("div");
  slide.className = "slide poster-slide";
  const imgSrc = poster?.image || "";
  const altText = poster?.title || "Event Poster";
  slide.innerHTML = `<img src="${imgSrc}" alt="${altText}" class="fullscreen-poster">`;

  const duration =
    typeof definition.duration === "number"
      ? definition.duration
      : poster?.duration || 10000;

  return {
    id: definition.id,
    element: slide,
    durationMs: duration,
  };
}

function buildQuotesFrame(definition, context) {
  const slide = document.createElement("div");
  slide.className = "slide islamic-quotes-slide";
  slide.innerHTML = `
    <div class="islamic-quotes-container">
      <div class="quote-section verse-section">
        <div class="quote-header">Verse of the Day</div>
        <div class="quote-arabic" id="verseArabic">...</div>
        <div class="quote-translation" id="verseTranslation">...</div>
        <div class="quote-reference" id="verseReference">...</div>
      </div>
      <div class="quote-divider"></div>
      <div class="quote-section hadith-section">
        <div class="quote-header">Hadith of the Day</div>
        <div class="quote-text" id="hadithText">...</div>
        <div class="quote-reference" id="hadithReference">...</div>
      </div>
    </div>
  `;

  const render = () => {
    const dailyContent =
      typeof context.dailyContent === "function" ? context.dailyContent() : context.dailyContent;
    if (!dailyContent) return;

    const { verse, hadith } = dailyContent;
    slide.querySelector("#verseArabic").textContent = verse?.arabic || "...";
    slide.querySelector("#verseTranslation").textContent = verse?.translation || "...";
    slide.querySelector("#verseReference").textContent = verse?.reference || "...";
    slide.querySelector("#hadithText").textContent = hadith?.text || "...";
    slide.querySelector("#hadithReference").textContent = hadith?.reference || "...";
  };

  render();

  return {
    id: definition.id,
    element: slide,
    durationMs: typeof definition.duration === "number" ? definition.duration : 20000,
    refresh: render,
  };
}

// =====================================================
// Helpers
// =====================================================
function getEventsForDay(events, date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  const dayEndMs = dayEnd.getTime();

  return (events || []).filter(
    (event) => event.startTimestamp <= dayEndMs && event.endTimestamp >= dayStartMs
  );
}

function getPrimaryEvent(dayEvents) {
  if (dayEvents.length === 0) return null;
  const now = Date.now();
  const upcoming = dayEvents.find((e) => e.startTimestamp >= now);
  if (upcoming) return upcoming;
  return dayEvents[dayEvents.length - 1];
}

function formatEventTimeDisplay(startTimestamp, endTimestamp, allDay) {
  if (allDay) return "All Day";

  const start = new Date(startTimestamp);
  const end = new Date(endTimestamp);

  const startTime = start.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const endTime = end.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${startTime} - ${endTime}`;
}

function formatTimeUntil(minutes) {
  if (minutes < 1) return "Starting now";
  if (minutes < 60) return `In ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `In ${hours}h`;
  }
  return `In ${hours}h ${mins}m`;
}

function calculateWeekDuration(eventCount) {
  const baseDuration = 10000;
  const perEventDuration = 2000;
  const maxDuration = 30000;
  return Math.min(baseDuration + eventCount * perEventDuration, maxDuration);
}

function calculateTodayDuration(eventCount) {
  const baseDuration = 8000;
  const perEventDuration = 3000;
  const maxDuration = 25000;
  return Math.min(baseDuration + eventCount * perEventDuration, maxDuration);
}

// Register default builders
registerFrameBuilder(FRAME_TYPES.WEEK_AT_GLANCE, buildWeekAtGlanceFrame);
registerFrameBuilder(FRAME_TYPES.TODAY, buildTodayFrame);
registerFrameBuilder(FRAME_TYPES.NEXT_PRAYER, buildNextPrayerFrame);
registerFrameBuilder(FRAME_TYPES.POSTER, buildPosterFrame);
registerFrameBuilder(FRAME_TYPES.QUOTES, buildQuotesFrame);
