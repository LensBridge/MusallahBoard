/**
 * =====================================================
 * MusallahBoard - Main Application
 * =====================================================
 * Entry point for the Musallah Board display application.
 * =====================================================
 */

import { initSlideshow } from './slideshow.js';
import { configureApiClient, getApiConfig } from './api/client.js';
import { getBoardPayload, getWeather } from './api/boardService.js';
import {
  getPrayerTimes,
  getTomorrowFajr,
  calculateNextPrayer,
  calculateCountdown,
  formatCountdown,
  formatHijriDate,
} from './api/prayerService.js';
import { getDailyContent } from './api/boardService.js';
import {
  PRAYER_NAMES,
  PRAYER_DISPLAY_ORDER,
  WEATHER_ICONS,
  formatTo12Hour,
  parseTimeString,
} from './models/index.js';
import { initSetupScreen } from './setup.js';
import { getSetupConfig } from './utils/cookies.js';

// =====================================================
// Application State
// =====================================================

/**
 * @typedef {Object} AppState
 * @property {import('./models/index.js').BoardConfig | null} boardConfig
 * @property {import('./models/index.js').PrayerTimes | null} prayerTimes
 * @property {import('./models/index.js').HijriDate | null} hijriDate
 * @property {import('./models/index.js').ParsedTime | null} maghribTime
 * @property {import('./models/index.js').ParsedTime | null} ishaTime
 * @property {import('./models/index.js').ParsedTime | null} tomorrowFajr
 * @property {boolean} isDarkMode
 * @property {string | null} nextPrayer
 * @property {string | null} currentPrayer
 * @property {import('./models/index.js').DailyContent | null} dailyContent
 * @property {import('./models/index.js').Event[]} events
 * @property {import('./models/index.js').Poster[]} posters
 * @property {import('./models/index.js').JummahPrayer[]} jummahPrayers
 * @property {import('./models/index.js').Weather | null} weather
 * @property {string | null} weatherApiKey
 */

/** @type {AppState} */
const state = {
  boardConfig: null,
  prayerTimes: null,
  hijriDate: null,
  maghribTime: null,
  ishaTime: null,
  tomorrowFajr: null,
  isDarkMode: false,
  nextPrayer: null,
  currentPrayer: null,
  dailyContent: null,
  events: [],
  posters: [],
  jummahPrayers: [],
  weather: null,
  weatherApiKey: null,
};

// =====================================================
// Configuration
// =====================================================

/**
 * Map frontend board location to backend enum format
 * @param {string} location - 'sisters' or 'brothers'
 * @returns {string} - 'SISTERS_MUSALLAH' or 'BROTHERS_MUSALLAH'
 */
function mapBoardLocationToApi(location) {
  if (location === 'sisters') return 'SISTERS_MUSALLAH';
  if (location === 'brothers') return 'BROTHERS_MUSALLAH';
  return 'BROTHERS_MUSALLAH'; // default
}

// Configure API client with backend base URL
// The backend serves endpoints under /api/musallah/*
// So we configure baseUrl to point to the backend root
// Can be overridden with VITE_API_BASE_URL environment variable
configureApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://10.0.0.75:8080' });

// =====================================================
// Initialization
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize setup screen first
  initSetupScreen();
  
  // Then initialize the app
  initApp();
});

async function initApp() {
  try {
    setLoadingOverlay(true, 'Initializing MusallahBoard v1.0b...');

    // Get setup configuration from cookies
    // This contains: boardLocation ('sisters' | 'brothers') and weatherApiKey
    const setupConfig = getSetupConfig();
    console.log('Setup Config:', setupConfig);
    
    // Map board location to API format and store in state
    const boardLocationParam = mapBoardLocationToApi(setupConfig.boardLocation);
    console.log('Board Location (API format):', boardLocationParam);
    
    // Store weather API key in state for later use
    state.weatherApiKey = setupConfig.weatherApiKey;

    // Fetch board payload (config, events, posters, frames)
    const payload = await getBoardPayload(boardLocationParam);
    state.boardConfig = payload.boardConfig;
    state.events = payload.events;
    state.posters = payload.posters;
    state.jummahPrayers = payload.jummahPrayers;
    state.dailyContent = payload.dailyContent;

    // Initialize UI components
    initializeClock();
    initializeDateDisplay();
    initializeIslamicContent();
    initializeScrollingMessage();
    renderJummahRows();

    // Fetch external data
    await fetchPrayerTimes();
    await initializeWeather();

    // Initialize slideshow
    initSlideshow({
      frameDefinitions: payload.frames,
      context: {
        events: state.events,
        posters: state.posters,
        dailyContent: () => state.dailyContent,
      },
    });

    // Slideshow rebuilds the DOM; refresh next prayer display afterward
    highlightNextPrayer();

    // Start timers and intervals
    startTimers();

    // Connect to refresh WebSocket
    initRefreshWebSocket();

    setLoadingOverlay(false);
  } catch (error) {
    console.error('Failed to initialize app:', error);
    setLoadingOverlay(false);
  }
}

