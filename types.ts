
export enum Status {
  UNTOUCHED = 'UNTOUCHED', // Newly imported, not started
  WORKED = 'WORKED', // Completed/Publication Ready
  PENDING_JM = 'PENDING_JM', // Pending: Queried to JM
  PENDING_TL = 'PENDING_TL', // Pending: with TL Query
  PENDING_CED = 'PENDING_CED', // Pending: Email CED
  BILLED = 'BILLED' // Confirmed in billing cycle
}

export interface Note {
  id: string;
  content: string;
  timestamp: number;
}

export interface Manuscript {
  id: string;
  manuscriptId: string;
  journalCode: string;
  status: Status;
  dateReceived: string;
  dueDate?: string;
  completedDate?: string;
  billedDate?: string;
  dateUpdated: string;
  dateStatusChanged?: string;
  queryReason?: string;
  dateQueried?: string;
  dateEmailed?: string;
  notes: Note[];
  priority: 'Normal' | 'High' | 'Urgent';
}

export interface UserSchedule {
  daysOff: string[];
  weeklyWeights: number[]; 
}
