/**
 * =====================================================
 * MusallahBoard - Slideshow Module
 * =====================================================
 * Handles the slideshow/frame rotation on the main display.
 * Supports multiple frame types with different durations.
 * =====================================================
 */

import { FRAME_TYPES } from './models/index.js';

// =====================================================
// Frame Builder Registry
// =====================================================

/** @type {Map<string, Function>} */
const frameBuilders = new Map();

/**
 * Register a frame builder for a specific frame type
 * @param {string} type - Frame type identifier
 * @param {Function} builder - Builder function
 */
export function registerFrameBuilder(type, builder) {
  frameBuilders.set(type, builder);
}

// =====================================================
// Slideshow Controller
// =====================================================

/**
 * @typedef {Object} SlideshowConfig
 * @property {import('./models/index.js').FrameDefinition[]} frameDefinitions
 * @property {Object} context - Shared context passed to frame builders
 * @property {string} [containerId] - Container element ID
 * @property {string} [indicatorsId] - Indicators container ID
 * @property {number} [autoRefreshMs] - Auto-refresh interval
 */

/**
 * @typedef {Object} SlideshowApi
 * @property {Function} refresh - Refresh all frames
 * @property {Function} goToSlide - Navigate to a specific slide
 */

/**
 * Initialize the slideshow
 * @param {SlideshowConfig} config
 * @returns {SlideshowApi | undefined}
 */
