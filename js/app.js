import { buildMockPayload, getDailyContent } from "./data.js";
import { initSlideshow } from "./slideshow.js";

/* =====================================================
   Application State
   ===================================================== */
const appState = {
  boardConfig: null,
  prayerTimes: null,
  hijriDate: null,
  maghribTime: null,
  ishaTime: null,
  tomorrowFajr: null,
  isDarkMode: false,
  nextPrayer: null,
  currentPrayer: null,
  weekEventCount: 0,
  todayEventCount: 0,
  dailyContent: null,
  events: [],
  posters: [],
  weather: null,
  weatherModeIndex: 0,
  weatherCycleTimer: null,
};

const PRAYER_NAMES = {
  Fajr: "fajr",
  Sunrise: "sunrise",
  Dhuhr: "dhuhr",
  Asr: "asr",
  Maghrib: "maghrib",
  Isha: "isha",
};

const PRAYER_DISPLAY_ORDER = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

const WEATHER_ICONS = {
  Clear: "☀️",
  Clouds: "☁️",
  Rain: "🌧️",
  Drizzle: "🌦️",
  Thunderstorm: "⛈️",
  Snow: "❄️",
  Mist: "🌫️",
  Fog: "🌫️",
};

function formatLocalDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = `${dateObj.getMonth() + 1}`.padStart(2, "0");
  const d = `${dateObj.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  setLoadingOverlay(true, "Initializing MusallahBoard v1.0b...");
  const payload = buildMockPayload();
  appState.boardConfig = payload.boardConfig;
  appState.events = payload.events;
  appState.posters = payload.posters;
  appState.dailyContent = payload.dailyContent;

  updateGregorianDate();
  updateClock();
  setInterval(updateClock, 1000);

  initializeIslamicContent(appState.dailyContent);
  initializeScrollingMessage();
  renderJummahRows();
  scaleSidebar();

  await fetchPrayerTimes();

  initSlideshow({
    frameDefinitions: payload.frames,
    context: {
      events: appState.events,
      posters: appState.posters,
      dailyContent: () => appState.dailyContent,
      onWeekMetrics: (count) => {
        appState.weekEventCount = count;
      },
      onTodayMetrics: (count) => {
        appState.todayEventCount = count;
      },
    },
  });
  // Slideshow rebuilds the DOM; refresh next prayer display afterward
  highlightNextPrayer();

  updateCountdown();
  setInterval(updateCountdown, 1000);

  initializeWeather();
  setInterval(initializeWeather, 3600000);

  // Refresh Islamic quotes once per day
  setInterval(() => {
    appState.dailyContent = getDailyContent();
    fetchIslamicQuotes();
  }, 86400000);

  checkDarkModeAndRefresh();
  setInterval(checkDarkModeAndRefresh, 60000);

  // Once initial API/data fetches are done, hide the loader
  setLoadingOverlay(false);

  // Re-scale on resize
  window.addEventListener("resize", debounce(scaleSidebar, 150));
}

/* =====================================================
   Prayer Times
   ===================================================== */
async function fetchPrayerTimes() {
  if (!appState.boardConfig) return;
  const { latitude, longitude, method } = appState.boardConfig.location;
  const today = new Date();
  const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;

  try {
    const timesUrl = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
    const timesResponse = await fetch(timesUrl);
    const timesData = await timesResponse.json();

    const hanafiUrl = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${method}&school=1`;
    const hanafiResponse = await fetch(hanafiUrl);
    const hanafiData = await hanafiResponse.json();

    if (timesData.code === 200) {
      const hanafiAsr = hanafiData.data.timings.Asr;
      timesData.data.timings.hanafiAsr = hanafiAsr;
      appState.prayerTimes = timesData.data.timings;
      appState.hijriDate = timesData.data.date.hijri;

      updatePrayerTimesUI();
      updateHijriDate();

      appState.maghribTime = parseTimeString(appState.prayerTimes.Maghrib);
      appState.ishaTime = parseTimeString(appState.prayerTimes.Isha);

      await checkAndFetchTomorrowPrayerTimes();
    }
  } catch (error) {
    console.error("Error fetching prayer times:", error);
    showPrayerTimesError();
  }
}

