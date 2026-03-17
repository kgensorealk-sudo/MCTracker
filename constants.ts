
import { Status } from './types';

export const QUICK_NOTES = {
  DONE: [
    "Done with Figure Assessment",
    "Done With MMC correction and Figure Assessment"
  ],
  CED: [
    "Pending For Retag: References",
    "Pending For Retag: Table"
  ],
  JM: [
    "Pending with JM Query: Uncited Reference",
    "Title Change confirmation",
    "Clarification",
    "Additional author"
  ],
  GENERAL: [
    "Follow-up required",
    "Waiting for response",
    "Priority check"
  ]
};

export const getQuickNotesForStatus = (status: Status, flags?: { jm: boolean, tl: boolean, ced: boolean }) => {
  const notes: string[] = [];
  
  if (status === Status.WORKED || status === Status.BILLED) {
    notes.push(...QUICK_NOTES.DONE);
  }
  
  if (flags?.ced || status === Status.PENDING_CED) {
    notes.push(...QUICK_NOTES.CED);
  }
  
  if (flags?.jm || status === Status.PENDING_JM) {
    notes.push(...QUICK_NOTES.JM);
  }
  
  if (notes.length === 0) {
    notes.push(...QUICK_NOTES.GENERAL);
  }
  
  return Array.from(new Set(notes)); // Remove duplicates if any
};
