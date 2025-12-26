export const FRAME_TYPES = {
  WEEK_AT_GLANCE: "weekAtGlance",
  TODAY: "today",
  NEXT_PRAYER: "nextPrayer",
  POSTER: "poster",
  QUOTES: "quotes",
  SOCIAL_MEDIA_PROMOTION: "socialMediaPromotion",
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
    const weekData = [];
    let maxEvents = 0;
    let maxEventIndex = -1;

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      const dayEvents = getEventsForDay(context.events || [], dayDate).sort(
        (a, b) => a.startTimestamp - b.startTimestamp
      );
      const isToday = dayDate.toDateString() === today.toDateString();
      weekData.push({ dayDate, dayEvents, isToday });
      if (dayEvents.length > maxEvents) {
        maxEvents = dayEvents.length;
        maxEventIndex = i;
      }
    }

    weekData.forEach(({ dayDate, dayEvents, isToday }, index) => {
      const isWide = index === maxEventIndex && maxEvents > 0;
      const dayCard = document.createElement("div");
      dayCard.className = "day-card" + (isToday ? " today" : "") + (dayEvents.length === 0 ? " empty" : "") + (isWide ? " wide" : "");

      const dayHeader = document.createElement("div");
      dayHeader.className = "day-card-header";
      const dayName = document.createElement("div");
      dayName.className = "day-name";
      dayName.textContent = weekDays[index];
      const dayDateBadge = document.createElement("div");
      dayDateBadge.className = "day-date-badge";
      dayDateBadge.textContent = dayDate.getDate();
      dayHeader.appendChild(dayName);
      dayHeader.appendChild(dayDateBadge);
      dayCard.appendChild(dayHeader);

      const dayBody = document.createElement("div");
      dayBody.className = "day-card-body";

      if (dayEvents.length === 0) {
        const noEventsPlaceholder = document.createElement("div");
        noEventsPlaceholder.className = "day-placeholder";
        noEventsPlaceholder.textContent = "Stay tuned";
        dayBody.appendChild(noEventsPlaceholder);
      } else {
        const eventsWrapper = document.createElement("div");
        eventsWrapper.className = "glance-events";
        if (dayEvents.length === 1) eventsWrapper.classList.add("single");

        const eventsInner = document.createElement("div");
        eventsInner.className = "glance-events-inner";

        const primaryEvent = getPrimaryEvent(dayEvents);
        const createEventCards = () => {
          const fragment = document.createDocumentFragment();
          dayEvents.forEach((event) => {
            const eventCard = document.createElement("div");
            const isPrimary = event.id === primaryEvent?.id;
            const isAllDay = !!event.allDay;
            eventCard.className = "glance-event";
            if (isPrimary) eventCard.classList.add("primary");
            if (isAllDay) eventCard.classList.add("all-day");

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
            fragment.appendChild(eventCard);
          });
          return fragment;
        };

        eventsInner.appendChild(createEventCards());
        eventsWrapper.appendChild(eventsInner);
        dayBody.appendChild(eventsWrapper);

        // Check for overflow after render and enable auto-scroll
        requestAnimationFrame(() => {
          if (eventsWrapper.scrollHeight > eventsWrapper.clientHeight) {
            // Duplicate content for seamless loop
            eventsInner.appendChild(createEventCards());
            eventsWrapper.classList.add("auto-scroll");
            
            // Calculate animation duration based on content height (slower = more readable)
            const scrollHeight = eventsInner.scrollHeight / 2;
            const duration = Math.max(15, scrollHeight / 10); // ~10px per second
            eventsWrapper.style.setProperty("--scroll-duration", `${duration}s`);
          }
        });
      }

      dayCard.appendChild(dayBody);
      weekGrid.appendChild(dayCard);
      frameState.eventCount += dayEvents.length;
    });
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
        <div class="quote-header">Verse of the Week</div>
        <div class="quote-arabic" id="verseArabic">...</div>
        <div class="quote-transliteration" id="verseTransliteration">...</div>
        <div class="quote-translation" id="verseTranslation">...</div>
        <div class="quote-reference" id="verseReference">...</div>
      </div>
      <div class="quote-divider"></div>
      <div class="quote-section hadith-section">
        <div class="quote-header">Hadith of the Week</div>
        <div class="quote-arabic" id="hadithArabic">...</div>
        <div class="quote-transliteration" id="hadithTransliteration">...</div>
        <div class="quote-translation" id="hadithTranslation">...</div>
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
    slide.querySelector("#verseTransliteration").textContent = verse?.transliteration || "...";
    slide.querySelector("#verseTranslation").textContent = verse?.translation || "...";
    slide.querySelector("#verseReference").textContent = verse?.reference || "...";
    slide.querySelector("#hadithArabic").textContent = hadith?.arabic || "...";
    slide.querySelector("#hadithTransliteration").textContent = hadith?.transliteration || "...";
    slide.querySelector("#hadithTranslation").textContent = hadith?.translation || "...";
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

function buildSocialMediaFrame(definition) {
  const handle = definition.instagramHandle || "@utmmsa";
  const handleSlug = handle.startsWith("@") ? handle.slice(1) : handle;
  const profileUrl = definition.instagramUrl || `https://www.instagram.com/${handleSlug}`;
  const qrCodeUrl =
    definition.qrCodeUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=4&data=${encodeURIComponent(
      profileUrl
    )}`;

  const slide = document.createElement("div");
  slide.className = "slide social-media-slide";
  slide.innerHTML = `
    <div class="social-media-container">
      <div class="social-media-body">
        <div class="social-media-label">Stay Connected</div>
        <div class="social-media-title">Follow us on Instagram</div>
        <div class="social-media-handle">${handle}</div>
        <div class="social-media-subtext">Scan the QR code to join the UTM MSA community</div>
      </div>
      <div class="social-media-qr-wrapper">
        <img src="${qrCodeUrl}" class="social-media-qr" alt="Instagram QR for ${handle}" loading="lazy" />
        <div class="social-media-qr-caption">${handleSlug}</div>
      </div>
    </div>
  `;

  return {
    id: definition.id,
    element: slide,
    durationMs: typeof definition.duration === "number" ? definition.duration : 15000,
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
registerFrameBuilder(FRAME_TYPES.SOCIAL_MEDIA_PROMOTION, buildSocialMediaFrame);
