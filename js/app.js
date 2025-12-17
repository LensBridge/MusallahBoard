/* =====================================================
   UTM MSA Musallah Board - Main Application
   ===================================================== */

// =====================================================
// State Management
// =====================================================
const state = {
    prayerTimes: null,
    hijriDate: null,
    currentSlideIndex: 0,
    totalSlides: 0,
    maghribTime: null,
    ishaTime: null,
    tomorrowFajr: null,
    isDarkMode: false,
    nextPrayer: null,
    currentPrayer: null,
    fullCalendarInstance: null,
    slideDurations: [], // Array to store duration for each slide
    slideTimer: null, // Timer for current slide
    weekEventCount: 0, // Track events in week view
    todayEventCount: 0 // Track events in today view
};

// =====================================================
// Prayer Time Names Mapping
// =====================================================
const PRAYER_NAMES = {
    Fajr: 'fajr',
    Sunrise: 'sunrise',
    Dhuhr: 'dhuhr',
    Asr: 'asr',
    Maghrib: 'maghrib',
    Isha: 'isha'
};

const PRAYER_DISPLAY_ORDER = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// =====================================================
// Initialization
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    
    // Start the clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // Fetch prayer times
    await fetchPrayerTimes();
    
    // Initialize UI components
    updateGregorianDate();
    initializeSlideshow();
    initializeWeather();
    fetchIslamicQuotes();
    initializeScrollingMessage();
    
    // Refresh weather every hour (3600000 ms = 1 hour)
    setInterval(initializeWeather, 3600000);
    
    // Refresh Islamic quotes once per day (86400000 ms = 24 hours)
    setInterval(fetchIslamicQuotes, 86400000);
    
    // Start countdown timer
    updateCountdown();
    setInterval(updateCountdown, 1000);
    
    // Slideshow cycling will be handled by scheduleNextSlide() with dynamic durations
    
    // Check for dark mode and refresh immediately, then every minute
    checkDarkModeAndRefresh();
    setInterval(checkDarkModeAndRefresh, 60000); // Check every minute
    });

// =====================================================
// Aladhan API Integration
// =====================================================
async function fetchPrayerTimes() {
    const { latitude, longitude, method } = BOARD_CONFIG.location;
    const today = new Date();
    const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
    
    try {
        // Fetch prayer times
        const timesUrl = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
        const timesResponse = await fetch(timesUrl);
        const timesData = await timesResponse.json();
        
        const hanafiUrl = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${method}&school=1`;
        const hanafiResponse = await fetch(hanafiUrl);
        const hanafiData = await hanafiResponse.json();

        if (timesData.code === 200) {
            const hanafiAsr = hanafiData.data.timings.Asr;
            timesData.data.timings.hanafiAsr = hanafiAsr;
            state.prayerTimes = timesData.data.timings;
            state.hijriDate = timesData.data.date.hijri;
            
            updatePrayerTimesUI();
            updateHijriDate();
            
            // Store Maghrib time for dark mode
            state.maghribTime = parseTimeString(state.prayerTimes.Maghrib);
            
            // Store Isha time for tomorrow's prayer time fetching logic
            state.ishaTime = parseTimeString(state.prayerTimes.Isha);
            
            // Fetch tomorrow's prayer times if it's after Isha
            await checkAndFetchTomorrowPrayerTimes();
        }
    } catch (error) {
        console.error('Error fetching prayer times:', error);
        // Show error state in UI
        showPrayerTimesError();
    }
}

async function checkAndFetchTomorrowPrayerTimes() {
    if (!state.ishaTime) return;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const ishaMinutes = state.ishaTime.hours * 60 + state.ishaTime.minutes;
    
    // If it's after Isha, fetch tomorrow's prayer times for accurate Fajr countdown
    if (currentMinutes >= ishaMinutes) {
        const { latitude, longitude, method } = BOARD_CONFIG.location;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowDateStr = `${tomorrow.getDate()}-${tomorrow.getMonth() + 1}-${tomorrow.getFullYear()}`;
        
        try {
            const timesUrl = `https://api.aladhan.com/v1/timings/${tomorrowDateStr}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
            const timesResponse = await fetch(timesUrl);
            const timesData = await timesResponse.json();
            
            if (timesData.code === 200) {
                // Store tomorrow's Fajr time for accurate countdown
                state.tomorrowFajr = parseTimeString(timesData.data.timings.Fajr);
            }
        } catch (error) {
            console.error('Error fetching tomorrow\'s prayer times:', error);
        }
    }
}

