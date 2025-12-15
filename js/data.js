/* =====================================================
   UTM MSA Musallah Board - Mock Data Configuration
   =====================================================
   
   This file contains all configurable data for the board.
   Update this file to change events, posters, Jummah times, etc.
   
   In the future, this can be replaced with API calls.
   ===================================================== */

const BOARD_CONFIG = {
    // Location Settings (for Aladhan API)
    location: {
        city: 'Mississauga',
        country: 'Canada',
        latitude: 43.5890,
        longitude: -79.6441,
        timezone: 'America/Toronto',
        method: 2 // ISNA (Islamic Society of North America)
    },

    // Jummah Prayer Settings
    // TODO: Connect to API in the future
    // Supports up to 3 Jummah prayers
    jummahPrayers: [
        {
            time: '12:30 PM',
            khatib: 'Br. Zaed Ul Islam',
            location: 'IB 110'
        },
        {
            time: '1:30 PM',
            khatib: 'Sh. Hosam Helal',
            location: 'IB 110'
        },
        {
            time: '2:30 PM',
            khatib: 'Sh. Alaa El-Sayed',
            location: 'DV 2080'
        }
    ],

    // Poster/Media Settings
    posterCycleInterval: 10000, // 10 seconds between posters
    
    // Auto-refresh Settings
    refreshAfterIshaMinutes: 15, // Refresh 15 minutes after Isha

    // Dark Mode Settings
    darkModeAfterIsha: true,
    darkModeMinutesAfterIsha: 30
};

// =====================================================
// MOCK POSTERS - Replace with API data later
// =====================================================
const POSTERS = [
    {
        id: 1,
        title: 'A Prophetic Blueprint: Redefining Manhood',
        date: 'December 1st @ 5-7 PM',
        image: 'images/mock/A_Prophetic_Blueprint_Redefining_Manhood_1.png'
    },
    {
        id: 2,
        title: 'Brothers Fifa Tournament',
        date: 'December 5th @ 6-8 PM',
        image: 'images/mock/fifa_brothers_events_2025_6.jpg'
    },
    {
        id: 3,
        title: 'Reviving Islamic Spirit',
        date: 'December 15th @ 1-9 PM',
        image: 'images/mock/RIS.png'
    },
    {
        id: 4,
        title: 'Alumni Event',
        date: 'TBA',
        image: 'images/mock/Alumni_Post.png'
    },
    {
        id: 5,
        title: 'Navigating Stress & Overwhelming Pressure',
        date: 'TBA',
        image: 'images/mock/Navigating_Stress__Overwhelming_Pressure.png'
    }
];

// =====================================================
// MOCK EVENTS - Replace with API data later
// =====================================================
const EVENTS = [
    {
        id: 1,
        name: 'A Prophetic Blueprint: Redefining Manhood',
        date: new Date(2025, 11, 1), // Dec 1, 2025
        // For multi-day events, use startDate and endDate instead of date
        // startDate: new Date(2025, 11, 1),
        // endDate: new Date(2025, 11, 3),
        time: '5:00 - 7:00 PM',
        location: 'TBA',
        description: 'Islamic perspective on masculinity and character'
    },
    {
        id: 2,
        name: 'Brothers Fifa Tournament',
        date: new Date(2025, 11, 5), // Dec 5, 2025
        time: '6:00 - 8:00 PM',
        location: 'TBA',
        description: 'Brothers gaming tournament'
    },
    {
        id: 3,
        name: 'Reviving Islamic Spirit',
        // Multi-day event example: Dec 13-15, 2025
        startDate: new Date(2025, 11, 13),
        endDate: new Date(2025, 11, 15),
        time: '1:00 - 9:00 PM',
        location: 'TBA',
        description: 'Annual RIS Conference'
    },
    {
        id: 4,
        name: 'Winter Break Study Sessions',
        // Multi-day event: Dec 18-22, 2025
        startDate: new Date(2025, 11, 18),
        endDate: new Date(2025, 11, 22),
        time: 'All Day',
        location: 'Musallah',
        description: 'Study sessions during winter break'
    }
    ,
    // Single-day events added for visual testing overlapping multi-day events
    {
        id: 5,
        name: 'Community Iftar',
        date: new Date(2025, 11, 14), // Dec 14, 2025 falls within Reviving Islamic Spirit span
        time: '9:00 - 10:00 PM',
        location: 'Musallah',
        description: 'Community iftar during the conference'
    },
    {
        id: 5,
        name: 'Community Iftar',
        date: new Date(2025, 11, 14), // Dec 14, 2025 falls within Reviving Islamic Spirit span
        time: '6:00 - 8:00 PM',
        location: 'Musallah',
        description: 'Community iftar during the conference'
    },
    {
        id: 6,
        name: 'Study Break Social',
        date: new Date(2025, 11, 15), // Dec 15, 2025 last day of Reviving Islamic Spirit
        time: '3:00 - 4:00 PM',
        location: 'Student Centre',
        description: 'Casual social to wrap up the conference'
    },
    {
        id: 7,
        name: 'Exam Review Session',
        date: new Date(2025, 11, 20), // Dec 20, 2025 inside Winter Break Study Sessions
        time: '10:00 AM - 12:00 PM',
        location: 'IB 110',
        description: 'Review session for exams during winter break'
    },
    // Single-day all-day examples
    {
        id: 8,
        name: 'RIS Bazaar (All Day)',
        date: new Date(2025, 11, 14),
        allDay: true,
        location: 'Hall A',
        description: 'Vendors and booths during RIS day 2'
    },
    {
        id: 9,
        name: 'Relax & Reset (All Day)',
        date: new Date(2025, 11, 19),
        allDay: true,
        location: 'Musallah',
        description: 'Quiet day in the musallah during break'
    }
];

