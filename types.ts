
export enum Status {
  UNTOUCHED = 'UNTOUCHED', // Newly imported, not started
  WORKED = 'WORKED', // Completed/Publication Ready
  PENDING_JM = 'PENDING_JM', // Pending: Queried to JM
  PENDING_TL = 'PENDING_TL', // Pending: with TL Query
  PENDING_CED = 'PENDING_CED' // Pending: Email CED
}

export interface Note {
  id: string;
  content: string;
  timestamp: number;
}

export interface Manuscript {
  id: string;
  manuscriptId: string; // e.g. JRNL-2023-001
  journalCode: string;
  status: Status;
  dateReceived: string; // ISO string (Date Sent)
  dueDate?: string; // ISO string
  completedDate?: string; // ISO string - Explicit completion date for WORKED items
  dateUpdated: string; // ISO string
  dateStatusChanged?: string; // ISO string - New field for tracking exact completion/status change time
  queryReason?: string; // Reason for the query (e.g. Figure Replacement, Missing Info)
  notes: Note[];
  priority: 'Normal' | 'High' | 'Urgent';
}

export interface DashboardStats {
  total: number;
  worked: number;
  untouched: number;
  pending: number;
}

export interface UserSchedule {
  daysOff: string[]; // ISO date strings (YYYY-MM-DD) of planned days off
  // Array of 7 numbers (0 to 1) representing capacity for Sun(0) to Sat(6)
  // e.g., [0, 1, 1, 1, 1, 1, 0.5] means Sun off, Sat half day
  weeklyWeights: number[]; 
}

// --- Gamification ---

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name mapping
  condition: (manuscripts: Manuscript[], target: number) => boolean;
  progress: (manuscripts: Manuscript[], target: number) => number; // 0 to 100
  maxProgressValue: number; // The generic number needed (e.g., 100 files)
  currentProgressValue: (manuscripts: Manuscript[], target: number) => number;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  xpReward: number;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  target: number;
  rewardXP: number;
  progress: (manuscripts: Manuscript[]) => number;
  isCompleted: (manuscripts: Manuscript[]) => boolean;
}

export interface UserLevel {
  level: number;
  title: string;
  currentXP: number;
  nextLevelXP: number;
  progressPercent: number;
}