/**
 * =====================================================
 * Mock Data
 * =====================================================
 * All mock data consolidated in one place. Used when
 * the backend API is not configured.
 * =====================================================
 */

import { FRAME_TYPES } from '../models/index.js';

// =====================================================
// Board Configuration
// =====================================================

/** @type {import('../models/index.js').BoardConfig} */
export const MOCK_BOARD_CONFIG = {
  location: {
    city: 'Mississauga',
    country: 'Canada',
    latitude: 43.589,
    longitude: -79.6441,
    timezone: 'America/Toronto',
    method: 2, // ISNA (Islamic Society of North America)
  },

  posterCycleInterval: 10000,
  refreshAfterIshaMinutes: 15,
  darkModeAfterIsha: true,
  darkModeMinutesAfterIsha: 30,
  enableScrollingMessage: false,
  scrollingMessages: [
    'Assalamu Alaikum, welcome to the Brothers Musallah.',
    'Please rack your shoes. Jazakallah Khair!',
    'MusallahBoard v1.0b, powered by IbraSoft.',
  ],
};

// =====================================================
// Jummah Prayers
// =====================================================

/** @type {import('../models/index.js').JummahPrayer[]} */
export const MOCK_JUMMAH_PRAYERS = [
  { id: 1, time: '12:30 PM', khatib: 'Br. Zaed Ul Islam', location: 'IB 110', audience: 'both' },
  { id: 2, time: '1:30 PM', khatib: 'Sh. Hosam Helal', location: 'IB 110', audience: 'both' },
  { id: 3, time: '2:30 PM', khatib: 'Sh. Alaa El-Sayed', location: 'DV 2080', audience: 'both' },
];

// =====================================================
// Mock Posters
// =====================================================

/** @type {import('../models/index.js').Poster[]} */
export const MOCK_POSTERS = [
  {
    id: 1,
    title: 'A Prophetic Blueprint: Redefining Manhood',
    image: 'images/mock/A_Prophetic_Blueprint_Redefining_Manhood_1.png',
    duration: 8000,
    startDate: '2025-11-15',
    endDate: '2025-12-05',
    audience: 'brothers',
  },
  {
    id: 2,
    title: 'Brothers Fifa Tournament',
    image: 'images/mock/fifa_brothers_events_2025_6.jpg',
    duration: 10000,
    startDate: '2025-11-20',
    endDate: '2025-12-10',
    audience: 'brothers',
  },
  {
    id: 3,
    title: 'Reviving Islamic Spirit',
    image: 'images/mock/RIS.png',
    duration: 12000,
    startDate: '2025-11-25',
    endDate: '2025-12-20',
    audience: 'both',
  },
  {
    id: 4,
    title: 'Alumni Event',
    image: 'images/mock/Alumni_Post.png',
    duration: 8000,
    startDate: '2025-12-01',
    endDate: '2025-12-18',
    audience: 'both',
  },
  {
    id: 5,
    title: 'Navigating Stress & Overwhelming Pressure',
    image: 'images/mock/Navigating_Stress__Overwhelming_Pressure.png',
    duration: 10000,
    startDate: '2025-12-05',
    endDate: '2026-01-05',
    audience: 'sisters',
  },
];

// =====================================================
// Mock Events
// =====================================================