export function initSlideshow({
  frameDefinitions = [],
  context = {},
  containerId = 'slideshowContainer',
  indicatorsId = 'slideIndicators',
  autoRefreshMs = 60000,
}) {
  const container = document.getElementById(containerId);
  const indicatorsContainer = document.getElementById(indicatorsId);

  if (!container || !indicatorsContainer) {
    console.warn('Slideshow container or indicators not found');
    return;
  }

  // Create track element
  const track = document.createElement('div');
  track.className = 'slides-track';

  // Build frames from definitions
  const frames = frameDefinitions
    .map((definition) => buildFrame(definition, context))
    .filter(Boolean);

  // Clear existing content (except indicators)
  Array.from(container.children).forEach((child) => {
    if (child.id !== indicatorsId) {
      child.remove();
    }
  });

  container.appendChild(track);
  frames.forEach((frame) => track.appendChild(frame.element));

  // Build indicators
  indicatorsContainer.innerHTML = '';
  frames.forEach((_, index) => {
    const indicator = document.createElement('div');
    indicator.className = 'slide-indicator' + (index === 0 ? ' active' : '');
    indicator.addEventListener('click', () => goToSlide(index));
    indicatorsContainer.appendChild(indicator);
  });

  // Slideshow state
  let currentIndex = 0;
  let slideTimer = null;
  let durations = frames.map(getFrameDuration);

  function showSlide(index) {
    currentIndex = index;
    track.style.transform = `translateX(${-index * 100}%)`;

    Array.from(indicatorsContainer.children).forEach((indicator, i) => {
      indicator.classList.toggle('active', i === index);
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
    durations = frames.map(getFrameDuration);
  }

  // Start slideshow
  showSlide(0);
  scheduleNextSlide();

  if (autoRefreshMs) {
    setInterval(refreshFrames, autoRefreshMs);
  }

  return {
    refresh: refreshFrames,
    goToSlide,
  };
}

// =====================================================
// Frame Building
// =====================================================

/**
 * Build a frame from its definition
 * @param {import('./models/index.js').FrameDefinition} definition
 * @param {Object} context
 * @returns {Object | null}
 */
function buildFrame(definition, context) {
  const builder = frameBuilders.get(definition.type);

  if (!builder) {
    console.warn(`No frame builder registered for type: ${definition.type}`);
    return null;
  }

  return builder(definition, context);
}

/**
 * Get duration from a frame
 * @param {Object} frame
 * @returns {number}
 */
function getFrameDuration(frame) {
  if (typeof frame.getDuration === 'function') {
    return frame.getDuration();
  }
  if (typeof frame.durationMs === 'number') {
    return frame.durationMs;
  }
  return 10000;
}

// =====================================================
// Frame Builders
// =====================================================

/**
 * Build "Week at a Glance" frame
 */
function buildWeekAtGlanceFrame(definition, context) {
  const slide = document.createElement('div');
  slide.className = 'slide week-glance-slide';
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
    weekGrid.innerHTML = '';
    frameState.eventCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekData = [];
    let maxEvents = 0;
    let maxEventIndex = -1;

    // Build week data
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

    // Render day cards
    weekData.forEach(({ dayDate, dayEvents, isToday }, index) => {
      const isWide = index === maxEventIndex && maxEvents > 0;
      const dayCard = createDayCard({
        dayDate,
        dayEvents,
        isToday,
        isWide,
        dayName: weekDays[index],
      });
      weekGrid.appendChild(dayCard);
      frameState.eventCount += dayEvents.length;
    });
  };

  render();

  return {
    id: definition.id,
    element: slide,
    refresh: render,
    getDuration: () => calculateWeekDuration(frameState.eventCount),
  };
}

/**
 * Create a day card for the week grid
 */
function createDayCard({ dayDate, dayEvents, isToday, isWide, dayName }) {
  const dayCard = document.createElement('div');
  dayCard.className = [
    'day-card',
    isToday && 'today',
    dayEvents.length === 0 && 'empty',
    isWide && 'wide',
  ].filter(Boolean).join(' ');

  // Header
  const dayHeader = document.createElement('div');
  dayHeader.className = 'day-card-header';
  dayHeader.innerHTML = `
    <div class="day-name">${dayName}</div>
    <div class="day-date-badge">${dayDate.getDate()}</div>
  `;
  dayCard.appendChild(dayHeader);

  // Body
  const dayBody = document.createElement('div');
  dayBody.className = 'day-card-body';

  if (dayEvents.length === 0) {
    dayBody.innerHTML = '<div class="day-placeholder">Stay tuned</div>';
  } else {
    const eventsWrapper = document.createElement('div');
    eventsWrapper.className = 'glance-events' + (dayEvents.length === 1 ? ' single' : '');

    const eventsInner = document.createElement('div');
    eventsInner.className = 'glance-events-inner';

    const primaryEvent = getPrimaryEvent(dayEvents);

    const createEventCards = () => {
      const fragment = document.createDocumentFragment();
      dayEvents.forEach((event) => {
        const isPrimary = event.id === primaryEvent?.id;
        const eventCard = createEventCard(event, isPrimary);
        fragment.appendChild(eventCard);
      });
      return fragment;
    };

    eventsInner.appendChild(createEventCards());
    eventsWrapper.appendChild(eventsInner);
    dayBody.appendChild(eventsWrapper);

    // Auto-scroll for overflow
    requestAnimationFrame(() => {
      if (eventsWrapper.scrollHeight > eventsWrapper.clientHeight) {
        eventsInner.appendChild(createEventCards());
        eventsWrapper.classList.add('auto-scroll');
        const scrollHeight = eventsInner.scrollHeight / 2;
        const duration = Math.max(15, scrollHeight / 10);
        eventsWrapper.style.setProperty('--scroll-duration', `${duration}s`);
      }
    });
  }

  dayCard.appendChild(dayBody);
  return dayCard;
}

/**
 * Create an event card element
 */
function createEventCard(event, isPrimary = false) {
  const eventCard = document.createElement('div');
  eventCard.className = [
    'glance-event',
    isPrimary && 'primary',
    event.allDay && 'all-day',
  ].filter(Boolean).join(' ');

  const displayTime = formatEventTimeDisplay(
    event.startTimestamp,
    event.endTimestamp,
    event.allDay
  );

  eventCard.innerHTML = `
    <div class="event-time">${displayTime}</div>
    <div class="event-name">${event.name}</div>
    <div class="event-location">${event.location || ''}</div>
  `;

  return eventCard;
}

/**
 * Build "Coming up Today" frame
 */
function buildTodayFrame(definition, context) {
  const slide = document.createElement('div');
  slide.className = 'slide today-slide';
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
    todayEventsContainer.innerHTML = '';
    frameState.visibleEvents = 0;

    const today = new Date();
    const events = getEventsForDay(context.events || [], today).sort(
      (a, b) => a.startTimestamp - b.startTimestamp
    );

    if (events.length === 0) {
      todayEventsContainer.innerHTML = `
        <div class="no-events-today">
          Stay Tuned!<br>
          <span style="font-size: 0.6em; opacity: 0.8;">Check back soon for upcoming events</span>
        </div>
      `;
      return;
    }

    const now = Date.now();
    const happeningNow = events.filter((e) => e.startTimestamp <= now && e.endTimestamp >= now);
    const comingSoon = events.filter((e) => e.startTimestamp > now);

    if (happeningNow.length === 0 && comingSoon.length === 0) {
      todayEventsContainer.innerHTML = `
        <div class="no-events-today">
          Stay Tuned!<br>
          <span style="font-size: 0.6em; opacity: 0.8;">Check back soon for upcoming events</span>
        </div>
      `;
      return;
    }

    const widget = document.createElement('div');
    widget.className = 'today-signage-display';

    // Happening now section
    if (happeningNow.length > 0) {
      const event = happeningNow[0];
      const minutesLeft = Math.max(0, Math.floor((event.endTimestamp - now) / (1000 * 60)));

      const nowSection = document.createElement('div');
      nowSection.className = 'signage-tier happening-now-tier';
      nowSection.innerHTML = `
        <div class="tier-label">Happening Now</div>
        <div class="tier-content">
          <div class="event-name-large">${event.name}</div>
          <div class="event-meta-large">
            <div class="event-location-large">${event.location || 'TBA'}</div>
            <div class="event-ends-in">${minutesLeft > 0 ? `${minutesLeft} min remaining` : 'Ending soon'}</div>
          </div>
        </div>
      `;
      widget.appendChild(nowSection);
    }

    // Coming soon section
    if (comingSoon.length > 0) {
      const soonSection = document.createElement('div');
      soonSection.className = 'signage-tier coming-soon-tier' + (happeningNow.length === 0 ? ' primary' : '');

      soonSection.innerHTML = `<div class="tier-label">${happeningNow.length === 0 ? 'Up Next' : 'Coming Up'}</div>`;

      const eventsList = document.createElement('div');
      eventsList.className = 'upcoming-events-list';

      comingSoon.slice(0, 5).forEach((event, index) => {
        const timeUntil = Math.floor((event.startTimestamp - now) / (1000 * 60));
        const timeText = formatTimeUntil(timeUntil);
        const displayTime = formatEventTimeDisplay(event.startTimestamp, event.endTimestamp, event.allDay);

        const eventItem = document.createElement('div');
        eventItem.className = 'upcoming-event-item' + (index === 0 && happeningNow.length === 0 ? ' primary' : '');
        eventItem.innerHTML = `
          <div class="upcoming-event-time">${displayTime}</div>
          <div class="upcoming-event-info">
            <div class="upcoming-event-name">${event.name}</div>
            <div class="upcoming-event-in">${timeText}</div>
          </div>
          <div class="upcoming-event-location">${event.location || 'TBA'}</div>
        `;
        eventsList.appendChild(eventItem);
      });

      soonSection.appendChild(eventsList);
      widget.appendChild(soonSection);
    }

    todayEventsContainer.appendChild(widget);
    frameState.visibleEvents = happeningNow.length + Math.min(comingSoon.length, 5);
  };

  render();

  return {
    id: definition.id,
    element: slide,
    refresh: render,
    getDuration: () => calculateTodayDuration(frameState.visibleEvents),
  };
}

