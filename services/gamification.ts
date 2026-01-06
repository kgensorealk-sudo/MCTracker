import { Achievement, Manuscript, Status, Quest, UserLevel } from '../types';

// --- Constants ---
const XP_PER_FILE = 25;
const XP_PER_ACHIEVEMENT_TIER = {
  BRONZE: 150,
  SILVER: 300,
  GOLD: 600,
  PLATINUM: 1000
};

// --- Helper Functions ---
const isToday = (dateString?: string) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  const now = new Date();
  return date.getDate() === now.getDate() &&
         date.getMonth() === now.getMonth() &&
         date.getFullYear() === now.getFullYear();
};

const getLocalDateKey = (dateString?: string) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  // Returns YYYY-M-D key based on local time to group daily work correctly
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const getMaxDailyCount = (mss: Manuscript[]) => {
    const counts: Record<string, number> = {};
    mss.forEach(m => {
        if (m.status === Status.WORKED) {
            const rawDate = m.completedDate || m.dateStatusChanged;
            const key = getLocalDateKey(rawDate);
            if (key) counts[key] = (counts[key] || 0) + 1;
        }
    });
    return Math.max(0, ...Object.values(counts));
};

const getUniqueJournals = (mss: Manuscript[]) => {
    return new Set(mss.filter(m => m.journalCode).map(m => m.journalCode)).size;
};

// --- Historical Daily Quest Calculator ---
// This ensures XP is kept for previous days' accomplishments
const calculateHistoricalDailyXP = (mss: Manuscript[]) => {
    const workedCounts: Record<string, number> = {};
    const queryCounts: Record<string, number> = {};

    mss.forEach(m => {
        // 1. Worked Counts Grouped by Day
        if (m.status === Status.WORKED) {
             const rawDate = m.completedDate || m.dateStatusChanged;
             const key = getLocalDateKey(rawDate);
             if (key) {
                 workedCounts[key] = (workedCounts[key] || 0) + 1;
             }
        }

        // 2. Query Counts Grouped by Day
        // Check dateQueried first (persistent), then status change if pending
        let queryKey: string | null = null;
        
        if (m.dateQueried) {
            queryKey = getLocalDateKey(m.dateQueried);
        } else if ([Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)) {
            queryKey = getLocalDateKey(m.dateStatusChanged || m.dateUpdated);
        }

        if (queryKey) {
            queryCounts[queryKey] = (queryCounts[queryKey] || 0) + 1;
        }
    });

    let xp = 0;

    // Sum Worked XP for every eligible day in history
    Object.values(workedCounts).forEach(count => {
        if (count >= 5) xp += 100; // Reward for 'Daily Grind'
        if (count >= 15) xp += 300; // Reward for 'High Volume' (Stacks)
    });

    // Sum Query XP for every eligible day in history
    Object.values(queryCounts).forEach(count => {
        if (count >= 2) xp += 150; // Reward for 'Query Crusher'
    });

    return xp;
};

// --- Daily Quests (For UI Display Only) ---
// These are used to show "Today's Progress", but XP calculation now uses the historical function above.
export const DAILY_QUESTS: Quest[] = [
  {
    id: 'daily_grind',
    title: 'Daily Grind',
    description: 'Complete 5 manuscripts today.',
    target: 5,
    rewardXP: 100,
    progress: (mss) => mss.filter(m => m.status === Status.WORKED && isToday(m.completedDate || m.dateStatusChanged)).length,
    isCompleted: (mss) => mss.filter(m => m.status === Status.WORKED && isToday(m.completedDate || m.dateStatusChanged)).length >= 5
  },
  {
    id: 'query_crusher',
    title: 'Query Crusher',
    description: 'Process 2 Pending items (JM/TL/CED) today.',
    target: 2,
    rewardXP: 150,
    // Updated logic to count queries even if they were resolved later today (using dateQueried)
    progress: (mss) => mss.filter(m => {
        if (m.dateQueried && isToday(m.dateQueried)) return true;
        if ([Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status) && isToday(m.dateStatusChanged)) return true;
        return false;
    }).length,
    isCompleted: (mss) => mss.filter(m => {
        if (m.dateQueried && isToday(m.dateQueried)) return true;
        if ([Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status) && isToday(m.dateStatusChanged)) return true;
        return false;
    }).length >= 2
  },
  {
    id: 'power_hour',
    title: 'High Volume',
    description: 'Complete 15 manuscripts today.',
    target: 15,
    rewardXP: 300,
    progress: (mss) => mss.filter(m => m.status === Status.WORKED && isToday(m.completedDate || m.dateStatusChanged)).length,
    isCompleted: (mss) => mss.filter(m => m.status === Status.WORKED && isToday(m.completedDate || m.dateStatusChanged)).length >= 15
  }
];

