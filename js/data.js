/* =====================================================
   UTM MSA Musallah Board - Mock Data Configuration
   =====================================================
   This file houses all configurable data and helpers for
   building the prototype payload that mirrors the future
   backend response shape.
   ===================================================== */

export const BOARD_CONFIG = {
  // Location Settings (for Aladhan API)
  location: {
    city: "Mississauga",
    country: "Canada",
    latitude: 43.589,
    longitude: -79.6441,
    timezone: "America/Toronto",
    method: 2, // ISNA (Islamic Society of North America)
  },

  // Jummah Prayer Settings
  // TODO: Connect to API in the future
  // Supports up to 3 Jummah prayers
  jummahPrayers: [
    {
      time: "12:30 PM",
      khatib: "Br. Zaed Ul Islam",
      location: "IB 110",
    },
    {
      time: "1:30 PM",
      khatib: "Sh. Hosam Helal",
      location: "IB 110",
    },
    {
      time: "2:30 PM",
      khatib: "Sh. Alaa El-Sayed",
      location: "DV 2080",
    },
  ],

  // Poster/Media Settings
  posterCycleInterval: 10000, // 10 seconds between posters

  // Auto-refresh Settings
  refreshAfterIshaMinutes: 15, // Refresh 15 minutes after Isha

  // Dark Mode Settings
  darkModeAfterIsha: true,
  darkModeMinutesAfterIsha: 30,

  // Scrolling Message (Bottom of RHS)
  enableScrollingMessage: false,
  scrollingMessage:
    "Assalamu Alaikum, welcome to the Brothers Musallah. Please rack your shoes. Jazakallah Khair! MusallahBoard v1.0b, powered by IbraSoft",
};

// =====================================================
// MOCK POSTERS - Replace with API data later
// duration: Time in milliseconds to display this poster
// =====================================================
export const POSTERS = [
  {
    id: 1,
    title: "A Prophetic Blueprint: Redefining Manhood",
    image: "images/mock/A_Prophetic_Blueprint_Redefining_Manhood_1.png",
    duration: 8000, // 8 seconds
    startDate: "2025-11-15",
    endDate: "2025-12-05",
    audience: "brothers",
  },
  {
    id: 2,
    title: "Brothers Fifa Tournament",
    image: "images/mock/fifa_brothers_events_2025_6.jpg",
    duration: 10000, // 10 seconds
    startDate: "2025-11-20",
    endDate: "2025-12-10",
    audience: "brothers",
  },
  {
    id: 3,
    title: "Reviving Islamic Spirit",
    image: "images/mock/RIS.png",
    duration: 12000, // 12 seconds
    startDate: "2025-11-25",
    endDate: "2025-12-20",
    audience: "both",
  },
  {
    id: 4,
    title: "Alumni Event",
    image: "images/mock/Alumni_Post.png",
    duration: 8000, // 8 seconds
    startDate: "2025-12-01",
    endDate: "2025-12-18",
    audience: "both",
  },
  {
    id: 5,
    title: "Navigating Stress & Overwhelming Pressure",
    image: "images/mock/Navigating_Stress__Overwhelming_Pressure.png",
    duration: 10000, // 10 seconds
    startDate: "2025-12-05",
    endDate: "2026-01-05",
    audience: "sisters",
  },
];