function startTimers() {
  // Update clock every second
  setInterval(updateClock, 1000);

  // Update countdown every second
  setInterval(updateCountdown, 1000);

  // Check dark mode and refresh every minute
  setInterval(checkDarkModeAndRefresh, 60000);
  checkDarkModeAndRefresh();

  // Refresh weather every hour
  setInterval(initializeWeather, 3600000);

  // Refresh Islamic content daily
  setInterval(() => {
    state.dailyContent = getDailyContent();
    updateIslamicContentUI();
  }, 86400000);
}

// =====================================================
// Prayer Times
// =====================================================

async function fetchPrayerTimes() {
  if (!state.boardConfig?.location) return;

  try {
    const { timings, hijriDate } = await getPrayerTimes(state.boardConfig.location);
    state.prayerTimes = timings;
    state.hijriDate = hijriDate;

    // Cache parsed times for dark mode calculations
    state.maghribTime = parseTimeString(timings.Maghrib);
    state.ishaTime = parseTimeString(timings.Isha);

    updatePrayerTimesUI();
    updateHijriDateUI();

    // Fetch tomorrow's Fajr if after Isha
    await checkAndFetchTomorrowFajr();
  } catch (error) {
    console.error('Error fetching prayer times:', error);
    showPrayerTimesError();
  }
}

async function checkAndFetchTomorrowFajr() {
  if (!state.ishaTime || !state.boardConfig?.location) return;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const ishaMinutes = state.ishaTime.hours * 60 + state.ishaTime.minutes;

  if (currentMinutes >= ishaMinutes) {
    try {
      const fajrTime = await getTomorrowFajr(state.boardConfig.location);
      state.tomorrowFajr = parseTimeString(fajrTime);
    } catch (error) {
      console.error('Error fetching tomorrow Fajr:', error);
    }
  }
}

function updatePrayerTimesUI() {
  if (!state.prayerTimes) return;

  PRAYER_DISPLAY_ORDER.forEach((prayer) => {
    const elementId = `${PRAYER_NAMES[prayer]}Time`;
    const element = document.getElementById(elementId);
    if (!element) return;

    const time24 = state.prayerTimes[prayer];

    // Special handling for Asr to show both Shafi'i and Hanafi times
    if (prayer === 'Asr' && state.prayerTimes.hanafiAsr) {
      const shafiFormatted = formatTo12Hour(time24);
      const hanafiFormatted = formatTo12Hour(state.prayerTimes.hanafiAsr);
      element.textContent = `${shafiFormatted} / ${hanafiFormatted}`;
    } else {
      element.textContent = formatTo12Hour(time24);
    }
  });

  renderJummahRows();
  highlightNextPrayer();
}

function showPrayerTimesError() {
  PRAYER_DISPLAY_ORDER.forEach((prayer) => {
    const element = document.getElementById(`${PRAYER_NAMES[prayer]}Time`);
    if (element) {
      element.textContent = '--:--';
    }
  });
}

