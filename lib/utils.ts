import { Status } from '../types';

export const isTodayDate = (dateString?: string) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth() === now.getMonth() &&
         d.getDate() === now.getDate();
};

export const isActivityToday = (date: Date) => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

export const generateAutoRemark = (oldStatus: Status, newStatus: Status): string => {
  if (newStatus === Status.WORKED) {
    return oldStatus === Status.PENDING_JM ? "JM Query Resolved / Submitted" : "Done / Submitted";
  }
  if (newStatus === Status.PENDING_JM) {
    return "Queried to JM";
  }
  if (newStatus === Status.BILLED) {
    return "Payment Confirmed / Billed";
  }
  if (newStatus === Status.PENDING_TL) {
    return "Queried to TL";
  }
  if (newStatus === Status.PENDING_CED) {
    return "Emailed to CED";
  }
  return "";
};