/** @type {import('../models/index.js').Event[]} */
export const MOCK_EVENTS = [
  {
    id: 1,
    name: 'A Prophetic Blueprint: Redefining Manhood',
    startTimestamp: new Date(2026, 0, 11, 17, 0).getTime(),
    endTimestamp: new Date(2026, 0, 11, 19, 0).getTime(),
    location: 'TBA',
    description: 'Islamic perspective on masculinity and character',
  },
  {
    id: 2,
    name: 'Brothers Fifa Tournament',
    startTimestamp: new Date(2026, 0, 12, 18, 0).getTime(),
    endTimestamp: new Date(2026, 0, 12, 20, 0).getTime(),
    location: 'TBA',
    description: 'Brothers gaming tournament',
  },
  {
    id: 4,
    name: 'Winter Break Study Sessions',
    startTimestamp: new Date(2026, 0, 13, 0, 0).getTime(),
    endTimestamp: new Date(2026, 0, 15, 23, 59).getTime(),
    allDay: true,
    location: 'Musallah',
    description: 'Study sessions during winter break',
  },
  {
    id: 6,
    name: 'Study Break Social',
    startTimestamp: new Date(2026, 0, 14, 19, 0).getTime(),
    endTimestamp: new Date(2026, 0, 14, 21, 0).getTime(),
    location: 'Student Centre',
    description: 'Casual social to wrap up the conference',
  },
  {
    id: 7,
    name: 'Exam Review Session',
    startTimestamp: new Date(2026, 0, 15, 10, 0).getTime(),
    endTimestamp: new Date(2026, 0, 15, 12, 0).getTime(),
    location: 'IB 110',
    description: 'Review session for exams during winter break',
  },
  {
    id: 8,
    name: 'RIS Bazaar (All Day)',
    startTimestamp: new Date(2026, 0, 11, 0, 0).getTime(),
    endTimestamp: new Date(2026, 0, 11, 23, 59).getTime(),
    allDay: true,
    location: 'Hall A',
    description: 'Vendors and booths during RIS day 2',
  },
  {
    id: 9,
    name: 'Relax & Reset (All Day)',
    startTimestamp: new Date(2026, 0, 16, 0, 0).getTime(),
    endTimestamp: new Date(2026, 0, 16, 23, 59).getTime(),
    allDay: true,
    location: 'Musallah',
    description: 'Quiet day in the musallah during break',
  },
  {
    id: 10,
    name: 'Dhuhr Prayer',
    startTimestamp: new Date(2026, 0, 13, 12, 30).getTime(),
    endTimestamp: new Date(2026, 0, 13, 13, 0).getTime(),
    location: 'Main Hall',
    description: 'Congregational prayer',
  },
  {
    id: 11,
    name: 'Lunch & Learn: Islamic History',
    startTimestamp: new Date(2026, 0, 13, 13, 15).getTime(),
    endTimestamp: new Date(2026, 0, 13, 14, 0).getTime(),
    location: 'Student Centre, Room 205',
    description: 'Learn about the Rashidun Caliphate',
  },
  {
    id: 12,
    name: 'Study Break Social',
    startTimestamp: new Date(2026, 0, 13, 16, 30).getTime(),
    endTimestamp: new Date(2026, 0, 13, 17, 15).getTime(),
    location: 'Student Centre',
    description: 'Casual social to wrap up the conference',
  },
  {
    id: 13,
    name: 'Maghrib Prayer & Iftar',
    startTimestamp: new Date(2026, 0, 13, 18, 30).getTime(),
    endTimestamp: new Date(2026, 0, 13, 19, 30).getTime(),
    location: 'Main Hall',
    description: 'Prayer followed by dinner',
  },
  {
    id: 15,
    name: 'Morning Study Circle',
    startTimestamp: new Date(2026, 0, 14, 7, 30).getTime(),
    endTimestamp: new Date(2026, 0, 14, 8, 30).getTime(),
    location: 'Musallah, Room 101',
    description: "Qur'an study session",
  },
  {
    id: 17,
    name: 'Lunch & Learn: Hadith Discussion',
    startTimestamp: new Date(2026, 0, 14, 13, 15).getTime(),
    endTimestamp: new Date(2026, 0, 14, 14, 0).getTime(),
    location: 'Student Centre, Room 205',
    description: 'Discussion on contemporary hadith applications',
  },
  {
    id: 19,
    name: "Sisters' Halaqah",
    startTimestamp: new Date(2026, 0, 14, 16, 30).getTime(),
    endTimestamp: new Date(2026, 0, 14, 17, 30).getTime(),
    location: "Musallah, Women's Room",
    description: 'Islamic knowledge circle for sisters',
  },
  {
    id: 21,
    name: 'Dinner & Community',
    startTimestamp: new Date(2026, 0, 14, 19, 0).getTime(),
    endTimestamp: new Date(2026, 0, 14, 20, 0).getTime(),
    location: 'Student Centre, Cafeteria',
    description: 'Break fast together and socialize',
  },
  {
    id: 22,
    name: 'Isha Prayer',
    startTimestamp: new Date(2026, 0, 14, 20, 30).getTime(),
    endTimestamp: new Date(2026, 0, 14, 21, 0).getTime(),
    location: 'Main Hall',
    description: 'Congregational prayer',
  },
  {
    id: 23,
    name: 'Isha Prayer',
    startTimestamp: new Date(2026, 0, 16, 20, 30).getTime(),
    endTimestamp: new Date(2026, 0, 16, 21, 0).getTime(),
    location: 'Main Hall',
    description: 'Congregational prayer',
  },
];