function highlightNextPrayer() {
  if (!state.prayerTimes) return;

  // Remove existing highlights
  document.querySelectorAll('.prayer-card, .prayer-row').forEach((el) => {
    el.classList.remove('active', 'next');
  });

  // Calculate next prayer
  const { current, next } = calculateNextPrayer(state.prayerTimes);
  state.currentPrayer = current;
  state.nextPrayer = next;

  // Highlight current prayer
  if (current) {
    const currentRow = document.querySelector(
      `.prayer-row[data-prayer="${PRAYER_NAMES[current]}"], .prayer-card[data-prayer="${PRAYER_NAMES[current]}"]`
    );
    if (currentRow) {
      currentRow.classList.add('active');
    }
  }

  // Update next prayer display
  const nextPrayerDisplayName = document.getElementById('nextPrayerDisplayName');
  if (nextPrayerDisplayName) {
    nextPrayerDisplayName.textContent = next;
  }
}

function updateCountdown() {
  if (!state.prayerTimes || !state.nextPrayer) return;

  const countdown = calculateCountdown(
    state.nextPrayer,
    state.prayerTimes,
    state.tomorrowFajr
  );

  // Check if we've reached the prayer time
  if (countdown.totalMs <= 0) {
    highlightNextPrayer();
    return;
  }

  const countdownStr = formatCountdown(countdown);

  const countdownTimerLarge = document.getElementById('countdownTimerLarge');
  if (countdownTimerLarge) {
    countdownTimerLarge.textContent = countdownStr;
  }
}

// =====================================================
// Clock & Date
// =====================================================

function initializeClock() {
  updateClock();
}

function updateClock() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;

  const timeElement = document.getElementById('currentTime');
  if (timeElement) {
    timeElement.textContent = timeStr;
  }
}

function initializeDateDisplay() {
  updateGregorianDate();
}

function updateGregorianDate() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = now.toLocaleDateString('en-US', options);

  const gregorianDate = document.getElementById('gregorianDate');
  if (gregorianDate) {
    gregorianDate.textContent = dateStr;
  }
}

function updateHijriDateUI() {
  if (!state.hijriDate) return;

  const hijriStr = formatHijriDate(state.hijriDate);
  const hijriElement = document.getElementById('hijriDate');
  if (hijriElement) {
    hijriElement.textContent = hijriStr;
  }
}

// =====================================================
// Jummah
// =====================================================

function renderJummahRows() {
  const isFriday = new Date().getDay() === 5;
  const jummahSection = document.getElementById('jummahSection');
  const subcards = document.getElementById('jummahSubcards');
  const sidebarContent = document.getElementById('sidebarContent');

  if (!jummahSection || !subcards) return;
  subcards.innerHTML = '';

  const prayers = state.jummahPrayers || [];

  if (!isFriday || prayers.length === 0) {
    jummahSection.style.display = 'none';
    if (sidebarContent) sidebarContent.classList.remove('jummah-visible');
    return;
  }

  jummahSection.style.display = 'block';
  if (sidebarContent) sidebarContent.classList.add('jummah-visible');

  prayers.forEach((prayer) => {
    const subcard = document.createElement('div');
    subcard.className = 'jummah-subcard';
    subcard.innerHTML = `
      <div class="jummah-time">${prayer.time}</div>
      <div class="jummah-khatib">${prayer.khatib}</div>
      <div class="jummah-location">${prayer.location}</div>
    `;
    subcards.appendChild(subcard);
  });
}

// =====================================================
// Islamic Content
// =====================================================

function initializeIslamicContent() {
  if (!state.dailyContent) {
    state.dailyContent = getDailyContent();
  }
  updateIslamicContentUI();
}

function updateIslamicContentUI() {
  const { verse, hadith } = state.dailyContent || {};

  const elements = {
    verseArabic: verse?.arabic,
    verseTransliteration: verse?.transliteration,
    verseTranslation: verse?.translation,
    verseReference: verse?.reference,
    hadithArabic: hadith?.arabic,
    hadithTransliteration: hadith?.transliteration,
    hadithTranslation: hadith?.translation,
    hadithReference: hadith?.reference,
  };

  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value || '...';
    }
  });
}

// =====================================================
// Scrolling Message
// =====================================================