// =====================================================
// MOCK EVENTS - Replace with API data later
// =====================================================
export const EVENTS = [
  {
    id: 1,
    name: "A Prophetic Blueprint: Redefining Manhood",
    startTimestamp: new Date(2025, 11, 1, 17, 0).getTime(), // Dec 1, 2025 5:00 PM
    endTimestamp: new Date(2025, 11, 1, 19, 0).getTime(), // Dec 1, 2025 7:00 PM
    location: "TBA",
    description: "Islamic perspective on masculinity and character",
  },
  {
    id: 2,
    name: "Brothers Fifa Tournament",
    startTimestamp: new Date(2025, 11, 5, 18, 0).getTime(), // Dec 5, 2025 6:00 PM
    endTimestamp: new Date(2025, 11, 5, 20, 0).getTime(), // Dec 5, 2025 8:00 PM
    location: "TBA",
    description: "Brothers gaming tournament",
  },
  {
    id: 4,
    name: "Winter Break Study Sessions",
    startTimestamp: new Date(2025, 11, 18, 0, 0).getTime(), // Dec 18, 2025 12:00 AM
    endTimestamp: new Date(2025, 11, 22, 23, 59).getTime(), // Dec 22, 2025 11:59 PM
    allDay: true,
    location: "Musallah",
    description: "Study sessions during winter break",
  },
  {
    id: 6,
    name: "Study Break Social",
    startTimestamp: new Date(2025, 11, 15, 23, 0).getTime(), // Dec 15, 2025 11:00 PM
    endTimestamp: new Date(2025, 11, 15, 23, 59).getTime(), // Dec 15, 2025 11:59 PM
    location: "Student Centre",
    description: "Casual social to wrap up the conference",
  },
  {
    id: 7,
    name: "Exam Review Session",
    startTimestamp: new Date(2025, 11, 20, 10, 0).getTime(), // Dec 20, 2025 10:00 AM
    endTimestamp: new Date(2025, 11, 20, 12, 0).getTime(), // Dec 20, 2025 12:00 PM
    location: "IB 110",
    description: "Review session for exams during winter break",
  },
  {
    id: 8,
    name: "RIS Bazaar (All Day)",
    startTimestamp: new Date(2025, 11, 14, 0, 0).getTime(), // Dec 14, 2025 12:00 AM
    endTimestamp: new Date(2025, 11, 14, 23, 59).getTime(), // Dec 14, 2025 11:59 PM
    allDay: true,
    location: "Hall A",
    description: "Vendors and booths during RIS day 2",
  },
  {
    id: 9,
    name: "Relax & Reset (All Day)",
    startTimestamp: new Date(2025, 11, 19, 0, 0).getTime(), // Dec 19, 2025 12:00 AM
    endTimestamp: new Date(2025, 11, 19, 23, 59).getTime(), // Dec 19, 2025 11:59 PM
    allDay: true,
    location: "Musallah",
    description: "Quiet day in the musallah during break",
  },
  // Events for December 15, 2025 (today)
  {
    id: 10,
    name: "Dhuhr Prayer",
    startTimestamp: new Date(2025, 11, 15, 12, 30).getTime(), // Dec 15, 2025 12:30 PM
    endTimestamp: new Date(2025, 11, 15, 13, 0).getTime(), // Dec 15, 2025 1:00 PM
    location: "Main Hall",
    description: "Congregational prayer",
  },
  {
    id: 11,
    name: "Lunch & Learn: Islamic History",
    startTimestamp: new Date(2025, 11, 15, 13, 15).getTime(), // Dec 15, 2025 1:15 PM
    endTimestamp: new Date(2025, 11, 15, 14, 0).getTime(), // Dec 15, 2025 2:00 PM
    location: "Student Centre, Room 205",
    description: "Learn about the Rashidun Caliphate",
  },
  {
    id: 12,
    name: "Study Break Social",
    startTimestamp: new Date(2025, 11, 15, 16, 30).getTime(), // Dec 15, 2025 4:30 PM
    endTimestamp: new Date(2025, 11, 15, 17, 15).getTime(), // Dec 15, 2025 5:15 PM
    location: "Student Centre",
    description: "Casual social to wrap up the conference",
  },
  {
    id: 13,
    name: "Maghrib Prayer & Iftar",
    startTimestamp: new Date(2025, 11, 15, 18, 30).getTime(), // Dec 15, 2025 6:30 PM
    endTimestamp: new Date(2025, 11, 15, 19, 30).getTime(), // Dec 15, 2025 7:30 PM
    location: "Main Hall",
    description: "Prayer followed by dinner",
  },
  // Events for December 16, 2025
  {
    id: 15,
    name: "Morning Study Circle",
    startTimestamp: new Date(2025, 11, 17, 7, 30).getTime(), // Dec 16, 2025 7:30 AM
    endTimestamp: new Date(2025, 11, 17, 8, 30).getTime(), // Dec 16, 2025 8:30 AM
    location: "Musallah, Room 101",
    description: "Qur'an study session",
  },
  {
    id: 17,
    name: "Lunch & Learn: Hadith Discussion",
    startTimestamp: new Date(2025, 11, 17, 22, 0).getTime(), // Dec 16, 2025 1:15 PM
    endTimestamp: new Date(2025, 11, 17, 23, 0).getTime(), // Dec 16, 2025 2:00 PM
    location: "Student Centre, Room 205",
    description: "Discussion on contemporary hadith applications",
  },
  {
    id: 19,
    name: "Sisters' Halaqah",
    startTimestamp: new Date(2025, 11, 17, 22, 30).getTime(), // Dec 16, 2025 4:30 PM
    endTimestamp: new Date(2025, 11, 17, 23, 0).getTime(), // Dec 16, 2025 5:30 PM
    location: "Musallah, Women's Room",
    description: "Islamic knowledge circle for sisters",
  },
  {
    id: 21,
    name: "Dinner & Community",
    startTimestamp: new Date(2025, 11, 16, 19, 0).getTime(), // Dec 16, 2025 7:00 PM
    endTimestamp: new Date(2025, 11, 16, 20, 0).getTime(), // Dec 16, 2025 8:00 PM
    location: "Student Centre, Cafeteria",
    description: "Break fast together and socialize",
  },
  {
    id: 22,
    name: "Isha Prayer",
    startTimestamp: new Date(2025, 11, 16, 20, 30).getTime(), // Dec 16, 2025 8:30 PM
    endTimestamp: new Date(2025, 11, 16, 21, 0).getTime(), // Dec 16, 2025 9:00 PM
    location: "Main Hall",
    description: "Congregational prayer",
  },

    {
    id: 22,
    name: "Isha Prayer",
    startTimestamp: new Date(2025, 11, 20, 20, 30).getTime(), // Dec 16, 2025 8:30 PM
    endTimestamp: new Date(2025, 11, 20, 21, 0).getTime(), // Dec 16, 2025 9:00 PM
    location: "Main Hall",
    description: "Congregational prayer",
  },
];

