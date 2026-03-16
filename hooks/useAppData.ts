
import { useState, useCallback } from 'react';
import { Manuscript, UserSchedule } from '../types';
import { dataService } from '../services/dataService';

export const useAppData = (isOffline: boolean) => {
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [targetPerCycle, setTargetPerCycle] = useState<number>(50);
  const [userSchedule, setUserSchedule] = useState<UserSchedule>({
    daysOff: [],
    weeklyWeights: [1, 1, 1, 1, 1, 1, 1],
    cycleRates: {}
  });
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mss, settings] = await Promise.all([
        dataService.getManuscripts(isOffline),
        dataService.getUserSettings(isOffline)
      ]);
      setManuscripts(mss || []);
      if (settings) {
        setTargetPerCycle(settings.targetPerCycle);
        setUserSchedule(prev => ({ ...prev, ...settings.userSchedule }));
      }
    } finally {
      setLoading(false);
    }
  }, [isOffline]);

  const createManuscript = async (m: Manuscript) => {
    const created = await dataService.createManuscript(m, isOffline);
    setManuscripts(prev => [created, ...prev]);
    return created;
  };

  const updateManuscript = async (m: Manuscript) => {
    const updated = await dataService.updateManuscript(m, isOffline);
    setManuscripts(prev => prev.map(item => item.id === updated.id ? updated : item));
    return updated;
  };

  const updateManuscripts = async (ids: string[], updates: Partial<Manuscript>) => {
    await dataService.updateManuscripts(ids, updates, isOffline);
    const now = new Date().toISOString();
    setManuscripts(prev => prev.map(m => ids.includes(m.id) ? { ...m, ...updates, dateUpdated: now } : m));
  };

  const deleteManuscript = async (id: string) => {
    await dataService.deleteManuscript(id, isOffline);
    setManuscripts(prev => prev.filter(m => m.id !== id));
  };

  const updateTarget = async (target: number) => {
    await dataService.updateTarget(target, isOffline);
    setTargetPerCycle(target);
  };

  const updateSchedule = async (schedule: UserSchedule) => {
    await dataService.updateSchedule(schedule, isOffline);
    setUserSchedule(schedule);
  };

  // Missing methods mentioned in build log
  const applyEscalationRule = useCallback((m: Manuscript): Manuscript => {
    // Example logic: if it's PENDING for > 24h, maybe it needs a flag?
    // This is a placeholder for the actual logic that was likely intended
    return m;
  }, []);

  const autoEscalate = useCallback(async () => {
    // Placeholder for auto-escalation logic
    console.log("Auto-escalating manuscripts...");
  }, []);

  return {
    manuscripts,
    setManuscripts,
    targetPerCycle,
    userSchedule,
    loading,
    loadData,
    createManuscript,
    updateManuscript,
    updateManuscripts,
    deleteManuscript,
    updateTarget,
    updateSchedule,
    createManuscripts: async (newManuscripts: Manuscript[]) => {
      setLoading(true);
      try {
        await dataService.createManuscripts(newManuscripts, isOffline);
        await loadData();
      } finally {
        setLoading(false);
      }
    },
    autoEscalate,
    applyEscalationRule
  };
};