/**
 * Build "Next Prayer" frame
 */
function buildNextPrayerFrame(definition) {
  const slide = document.createElement('div');
  slide.className = 'slide next-prayer-slide';
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
    durationMs: typeof definition.duration === 'number' ? definition.duration : 12000,
  };
}

/**
 * Build "Poster" frame
 */
function buildPosterFrame(definition, context) {
  const posters = context.posters || [];
  const poster = posters.find((p) => p.id === definition.posterId) || posters[0] || null;

  const slide = document.createElement('div');
  slide.className = 'slide poster-slide';

  const imgSrc = poster?.image || '';
  const altText = poster?.title || 'Event Poster';
  slide.innerHTML = `<img src="${imgSrc}" alt="${altText}" class="fullscreen-poster">`;

  const duration = typeof definition.duration === 'number'
    ? definition.duration
    : poster?.duration || 10000;

  return {
    id: definition.id,
    element: slide,
    durationMs: duration,
  };
}

/**
 * Build "Islamic Quotes" frame
 */
function buildQuotesFrame(definition, context) {
  const slide = document.createElement('div');
  slide.className = 'slide islamic-quotes-slide';
  slide.innerHTML = `
    <div class="islamic-quotes-container">
      <div class="quote-section verse-section">
        <div class="quote-header">Verse of the Week</div>
        <div class="quote-arabic" data-role="verseArabic">...</div>
        <div class="quote-transliteration" data-role="verseTransliteration">...</div>
        <div class="quote-translation" data-role="verseTranslation">...</div>
        <div class="quote-reference" data-role="verseReference">...</div>
      </div>
      <div class="quote-divider"></div>
      <div class="quote-section hadith-section">
        <div class="quote-header">Hadith of the Week</div>
        <div class="quote-arabic" data-role="hadithArabic">...</div>
        <div class="quote-transliteration" data-role="hadithTransliteration">...</div>
        <div class="quote-translation" data-role="hadithTranslation">...</div>
        <div class="quote-reference" data-role="hadithReference">...</div>
      </div>
    </div>
  `;

  const render = () => {
    const dailyContent = typeof context.dailyContent === 'function'
      ? context.dailyContent()
      : context.dailyContent;

    if (!dailyContent) return;

    const { verse, hadith } = dailyContent;

    const updateText = (role, value) => {
      const el = slide.querySelector(`[data-role="${role}"]`);
      if (el) el.textContent = value || '...';
    };

    updateText('verseArabic', verse?.arabic);
    updateText('verseTransliteration', verse?.transliteration);
    updateText('verseTranslation', verse?.translation);
    updateText('verseReference', verse?.reference);
    updateText('hadithArabic', hadith?.arabic);
    updateText('hadithTransliteration', hadith?.transliteration);
    updateText('hadithTranslation', hadith?.translation);
    updateText('hadithReference', hadith?.reference);
  };

  render();

  return {
    id: definition.id,
    element: slide,
    durationMs: typeof definition.duration === 'number' ? definition.duration : 20000,
    refresh: render,
  };
}