// --- Achievements ---
export const ACHIEVEMENTS: Achievement[] = [
  // --- EXISTING & BASE MILESTONES ---
  {
    id: 'first_blood',
    title: 'First Output',
    description: 'Complete your very first manuscript.',
    icon: 'Zap',
    tier: 'BRONZE',
    xpReward: XP_PER_ACHIEVEMENT_TIER.BRONZE,
    maxProgressValue: 1,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.WORKED).length,
    condition: (mss) => mss.some(m => m.status === Status.WORKED),
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.WORKED).length / 1) * 100)
  },
  {
    id: 'novice',
    title: 'Novice Analyst',
    description: 'Complete 5 manuscripts total.',
    icon: 'Zap',
    tier: 'BRONZE',
    xpReward: XP_PER_ACHIEVEMENT_TIER.BRONZE,
    maxProgressValue: 5,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.WORKED).length,
    condition: (mss) => mss.filter(m => m.status === Status.WORKED).length >= 5,
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.WORKED).length / 5) * 100)
  },
  {
    id: 'getting_started',
    title: 'Getting Started',
    description: 'Complete 25 manuscripts total.',
    icon: 'Zap',
    tier: 'BRONZE',
    xpReward: XP_PER_ACHIEVEMENT_TIER.BRONZE,
    maxProgressValue: 25,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.WORKED).length,
    condition: (mss) => mss.filter(m => m.status === Status.WORKED).length >= 25,
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.WORKED).length / 25) * 100)
  },
  {
    id: 'warming_up',
    title: 'Warming Up',
    description: 'Complete 50 manuscripts total.',
    icon: 'Flame',
    tier: 'BRONZE',
    xpReward: XP_PER_ACHIEVEMENT_TIER.BRONZE,
    maxProgressValue: 50,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.WORKED).length,
    condition: (mss) => mss.filter(m => m.status === Status.WORKED).length >= 50,
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.WORKED).length / 50) * 100)
  },
  {
    id: 'century_club',
    title: 'Century Club',
    description: 'Complete 100 manuscripts total.',
    icon: 'Flame',
    tier: 'SILVER',
    xpReward: XP_PER_ACHIEVEMENT_TIER.SILVER,
    maxProgressValue: 100,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.WORKED).length,
    condition: (mss) => mss.filter(m => m.status === Status.WORKED).length >= 100,
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.WORKED).length / 100) * 100)
  },
  {
    id: 'analyst_pro',
    title: 'Analyst Pro',
    description: 'Complete 250 manuscripts total.',
    icon: 'Star',
    tier: 'SILVER',
    xpReward: XP_PER_ACHIEVEMENT_TIER.SILVER,
    maxProgressValue: 250,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.WORKED).length,
    condition: (mss) => mss.filter(m => m.status === Status.WORKED).length >= 250,
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.WORKED).length / 250) * 100)
  },
  {
    id: 'half_k',
    title: 'Half-K',
    description: 'Complete 500 manuscripts total.',
    icon: 'Star',
    tier: 'GOLD',
    xpReward: XP_PER_ACHIEVEMENT_TIER.GOLD,
    maxProgressValue: 500,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.WORKED).length,
    condition: (mss) => mss.filter(m => m.status === Status.WORKED).length >= 500,
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.WORKED).length / 500) * 100)
  },
  {
    id: 'master_analyst',
    title: 'Master Analyst',
    description: 'Complete 1000 manuscripts total.',
    icon: 'Trophy',
    tier: 'GOLD',
    xpReward: XP_PER_ACHIEVEMENT_TIER.GOLD,
    maxProgressValue: 1000,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.WORKED).length,
    condition: (mss) => mss.filter(m => m.status === Status.WORKED).length >= 1000,
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.WORKED).length / 1000) * 100)
  },
  {
    id: 'kilo_plus',
    title: 'Veteran',
    description: 'Complete 1500 manuscripts total.',
    icon: 'Trophy',
    tier: 'GOLD',
    xpReward: XP_PER_ACHIEVEMENT_TIER.GOLD,
    maxProgressValue: 1500,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.WORKED).length,
    condition: (mss) => mss.filter(m => m.status === Status.WORKED).length >= 1500,
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.WORKED).length / 1500) * 100)
  },
  {
    id: 'two_grand',
    title: 'Two Grand',
    description: 'Complete 2000 manuscripts total.',
    icon: 'Trophy',
    tier: 'PLATINUM',
    xpReward: XP_PER_ACHIEVEMENT_TIER.PLATINUM,
    maxProgressValue: 2000,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.WORKED).length,
    condition: (mss) => mss.filter(m => m.status === Status.WORKED).length >= 2000,
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.WORKED).length / 2000) * 100)
  },
  {
    id: 'five_k',
    title: 'High Five',
    description: 'Complete 5000 manuscripts total.',
    icon: 'Trophy',
    tier: 'PLATINUM',
    xpReward: XP_PER_ACHIEVEMENT_TIER.PLATINUM,
    maxProgressValue: 5000,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.WORKED).length,
    condition: (mss) => mss.filter(m => m.status === Status.WORKED).length >= 5000,
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.WORKED).length / 5000) * 100)
  },

  // --- DAILY PRODUCTIVITY (SPEED) ---
  {
    id: 'daily_momentum',
    title: 'Building Momentum',
    description: 'Complete 5 manuscripts in a single day.',
    icon: 'Zap',
    tier: 'BRONZE',
    xpReward: XP_PER_ACHIEVEMENT_TIER.BRONZE,
    maxProgressValue: 5,
    currentProgressValue: (mss) => getMaxDailyCount(mss),
    condition: (mss) => getMaxDailyCount(mss) >= 5,
    progress: (mss) => Math.min(100, (getMaxDailyCount(mss) / 5) * 100)
  },
  {
    id: 'daily_fire',
    title: 'On Fire',
    description: 'Complete 10 manuscripts in a single day.',
    icon: 'Flame',
    tier: 'BRONZE',
    xpReward: XP_PER_ACHIEVEMENT_TIER.BRONZE,
    maxProgressValue: 10,
    currentProgressValue: (mss) => getMaxDailyCount(mss),
    condition: (mss) => getMaxDailyCount(mss) >= 10,
    progress: (mss) => Math.min(100, (getMaxDailyCount(mss) / 10) * 100)
  },
  {
    id: 'daily_blazing',
    title: 'Blazing Fast',
    description: 'Complete 20 manuscripts in a single day.',
    icon: 'Flame',
    tier: 'SILVER',
    xpReward: XP_PER_ACHIEVEMENT_TIER.SILVER,
    maxProgressValue: 20,
    currentProgressValue: (mss) => getMaxDailyCount(mss),
    condition: (mss) => getMaxDailyCount(mss) >= 20,
    progress: (mss) => Math.min(100, (getMaxDailyCount(mss) / 20) * 100)
  },
  {
    id: 'daily_unstoppable',
    title: 'Unstoppable',
    description: 'Complete 30 manuscripts in a single day.',
    icon: 'Zap',
    tier: 'GOLD',
    xpReward: XP_PER_ACHIEVEMENT_TIER.GOLD,
    maxProgressValue: 30,
    currentProgressValue: (mss) => getMaxDailyCount(mss),
    condition: (mss) => getMaxDailyCount(mss) >= 30,
    progress: (mss) => Math.min(100, (getMaxDailyCount(mss) / 30) * 100)
  },
  {
    id: 'daily_godlike',
    title: 'Godlike Productivity',
    description: 'Complete 50 manuscripts in a single day.',
    icon: 'Zap',
    tier: 'PLATINUM',
    xpReward: XP_PER_ACHIEVEMENT_TIER.PLATINUM,
    maxProgressValue: 50,
    currentProgressValue: (mss) => getMaxDailyCount(mss),
    condition: (mss) => getMaxDailyCount(mss) >= 50,
    progress: (mss) => Math.min(100, (getMaxDailyCount(mss) / 50) * 100)
  },

  // --- QUALITY (Straight Through) ---
  {
    id: 'quality_careful',
    title: 'Smooth Operator',
    description: 'Complete 10 manuscripts without raising any queries.',
    icon: 'CheckCheck',
    tier: 'BRONZE',
    xpReward: XP_PER_ACHIEVEMENT_TIER.BRONZE,
    maxProgressValue: 10,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.WORKED && !m.queryReason).length,
    condition: (mss) => mss.filter(m => m.status === Status.WORKED && !m.queryReason).length >= 10,
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.WORKED && !m.queryReason).length / 10) * 100)
  },
  {
    id: 'quality_meticulous',
    title: 'Meticulous',
    description: 'Complete 50 manuscripts without raising any queries.',
    icon: 'CheckCheck',
    tier: 'SILVER',
    xpReward: XP_PER_ACHIEVEMENT_TIER.SILVER,
    maxProgressValue: 50,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.WORKED && !m.queryReason).length,
    condition: (mss) => mss.filter(m => m.status === Status.WORKED && !m.queryReason).length >= 50,
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.WORKED && !m.queryReason).length / 50) * 100)
  },
  {
    id: 'quality_pristine',
    title: 'Pristine Record',
    description: 'Complete 100 manuscripts without raising any queries.',
    icon: 'CheckCheck',
    tier: 'GOLD',
    xpReward: XP_PER_ACHIEVEMENT_TIER.GOLD,
    maxProgressValue: 100,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.WORKED && !m.queryReason).length,
    condition: (mss) => mss.filter(m => m.status === Status.WORKED && !m.queryReason).length >= 100,
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.WORKED && !m.queryReason).length / 100) * 100)
  },

  // --- QUERIES & PENDING ---
  {
    id: 'query_asker',
    title: 'The Asker',
    description: 'Raise 10 queries total.',
    icon: 'Search',
    tier: 'BRONZE',
    xpReward: XP_PER_ACHIEVEMENT_TIER.BRONZE,
    maxProgressValue: 10,
    currentProgressValue: (mss) => mss.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length,
    condition: (mss) => mss.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length >= 10,
    progress: (mss) => Math.min(100, (mss.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length / 10) * 100)
  },
  {
    id: 'query_master',
    title: 'Query Master',
    description: 'Raise 100 queries total.',
    icon: 'Search',
    tier: 'SILVER',
    xpReward: XP_PER_ACHIEVEMENT_TIER.SILVER,
    maxProgressValue: 100,
    currentProgressValue: (mss) => mss.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length,
    condition: (mss) => mss.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length >= 100,
    progress: (mss) => Math.min(100, (mss.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length / 100) * 100)
  },
  {
    id: 'query_interrogator',
    title: 'The Interrogator',
    description: 'Raise 500 queries total.',
    icon: 'Search',
    tier: 'GOLD',
    xpReward: XP_PER_ACHIEVEMENT_TIER.GOLD,
    maxProgressValue: 500,
    currentProgressValue: (mss) => mss.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length,
    condition: (mss) => mss.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length >= 500,
    progress: (mss) => Math.min(100, (mss.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length / 500) * 100)
  },
  {
    id: 'query_messenger',
    title: 'The Messenger',
    description: 'Send 25 JM Queries.',
    icon: 'Search',
    tier: 'SILVER',
    xpReward: XP_PER_ACHIEVEMENT_TIER.SILVER,
    maxProgressValue: 25,
    currentProgressValue: (mss) => mss.filter(m => m.status === Status.PENDING_JM).length,
    condition: (mss) => mss.filter(m => m.status === Status.PENDING_JM).length >= 25,
    progress: (mss) => Math.min(100, (mss.filter(m => m.status === Status.PENDING_JM).length / 25) * 100)
  },

  // --- PRIORITIES ---
  {
    id: 'priority_responder',
    title: 'First Responder',
    description: 'Complete 10 Urgent manuscripts.',
    icon: 'Zap',
    tier: 'BRONZE',
    xpReward: XP_PER_ACHIEVEMENT_TIER.BRONZE,
    maxProgressValue: 10,
    currentProgressValue: (mss) => mss.filter(m => m.priority === 'Urgent' && m.status === Status.WORKED).length,
    condition: (mss) => mss.filter(m => m.priority === 'Urgent' && m.status === Status.WORKED).length >= 10,
    progress: (mss) => Math.min(100, (mss.filter(m => m.priority === 'Urgent' && m.status === Status.WORKED).length / 10) * 100)
  },
  {
    id: 'priority_paramedic',
    title: 'Paramedic',
    description: 'Complete 50 Urgent manuscripts.',
    icon: 'Zap',
    tier: 'SILVER',
    xpReward: XP_PER_ACHIEVEMENT_TIER.SILVER,
    maxProgressValue: 50,
    currentProgressValue: (mss) => mss.filter(m => m.priority === 'Urgent' && m.status === Status.WORKED).length,
    condition: (mss) => mss.filter(m => m.priority === 'Urgent' && m.status === Status.WORKED).length >= 50,
    progress: (mss) => Math.min(100, (mss.filter(m => m.priority === 'Urgent' && m.status === Status.WORKED).length / 50) * 100)
  },
  {
    id: 'priority_hero',
    title: 'Hero',
    description: 'Complete 100 Urgent manuscripts.',
    icon: 'Zap',
    tier: 'GOLD',
    xpReward: XP_PER_ACHIEVEMENT_TIER.GOLD,
    maxProgressValue: 100,
    currentProgressValue: (mss) => mss.filter(m => m.priority === 'Urgent' && m.status === Status.WORKED).length,
    condition: (mss) => mss.filter(m => m.priority === 'Urgent' && m.status === Status.WORKED).length >= 100,
    progress: (mss) => Math.min(100, (mss.filter(m => m.priority === 'Urgent' && m.status === Status.WORKED).length / 100) * 100)
  },

  // --- JOURNAL VARIETY ---
  {
    id: 'journal_explorer',
    title: 'Journal Explorer',
    description: 'Work on 3 different journals.',
    icon: 'Search',
    tier: 'BRONZE',
    xpReward: XP_PER_ACHIEVEMENT_TIER.BRONZE,
    maxProgressValue: 3,
    currentProgressValue: (mss) => getUniqueJournals(mss),
    condition: (mss) => getUniqueJournals(mss) >= 3,
    progress: (mss) => Math.min(100, (getUniqueJournals(mss) / 3) * 100)
  },
  {
    id: 'journal_traveler',
    title: 'Traveler',
    description: 'Work on 5 different journals.',
    icon: 'Search',
    tier: 'BRONZE',
    xpReward: XP_PER_ACHIEVEMENT_TIER.BRONZE,
    maxProgressValue: 5,
    currentProgressValue: (mss) => getUniqueJournals(mss),
    condition: (mss) => getUniqueJournals(mss) >= 5,
    progress: (mss) => Math.min(100, (getUniqueJournals(mss) / 5) * 100)
  },
  {
    id: 'journal_voyager',
    title: 'Voyager',
    description: 'Work on 10 different journals.',
    icon: 'Search',
    tier: 'SILVER',
    xpReward: XP_PER_ACHIEVEMENT_TIER.SILVER,
    maxProgressValue: 10,
    currentProgressValue: (mss) => getUniqueJournals(mss),
    condition: (mss) => getUniqueJournals(mss) >= 10,
    progress: (mss) => Math.min(100, (getUniqueJournals(mss) / 10) * 100)
  },
  {
    id: 'journal_globetrotter',
    title: 'Globetrotter',
    description: 'Work on 20 different journals.',
    icon: 'Search',
    tier: 'GOLD',
    xpReward: XP_PER_ACHIEVEMENT_TIER.GOLD,
    maxProgressValue: 20,
    currentProgressValue: (mss) => getUniqueJournals(mss),
    condition: (mss) => getUniqueJournals(mss) >= 20,
    progress: (mss) => Math.min(100, (getUniqueJournals(mss) / 20) * 100)
  },

  // --- TIME & HABITS ---
  {
    id: 'time_earlybird',
    title: 'Early Bird',
    description: 'Complete a manuscript before 8 AM.',
    icon: 'Moon',
    tier: 'BRONZE',
    xpReward: XP_PER_ACHIEVEMENT_TIER.BRONZE,
    maxProgressValue: 1,
    currentProgressValue: (mss) => mss.some(m => m.status === Status.WORKED && new Date(m.completedDate || '').getHours() < 8) ? 1 : 0,
    condition: (mss) => mss.some(m => m.status === Status.WORKED && new Date(m.completedDate || '').getHours() < 8),
    progress: (mss) => mss.some(m => m.status === Status.WORKED && new Date(m.completedDate || '').getHours() < 8) ? 100 : 0
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Complete a manuscript between 8 PM and 4 AM.',
    icon: 'Moon',
    tier: 'SILVER',
    xpReward: XP_PER_ACHIEVEMENT_TIER.SILVER,
    maxProgressValue: 1,
    currentProgressValue: (mss) => {
        return mss.some(m => {
            if (m.status !== Status.WORKED) return false;
            const d = new Date(m.completedDate || m.dateStatusChanged || '');
            const h = d.getHours();
            return h >= 20 || h <= 4;
        }) ? 1 : 0;
    },
    condition: (mss) => mss.some(m => {
        if (m.status !== Status.WORKED) return false;
        const d = new Date(m.completedDate || m.dateStatusChanged || '');
        const h = d.getHours();
        return h >= 20 || h <= 4;
    }),
    progress: (mss) => mss.some(m => {
        if (m.status !== Status.WORKED) return false;
        const d = new Date(m.completedDate || m.dateStatusChanged || '');
        const h = d.getHours();
        return h >= 20 || h <= 4;
    }) ? 100 : 0
  },
  {
    id: 'time_weekend',
    title: 'Weekend Warrior',
    description: 'Complete a manuscript on a Saturday or Sunday.',
    icon: 'Moon',
    tier: 'SILVER',
    xpReward: XP_PER_ACHIEVEMENT_TIER.SILVER,
    maxProgressValue: 1,
    currentProgressValue: (mss) => mss.some(m => {
       const d = new Date(m.completedDate || '');
       return m.status === Status.WORKED && (d.getDay() === 0 || d.getDay() === 6);
    }) ? 1 : 0,
    condition: (mss) => mss.some(m => {
       const d = new Date(m.completedDate || '');
       return m.status === Status.WORKED && (d.getDay() === 0 || d.getDay() === 6);
    }),
    progress: (mss) => mss.some(m => {
       const d = new Date(m.completedDate || '');
       return m.status === Status.WORKED && (d.getDay() === 0 || d.getDay() === 6);
    }) ? 100 : 0
  },

  // --- TARGETS ---
  {
    id: 'cycle_crusher',
    title: 'Cycle Crusher',
    description: 'Reach 100% of your productivity target for the current cycle.',
    icon: 'Target',
    tier: 'GOLD',
    xpReward: XP_PER_ACHIEVEMENT_TIER.GOLD,
    maxProgressValue: 100,
    currentProgressValue: (mss, target) => {
       const now = new Date();
       const day = now.getDate();
       const month = now.getMonth();
       const year = now.getFullYear();
       let startDate: Date;
       let endDate: Date;

        if (day >= 11 && day <= 25) {
            startDate = new Date(year, month, 11);
            endDate = new Date(year, month, 25);
        } else {
            if (day >= 26) {
                startDate = new Date(year, month, 26);
                endDate = new Date(year, month + 1, 10);
            } else {
                startDate = new Date(year, month - 1, 26);
                endDate = new Date(year, month, 10);
            }
        }
        endDate.setHours(23, 59, 59, 999);
        startDate.setHours(0, 0, 0, 0);

        const completedInCycle = mss.filter(m => {
            if (m.status !== Status.WORKED) return false;
            const dateStr = m.completedDate || m.dateStatusChanged || m.dateUpdated;
            const date = new Date(dateStr); 
            return date >= startDate && date <= endDate;
        }).length;
        
        return Math.min(100, Math.floor((completedInCycle / target) * 100));
    },
    condition: (mss, target) => {
       const now = new Date();
       const day = now.getDate();
       const month = now.getMonth();
       const year = now.getFullYear();
       let startDate: Date;
       let endDate: Date;

        if (day >= 11 && day <= 25) {
            startDate = new Date(year, month, 11);
            endDate = new Date(year, month, 25);
        } else {
            if (day >= 26) {
                startDate = new Date(year, month, 26);
                endDate = new Date(year, month + 1, 10);
            } else {
                startDate = new Date(year, month - 1, 26);
                endDate = new Date(year, month, 10);
            }
        }
        endDate.setHours(23, 59, 59, 999);
        startDate.setHours(0, 0, 0, 0);

        const completedInCycle = mss.filter(m => {
            if (m.status !== Status.WORKED) return false;
            const dateStr = m.completedDate || m.dateStatusChanged || m.dateUpdated;
            const date = new Date(dateStr); 
            return date >= startDate && date <= endDate;
        }).length;

        return completedInCycle >= target;
    },
    progress: (mss, target) => {
       const now = new Date();
       const day = now.getDate();
       const month = now.getMonth();
       const year = now.getFullYear();
       let startDate: Date;
       let endDate: Date;

        if (day >= 11 && day <= 25) {
            startDate = new Date(year, month, 11);
            endDate = new Date(year, month, 25);
        } else {
            if (day >= 26) {
                startDate = new Date(year, month, 26);
                endDate = new Date(year, month + 1, 10);
            } else {
                startDate = new Date(year, month - 1, 26);
                endDate = new Date(year, month, 10);
            }
        }
        endDate.setHours(23, 59, 59, 999);
        startDate.setHours(0, 0, 0, 0);

        const completedInCycle = mss.filter(m => {
            if (m.status !== Status.WORKED) return false;
            const dateStr = m.completedDate || m.dateStatusChanged || m.dateUpdated;
            const date = new Date(dateStr); 
            return date >= startDate && date <= endDate;
        }).length;

        return Math.min(100, (completedInCycle / target) * 100);
    }
  },
  {
    id: 'cycle_overachiever',
    title: 'Overachiever',
    description: 'Reach 150% of your productivity target for the current cycle.',
    icon: 'Target',
    tier: 'PLATINUM',
    xpReward: XP_PER_ACHIEVEMENT_TIER.PLATINUM,
    maxProgressValue: 150,
    currentProgressValue: (mss, target) => {
       // Re-using simplified cycle logic
       const now = new Date();
       const day = now.getDate();
       const month = now.getMonth();
       const year = now.getFullYear();
       let startDate: Date, endDate: Date;
        if (day >= 11 && day <= 25) {
            startDate = new Date(year, month, 11);
            endDate = new Date(year, month, 25);
        } else {
            if (day >= 26) { startDate = new Date(year, month, 26); endDate = new Date(year, month + 1, 10); } 
            else { startDate = new Date(year, month - 1, 26); endDate = new Date(year, month, 10); }
        }
        endDate.setHours(23, 59, 59, 999); startDate.setHours(0, 0, 0, 0);
        const completedInCycle = mss.filter(m => {
            if (m.status !== Status.WORKED) return false;
            const d = new Date(m.completedDate || m.dateStatusChanged || m.dateUpdated); 
            return d >= startDate && d <= endDate;
        }).length;
        return Math.min(150, Math.floor((completedInCycle / target) * 100));
    },
    condition: (mss, target) => {
       // Cycle logic (simplified for checking)
       const now = new Date();
       const day = now.getDate();
       const month = now.getMonth();
       const year = now.getFullYear();
       let startDate: Date, endDate: Date;
        if (day >= 11 && day <= 25) { startDate = new Date(year, month, 11); endDate = new Date(year, month, 25); } 
        else {
            if (day >= 26) { startDate = new Date(year, month, 26); endDate = new Date(year, month + 1, 10); } 
            else { startDate = new Date(year, month - 1, 26); endDate = new Date(year, month, 10); }
        }
        endDate.setHours(23, 59, 59, 999); startDate.setHours(0, 0, 0, 0);
        const completedInCycle = mss.filter(m => {
            if (m.status !== Status.WORKED) return false;
            const d = new Date(m.completedDate || m.dateStatusChanged || m.dateUpdated); 
            return d >= startDate && d <= endDate;
        }).length;
        return completedInCycle >= (target * 1.5);
    },
    progress: (mss, target) => {
        // Reuse for simplicity
        const now = new Date();
        const day = now.getDate();
        const month = now.getMonth();
        const year = now.getFullYear();
        let startDate: Date, endDate: Date;
         if (day >= 11 && day <= 25) { startDate = new Date(year, month, 11); endDate = new Date(year, month, 25); } 
         else {
             if (day >= 26) { startDate = new Date(year, month, 26); endDate = new Date(year, month + 1, 10); } 
             else { startDate = new Date(year, month - 1, 26); endDate = new Date(year, month, 10); }
         }
         endDate.setHours(23, 59, 59, 999); startDate.setHours(0, 0, 0, 0);
         const completedInCycle = mss.filter(m => {
             if (m.status !== Status.WORKED) return false;
             const d = new Date(m.completedDate || m.dateStatusChanged || m.dateUpdated); 
             return d >= startDate && d <= endDate;
         }).length;
        return Math.min(100, (completedInCycle / (target * 1.5)) * 100);
    }
  },

  // --- MISC ---
  {
    id: 'clean_slate',
    title: 'Clean Slate',
    description: 'Clear all "Untouched" files from your queue.',
    icon: 'CheckCheck',
    tier: 'PLATINUM',
    xpReward: XP_PER_ACHIEVEMENT_TIER.PLATINUM,
    maxProgressValue: 1, 
    currentProgressValue: (mss) => {
        const total = mss.length;
        const untouched = mss.filter(m => m.status === Status.UNTOUCHED).length;
        return total > 0 && untouched === 0 ? 1 : 0;
    },
    condition: (mss) => mss.length > 0 && mss.filter(m => m.status === Status.UNTOUCHED).length === 0,
    progress: (mss) => {
        const total = mss.length;
        if (total === 0) return 0;
        const untouched = mss.filter(m => m.status === Status.UNTOUCHED).length;
        return untouched === 0 ? 100 : Math.round(((total - untouched) / total) * 100);
    }
  },
  {
    id: 'misc_scribe',
    title: 'Scribe',
    description: 'Add notes to 50 manuscripts.',
    icon: 'Search',
    tier: 'SILVER',
    xpReward: XP_PER_ACHIEVEMENT_TIER.SILVER,
    maxProgressValue: 50,
    currentProgressValue: (mss) => mss.filter(m => m.notes && m.notes.length > 0).length,
    condition: (mss) => mss.filter(m => m.notes && m.notes.length > 0).length >= 50,
    progress: (mss) => Math.min(100, (mss.filter(m => m.notes && m.notes.length > 0).length / 50) * 100)
  }
];

