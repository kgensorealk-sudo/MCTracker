
import { useMemo } from 'react';

export interface CycleDates {
  startDate: Date;
  endDate: Date;
  cycleLabel: string;
}

export const useCycleDates = (): CycleDates => {
  return useMemo(() => {
    const d = new Date();
    const day = d.getDate();
    const month = d.getMonth(); 
    const year = d.getFullYear();

    let startDate: Date;
    let endDate: Date;
    let cycleLabel: string;

    if (day >= 11 && day <= 25) {
      startDate = new Date(year, month, 11);
      endDate = new Date(year, month, 25);
      cycleLabel = `11th - 25th ${startDate.toLocaleString('default', { month: 'long' })}`;
    } else {
      if (day >= 26) {
        startDate = new Date(year, month, 26);
        endDate = new Date(year, month + 1, 10);
      } else {
        startDate = new Date(year, month - 1, 26);
        endDate = new Date(year, month, 10);
      }
      const startStr = startDate.toLocaleString('default', { month: 'short' });
      const endStr = endDate.toLocaleString('default', { month: 'short' });
      cycleLabel = `26th ${startStr} - 10th ${endStr}`;
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate, cycleLabel };
  }, []);
};