function initializeScrollingMessage() {
  const messageBar = document.querySelector('.scrolling-message-bar');
  const messageElement = document.getElementById('scrollingMessageContent');
  const rightPanel = document.querySelector('.right-panel');
  const messages = getScrollingMessages(state.boardConfig);

  if (!state.boardConfig?.enableScrollingMessage || messages.length === 0) {
    if (messageBar) messageBar.style.display = 'none';
    if (rightPanel) rightPanel.style.paddingBottom = '0';
    return;
  }

  if (messageBar) messageBar.style.display = 'flex';
  if (rightPanel) rightPanel.style.paddingBottom = '';

  if (!messageElement) return;

  let currentIndex = 0;
  let animationEndHandler = null;

  const playMessage = () => {
    const message = messages[currentIndex];
    if (!message) return;

    // Remove previous event listener if it exists
    if (animationEndHandler) {
      messageElement.removeEventListener('animationend', animationEndHandler);
    }

    messageElement.textContent = message;
    messageElement.classList.remove('is-animating');

    const duration = getScrollDuration(messageBar, messageElement);
    messageElement.style.setProperty('--scroll-duration', `${duration}s`);

    // Force reflow to restart the animation
    void messageElement.offsetWidth;
    messageElement.classList.add('is-animating');

    // Create new event listener for this animation
    animationEndHandler = () => {
      currentIndex = (currentIndex + 1) % messages.length;
      // Small delay before next message to ensure clean transition
      setTimeout(() => playMessage(), 100);
    };
    
    messageElement.addEventListener('animationend', animationEndHandler, { once: true });
  };

  playMessage();
}

function getScrollingMessages(boardConfig) {
  if (!boardConfig) return [];
  if (Array.isArray(boardConfig.scrollingMessages)) {
    return boardConfig.scrollingMessages
      .map((message) => String(message).trim())
      .filter(Boolean);
  }
  if (typeof boardConfig.scrollingMessage === 'string') {
    const message = boardConfig.scrollingMessage.trim();
    return message ? [message] : [];
  }
  return [];
}

function getScrollDuration(messageBar, messageElement) {
  if (!messageBar || !messageElement) return 15;
  const totalDistance = messageBar.clientWidth + messageElement.scrollWidth;
  const pixelsPerSecond = 200;
  const duration = totalDistance / pixelsPerSecond;
  return Math.max(12, Math.min(30, duration));
}

// =====================================================
// Dark Mode
// =====================================================

function checkDarkModeAndRefresh() {
  if (!state.maghribTime || !state.prayerTimes || !state.boardConfig) return;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const maghribMinutes = state.maghribTime.hours * 60 + state.maghribTime.minutes;

  if (state.boardConfig.darkModeAfterIsha) {
    const fajrTime = parseTimeString(state.prayerTimes.Fajr);
    const fajrMinutes = fajrTime.hours * 60 + fajrTime.minutes;

    if (currentMinutes >= maghribMinutes || currentMinutes < fajrMinutes) {
      if (!state.isDarkMode) enableDarkMode();
    } else if (state.isDarkMode) {
      disableDarkMode();
    }
  }

  // Refresh at midnight
  if (currentMinutes === 0) {
    location.reload();
  }
}

function enableDarkMode() {
  document.body.classList.add('dark-mode');
  state.isDarkMode = true;
}

function disableDarkMode() {
  document.body.classList.remove('dark-mode');
  state.isDarkMode = false;
}

// =====================================================
// Weather
// =====================================================

async function initializeWeather() {
  try {
    // Fetch weather directly from OpenWeatherMap using API key from setup
    const weather = await fetchWeatherDirect();

    if (weather) {
      state.weather = weather;
      renderWeather();
    } else {
      renderWeatherError();
    }
  } catch (error) {
    console.error('Error initializing weather:', error);
    renderWeatherError();
  }
}

/**
 * Fallback: fetch weather directly from OpenWeatherMap
 * @returns {Promise<import('./models/index.js').Weather | null>}
 */
async function fetchWeatherDirect() {
  const location = state.boardConfig?.location;
  if (!location || !state.weatherApiKey) return null;

  const { latitude, longitude } = location;
  const apiKey = state.weatherApiKey;

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Weather fetch failed');
    }

    const data = await response.json();

    return {
      current: {
        temp: Math.round(data.main.temp),
        icon: WEATHER_ICONS[data.weather[0].main] || '☁️',
        condition: data.weather[0].main,
        description: `${data.name}, ${data.sys.country}`,
      },
      outlook: null,
    };
  } catch (error) {
    console.error('Error fetching weather directly:', error);
    return null;
  }
}

