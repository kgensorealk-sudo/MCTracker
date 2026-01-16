import { useState, useEffect, useRef, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { dataService } from '../services/dataService';
import { Manuscript, Status, UserSchedule } from '../types';
import { generateAutoRemark } from '../lib/utils';

export const useAppData = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!isSupabaseConfigured);
  const authInitRef = useRef(false);

  // Data States
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [targetPerCycle, setTargetPerCycle] = useState<number>(50);
  const [userSchedule, setUserSchedule] = useState<UserSchedule>({ daysOff: [], weeklyWeights: [1, 1, 1, 1, 1, 1, 1] });

  const enterOfflineMode = useCallback(() => {
    if (isOffline) return; 
    console.warn('App running in Offline Mode (LocalStorage)');
    setIsOffline(true);
    setSession({
      access_token: 'offline_token',
      refresh_token: 'offline_refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'offline-user',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'guest@local.dev',
        app_metadata: { provider: 'email' },
        user_metadata: { full_name: 'Guest Analyst' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    } as Session);
    setLoading(false);
  }, [isOffline]);

  // Auth & Initial Load
  useEffect(() => {
    if (authInitRef.current) return;
    authInitRef.current = true;

    const initAuth = async () => {
      if (!isSupabaseConfigured) {
        enterOfflineMode();
        return;
      }

      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (currentSession) {
          setSession(currentSession);
        }
        setLoading(false);
      } catch (err: any) {
        console.error("Auth initialization failed:", err);
        enterOfflineMode();
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSession(session);
      else if (!isOffline) setSession(null);
    });

    return () => subscription.unsubscribe();
  }, [enterOfflineMode, isOffline]);

  const loadData = useCallback(async () => {
    if (dataLoading) return;
    setDataLoading(true);
    try {
      const [mss, settings] = await Promise.all([
        dataService.getManuscripts(isOffline),
        dataService.getUserSettings(isOffline)
      ]);
      
      const escalatedMss = await dataService.autoEscalate(mss || [], isOffline);
      setManuscripts(escalatedMss);
      if (settings) {
        setTargetPerCycle(settings.targetPerCycle);
        setUserSchedule(settings.userSchedule);
      }
    } catch (error: any) {
      console.error("Error loading data:", error);
    } finally {
      setDataLoading(false);
    }
  }, [isOffline]);

  // Fetch Data when session is ready
  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session, isOffline, loadData]);

  const saveManuscript = async (manuscript: Manuscript, isEditing: boolean): Promise<Manuscript | null> => {
    setDataLoading(true);
    try {
      const processedManuscript = dataService.applyEscalationRule(manuscript);
      
      let result: Manuscript;
      if (isEditing) {
        result = await dataService.updateManuscript(processedManuscript, isOffline);
        setManuscripts(prev => prev.map(m => m.id === result.id ? result : m));
      } else {
        result = await dataService.createManuscript(processedManuscript, isOffline);
        setManuscripts(prev => [result, ...prev]);
      }
      return result;
    } catch (error: any) {
      console.error("Error saving:", error);
      alert(`Failed to save record: ${error.message || 'Unknown error'}`);
      return null;
    } finally {
      setDataLoading(false);
    }
  };

  const handleQuickUpdate = async (id: string, updates: Partial<Manuscript>) => {
    const original = manuscripts.find(m => m.id === id);
    if (!original) return;

    const now = new Date().toISOString();
    let updatedManuscript = { 
      ...original, 
      ...updates, 
      dateUpdated: now 
    };

    updatedManuscript = dataService.applyEscalationRule(updatedManuscript);

    // Automatic remark handling for status changes
    if (updates.status && updates.status !== original.status) {
      const autoRemark = generateAutoRemark(original.status, updates.status);
      if (autoRemark && !updates.notes) {
        const newNote = {
          id: crypto.randomUUID(),
          content: autoRemark,
          timestamp: Date.now()
        };
        updatedManuscript.notes = [newNote, ...original.notes];
      }

      if (updates.status !== Status.BILLED || original.status !== Status.WORKED) {
        updatedManuscript.dateStatusChanged = now;
      }
      if ((updatedManuscript.status === Status.WORKED || updatedManuscript.status === Status.BILLED) && !original.completedDate) {
        updatedManuscript.completedDate = now;
      }
    }

    setManuscripts(prev => prev.map(m => m.id === id ? updatedManuscript : m));

    try {
      await dataService.updateManuscript(updatedManuscript, isOffline);
    } catch (error: any) {
      console.error("Quick update failed:", error);
      setManuscripts(prev => prev.map(m => m.id === id ? original : m));
    }
  };

  const handleBulkUpdate = async (ids: string[], updates: Partial<Manuscript>) => {
    if (ids.length === 0) return;
    setDataLoading(true);

    const now = new Date().toISOString();
    const updatedItems: Manuscript[] = [];
    
    setManuscripts(prev => prev.map(m => {
      if (!ids.includes(m.id)) return m;
      
      let item = { ...m, ...updates, dateUpdated: now };
      item = dataService.applyEscalationRule(item);
      
      if (updates.status && updates.status !== m.status) {
        const autoRemark = generateAutoRemark(m.status, updates.status);
        if (autoRemark && !updates.notes) {
          const newNote = {
            id: crypto.randomUUID(),
            content: autoRemark,
            timestamp: Date.now()
          };
          item.notes = [newNote, ...m.notes];
        }

        if (updates.status !== Status.BILLED || m.status !== Status.WORKED) {
          item.dateStatusChanged = now;
        }
        if ((updates.status === Status.WORKED || updates.status === Status.BILLED) && !m.completedDate) {
          item.completedDate = now;
        }
      }
      updatedItems.push(item);
      return item;
    }));

    try {
      if (updates.status) {
        await Promise.all(updatedItems.map(item => dataService.updateManuscript(item, isOffline)));
      } else {
        await dataService.updateManuscripts(ids, updates, isOffline);
      }
    } catch (error: any) {
      console.error("Bulk update failed:", error);
      loadData(); 
    } finally {
      setDataLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDataLoading(true);
    try {
      await dataService.deleteManuscript(id, isOffline);
      setManuscripts(prev => prev.filter(m => m.id !== id));
    } catch (error: any) {
      console.error("Error deleting:", error);
    } finally {
      setDataLoading(false);
    }
  };

  const handleBulkImport = async (newItems: Manuscript[]) => {
    setDataLoading(true);
    try {
      const createdItems: Manuscript[] = [];
      for (const item of newItems) {
        const processed = dataService.applyEscalationRule(item);
        const created = await dataService.createManuscript(processed, isOffline);
        createdItems.push(created);
      }
      setManuscripts(prev => [...createdItems, ...prev]);
    } catch (error: any) {
      console.error("Bulk import failed:", error);
    } finally {
      setDataLoading(false);
    }
  };

  const handleUpdateTarget = (target: number) => {
    setTargetPerCycle(target);
    dataService.updateTarget(target, isOffline).catch(err => {
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('fetch') || msg.includes('aborted')) enterOfflineMode();
    });
  };

  const handleUpdateSchedule = (schedule: UserSchedule) => {
    setUserSchedule(schedule);
    dataService.updateSchedule(schedule, isOffline).catch((err: any) => {
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('fetch') || msg.includes('aborted')) enterOfflineMode();
    });
  };

  const handleMarkReported = async (ids: string[]) => {
    const now = new Date().toISOString();
    setManuscripts(prev => prev.map(m => ids.includes(m.id) ? { ...m, dateEmailed: now } : m));
    try {
      await dataService.updateManuscripts(ids, { dateEmailed: now }, isOffline);
    } catch (error: any) {
      console.error("Failed to mark reported:", error);
    }
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured && !isOffline) {
      try {
        await supabase.auth.signOut();
      } catch {
        window.location.reload();
      }
    } else {
      window.location.reload();
    }
  };

  return {
    session,
    loading,
    dataLoading,
    isOffline,
    manuscripts,
    targetPerCycle,
    userSchedule,
    loadData,
    saveManuscript,
    handleDelete,
    handleUpdateTarget,
    handleUpdateSchedule,
    handleMarkReported,
    handleQuickUpdate,
    handleBulkUpdate,
    handleBulkImport,
    handleSignOut,
    setManuscripts
  };
};