function parseTimeString(timeStr) {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    // Handle 24-hour format from API
    if (!period) {
        return { hours, minutes };
    }
    
    // Handle 12-hour format if present
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return { hours, minutes };
}

function updatePrayerTimesUI() {
    if (!state.prayerTimes) return;
    
    // Update each prayer time
    PRAYER_DISPLAY_ORDER.forEach(prayer => {
        const elementId = `${PRAYER_NAMES[prayer]}Time`;
        const element = document.getElementById(elementId);
        const time24 = state.prayerTimes[prayer];
        
        // Special handling for Asr to show both Shafi and Hanafi times
        if (prayer === 'Asr' && state.prayerTimes.hanafiAsr) {
            const shafiFormatted = formatTo12Hour(time24);
            const hanafiFormatted = formatTo12Hour(state.prayerTimes.hanafiAsr);
            if (element) element.textContent = `${shafiFormatted} / ${hanafiFormatted}`;
        } else {
            const formatted = formatTo12Hour(time24);
            if (element) element.textContent = formatted;
        }
    });

    renderJummahRows();
    
    // Highlight next prayer
    highlightNextPrayer();
}

function formatTo12Hour(time24) {
    let [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function showPrayerTimesError() {
    PRAYER_DISPLAY_ORDER.forEach(prayer => {
        const elementId = `${PRAYER_NAMES[prayer]}Time`;
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = '--:--';
        }
    });
}

// =====================================================
// Next Prayer & Countdown
// =====================================================
function highlightNextPrayer() {
    if (!state.prayerTimes) return;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Remove all highlights first (support both old and new class names)
    document.querySelectorAll('.prayer-card, .prayer-row').forEach(card => {
        card.classList.remove('active', 'next');
    });
    
    // Get sunrise and dhuhr times to check if we're between them
    const sunriseTime = parseTimeString(state.prayerTimes.Sunrise);
    const dhuhrTime = parseTimeString(state.prayerTimes.Dhuhr);
    const sunriseMinutes = sunriseTime.hours * 60 + sunriseTime.minutes;
    const dhuhrMinutes = dhuhrTime.hours * 60 + dhuhrTime.minutes;
    
    // Check if current time is between sunrise and dhuhr (no prayer should be highlighted)
    const isBetweenSunriseAndDhuhr = currentMinutes > sunriseMinutes && currentMinutes < dhuhrMinutes;
    
    // Find current prayer and next prayer
    let currentPrayer = null;
    let currentPrayerMinutes = -Infinity;
    let nextPrayer = null;
    let nextPrayerMinutes = Infinity;
    
    // Only check actual prayers (not sunrise for next prayer purposes)
    const prayersToCheck = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    
    for (const prayer of prayersToCheck) {
        const time = parseTimeString(state.prayerTimes[prayer]);
        const prayerMinutes = time.hours * 60 + time.minutes;
        
        // Current prayer is the most recent one that has passed
        // BUT don't highlight if we're between sunrise and dhuhr
        if (prayerMinutes <= currentMinutes && prayerMinutes > currentPrayerMinutes) {
            if (!(isBetweenSunriseAndDhuhr && prayer === 'Fajr')) {
                currentPrayer = prayer;
                currentPrayerMinutes = prayerMinutes;
            }
        }
        
        // Next prayer is the next one coming up
        if (prayerMinutes > currentMinutes && prayerMinutes < nextPrayerMinutes) {
            nextPrayer = prayer;
            nextPrayerMinutes = prayerMinutes;
        }
    }
    
    // If no prayer found today, next prayer is Fajr tomorrow
    if (!nextPrayer) {
        nextPrayer = 'Fajr';
    }
    
    state.nextPrayer = nextPrayer;
    state.currentPrayer = currentPrayer;
    
    // Highlight current prayer row (support both old and new class names)
    // Don't highlight if we're between sunrise and dhuhr
    if (currentPrayer && !isBetweenSunriseAndDhuhr) {
        const currentRow = document.querySelector(`.prayer-row[data-prayer="${PRAYER_NAMES[currentPrayer]}"]`) ||
                        document.querySelector(`.prayer-card[data-prayer="${PRAYER_NAMES[currentPrayer]}"]`);
        if (currentRow) {
            currentRow.classList.add('active');
        }
    }
    
    // Update current prayer display in hero
    const currentPrayerDisplay = document.getElementById('currentPrayerDisplay');
    if (currentPrayerDisplay && currentPrayer) {
        currentPrayerDisplay.textContent = currentPrayer;
    }
    
    // Update next prayer display on next prayer slide
    const nextPrayerDisplayName = document.getElementById('nextPrayerDisplayName');
    if (nextPrayerDisplayName) {
        nextPrayerDisplayName.textContent = nextPrayer;
    }
    
    // Update prayer times title based on whether we're past Isha
    updatePrayerTimesTitle();
}

function updatePrayerTimesTitle() {
    if (!state.prayerTimes) return;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const ishaTime = parseTimeString(state.prayerTimes.Isha);
    const ishaMinutes = ishaTime.hours * 60 + ishaTime.minutes;
    
    const titleElement = document.getElementById('prayerTimesTitle');
    if (titleElement) {
        if (currentMinutes >= ishaMinutes) {
            titleElement.textContent = "Tomorrow's Prayer Times";
        } else {
            titleElement.textContent = "Today's Prayer Times";
        }
    }
}

function updateCountdown() {
    if (!state.prayerTimes || !state.nextPrayer) return;
    
    const now = new Date();
    let prayerTime;
    
    // If next prayer is Fajr and we have tomorrow's Fajr time, use that
    if (state.nextPrayer === 'Fajr' && state.tomorrowFajr) {
        prayerTime = state.tomorrowFajr;
    } else {
        prayerTime = parseTimeString(state.prayerTimes[state.nextPrayer]);
    }
    
    let targetTime = new Date();
    targetTime.setHours(prayerTime.hours, prayerTime.minutes, 0, 0);
    
    // If next prayer is Fajr and it's after Isha, target is tomorrow
    if (state.nextPrayer === 'Fajr' && now > targetTime) {
        targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const diff = targetTime - now;
    
    if (diff <= 0) {
        // Prayer time reached, recalculate
        highlightNextPrayer();
        return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const countdownStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Update the large countdown timer on next prayer slide
    const countdownTimerLarge = document.getElementById('countdownTimerLarge');
    if (countdownTimerLarge) {
        countdownTimerLarge.textContent = countdownStr;
    }
}

// =====================================================
// Clock & Date Display
// =====================================================
function updateClock() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    
    const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    document.getElementById('currentTime').textContent = timeStr;
}

function updateGregorianDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('en-US', options);
    document.getElementById('gregorianDate').textContent = dateStr;
    const heroDate = document.getElementById('heroDate');
    if (heroDate) heroDate.textContent = dateStr.toUpperCase();
}

function updateHijriDate() {
    if (!state.hijriDate) return;
    
    const { day, month, year } = state.hijriDate;
    const hijriStr = `${day} ${month.en} ${year} AH`;
    document.getElementById('hijriDate').textContent = hijriStr;
}

// =====================================================
// Jummah Section
// =====================================================
function renderJummahRows() {
    const today = new Date();
    const isFriday = today.getDay() === 5;
    const jummahSection = document.getElementById('jummahSection');
    const subcards = document.getElementById('jummahSubcards');
    
    if (!jummahSection || !subcards) return;

    // Clear existing subcards
    subcards.innerHTML = '';

    // Only show Jummah card if it's Friday AND there are prayers configured
    const prayers = BOARD_CONFIG.jummahPrayers || [];
    
    if (!isFriday || prayers.length === 0) {
        jummahSection.style.display = 'none';
        return;
    }
    
    jummahSection.style.display = 'block';
    
    prayers.forEach((prayer, index) => {
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
// Islamic Content (Verse & Hadith)
// =====================================================
function initializeIslamicContent() {
    const dailyContent = getDailyContent();
    
    // Verse of the day
    document.getElementById('verseArabic').textContent = dailyContent.verse.arabic;
    document.getElementById('verseTranslation').textContent = dailyContent.verse.translation;
    document.getElementById('verseReference').textContent = `— ${dailyContent.verse.reference}`;
    
    // Hadith of the day
    document.getElementById('hadithText').textContent = dailyContent.hadith.text;
    document.getElementById('hadithReference').textContent = `— ${dailyContent.hadith.reference}`;
}

// =====================================================
// Fullscreen Slideshow (Week at Glance + Today + Posters)
// =====================================================
function initializeSlideshow() {
    // Build the new widgets
    buildWeekGlanceWidget();
    buildTodayWidget();
    
    // Build slides track
    const slideshowContainer = document.getElementById('slideshowContainer');
    const track = document.createElement('div');
    track.className = 'slides-track';

    // Add week glance slide
    const weekGlanceSlide = document.getElementById('weekGlanceSlide');
    if (weekGlanceSlide) track.appendChild(weekGlanceSlide);

    // Add today slide
    const todaySlide = document.getElementById('todaySlide');
    if (todaySlide) track.appendChild(todaySlide);

    // Add next prayer slide
    const nextPrayerSlide = document.getElementById('nextPrayerSlide');
    if (nextPrayerSlide) track.appendChild(nextPrayerSlide);

    // Create poster slides from POSTERS and append
    POSTERS.forEach(p => {
        const slide = document.createElement('div');
        slide.className = 'slide poster-slide';
        slide.innerHTML = `<img src="${p.image}" alt="${p.title}" class="fullscreen-poster">`;
        track.appendChild(slide);
    });

    // Add Islamic quotes slide (Hadith & Verse of the Day) at the end
    const islamicQuotesSlide = document.getElementById('islamicQuotesSlide');
    if (islamicQuotesSlide) track.appendChild(islamicQuotesSlide);

    // Clear and add track
    Array.from(slideshowContainer.children).forEach(ch => {
        if (ch.id !== 'slideIndicators') ch.remove();
    });
    slideshowContainer.appendChild(track);

    // Calculate total slides: 3 (week + today + next prayer) + number of posters + 1 (Islamic quotes)
    state.totalSlides = 3 + POSTERS.length + 1;
    
    // Build slide durations array
    state.slideDurations = [
        calculateWeekDuration(), // Week at a glance
        calculateTodayDuration(), // Coming up today
        12000, // Next prayer slide (fixed 12 seconds)
        ...POSTERS.map(p => p.duration || 10000), // Poster durations
        20000 // Islamic quotes slide (20 seconds for reading)
    ];

    // Create slide indicators
    const indicatorsContainer = document.getElementById('slideIndicators');
    indicatorsContainer.innerHTML = '';

    for (let i = 0; i < state.totalSlides; i++) {
        const indicator = document.createElement('div');
        indicator.className = 'slide-indicator' + (i === 0 ? ' active' : '');
        indicator.addEventListener('click', () => goToSlide(i));
        indicatorsContainer.appendChild(indicator);
    }

    // Start at first slide and schedule cycling
    showSlide(0);
    scheduleNextSlide();
    
    // Refresh widgets and recalculate durations periodically
    setInterval(() => {
        buildWeekGlanceWidget();
        buildTodayWidget();
        // Update durations
        state.slideDurations[0] = calculateWeekDuration();
        state.slideDurations[1] = calculateTodayDuration();
    }, 60000); // Refresh every minute to update "today" widget
}

function calculateWeekDuration() {
    // Base duration of 10 seconds
    // Add 2 seconds per event displayed across the week (up to a max of 30 seconds)
    const baseDuration = 10000;
    const perEventDuration = 2000;
    const maxDuration = 30000;
    
    const duration = Math.min(baseDuration + (state.weekEventCount * perEventDuration), maxDuration);
    return duration;
}

function calculateTodayDuration() {
    // Base duration of 8 seconds
    // Add 3 seconds per event (up to a max of 25 seconds)
    const baseDuration = 8000;
    const perEventDuration = 3000;
    const maxDuration = 25000;
    
    const duration = Math.min(baseDuration + (state.todayEventCount * perEventDuration), maxDuration);
    return duration;
}

function buildWeekGlanceWidget() {
    const weekGrid = document.getElementById('weekGrid');
    if (!weekGrid) return;
    
    weekGrid.innerHTML = '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentDay = today.getDay();
    
    // Calculate start of week (Sunday)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - currentDay);
    
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let totalWeekEvents = 0; // Track total events for duration calculation
    
    // Helper: Get the primary (first upcoming) event for a day
    function getPrimaryEvent(dayEvents) {
        if (dayEvents.length === 0) return null;
        
        const now = new Date().getTime();
        
        // Find first upcoming event
        const upcoming = dayEvents.find(e => e.startTimestamp >= now);
        if (upcoming) return upcoming;
        
        // If all events have passed, return the last one
        return dayEvents[dayEvents.length - 1];
    }
    
    // Build 7 day rows
    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + i);
        
        const dayEvents = getEventsForDay(dayDate);
        const isToday = dayDate.toDateString() === today.toDateString();
        const hasEvents = dayEvents.length > 0;
        
        const dayRow = document.createElement('div');
        dayRow.className = 'day-row' + (isToday ? ' today' : '');
        
        // Day header
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.innerHTML = `<div class="day-name">${weekDays[i]}</div><div class="day-date">${dayDate.getDate()}</div>`;
        dayRow.appendChild(dayHeader);
        
        // Day content
        const dayContent = document.createElement('div');
        dayContent.className = 'day-content';
        
        if (dayEvents.length === 0) {
            // Empty day - subtle placeholder
            const noEventsPlaceholder = document.createElement('div');
            noEventsPlaceholder.className = 'no-events-placeholder';
            noEventsPlaceholder.textContent = 'Stay tuned';
            dayContent.appendChild(noEventsPlaceholder);
        } else {
            // Events container with scroll capability
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'day-events';
            
            // Create scroll container for auto-scrolling
            const scrollContainer = document.createElement('div');
            scrollContainer.className = 'day-events-scroll-container';
            
            // Get primary event
            const primaryEvent = getPrimaryEvent(dayEvents);
            
            // Build event cards
            dayEvents.forEach((event) => {
                const eventCard = document.createElement('div');
                const isPrimary = event.id === primaryEvent.id;
                eventCard.className = `event-card ${isPrimary ? 'primary' : 'secondary'}`;
                const displayTime = formatEventTimeDisplay(event.startTimestamp, event.endTimestamp, event.allDay);
                
                eventCard.innerHTML = `
                    <div class="event-time">${displayTime}</div>
                    <div class="event-name">${event.name}</div>
                    <div class="event-location">${event.location || ''}</div>
                `;
                scrollContainer.appendChild(eventCard);
            });
            
            eventsContainer.appendChild(scrollContainer);
            
            // Check if we need auto-scroll (after DOM insertion)
            setTimeout(() => {
                const container = eventsContainer;
                const scrollCont = scrollContainer;
                
                if (scrollCont.scrollWidth > container.clientWidth) {
                    // Duplicate content for seamless loop
                    const originalCards = scrollCont.innerHTML;
                    scrollCont.innerHTML = originalCards + originalCards;
                    scrollCont.classList.add('auto-scroll');
                }
            }, 100);
            
            dayContent.appendChild(eventsContainer);
        }
        
        dayRow.appendChild(dayContent);
        weekGrid.appendChild(dayRow);
        
        // Count visible events
        totalWeekEvents += dayEvents.length;
    }
    
    // Update state with event count for duration calculation
    state.weekEventCount = totalWeekEvents;
}

function formatEventTimeDisplay(startTimestamp, endTimestamp, allDay) {
    if (allDay) return 'All Day';
    
    const start = new Date(startTimestamp);
    const startTime = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    const end = new Date(endTimestamp);
    const endTime = end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    return `${startTime} - ${endTime}`;
}

function buildTodayWidget() {
    const todayEvents = document.getElementById('todayEvents');
    if (!todayEvents) return;
    
    todayEvents.innerHTML = '';
    
    const today = new Date();
    const events = getEventsForDay(today);
    
    if (events.length === 0) {
        todayEvents.innerHTML = '<div class="no-events-today">Stay Tuned!<br><span style="font-size: 0.6em; opacity: 0.8;">Check back soon for upcoming events</span></div>';
        return;
    }
    
    // Sort events by start time
    events.sort((a, b) => a.startTimestamp - b.startTimestamp);
    
    // Get current time in milliseconds
    const now = Date.now();
    
    // Categorize events into three tiers
    const happeningNow = [];
    const comingSoon = [];
    
    events.forEach(event => {
        // Check if happening now (event has started but not ended)
        if (event.startTimestamp <= now && event.endTimestamp >= now) {
            happeningNow.push(event);
        }
        // Check if still upcoming today
        else if (event.startTimestamp > now) {
            comingSoon.push(event);
        }
        // Otherwise it's past - don't include
    });
    
    // If all events have passed, show "Stay Tuned" message
    if (happeningNow.length === 0 && comingSoon.length === 0) {
        todayEvents.innerHTML = '<div class="no-events-today">Stay Tuned!<br><span style="font-size: 0.6em; opacity: 0.8;">Check back soon for upcoming events</span></div>';
        return;
    }
    
    // Build the signage display
    const widget = document.createElement('div');
    widget.className = 'today-signage-display';
    
    // TIER 1: Happening Now (if exists)
    if (happeningNow.length > 0) {
        const nowSection = document.createElement('div');
        nowSection.className = 'signage-tier happening-now-tier';
        
        const event = happeningNow[0]; // Show first happening now event
        const minutesLeft = Math.max(0, Math.floor((event.endTimestamp - now) / (1000 * 60)));
        
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
    
    // TIER 2: Coming Soon (show up to 3 upcoming events)
    if (comingSoon.length > 0) {
        const soonSection = document.createElement('div');
        soonSection.className = 'signage-tier coming-soon-tier' + (happeningNow.length === 0 ? ' primary' : '');
        
        if (happeningNow.length === 0) {
            soonSection.innerHTML += '<div class="tier-label">Up Next</div>';
        } else {
            soonSection.innerHTML += '<div class="tier-label">Coming Up</div>';
        }
        
        const eventsList = document.createElement('div');
        eventsList.className = 'upcoming-events-list';
        
        // Show next upcoming event prominently, then others more subtly
        comingSoon.slice(0, 5).forEach((event, index) => {
            const timeUntil = Math.floor((event.startTimestamp - now) / (1000 * 60));
            const timeText = formatTimeUntil(timeUntil);
            const displayTime = formatEventTimeDisplay(event.startTimestamp, event.endTimestamp, event.allDay);
            
            const eventItem = document.createElement('div');
            eventItem.className = `upcoming-event-item${index === 0 && happeningNow.length === 0 ? ' primary' : ''}`;
            
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
    
    todayEvents.appendChild(widget);
    
    // Update state with event count for duration calculation
    state.todayEventCount = happeningNow.length + Math.min(comingSoon.length, 5);
}

function parseEventEndTime(timeStr, startMinutes) {
    // Try to parse duration from time string (e.g., "2:00 - 3:30 PM")
    if (timeStr.includes(' - ')) {
        const parts = timeStr.split(' - ');
        const endPart = parts[1];
        
        const match = endPart.match(/(\d{1,2}):(\d{2})/);
        if (match) {
            let hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            
            if (endPart.includes('PM') && hours !== 12) {
                hours += 12;
            } else if (endPart.includes('AM') && hours === 12) {
                hours = 0;
            }
            
            return hours * 60 + minutes;
        }
    }
    
    // If no end time found, assume 1 hour duration
    return startMinutes + 60;
}

function formatTimeUntil(minutes) {
    if (minutes < 1) return 'Starting now';
    if (minutes < 60) return `In ${minutes} min`;
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (mins === 0) {
        return `In ${hours}h`;
    }
    return `In ${hours}h ${mins}m`;
}

function getEventsForDay(date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();
    
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const dayEndMs = dayEnd.getTime();
    
    return EVENTS.filter(event => {
        // Event overlaps with this day if:
        // event starts before day ends AND event ends after day starts
        return event.startTimestamp <= dayEndMs && event.endTimestamp >= dayStartMs;
    });
}

function parseEventTime(timeStr) {
    if (!timeStr || timeStr === 'All Day') return -1; // All-day events at start
    
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return -1;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    
    // Handle PM times
    if (timeStr.includes('PM') && hours !== 12) {
        hours += 12;
    } else if (timeStr.includes('AM') && hours === 12) {
        hours = 0;
    }
    
    return hours * 60 + minutes;
}

function showSlide(index) {
    const track = document.querySelector('.slides-track');
    if (!track) return;

    // Translate track to show the requested slide
    const percent = -index * 100;
    track.style.transform = `translateX(${percent}%)`;

    // Update indicators
    document.querySelectorAll('.slide-indicator').forEach((ind, i) => {
        ind.classList.toggle('active', i === index);
    });

    state.currentSlideIndex = index;
}

function scheduleNextSlide() {
    // Clear any existing timer
    if (state.slideTimer) {
        clearTimeout(state.slideTimer);
    }
    
    // Get duration for current slide
    const currentDuration = state.slideDurations[state.currentSlideIndex] || 10000;
    
    // Schedule next slide transition
    state.slideTimer = setTimeout(() => {
        cycleSlides();
        scheduleNextSlide(); // Schedule the next one
    }, currentDuration);
}

function cycleSlides() {
    if (state.totalSlides === 0) return;
    const nextIndex = (state.currentSlideIndex + 1) % state.totalSlides;
    // Animate slide to next index
    showSlide(nextIndex);
}

function goToSlide(index) {
    showSlide(index);
    // Reschedule with new slide's duration
    scheduleNextSlide();
}


async function initializeWeather() {
    const city = 'Mississauga';
    const country = 'CA';
    const apiKey = '7e32f8476fc6017c8e2ad00d10c10529';
    
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${city},${country}&units=metric&appid=${apiKey}`
        );
        
        if (!response.ok) throw new Error('Weather fetch failed');
        
        const data = await response.json();
        
        const weatherIcons = {
            'Clear': '☀️',
            'Clouds': '☁️',
            'Rain': '🌧️',
            'Drizzle': '🌦️',
            'Thunderstorm': '⛈️',
            'Snow': '❄️',
            'Mist': '🌫️',
            'Fog': '🌫️'
        };
        
        const weatherData = {
            temp: Math.round(data.main.temp),
            icon: weatherIcons[data.weather[0].main] || '🌡️',
            desc: `${data.name}, ${data.sys.country}`
        };
        
        document.getElementById('weatherIcon').textContent = weatherData.icon;
        document.getElementById('weatherTemp').textContent = `${weatherData.temp}°C`;
        document.getElementById('weatherDesc').textContent = weatherData.desc;
        
    } catch (error) {
        console.error('Error fetching weather:', error);
        // Fallback to mock data
        document.getElementById('weatherIcon').textContent = '🌡️';
        document.getElementById('weatherTemp').textContent = '--°C';
        document.getElementById('weatherDesc').textContent = 'Mississauga, ON';
    }
}

// =====================================================
// Islamic Quotes (Hadith & Verse of the Day)
// =====================================================
function fetchIslamicQuotes() {
    // Get daily content from mock data
    const dailyContent = getDailyContent();
    
    // Display Verse of the Day
    if (dailyContent.verse) {
        document.getElementById('verseArabic').textContent = dailyContent.verse.arabic;
        document.getElementById('verseTranslation').textContent = dailyContent.verse.translation;
        document.getElementById('verseReference').textContent = dailyContent.verse.reference;
    }
    
    // Display Hadith of the Day
    if (dailyContent.hadith) {
        document.getElementById('hadithText').textContent = dailyContent.hadith.text;
        document.getElementById('hadithReference').textContent = dailyContent.hadith.reference;
    }
}


// =====================================================
// Scrolling Message Bar
// =====================================================
function initializeScrollingMessage() {
    const messageBar = document.querySelector('.scrolling-message-bar');
    const messageElement = document.getElementById('scrollingMessageContent');
    const rightPanel = document.querySelector('.right-panel');
    
    // Check if scrolling message is enabled
    if (!BOARD_CONFIG.enableScrollingMessage) {
        if (messageBar) {
            messageBar.style.display = 'none';
        }
        // Remove padding when message bar is disabled
        if (rightPanel) {
            rightPanel.style.paddingBottom = '0';
        }
        return;
    }
    
    // Show message bar and restore padding when enabled
    if (messageBar) {
        messageBar.style.display = 'flex';
    }
    if (rightPanel) {
        rightPanel.style.paddingBottom = '';
    }
    
    if (messageElement && BOARD_CONFIG.scrollingMessage) {
        messageElement.textContent = BOARD_CONFIG.scrollingMessage;
    }
}


// =====================================================
// Dark Mode & Auto Refresh
// =====================================================
function checkDarkModeAndRefresh() {
    if (!state.maghribTime) return;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const maghribMinutes = state.maghribTime.hours * 60 + state.maghribTime.minutes;
    
    // Dark mode: Enable at Maghrib time
    if (BOARD_CONFIG.darkModeAfterIsha) {
        const fajrTime = parseTimeString(state.prayerTimes.Fajr);
        const fajrMinutes = fajrTime.hours * 60 + fajrTime.minutes;
        
        // Dark mode between Maghrib and Fajr
        if (currentMinutes >= maghribMinutes || currentMinutes < fajrMinutes) {
            if (!state.isDarkMode) {
                enableDarkMode();
            }
        } else {
            if (state.isDarkMode) {
                disableDarkMode();
            }
        }
    }
    
    // Auto-refresh: Only at midnight to fetch next day's prayer times
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
// Utility Functions
// =====================================================
function formatDate(date) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// =====================================================
// Error Handling
// =====================================================
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Error: ', msg, '\nURL: ', url, '\nLine: ', lineNo);
    return false;
};

// =====================================================
// Console Branding
// =====================================================
console.log('%c🕌 UTM MSA Musallah Board', 'font-size: 24px; font-weight: bold; color: #F8E15D; background: #082D5D; padding: 10px 20px; border-radius: 8px;');
console.log('%cMade with ❤️ for the UTM Muslim community by IbraSoft', 'font-size: 12px; color: #2E5380;');