// --- Leveling System ---
const TITLES = [
  { xp: 0, title: "Novice Analyst" },
  { xp: 500, title: "Content Specialist" },
  { xp: 1500, title: "Senior Analyst" },
  { xp: 3500, title: "Workflow Expert" },
  { xp: 6000, title: "Master of Copy" },
  { xp: 10000, title: "Legendary Curator" },
  { xp: 20000, title: "Grandmaster" },
  { xp: 50000, title: "The Oracle" }
];

export const calculateXP = (manuscripts: Manuscript[], target: number): number => {
    let xp = 0;
    
    // 1. XP for Work
    const workedCount = manuscripts.filter(m => m.status === Status.WORKED).length;
    xp += workedCount * XP_PER_FILE;

    // 2. XP for Achievements
    ACHIEVEMENTS.forEach(ach => {
        if (ach.condition(manuscripts, target)) {
            xp += ach.xpReward;
        }
    });

    // 3. XP for Daily Quests (HISTORICAL)
    // We calculate this by looking at all past days, not just today
    xp += calculateHistoricalDailyXP(manuscripts);

    return xp;
};

export const calculateLevel = (currentXP: number): UserLevel => {
    let currentTitleIndex = 0;
    
    for (let i = 0; i < TITLES.length; i++) {
        if (currentXP >= TITLES[i].xp) {
            currentTitleIndex = i;
        } else {
            break;
        }
    }

    const title = TITLES[currentTitleIndex].title;
    const level = currentTitleIndex + 1;
    
    // Calculate progress to next level
    let nextLevelXP = TITLES[currentTitleIndex + 1]?.xp || (TITLES[currentTitleIndex].xp * 1.5); // Fallback for max level
    let prevLevelXP = TITLES[currentTitleIndex].xp;
    
    // Logic to handle percentage between tiers
    // Percent = (XP - Prev) / (Next - Prev)
    let progressPercent = 0;
    if (nextLevelXP > prevLevelXP) {
        progressPercent = Math.min(100, Math.round(((currentXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100));
    } else {
        progressPercent = 100; // Max level
    }

    return {
        level,
        title,
        currentXP,
        nextLevelXP,
        progressPercent
    };
};