async function checkAndFetchTomorrowPrayerTimes() {
  if (!appState.ishaTime || !appState.boardConfig) return;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const ishaMinutes = appState.ishaTime.hours * 60 + appState.ishaTime.minutes;

  if (currentMinutes >= ishaMinutes) {
    const { latitude, longitude, method } = appState.boardConfig.location;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = `${tomorrow.getDate()}-${tomorrow.getMonth() + 1}-${tomorrow.getFullYear()}`;

    try {
      const timesUrl = `https://api.aladhan.com/v1/timings/${tomorrowDateStr}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
      const timesResponse = await fetch(timesUrl);
      const timesData = await timesResponse.json();

      if (timesData.code === 200) {
        appState.tomorrowFajr = parseTimeString(timesData.data.timings.Fajr);
      }
    } catch (error) {
      console.error("Error fetching tomorrow's prayer times:", error);
    }
  }
}

function parseTimeString(timeStr) {
  const [time, period] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (!period) {
    return { hours, minutes };
  }

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return { hours, minutes };
}

function updatePrayerTimesUI() {
  if (!appState.prayerTimes) return;

  PRAYER_DISPLAY_ORDER.forEach((prayer) => {
    const elementId = `${PRAYER_NAMES[prayer]}Time`;
    const element = document.getElementById(elementId);
    const time24 = appState.prayerTimes[prayer];

    if (prayer === "Asr" && appState.prayerTimes.hanafiAsr) {
      const shafiFormatted = formatTo12Hour(time24);
      const hanafiFormatted = formatTo12Hour(appState.prayerTimes.hanafiAsr);
      if (element) element.textContent = `${shafiFormatted} / ${hanafiFormatted}`;
    } else {
      const formatted = formatTo12Hour(time24);
      if (element) element.textContent = formatted;
    }
  });

  renderJummahRows();
  highlightNextPrayer();
}

function formatTo12Hour(time24) {
  let [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function showPrayerTimesError() {
  PRAYER_DISPLAY_ORDER.forEach((prayer) => {
    const elementId = `${PRAYER_NAMES[prayer]}Time`;
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = "--:--";
    }
  });
}

/* =====================================================
   Next Prayer & Countdown
   ===================================================== */
function highlightNextPrayer() {
  if (!appState.prayerTimes) return;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  document.querySelectorAll(".prayer-card, .prayer-row").forEach((card) => {
    card.classList.remove("active", "next");
  });

  const sunriseTime = parseTimeString(appState.prayerTimes.Sunrise);
  const dhuhrTime = parseTimeString(appState.prayerTimes.Dhuhr);
  const sunriseMinutes = sunriseTime.hours * 60 + sunriseTime.minutes;
  const dhuhrMinutes = dhuhrTime.hours * 60 + dhuhrTime.minutes;
  const isBetweenSunriseAndDhuhr = currentMinutes > sunriseMinutes && currentMinutes < dhuhrMinutes;

  let currentPrayer = null;
  let currentPrayerMinutes = -Infinity;
  let nextPrayer = null;
  let nextPrayerMinutes = Infinity;

  const prayersToCheck = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

  for (const prayer of prayersToCheck) {
    const time = parseTimeString(appState.prayerTimes[prayer]);
    const prayerMinutes = time.hours * 60 + time.minutes;

    if (prayerMinutes <= currentMinutes && prayerMinutes > currentPrayerMinutes) {
      if (!(isBetweenSunriseAndDhuhr && prayer === "Fajr")) {
        currentPrayer = prayer;
        currentPrayerMinutes = prayerMinutes;
      }
    }

    if (prayerMinutes > currentMinutes && prayerMinutes < nextPrayerMinutes) {
      nextPrayer = prayer;
      nextPrayerMinutes = prayerMinutes;
    }
  }

  if (!nextPrayer) {
    nextPrayer = "Fajr";
  }

  appState.nextPrayer = nextPrayer;
  appState.currentPrayer = currentPrayer;

  if (currentPrayer && !isBetweenSunriseAndDhuhr) {
    const currentRow =
      document.querySelector(`.prayer-row[data-prayer="${PRAYER_NAMES[currentPrayer]}"]`) ||
      document.querySelector(`.prayer-card[data-prayer="${PRAYER_NAMES[currentPrayer]}"]`);
    if (currentRow) {
      currentRow.classList.add("active");
    }
  }

  const currentPrayerDisplay = document.getElementById("currentPrayerDisplay");
  if (currentPrayerDisplay && currentPrayer) {
    currentPrayerDisplay.textContent = currentPrayer;
  }

  const nextPrayerDisplayName = document.getElementById("nextPrayerDisplayName");
  if (nextPrayerDisplayName) {
    nextPrayerDisplayName.textContent = nextPrayer;
  }

  updatePrayerTimesTitle();
}

function updatePrayerTimesTitle() {
  if (!appState.prayerTimes) return;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const ishaTime = parseTimeString(appState.prayerTimes.Isha);
  const ishaMinutes = ishaTime.hours * 60 + ishaTime.minutes;

  const titleElement = document.getElementById("prayerTimesTitle");
  if (titleElement) {
    if (currentMinutes >= ishaMinutes) {
      titleElement.textContent = "Tomorrow's Prayer Times";
    } else {
      titleElement.textContent = "Today's Prayer Times";
    }
  }
}

function updateCountdown() {
  if (!appState.prayerTimes || !appState.nextPrayer) return;

  const now = new Date();
  let prayerTime;

  if (appState.nextPrayer === "Fajr" && appState.tomorrowFajr) {
    prayerTime = appState.tomorrowFajr;
  } else {
    prayerTime = parseTimeString(appState.prayerTimes[appState.nextPrayer]);
  }

  let targetTime = new Date();
  targetTime.setHours(prayerTime.hours, prayerTime.minutes, 0, 0);

  if (appState.nextPrayer === "Fajr" && now > targetTime) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  const diff = targetTime - now;

  if (diff <= 0) {
    highlightNextPrayer();
    return;
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const countdownStr = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  const countdownTimerLarge = document.getElementById("countdownTimerLarge");
  if (countdownTimerLarge) {
    countdownTimerLarge.textContent = countdownStr;
  }
}

/* =====================================================
   Clock & Date Display
   ===================================================== */
function updateClock() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  const timeStr = `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  const timeElement = document.getElementById("currentTime");
  if (timeElement) {
    timeElement.textContent = timeStr;
  }
}

function updateGregorianDate() {
  const now = new Date();
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  const dateStr = now.toLocaleDateString("en-US", options);
  const gregorianDate = document.getElementById("gregorianDate");
  if (gregorianDate) gregorianDate.textContent = dateStr;
  const heroDate = document.getElementById("heroDate");
  if (heroDate) heroDate.textContent = dateStr.toUpperCase();
}

function updateHijriDate() {
  if (!appState.hijriDate) return;
  const { day, month, year } = appState.hijriDate;
  const hijriStr = `${day} ${month.en} ${year} AH`;
  const hijriElement = document.getElementById("hijriDate");
  if (hijriElement) hijriElement.textContent = hijriStr;
}

/* =====================================================
   Jummah
   ===================================================== */
function renderJummahRows() {
  if (!appState.boardConfig) return;
  const today = new Date();
  const isFriday = today.getDay() === 5;
  const jummahSection = document.getElementById("jummahSection");
  const subcards = document.getElementById("jummahSubcards");

  if (!jummahSection || !subcards) return;
  subcards.innerHTML = "";

  const prayers = appState.boardConfig.jummahPrayers || [];

//   if (!isFriday || prayers.length === 0) {
//     jummahSection.style.display = "none";
//     return;
//   }

  jummahSection.style.display = "block";

  prayers.forEach((prayer) => {
    const subcard = document.createElement("div");
    subcard.className = "jummah-subcard";
    subcard.innerHTML = `
      <div class="jummah-time">${prayer.time}</div>
      <div class="jummah-khatib">${prayer.khatib}</div>
      <div class="jummah-location">${prayer.location}</div>
    `;
    subcards.appendChild(subcard);
  });
}

/* =====================================================
   Islamic Content (Verse & Hadith)
   ===================================================== */
function initializeIslamicContent(dailyContent) {
  if (!dailyContent) return;
  const verseArabic = document.getElementById("verseArabic");
  const verseTranslation = document.getElementById("verseTranslation");
  const verseReference = document.getElementById("verseReference");
  const hadithText = document.getElementById("hadithText");
  const hadithReference = document.getElementById("hadithReference");

  if (verseArabic) verseArabic.textContent = dailyContent.verse.arabic;
  if (verseTranslation) verseTranslation.textContent = dailyContent.verse.translation;
  if (verseReference) verseReference.textContent = dailyContent.verse.reference;
  if (hadithText) hadithText.textContent = dailyContent.hadith.text;
  if (hadithReference) hadithReference.textContent = dailyContent.hadith.reference;
}

function fetchIslamicQuotes() {
  if (!appState.dailyContent) {
    appState.dailyContent = getDailyContent();
  }
  const { verse, hadith } = appState.dailyContent;
  const verseArabic = document.getElementById("verseArabic");
  const verseTranslation = document.getElementById("verseTranslation");
  const verseReference = document.getElementById("verseReference");
  const hadithText = document.getElementById("hadithText");
  const hadithReference = document.getElementById("hadithReference");

  if (verseArabic) verseArabic.textContent = verse?.arabic || "...";
  if (verseTranslation) verseTranslation.textContent = verse?.translation || "...";
  if (verseReference) verseReference.textContent = verse?.reference || "...";
  if (hadithText) hadithText.textContent = hadith?.text || "...";
  if (hadithReference) hadithReference.textContent = hadith?.reference || "...";
}

/* =====================================================
   Scrolling Message Bar
   ===================================================== */
function initializeScrollingMessage() {
  const messageBar = document.querySelector(".scrolling-message-bar");
  const messageElement = document.getElementById("scrollingMessageContent");
  const rightPanel = document.querySelector(".right-panel");

  if (!appState.boardConfig?.enableScrollingMessage) {
    if (messageBar) messageBar.style.display = "none";
    if (rightPanel) rightPanel.style.paddingBottom = "0";
    return;
  }

  if (messageBar) messageBar.style.display = "flex";
  if (rightPanel) rightPanel.style.paddingBottom = "";

  if (messageElement && appState.boardConfig.scrollingMessage) {
    messageElement.textContent = appState.boardConfig.scrollingMessage;
  }
}

/* =====================================================
   Dark Mode & Auto Refresh
   ===================================================== */
function checkDarkModeAndRefresh() {
  if (!appState.maghribTime || !appState.prayerTimes || !appState.boardConfig) return;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const maghribMinutes = appState.maghribTime.hours * 60 + appState.maghribTime.minutes;

  if (appState.boardConfig.darkModeAfterIsha) {
    const fajrTime = parseTimeString(appState.prayerTimes.Fajr);
    const fajrMinutes = fajrTime.hours * 60 + fajrTime.minutes;

    if (currentMinutes >= maghribMinutes || currentMinutes < fajrMinutes) {
      if (!appState.isDarkMode) enableDarkMode();
    } else if (appState.isDarkMode) {
      disableDarkMode();
    }
  }

  if (currentMinutes === 0) {
    location.reload();
  }
}

function enableDarkMode() {
  document.body.classList.add("dark-mode");
  appState.isDarkMode = true;
}

function disableDarkMode() {
  document.body.classList.remove("dark-mode");
  appState.isDarkMode = false;
}

/* =====================================================
   Weather (current + outlook cycling)
   ===================================================== */
async function initializeWeather() {
  const location = appState.boardConfig?.location || {
    city: "Mississauga",
    country: "CA",
    latitude: 43.589,
    longitude: -79.6441,
  };
  const { latitude, longitude } = location;
  const apiKey = "7e32f8476fc6017c8e2ad00d10c10529";

  try {
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`;

    const [currentResp, forecastResp] = await Promise.all([fetch(currentUrl), fetch(forecastUrl)]);
    if (!currentResp.ok) throw new Error("Weather fetch failed");

    const currentData = await currentResp.json();
    let forecastData = null;
    if (forecastResp.ok) {
      forecastData = await forecastResp.json();
    }

    const current = {
      temp: Math.round(currentData.main.temp),
      icon: WEATHER_ICONS[currentData.weather[0].main] || "\u2601\ufe0f",
      desc: `${currentData.name}, ${currentData.sys.country}`,
      condition: currentData.weather[0].main,
    };

    const outlook = buildWeatherOutlook(forecastData);

    appState.weather = { current, outlook };
    startWeatherCycle();
  } catch (error) {
    console.error("Error fetching weather:", error);
    appState.weather = null;
    document.getElementById("weatherIcon").textContent = "\u2601\ufe0f";
    document.getElementById("weatherTemp").textContent = "--\u00b0C";
    document.getElementById("weatherDesc").textContent = "Mississauga, ON";
  }
}

function buildWeatherOutlook(forecastData) {
  if (!forecastData?.list?.length) return null;
  const now = Date.now();

  const todayKey = formatLocalDateKey(new Date());
  const hourly = forecastData.list
    .filter((entry) => entry.dt * 1000 > now)
    .map((entry) => {
      const dateObj = new Date(entry.dt * 1000);
      const timeLabel = dateObj.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      const dayKey = formatLocalDateKey(dateObj);
      return {
        timeLabel,
        temp: Math.round(entry.main.temp),
        icon: WEATHER_ICONS[entry.weather[0].main] || "\u2601\ufe0f",
        isToday: dayKey === todayKey,
      };
    });

  const dailyMap = new Map();
  forecastData.list.forEach((entry) => {
    const date = new Date(entry.dt * 1000);
    const dayKey = formatLocalDateKey(date);
    const existing = dailyMap.get(dayKey) || {
      high: -Infinity,
      low: Infinity,
      icon: WEATHER_ICONS[entry.weather[0].main] || "\u2601\ufe0f",
      firstIconSet: false,
    };
    existing.high = Math.max(existing.high, entry.main.temp_max);
    existing.low = Math.min(existing.low, entry.main.temp_min);
    if (!existing.firstIconSet) {
      existing.icon = WEATHER_ICONS[entry.weather[0].main] || "\u2601\ufe0f";
      existing.firstIconSet = true;
    }
    dailyMap.set(dayKey, existing);
  });

  const daily = Array.from(dailyMap.entries())
    .filter(([dayKey]) => dayKey >= todayKey)
    .slice(0, 7)
    .map(([dayKey, info], index) => {
      const label = index === 0 ? "Today" : index === 1 ? "Tomorrow" : dayKey;
      return {
        label,
        high: Math.round(info.high),
        low: Math.round(info.low),
        icon: info.icon,
      };
    });

  return { hourly, daily };
}

function renderWeather() {
  const modes = ["current", "daily", "hourly"];
  const mode = modes[appState.weatherModeIndex % modes.length];
  const container = document.getElementById("weatherCards");
  if (container) {
    container.classList.add("transitioning");
    const track = container.querySelector(".weather-track");
    if (track) {
      track.classList.add("transitioning");
      setTimeout(() => track.classList.remove("transitioning"), 400);
    }
    setTimeout(() => container.classList.remove("transitioning"), 400);
  }
  if (mode === "daily") {
    renderWeatherDaily();
  } else if (mode === "hourly") {
    renderWeatherHourly();
  } else {
    renderWeatherCurrentInline();
  }
}

function renderWeatherCurrentInline() {
  const container = document.getElementById("weatherCards");
  if (!container) return;
  if (!appState.weather?.current) {
    container.innerHTML = `<div class="weather-card primary"><div class="weather-time">Weather</div><div class="weather-desc">Loading...</div></div>`;
    return;
  }
  const { temp, icon, desc, condition } = appState.weather.current;
  const locationLine = appState.boardConfig?.location
    ? `${appState.boardConfig.location.city}, ${appState.boardConfig.location.country}`
    : desc;
  container.innerHTML = `
    <div class="weather-track">
      <div class="weather-card primary full">
        <div class="weather-time">Now</div>
        <div class="weather-icon">${icon}</div>
        <div class="weather-temps">
          <span class="weather-temp-high">${temp}&deg;C</span>
        </div>
        <div class="weather-desc">${locationLine} • ${condition}</div>
      </div>
    </div>
  `;
  resetWeatherAutoScroll(container);
}

function renderWeatherDaily() {
  const container = document.getElementById("weatherCards");
  if (!container) return;
  if (!appState.weather?.outlook?.daily?.length) {
    container.innerHTML = `<div class="weather-card primary"><div class="weather-time">Daily</div><div class="weather-desc">No data</div></div>`;
    return;
  }
  const cards = appState.weather.outlook.daily.slice(0, 7).map((d, idx) =>
    buildWeatherCard({ label: d.label, icon: d.icon, high: d.high, low: d.low, highlight: idx === 0 })
  );
  container.innerHTML = `<div class="weather-track">${cards.join("")}</div>`;
  applyWeatherAutoScroll(container);
}

function renderWeatherHourly() {
  const container = document.getElementById("weatherCards");
  if (!container) return;
  if (!appState.weather?.outlook?.hourly?.length) {
    container.innerHTML = `<div class="weather-card primary"><div class="weather-time">Hourly</div><div class="weather-desc">No data</div></div>`;
    return;
  }
  const cards = appState.weather.outlook.hourly
    .filter((h) => h.isToday)
    .slice(0, 16)
    .map((h, idx) => buildWeatherCard({ label: h.timeLabel, icon: h.icon, high: h.temp, low: h.temp, highlight: idx === 0 }));
  container.innerHTML = `<div class="weather-track">${cards.join("")}</div>`;
  applyWeatherAutoScroll(container);
}

function buildWeatherCard({ label, icon, high, low, highlight = false }) {
  const safeLabel = label || "";
  const hi = typeof high === "number" ? `${high}\u00b0` : "--";
  const lo = typeof low === "number" ? `${low}\u00b0` : "--";
  return `
    <div class="weather-card ${highlight ? "primary" : ""}">
      <div class="weather-time">${safeLabel}</div>
      <div class="weather-icon">${icon || "\u2601\ufe0f"}</div>
      <div class="weather-temps">
        <span class="weather-temp-high">${hi}</span>
        <span class="weather-temp-low">${lo}</span>
      </div>
    </div>
  `;
}

function startWeatherCycle() {
  if (appState.weatherCycleTimer) clearInterval(appState.weatherCycleTimer);
  appState.weatherModeIndex = 0;
  renderWeather();
  appState.weatherCycleTimer = setInterval(() => {
    appState.weatherModeIndex = (appState.weatherModeIndex + 1) % 3;
    renderWeather();
  }, 12000);
}

function setLoadingOverlay(isLoading, message) {
  const overlay = document.getElementById("loadingOverlay");
  if (!overlay) return;
  const subtitle = overlay.querySelector(".loading-subtitle");
  if (message && subtitle) {
    subtitle.textContent = message;
  }
  overlay.classList.toggle("hidden", !isLoading);
}

function applyWeatherAutoScroll(container) {
  resetWeatherAutoScroll(container);
  const track = container.querySelector(".weather-track");
  if (track && track.scrollWidth > container.clientWidth) {
    const original = track.innerHTML;
    track.innerHTML = original + original;
    track.classList.add("weather-auto-scroll");
  }
}

function resetWeatherAutoScroll(container) {
  const track = container.querySelector(".weather-track");
  if (track) {
    track.classList.remove("weather-auto-scroll");
  }
}

function scaleSidebar() {
  const panel = document.querySelector(".left-panel");
  const content = document.getElementById("sidebarContent");
  if (!panel || !content) return;

  // reset before measuring
  content.style.transform = "scale(1)";
  content.style.width = "100%";

  const available = panel.clientHeight;
  const contentHeight = content.scrollHeight;
  const target = 1080;

  const fitScale = contentHeight > 0 ? available / contentHeight : 1;
  const targetScale = available / target;
  const scale = Math.max(0.75, Math.min(Math.max(fitScale, targetScale), 1.1));

  content.style.transform = `scale(${scale})`;
  content.style.width = `${(1 / scale) * 100}%`;
}

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}
/* =====================================================
   Utilities
   ===================================================== */
window.onerror = function (msg, url, lineNo) {
  console.error("Error: ", msg, "\nURL: ", url, "\nLine: ", lineNo);
  return false;
};

console.log(
  "%cUTM MSA Musallah Board",
  "font-size: 24px; font-weight: bold; color: #F8E15D; background: #082D5D; padding: 10px 20px; border-radius: 8px;"
);
console.log(
  "%cMade with care for the UTM Muslim community by IbraSoft",
  "font-size: 12px; color: #2E5380;"
);