// =====================================================
// MOCK ISLAMIC CONTENT - Replace with API data later
// =====================================================
export const VERSES_OF_DAY = [
  {
    arabic: "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
    transliteration: "Inna maʿa al-ʿusri yusra.",
    translation: '"Indeed, with hardship comes ease."',
    reference: "Surah Ash-Sharh (94:6)",
  },
  {
    arabic: "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ",
    transliteration: "Wa man yatawakkal ʿala Allahi fahuwa hasbuhu.",
    translation: '"And whoever relies upon Allah - then He is sufficient for him."',
    reference: "Surah At-Talaq (65:3)",
  },
  {
    arabic: "فَاذْكُرُونِي أَذْكُرْكُمْ",
    transliteration: "Fadhkuruni adhkurkum.",
    translation: '"So remember Me; I will remember you."',
    reference: "Surah Al-Baqarah (2:152)",
  },
  {
    arabic: "وَقُل رَّبِّ زِدْنِي عِلْمًا",
    transliteration: "Wa qul rabbi zidni ʿilman.",
    translation: "\"And say, 'My Lord, increase me in knowledge.'\"",
    reference: "Surah Ta-Ha (20:114)",
  },
  {
    arabic: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
    transliteration: "Inna Allaha maʿa as-sabireen.",
    translation: '"Indeed, Allah is with the patient."',
    reference: "Surah Al-Baqarah (2:153)",
  },
  {
    arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً",
    transliteration: "Rabbana atina fi d-dunya hasanatan wa fi l-akhirati hasanatan.",
    translation: '"Our Lord, give us good in this world and good in the Hereafter."',
    reference: "Surah Al-Baqarah (2:201)",
  },
  {
    arabic: "وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَى",
    transliteration: "Wa lasawfa yuʿṭīka rabbuka fa-tarḍā.",
    translation: '"And your Lord is going to give you, and you will be satisfied."',
    reference: "Surah Ad-Duha (93:5)",
  },
];


