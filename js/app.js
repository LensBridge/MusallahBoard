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
    ishaTime: null,
    isDarkMode: false,
    nextPrayer: null
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
    console.log('🕌 UTM MSA Musallah Board Initializing...');
    
    // Start the clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // Fetch prayer times
    await fetchPrayerTimes();
    
    // Initialize UI components
    updateGregorianDate();
    initializeJummahSection();
    initializeIslamicContent();
    initializeSlideshow();
    initializeWeather();
    
    // Refresh weather every hour (3600000 ms = 1 hour)
    setInterval(initializeWeather, 3600000);
    
    // Start countdown timer
    updateCountdown();
    setInterval(updateCountdown, 1000);
    
    // Start slideshow cycling
    setInterval(cycleSlides, BOARD_CONFIG.posterCycleInterval);
    
    // Check for dark mode and refresh
    setInterval(checkDarkModeAndRefresh, 60000); // Check every minute
    
    console.log('✅ Musallah Board Ready!');
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
        
        if (timesData.code === 200) {
            state.prayerTimes = timesData.data.timings;
            state.hijriDate = timesData.data.date.hijri;
            
            updatePrayerTimesUI();
            updateHijriDate();
            
            // Store Isha time for dark mode and refresh logic
            state.ishaTime = parseTimeString(state.prayerTimes.Isha);
            
            console.log('📿 Prayer times loaded:', state.prayerTimes);
        }
    } catch (error) {
        console.error('Error fetching prayer times:', error);
        // Show error state in UI
        showPrayerTimesError();
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
        if (element) {
            const time24 = state.prayerTimes[prayer];
            element.textContent = formatTo12Hour(time24);
        }
    });
    
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
    
    // Find next prayer
    let nextPrayer = null;
    let nextPrayerMinutes = Infinity;
    
    // Only check actual prayers (not sunrise for next prayer purposes)
    const prayersToCheck = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    
    for (const prayer of prayersToCheck) {
        const time = parseTimeString(state.prayerTimes[prayer]);
        const prayerMinutes = time.hours * 60 + time.minutes;
        
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
    
    // Highlight next prayer row (support both old and new class names)
    const nextRow = document.querySelector(`.prayer-row[data-prayer="${PRAYER_NAMES[nextPrayer]}"]`) ||
                    document.querySelector(`.prayer-card[data-prayer="${PRAYER_NAMES[nextPrayer]}"]`);
    if (nextRow) {
        nextRow.classList.add('next');
    }
    
    // Update countdown display
    document.getElementById('nextPrayerName').textContent = nextPrayer;
    
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
    const prayerTime = parseTimeString(state.prayerTimes[state.nextPrayer]);
    
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
    document.getElementById('countdownTimer').textContent = countdownStr;
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
function initializeJummahSection() {
    const jummahSection = document.getElementById('jummahSection');
    const container = document.getElementById('jummahPrayersContainer');
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Show Jummah section only on Thursday (4) or Friday (5)
    if ((dayOfWeek !== 4 && dayOfWeek !== 5)) {
        jummahSection.style.display = 'none';
        return;
    }
    else {
        // Remove the hadith and verse of the day to make space
        hadithSection.style.display = 'none';
        verseSection.style.display = 'none';
    }
    
    const prayers = BOARD_CONFIG.jummahPrayers || [];
    
    if (prayers.length === 0) {
        jummahSection.style.display = 'none';
        return;
    }
    
    container.innerHTML = '';
    
    prayers.forEach((prayer, index) => {
        const card = document.createElement('div');
        card.className = 'jummah-card';
        card.innerHTML = `
            <div class="jummah-number">${index + 1}</div>
            <div class="jummah-time">${prayer.time}</div>
            <div class="jummah-details">
                <div class="jummah-khatib">${prayer.khatib}</div>
                <div class="jummah-location">📍 ${prayer.location}</div>
            </div>
        `;
        container.appendChild(card);
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
// Fullscreen Slideshow (Calendar + Posters)
// =====================================================
function initializeSlideshow() {
    // Build full calendar first
    buildFullCalendar();
    
    // Build slides track: calendar slide + poster slides
    const slideshowContainer = document.getElementById('slideshowContainer');

    // Create a track and move existing calendar slide into it
    const track = document.createElement('div');
    track.className = 'slides-track';

    const calendarSlide = document.getElementById('calendarSlide');
    if (calendarSlide) track.appendChild(calendarSlide);

    // Create poster slides from POSTERS and append
    POSTERS.forEach(p => {
        const slide = document.createElement('div');
        slide.className = 'slide poster-slide';
        slide.innerHTML = `<img src="${p.image}" alt="${p.title}" class="fullscreen-poster">`;
        track.appendChild(slide);
    });

    // Replace slideshowContainer content with track (preserve slide-indicators container below)
    // Remove any existing direct slide children (posterSlide etc.) then append track
    Array.from(slideshowContainer.children).forEach(ch => {
        // Keep slide-indicators if present outside slideshowContainer (it is outside in DOM)
        if (ch.id !== 'slideIndicators') ch.remove();
    });
    slideshowContainer.appendChild(track);

    // Calculate total slides: 1 (calendar) + number of posters
    state.totalSlides = 1 + POSTERS.length;

    // Create slide indicators (progress bar segments)
    const indicatorsContainer = document.getElementById('slideIndicators');
    indicatorsContainer.innerHTML = '';

    for (let i = 0; i < state.totalSlides; i++) {
        const indicator = document.createElement('div');
        indicator.className = 'slide-indicator' + (i === 0 ? ' active' : '');
        indicator.addEventListener('click', () => goToSlide(i));
        indicatorsContainer.appendChild(indicator);
    }

    // Start at the first slide
    showSlide(0);
}

function buildFullCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // Update month header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('fullCalendarMonth').textContent = `${monthNames[month]} ${year}`;
    
    // Build calendar grid
    const grid = document.getElementById('fullCalendarGrid');
    grid.innerHTML = '';
    
    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    // Separate events into: single-day timed, single-day all-day, and multi-day
    const singleDayTimedEvents = [];
    const singleDayAllDayEvents = [];
    const multiDayEvents = [];
    
    EVENTS.forEach(event => {
        if (event.startDate && event.endDate) {
            multiDayEvents.push(event);
        } else if (event.date) {
            if (event.allDay) singleDayAllDayEvents.push(event);
            else singleDayTimedEvents.push(event);
        }
    });
    
    // Create a map of single-day events by date for quick lookup
    const eventsByDate = {};
    singleDayTimedEvents.forEach(event => {
        if (event.date.getMonth() === month && event.date.getFullYear() === year) {
            const day = event.date.getDate();
            if (!eventsByDate[day]) {
                eventsByDate[day] = [];
            }
            eventsByDate[day].push(event);
        }
    });
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const cell = createCalendarCell(prevMonthDays - i, true, false, []);
        grid.appendChild(cell);
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
        const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
        const dayEvents = eventsByDate[day] || [];
        const cell = createCalendarCell(day, false, isToday, dayEvents);
        grid.appendChild(cell);
    }

    // Fill remaining cells to complete the grid (support 5- or 6-week months)
    const filledCells = grid.children.length;
    const rowsNeeded = Math.max(5, Math.ceil((firstDay + totalDays) / 7)); // clamp to at least 5 rows for consistent height
    const targetCells = rowsNeeded * 7;
    const remainingCells = targetCells - filledCells;
    for (let i = 1; i <= remainingCells; i++) {
        const cell = createCalendarCell(i, true, false, []);
        grid.appendChild(cell);
    }

    // Render all-day overlay: multi-day spans + single-day all-day chips (deduped)
    renderMultiDayEvents(
        dedupeEvents(multiDayEvents),
        dedupeEvents(singleDayAllDayEvents),
        year,
        month,
        firstDay,
        totalDays
    );
}

function renderMultiDayEvents(multiDay, singleDayAll, year, month, firstDayOffset, totalDays) {
    const overlay = document.getElementById('multiDayEventsOverlay');
    const grid = document.getElementById('fullCalendarGrid');
    if (!overlay || !grid) return;

    overlay.innerHTML = '';

    // Reset any row padding previously applied
    grid.querySelectorAll('.calendar-cell .calendar-cell-events').forEach(ec => {
        ec.style.marginTop = '0px';
    });

    const cells = grid.querySelectorAll('.calendar-cell');
    if (cells.length === 0) return;

    // Measure shared metrics
    const overlayRect = overlay.getBoundingClientRect();
    const firstCell = cells[0];
    const headerEl = firstCell.querySelector('.calendar-cell-header');
    const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;

    // Create temp bar to measure height
    const tempBar = document.createElement('div');
    tempBar.className = 'multi-day-event-bar';
    tempBar.style.position = 'absolute';
    tempBar.style.left = '-9999px';
    tempBar.style.top = '-9999px';
    tempBar.textContent = '';
    overlay.appendChild(tempBar);
    const barHeight = tempBar.offsetHeight || 22;
    overlay.removeChild(tempBar);
    const barGap = 6;

    // Determine rows count from grid
    const totalCells = cells.length; // 35 or 42 depending on month
    const rows = Math.ceil(totalCells / 7);

    // Preserve lane assignment across week rows so long spans do not jump vertically
    const eventLaneMap = new Map();

    // Helper to get cell rect by index safely
    const getCellRect = (idx) => cells[idx]?.getBoundingClientRect();

    // Build visible spans for this month only
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month, totalDays, 23, 59, 59);

    // Per-row segments to lane-pack
    const rowSegments = Array.from({ length: rows }, () => []);

    // 1) Multi-day event segments across week rows
    multiDay.forEach(event => {
        const startDate = event.startDate;
        const endDate = event.endDate;
        if (!startDate || !endDate) return;
        if (endDate < monthStart || startDate > monthEnd) return;

        const visibleStartDay = (startDate.getMonth() === month && startDate.getFullYear() === year)
            ? startDate.getDate() : 1;
        const visibleEndDay = (endDate.getMonth() === month && endDate.getFullYear() === year)
            ? endDate.getDate() : totalDays;

        const startIdx = firstDayOffset + visibleStartDay - 1; // 0-based cell index
        const endIdx = firstDayOffset + visibleEndDay - 1;

        const startRow = Math.floor(startIdx / 7);
        const endRow = Math.floor(endIdx / 7);

        for (let row = startRow; row <= endRow; row++) {
            const weekStartIdx = row * 7;
            const weekEndIdx = row * 7 + 6;
            const segStart = Math.max(startIdx, weekStartIdx);
            const segEnd = Math.min(endIdx, weekEndIdx);
            if (segStart <= segEnd) {
                rowSegments[row].push({
                    event,
                    row,
                    startCell: segStart,
                    endCell: segEnd,
                    isAllDaySingle: false,
                    isStart: segStart === startIdx,
                    isEnd: segEnd === endIdx
                });
            }
        }
    });

    // 2) Single-day all-day events as single-cell segments
    singleDayAll.forEach(event => {
        const d = event.date;
        if (!d) return;
        if (d.getMonth() !== month || d.getFullYear() !== year) return;
        const cellIdx = firstDayOffset + d.getDate() - 1;
        const row = Math.floor(cellIdx / 7);
        rowSegments[row].push({
            event,
            row,
            startCell: cellIdx,
            endCell: cellIdx,
            isAllDaySingle: true,
            isStart: true,
            isEnd: true
        });
    });

    // For each row, pack segments into lanes to avoid overlap
    rowSegments.forEach((segments, row) => {
        if (segments.length === 0) return;

        // Sort by start, then by end
        segments.sort((a, b) => a.startCell - b.startCell || a.endCell - b.endCell);

        const lanes = []; // each lane holds the endCell of last placed segment

        const isLaneFree = (idx, startCell) => lanes[idx] === undefined || lanes[idx] < startCell;

        segments.forEach(seg => {
            const eventKey = seg.event.id ?? `${seg.event.name}-${seg.startCell}-${seg.endCell}`;

            let laneIndex = eventLaneMap.has(eventKey) ? eventLaneMap.get(eventKey) : null;
            if (laneIndex !== null && !isLaneFree(laneIndex, seg.startCell)) {
                laneIndex = null; // fall back to next free lane when prior lane is blocked
            }

            if (laneIndex === null) {
                laneIndex = lanes.findIndex(end => end < seg.startCell);
            }

            if (laneIndex === -1 || laneIndex === null) {
                laneIndex = lanes.length;
            }

            lanes[laneIndex] = seg.endCell;
            eventLaneMap.set(eventKey, laneIndex);

            // Compute geometry for this segment
            const firstRect = getCellRect(seg.startCell);
            const lastRect = getCellRect(seg.endCell);
            if (!firstRect || !lastRect) return;

            const left = firstRect.left - overlayRect.left + 2;
            const width = (lastRect.right - firstRect.left) - 4;
            const top = firstRect.top - overlayRect.top + headerHeight + (laneIndex * (barHeight + barGap)) + 4;

            const bar = document.createElement('div');
            bar.className = 'multi-day-event-bar';
            if (seg.isAllDaySingle) bar.classList.add('single-day-all');
            if (seg.isStart) bar.classList.add('seg-start'); else bar.classList.add('cont-left');
            if (seg.isEnd) bar.classList.add('seg-end'); else bar.classList.add('cont-right');
            bar.style.left = `${left}px`;
            bar.style.top = `${top}px`;
            bar.style.width = `${width}px`;

            const e = seg.event;
            if (seg.isAllDaySingle) {
                bar.innerHTML = `
                    <span class="event-bar-name">${e.name}</span>
                    <span class="event-bar-dates">All Day</span>
                `;
            } else {
                const startStr = `${e.startDate.getMonth() + 1}/${e.startDate.getDate()}`;
                const endStr = `${e.endDate.getMonth() + 1}/${e.endDate.getDate()}`;
                bar.innerHTML = `
                    <span class="event-bar-name">${e.name}</span>
                    <span class="event-bar-dates">${startStr} - ${endStr}</span>
                `;
            }
            overlay.appendChild(bar);
        });

        // After laying out, push per-day events down in this row to avoid overlap
        const lanesCount = lanes.length;
        const rowExtra = lanesCount > 0 ? (lanesCount * (barHeight + barGap)) + 6 : 0;
        for (let c = 0; c < 7; c++) {
            const cellIdx = row * 7 + c;
            const cell = cells[cellIdx];
            if (!cell) continue;
            const eventsContainer = cell.querySelector('.calendar-cell-events');
            if (eventsContainer) {
                eventsContainer.style.marginTop = `${rowExtra}px`;
            }
        }
    });
}

function createCalendarCell(day, isOtherMonth, isToday, events) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    
    if (isOtherMonth) {
        cell.classList.add('other-month');
    }
    if (isToday) {
        cell.classList.add('today');
    }
    
    // Cell header with day number
    const header = document.createElement('div');
    header.className = 'calendar-cell-header';
    header.innerHTML = `<span class="calendar-cell-day">${day}</span>`;
    cell.appendChild(header);
    
    // Events container
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'calendar-cell-events';
    
    events.forEach(event => {
        const eventCard = document.createElement('div');
        eventCard.className = 'calendar-event-card';
        eventCard.innerHTML = `
            <div class="calendar-event-name">${event.name}</div>
            <div class="calendar-event-time">${event.time}</div>
        `;
        eventsContainer.appendChild(eventCard);
    });
    
    cell.appendChild(eventsContainer);
    
    return cell;
}