/**
 * Build "Social Media Promotion" frame
 */
function buildSocialMediaFrame(definition) {
  const handle = definition.instagramHandle || '@utmmsa';
  const handleSlug = handle.startsWith('@') ? handle.slice(1) : handle;
  const profileUrl = definition.instagramUrl || `https://www.instagram.com/${handleSlug}`;
  const qrCodeUrl = definition.qrCodeUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=4&data=${encodeURIComponent(profileUrl)}`;

  const slide = document.createElement('div');
  slide.className = 'slide social-media-slide';
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
    durationMs: typeof definition.duration === 'number' ? definition.duration : 15000,
  };
}

// =====================================================
// Helpers
// =====================================================

/**
 * Get events for a specific day
 * @param {import('./models/index.js').Event[]} events
 * @param {Date} date
 * @returns {import('./models/index.js').Event[]}
 */
function getEventsForDay(events, date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return events.filter(
    (event) => event.startTimestamp <= dayEnd.getTime() && event.endTimestamp >= dayStart.getTime()
  );
}

/**
 * Get the primary (most important) event from a list
 * @param {import('./models/index.js').Event[]} dayEvents
 * @returns {import('./models/index.js').Event | null}
 */
function getPrimaryEvent(dayEvents) {
  if (dayEvents.length === 0) return null;

  const now = Date.now();
  const upcoming = dayEvents.find((e) => e.startTimestamp >= now);
  return upcoming || dayEvents[dayEvents.length - 1];
}

/**
 * Format event time for display
 * @param {number} startTimestamp
 * @param {number} endTimestamp
 * @param {boolean} allDay
 * @returns {string}
 */
function formatEventTimeDisplay(startTimestamp, endTimestamp, allDay) {
  if (allDay) return 'All Day';

  const options = { hour: '2-digit', minute: '2-digit', hour12: true };
  const start = new Date(startTimestamp).toLocaleTimeString('en-US', options);
  const end = new Date(endTimestamp).toLocaleTimeString('en-US', options);

  return `${start} - ${end}`;
}

/**
 * Format time until an event
 * @param {number} minutes
 * @returns {string}
 */
function formatTimeUntil(minutes) {
  if (minutes < 1) return 'Starting now';
  if (minutes < 60) return `In ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `In ${hours}h` : `In ${hours}h ${mins}m`;
}

/**
 * Calculate week frame duration based on event count
 * @param {number} eventCount
 * @returns {number}
 */
function calculateWeekDuration(eventCount) {
  const baseDuration = 10000;
  const perEventDuration = 2000;
  const maxDuration = 30000;
  return Math.min(baseDuration + eventCount * perEventDuration, maxDuration);
}

/**
 * Calculate today frame duration based on event count
 * @param {number} eventCount
 * @returns {number}
 */
function calculateTodayDuration(eventCount) {
  const baseDuration = 8000;
  const perEventDuration = 3000;
  const maxDuration = 25000;
  return Math.min(baseDuration + eventCount * perEventDuration, maxDuration);
}

// =====================================================
// Register Default Frame Builders
// =====================================================

registerFrameBuilder(FRAME_TYPES.WEEK_AT_GLANCE, buildWeekAtGlanceFrame);
registerFrameBuilder(FRAME_TYPES.TODAY, buildTodayFrame);
registerFrameBuilder(FRAME_TYPES.NEXT_PRAYER, buildNextPrayerFrame);
registerFrameBuilder(FRAME_TYPES.POSTER, buildPosterFrame);
registerFrameBuilder(FRAME_TYPES.QUOTES, buildQuotesFrame);
registerFrameBuilder(FRAME_TYPES.SOCIAL_MEDIA_PROMOTION, buildSocialMediaFrame);

// Re-export FRAME_TYPES for convenience
export { FRAME_TYPES };