// =====================================================
// Mock Islamic Content
// =====================================================

/** @type {import('../models/index.js').IslamicQuote[]} */
export const MOCK_VERSES = [
  {
    arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا',
    transliteration: 'Inna maʿa al-ʿusri yusra.',
    translation: '"Indeed, with hardship comes ease."',
    reference: 'Surah Ash-Sharh (94:6)',
  },
  {
    arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ',
    transliteration: 'Wa man yatawakkal ʿala Allahi fahuwa hasbuhu.',
    translation: '"And whoever relies upon Allah - then He is sufficient for him."',
    reference: 'Surah At-Talaq (65:3)',
  },
  {
    arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ',
    transliteration: 'Fadhkuruni adhkurkum.',
    translation: '"So remember Me; I will remember you."',
    reference: 'Surah Al-Baqarah (2:152)',
  },
  {
    arabic: 'وَقُل رَّبِّ زِدْنِي عِلْمًا',
    transliteration: 'Wa qul rabbi zidni ʿilman.',
    translation: "\"And say, 'My Lord, increase me in knowledge.'\"",
    reference: 'Surah Ta-Ha (20:114)',
  },
  {
    arabic: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ',
    transliteration: 'Inna Allaha maʿa as-sabireen.',
    translation: '"Indeed, Allah is with the patient."',
    reference: 'Surah Al-Baqarah (2:153)',
  },
  {
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً',
    transliteration: 'Rabbana atina fi d-dunya hasanatan wa fi l-akhirati hasanatan.',
    translation: '"Our Lord, give us good in this world and good in the Hereafter."',
    reference: 'Surah Al-Baqarah (2:201)',
  },
  {
    arabic: 'وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَى',
    transliteration: 'Wa lasawfa yuʿṭīka rabbuka fa-tarḍā.',
    translation: '"And your Lord is going to give you, and you will be satisfied."',
    reference: 'Surah Ad-Duha (93:5)',
  },
];

/** @type {import('../models/index.js').IslamicQuote[]} */
export const MOCK_HADITHS = [
  {
    arabic: 'إِنَّ مِنْ خِيَارِكُمْ أَحَسَنَكُمْ أَخْلَاقًا',
    transliteration: 'Inna min khiyarikum ahsankum akhlaqan.',
    translation: '"The best among you are those who have the best manners and character."',
    reference: 'Sahih al-Bukhari',
  },
  {
    arabic: 'وَبَشِّرُوا وَجْهَ أَخِيكَ الصَّالِحَ فَإِنَّهُ صَدَقَةٌ',
    transliteration: 'Wa bashshiru wajh akhika as-salih fa-innahu sadaqah.',
    translation: '"Smiling in the face of your brother is charity."',
    reference: 'Jami` at-Tirmidhi',
  },
  {
    arabic: 'لَيْسَ الشَّدِيدُ بِالصَّرْعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ',
    transliteration:
      'Laysa ash-shadidu bis-sir\'ati, innama ash-shadidu alladhi yamsiku nafsahu ʿinda al-ghadabi.',
    translation:
      '"The strong person is not the one who can wrestle someone else down. The strong person is the one who can control himself when he is angry."',
    reference: 'Sahih al-Bukhari',
  },
  {
    arabic: 'يَسِّرُوا وَلاَ تُعَسِّرُوا وَبَشِّرُوا وَلاَ تُنَفِّرُوا',
    transliteration: 'Yassiru wa la tu\'assiru wa bashshiru wa la tunaffiru.',
    translation:
      '"Make things easy and do not make them difficult, cheer people up and do not drive them away."',
    reference: 'Sahih al-Bukhari',
  },
  {
    arabic: 'لاَ يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    transliteration: 'La yu\'minu ahadukum hatta yuhibba li-akhihi ma yuhibbu linafsihi.',
    translation: '"None of you truly believes until he loves for his brother what he loves for himself."',
    reference: 'Sahih al-Bukhari',
  },
  {
    arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ',
    transliteration: 'Man kana yu\'minu billahi wal-yawmi al-akhiri falyakul khayran aw liyasmut.',
    translation: '"Whoever believes in Allah and the Last Day, let him speak good or remain silent."',
    reference: 'Sahih al-Bukhari',
  },
  {
    arabic: 'أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ',
    transliteration: 'Ahabbu al-a\'mali ila Allahi adwamuhā wa-in qalla.',
    translation: '"The most beloved of deeds to Allah are those that are most consistent, even if they are small."',
    reference: 'Sahih al-Bukhari',
  },
];