// Small helper to strip duplicate mock entries so bars and cards don't double-render
function dedupeEvents(events) {
    const seen = new Set();
    return events.filter(ev => {
        const key = [ev.id, ev.name, ev.date?.toISOString?.(), ev.startDate?.toISOString?.(), ev.endDate?.toISOString?.()].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
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

function cycleSlides() {
    if (state.totalSlides === 0) return;
    const nextIndex = (state.currentSlideIndex + 1) % state.totalSlides;
    // Animate slide to next index
    showSlide(nextIndex);
}

function goToSlide(index) {
    showSlide(index);
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


// async function initializeWeather() {
//     // Mississauga coordinates
//     const lat = 43.5890;
//     const lon = -79.6441;
    
//     try {
//         const response = await fetch(
//             `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius`
//         );
        
//         if (!response.ok) throw new Error('Weather fetch failed');
        
//         const data = await response.json();
        
//         // Map WMO weather codes to emojis
//         const getWeatherIcon = (code) => {
//             if (code === 0) return '☀️'; // Clear
//             if (code <= 3) return '☁️'; // Cloudy
//             if (code <= 49) return '🌫️'; // Fog
//             if (code <= 59) return '🌦️'; // Drizzle
//             if (code <= 69) return '🌧️'; // Rain
//             if (code <= 79) return '❄️'; // Snow
//             if (code <= 84) return '🌧️'; // Showers
//             if (code <= 99) return '⛈️'; // Thunderstorm
//             return '🌡️';
//         };
        
//         const weatherData = {
//             temp: Math.round(data.current.temperature_2m),
//             icon: getWeatherIcon(data.current.weather_code),
//             desc: 'Mississauga, ON'
//         };
        
//         document.getElementById('weatherIcon').textContent = weatherData.icon;
//         document.getElementById('weatherTemp').textContent = `${weatherData.temp}°C`;
//         document.getElementById('weatherDesc').textContent = weatherData.desc;
        
//     } catch (error) {
//         console.error('Error fetching weather:', error);
//         // Fallback to mock data
//         document.getElementById('weatherIcon').textContent = '🌡️';
//         document.getElementById('weatherTemp').textContent = '--°C';
//         document.getElementById('weatherDesc').textContent = 'Mississauga, ON';
//     }
// }


// =====================================================
// Dark Mode & Auto Refresh
// =====================================================
function checkDarkModeAndRefresh() {
    if (!state.ishaTime) return;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const ishaMinutes = state.ishaTime.hours * 60 + state.ishaTime.minutes;
    
    // Dark mode: X minutes after Isha
    if (BOARD_CONFIG.darkModeAfterIsha) {
        const darkModeStart = ishaMinutes + BOARD_CONFIG.darkModeMinutesAfterIsha;
        const fajrTime = parseTimeString(state.prayerTimes.Fajr);
        const fajrMinutes = fajrTime.hours * 60 + fajrTime.minutes;
        
        // Dark mode between Isha+30min and Fajr
        if (currentMinutes >= darkModeStart || currentMinutes < fajrMinutes) {
            if (!state.isDarkMode) {
                enableDarkMode();
            }
        } else {
            if (state.isDarkMode) {
                disableDarkMode();
            }
        }
    }
    
    // Auto-refresh: X minutes after Isha
    const refreshTime = ishaMinutes + BOARD_CONFIG.refreshAfterIshaMinutes;
    if (currentMinutes >= refreshTime && currentMinutes < refreshTime + 2) {
        console.log('🔄 Refreshing page for next day...');
        location.reload();
    }
}

function enableDarkMode() {
    document.body.classList.add('dark-mode');
    state.isDarkMode = true;
    console.log('🌙 Dark mode enabled');
}

function disableDarkMode() {
    document.body.classList.remove('dark-mode');
    state.isDarkMode = false;
    console.log('☀️ Dark mode disabled');
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
console.log('%cDeveloped with ❤️ for the UTM Muslim community', 'font-size: 12px; color: #2E5380;');