// =====================================================
// MOCK ISLAMIC CONTENT - Replace with API data later
// =====================================================
const VERSES_OF_DAY = [
    {
        arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا',
        translation: '"Indeed, with hardship comes ease."',
        reference: 'Surah Ash-Sharh (94:6)'
    },
    {
        arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ',
        translation: '"And whoever relies upon Allah - then He is sufficient for him."',
        reference: 'Surah At-Talaq (65:3)'
    },
    {
        arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ',
        translation: '"So remember Me; I will remember you."',
        reference: 'Surah Al-Baqarah (2:152)'
    },
    {
        arabic: 'وَقُل رَّبِّ زِدْنِي عِلْمًا',
        translation: '"And say, \'My Lord, increase me in knowledge.\'"',
        reference: 'Surah Ta-Ha (20:114)'
    },
    {
        arabic: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ',
        translation: '"Indeed, Allah is with the patient."',
        reference: 'Surah Al-Baqarah (2:153)'
    },
    {
        arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً',
        translation: '"Our Lord, give us good in this world and good in the Hereafter."',
        reference: 'Surah Al-Baqarah (2:201)'
    },
    {
        arabic: 'وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ',
        translation: '"And your Lord is going to give you, and you will be satisfied."',
        reference: 'Surah Ad-Duha (93:5)'
    }
];

const HADITHS_OF_DAY = [
    {
        text: '"The best among you are those who have the best manners and character."',
        reference: 'Sahih al-Bukhari'
    },
    {
        text: '"Smiling in the face of your brother is charity."',
        reference: 'Jami` at-Tirmidhi'
    },
    {
        text: '"The strong person is not the one who can wrestle someone else down. The strong person is the one who can control himself when he is angry."',
        reference: 'Sahih al-Bukhari'
    },
    {
        text: '"Make things easy and do not make them difficult, cheer people up and do not drive them away."',
        reference: 'Sahih al-Bukhari'
    },
    {
        text: '"None of you truly believes until he loves for his brother what he loves for himself."',
        reference: 'Sahih al-Bukhari'
    },
    {
        text: '"Whoever believes in Allah and the Last Day, let him speak good or remain silent."',
        reference: 'Sahih al-Bukhari'
    },
    {
        text: '"The most beloved of deeds to Allah are those that are most consistent, even if they are small."',
        reference: 'Sahih al-Bukhari'
    }
];

// =====================================================
// HELPER: Get content based on day of year
// This ensures content changes daily but is consistent throughout the day
// =====================================================
function getDailyContent() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    return {
        verse: VERSES_OF_DAY[dayOfYear % VERSES_OF_DAY.length],
        hadith: HADITHS_OF_DAY[dayOfYear % HADITHS_OF_DAY.length]
    };
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BOARD_CONFIG, POSTERS, EVENTS, VERSES_OF_DAY, HADITHS_OF_DAY, getDailyContent };
}