// =====================================================
// Helper Functions
// =====================================================

/**
 * Get daily content based on day of year
 * Ensures content changes daily but remains consistent throughout the day
 * @param {Date} [now]
 * @returns {import('../models/index.js').DailyContent}
 */
export function getDailyContent(now = new Date()) {
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  return {
    verse: MOCK_VERSES[dayOfYear % MOCK_VERSES.length],
    hadith: MOCK_HADITHS[dayOfYear % MOCK_HADITHS.length],
  };
}

/**
 * Build default frame definitions
 * @param {import('../models/index.js').Poster[]} posters
 * @param {import('../models/index.js').BoardConfig} config
 * @returns {import('../models/index.js').FrameDefinition[]}
 */
export function buildDefaultFrameDefinitions(posters, config) {
  /** @type {import('../models/index.js').FrameDefinition[]} */
  const frames = [
    { id: 'week-at-a-glance', type: FRAME_TYPES.WEEK_AT_GLANCE, duration: 'auto' },
    { id: 'today', type: FRAME_TYPES.TODAY, duration: 'auto' },
    { id: 'next-prayer', type: FRAME_TYPES.NEXT_PRAYER, duration: 12000 },
  ];

  // Add poster frames
  posters.forEach((poster) => {
    frames.push({
      id: `poster-${poster.id}`,
      type: FRAME_TYPES.POSTER,
      posterId: poster.id,
      duration: poster.duration || config.posterCycleInterval,
    });
  });

  // Add social media and quotes
  frames.push({
    id: 'social-media-promotion',
    type: FRAME_TYPES.SOCIAL_MEDIA_PROMOTION,
    instagramHandle: '@utmmsa',
    duration: 15000,
  });

  frames.push({
    id: 'quotes',
    type: FRAME_TYPES.QUOTES,
    duration: 20000,
  });

  return frames;
}

/**
 * Get the complete mock board payload
 * @returns {import('../models/index.js').BoardPayload}
 */
export function getMockBoardPayload() {
  const dailyContent = getDailyContent();
  const frames = buildDefaultFrameDefinitions(MOCK_POSTERS, MOCK_BOARD_CONFIG);

  return {
    boardConfig: MOCK_BOARD_CONFIG,
    events: MOCK_EVENTS,
    posters: MOCK_POSTERS,
    jummahPrayers: MOCK_JUMMAH_PRAYERS,
    frames,
    dailyContent,
    weather: null, // Weather will be fetched separately
  };
}

/**
 * Get mock weather data
 * @returns {import('../models/index.js').Weather}
 */
export function getMockWeather() {
  return {
    current: {
      temp: -5,
      icon: '❄️',
      condition: 'Snow',
      description: 'Light snow',
    },
    outlook: {
      hourly: [
        { timeLabel: '2:00 PM', temp: -5, icon: '❄️', isToday: true },
        { timeLabel: '3:00 PM', temp: -4, icon: '❄️', isToday: true },
        { timeLabel: '4:00 PM', temp: -4, icon: '☁️', isToday: true },
        { timeLabel: '5:00 PM', temp: -5, icon: '☁️', isToday: true },
      ],
      daily: [
        { label: 'Today', high: -3, low: -8, icon: '❄️' },
        { label: 'Tomorrow', high: -1, low: -6, icon: '☁️' },
        { label: '2026-01-05', high: 0, low: -4, icon: '🌧️' },
      ],
    },
  };
}