export const HADITHS_OF_DAY = [
  {
    arabic: "إِنَّ مِنْ خِيَارِكُمْ أَحَسَنَكُمْ أَخْلَاقًا",
    transliteration: "Inna min khiyarikum ahsankum akhlaqan.",
    translation: '"The best among you are those who have the best manners and character."',
    reference: "Sahih al-Bukhari",
  },
  {
    arabic: "وَبَشِّرُوا وَجْهَ أَخِيكَ الصَّالِحَ فَإِنَّهُ صَدَقَةٌ",
    transliteration: "Wa bashshiru wajh akhika as-salih fa-innahu sadaqah.",
    translation: '"Smiling in the face of your brother is charity."',
    reference: "Jami` at-Tirmidhi",
  },
  {
    arabic: "لَيْسَ الشَّدِيدُ بِالصَّرْعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ",
    transliteration: "Laysa ash-shadidu bis-sir'ati, innama ash-shadidu alladhi yamsiku nafsahu ʿinda al-ghadabi.",
    translation: '"The strong person is not the one who can wrestle someone else down. The strong person is the one who can control himself when he is angry."',
    reference: "Sahih al-Bukhari",
  },
  {
    arabic: "يَسِّرُوا وَلاَ تُعَسِّرُوا وَبَشِّرُوا وَلاَ تُنَفِّرُوا",
    transliteration: "Yassiru wa la tu'assiru wa bashshiru wa la tunaffiru.",
    translation: '"Make things easy and do not make them difficult, cheer people up and do not drive them away."',
    reference: "Sahih al-Bukhari",
  },
  {
    arabic: "لاَ يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ",
    transliteration: "La yu'minu ahadukum hatta yuhibba li-akhihi ma yuhibbu linafsihi.",
    translation: '"None of you truly believes until he loves for his brother what he loves for himself."',
    reference: "Sahih al-Bukhari",
  },
  {
    arabic: "مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ",
    transliteration: "Man kana yu'minu billahi wal-yawmi al-akhiri falyakul khayran aw liyasmut.",
    translation: '"Whoever believes in Allah and the Last Day, let him speak good or remain silent."',
    reference: "Sahih al-Bukhari",
  },
  {
    arabic: "أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ",
    transliteration: "Ahabbu al-a'mali ila Allahi adwamuhā wa-in qalla.",
    translation: '"The most beloved of deeds to Allah are those that are most consistent, even if they are small."',
    reference: "Sahih al-Bukhari",
  },
];


// =====================================================
// HELPER: Get content based on day of year
// This ensures content changes daily but is consistent throughout the day
// =====================================================
export function getDailyContent(now = new Date()) {
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  return {
    verse: VERSES_OF_DAY[dayOfYear % VERSES_OF_DAY.length],
    hadith: HADITHS_OF_DAY[dayOfYear % HADITHS_OF_DAY.length],
  };
}

/**
 * Build the default frame definitions in the order the backend is expected to send.
 * Week and Today frames use dynamic durations, posters use their own duration,
 * and quotes use a fixed read-time.
 */
export function buildDefaultFrameDefinitions(posters = POSTERS) {
  return [
    { id: "week-at-a-glance", type: "weekAtGlance", duration: "auto" },
    { id: "today", type: "today", duration: "auto" },
    { id: "next-prayer", type: "nextPrayer", duration: 12000 },
    ...posters.map((p) => ({
      id: `poster-${p.id}`,
      type: "poster",
      posterId: p.id,
      duration: p.duration || BOARD_CONFIG.posterCycleInterval,
    })),
    {
      id: "social-media-promotion",
      type: "socialMediaPromotion",
      instagramHandle: "@utmmsa",
      duration: 15000,
    },
    { id: "quotes", type: "quotes", duration: 20000 },
  ];
}

/**
 * Convenience helper for the prototype: returns a payload that mimics the future
 * backend response shape with board config, events, posters, and frame definitions.
 */
export function buildMockPayload() {
  return {
    boardConfig: BOARD_CONFIG,
    events: EVENTS,
    posters: POSTERS,
    frames: buildDefaultFrameDefinitions(POSTERS),
    dailyContent: getDailyContent(),
  };
}