function renderWeather() {
  const container = document.getElementById('weatherCards');
  if (!container) return;

  if (!state.weather?.current) {
    renderWeatherError();
    return;
  }

  const { temp, icon, condition } = state.weather.current;
  const locationLine = state.boardConfig?.location
    ? `${state.boardConfig.location.city}, ${state.boardConfig.location.country}`
    : '';

  container.innerHTML = `
    <div class="weather-card primary full">
      <div class="weather-time">Now</div>
      <div class="weather-icon">${icon}</div>
      <div class="weather-temps">
        <span class="weather-temp-high">${temp}°C</span>
      </div>
      <div class="weather-desc">${locationLine} • ${condition}</div>
    </div>
  `;
}

function renderWeatherError() {
  const container = document.getElementById('weatherCards');
  if (!container) return;

  container.innerHTML = `
    <div class="weather-card primary">
      <div class="weather-time">Weather</div>
      <div class="weather-icon">☁️</div>
      <div class="weather-temps">
        <span class="weather-temp-high">--°C</span>
      </div>
      <div class="weather-desc">Unable to load</div>
    </div>
  `;
}

// =====================================================
// WebSocket for Live Refresh
// =====================================================

let refreshWebSocket = null;
let refreshTimeout = null;

/**
 * Initialize WebSocket connection for live refresh notifications
 */
function initRefreshWebSocket() {
  try {
    // Get base URL from API config
    const apiConfig = getApiConfig();
    const baseUrl = apiConfig.baseUrl || window.location.origin;
    
    // Convert http/https to ws/wss
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/api/refresh-musallahboard';
    
    console.log('Connecting to refresh WebSocket:', wsUrl);
    refreshWebSocket = new WebSocket(wsUrl);
    
    refreshWebSocket.onopen = () => {
      console.log('✅ Refresh WebSocket connected');
    };
    
    refreshWebSocket.onmessage = (event) => {
      console.log('WebSocket message received:', event.data);
      
      if (event.data === 'REFRESH' || event.data.toUpperCase().includes('REFRESH')) {
        handleRefreshCommand();
      }
    };
    
    refreshWebSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    refreshWebSocket.onclose = () => {
      console.log('WebSocket connection closed. Reconnecting in 5 seconds...');
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          initRefreshWebSocket();
        }
      }, 5000);
    };
  } catch (error) {
    console.error('Failed to initialize refresh WebSocket:', error);
  }
}

/**
 * Handle refresh command from WebSocket
 */
function handleRefreshCommand() {
  // Clear any existing refresh timeout
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
  }
  
  // Show toast notification
  showRefreshToast('New data available! Refreshing in 5 seconds...');
  
  // Set timeout to refresh after 5 seconds
  refreshTimeout = setTimeout(() => {
    console.log('Refreshing board for new data...');
    window.location.reload();
  }, 5000);
}

/**
 * Show refresh toast notification
 * @param {string} message
 */
function showRefreshToast(message) {
  // Remove any existing toast
  const existingToast = document.querySelector('.refresh-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = 'refresh-toast';
  toast.innerHTML = `
    <div class="refresh-toast-icon">🔄</div>
    <div class="refresh-toast-message">${message}</div>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Remove toast after it's done
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 5500);
}

// =====================================================
// Loading Overlay
// =====================================================

function setLoadingOverlay(isLoading, message) {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;

  const subtitle = overlay.querySelector('.loading-subtitle');
  if (message && subtitle) {
    subtitle.textContent = message;
  }

  overlay.classList.toggle('hidden', !isLoading);
}

// =====================================================
// Error Handling & Console Branding
// =====================================================

window.onerror = function (msg, url, lineNo) {
  console.error('Error:', msg, '\nURL:', url, '\nLine:', lineNo);
  return false;
};

console.log(
  '%cUTM MSA Musallah Board',
  'font-size: 24px; font-weight: bold; color: #F8E15D; background: #082D5D; padding: 10px 20px; border-radius: 8px;'
);
console.log(
  '%cMade with care for the UTM Muslim community by IbraSoft',
  'font-size: 12px; color: #2E5380;'
);
