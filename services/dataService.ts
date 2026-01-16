import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Manuscript, UserSchedule, Status } from '../types';
import { isTodayDate } from '../lib/utils';

// Map DB snake_case to TS camelCase
const mapToManuscript = (row: any): Manuscript => ({
  id: row.id,
  manuscriptId: row.manuscript_id,
  // Fix: changed journal_code to journalCode to match Manuscript interface
  journalCode: row.journal_code,
  status: row.status,
  priority: row.priority,
  dateReceived: row.date_received,
  dueDate: row.due_date,
  // Fix: removed invalid property completed_date
  completedDate: row.completed_date,
  billedDate: row.billed_date,
  dateUpdated: row.date_updated,
  dateStatusChanged: row.date_status_changed,
  queryReason: row.query_reason, 
  dateQueried: row.date_queried,
  dateEmailed: row.date_emailed,
  notes: row.notes || []
});

const STORAGE_KEYS = {
  MANUSCRIPTS: 'mc_tracker_local_manuscripts',
  SETTINGS: 'mc_tracker_local_settings'
};

const getLocalManuscripts = (): Manuscript[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.MANUSCRIPTS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const getLocalSettings = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

/**
 * Utility to identify if an error is network-related or a Supabase abort
 */
const isNetworkError = (err: any): boolean => {
  if (!err) return false;
  const msg = err.message?.toLowerCase() || '';
  return (
    msg.includes('failed to fetch') || 
    msg.includes('networkerror') || 
    msg.includes('signal is aborted') ||
    msg.includes('aborted') ||
    err.name === 'AbortError' ||
    err.name === 'TypeError' // Fetch failures are often TypeErrors in browsers
  );
};

// Helper to catch network errors during user check
// Uses getSession which is faster/local-first compared to getUser
const getSafeUser = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) return null;
    return session?.user || null;
  } catch (err) {
    return null;
  }
};

export const dataService = {
  // --- Manuscripts ---
  
  async getManuscripts(forceLocal = false): Promise<Manuscript[]> {
    if (!isSupabaseConfigured || forceLocal) {
      return getLocalManuscripts();
    }

    try {
      const user = await getSafeUser();
      if (!user) return getLocalManuscripts();

      const { data, error } = await supabase
        .from('manuscripts')
        .select('*')
        .eq('user_id', user.id)
        .order('date_updated', { ascending: false });
        
      if (error) throw error;
      return (data || []).map(mapToManuscript);
    } catch (err: any) {
      if (isNetworkError(err)) {
        console.warn("Network issue detected during getManuscripts, falling back to local data.");
        return getLocalManuscripts();
      }
      throw err;
    }
  },

  applyEscalationRule(m: Manuscript): Manuscript {
    const isDueToday = isTodayDate(m.dueDate);
    const isPendingReview = [Status.UNTOUCHED, Status.PENDING_TL, Status.PENDING_CED].includes(m.status);
    
    if (isDueToday && isPendingReview && m.priority === 'Normal') {
      return { ...m, priority: 'High' as const };
    }
    return m;
  },

  async autoEscalate(items: Manuscript[], isOffline: boolean): Promise<Manuscript[]> {
    const escalatedIds: string[] = [];
    const updatedItems = items.map(m => {
      const escalated = this.applyEscalationRule(m);
      if (escalated.priority !== m.priority) {
        escalatedIds.push(m.id);
        return { ...escalated, dateUpdated: new Date().toISOString() };
      }
      return m;
    });

    if (escalatedIds.length > 0) {
      try {
        await this.updateManuscripts(escalatedIds, { priority: 'High' as const }, isOffline);
      } catch (e) {
        console.error("Auto-escalation sync failed:", e);
      }
    }
    return updatedItems;
  },

  async createManuscript(m: Manuscript, forceLocal = false): Promise<Manuscript> {
    if (!isSupabaseConfigured || forceLocal) {
      const current = getLocalManuscripts();
      const newItem = { ...m, id: m.id || crypto.randomUUID() };
      const updated = [newItem, ...current];
      localStorage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify(updated));
      return newItem;
    }

    try {
      const user = await getSafeUser();
      if (!user) return this.createManuscript(m, true);

      const payload: any = {
          user_id: user.id,
          manuscript_id: m.manuscriptId,
          journal_code: m.journalCode,
          status: m.status,
          priority: m.priority,
          date_received: m.dateReceived,
          due_date: m.dueDate,
          completed_date: m.completedDate,
          billed_date: m.billedDate,
          date_updated: new Date().toISOString(),
          date_status_changed: m.dateStatusChanged,
          query_reason: m.queryReason,
          date_queried: m.dateQueried,
          date_emailed: m.dateEmailed,
          notes: m.notes
      };

      const { data, error } = await supabase
        .from('manuscripts')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return mapToManuscript(data);
    } catch (err: any) {
      if (isNetworkError(err)) {
        console.warn("Network issue detected during createManuscript, syncing locally.");
        return this.createManuscript(m, true);
      }
      throw err;
    }
  },

  async updateManuscript(m: Manuscript, forceLocal = false): Promise<Manuscript> {
    if (!isSupabaseConfigured || forceLocal) {
      const current = getLocalManuscripts();
      const updated = current.map((item: Manuscript) => item.id === m.id ? m : item);
      localStorage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify(updated));
      return m;
    }

    try {
      const user = await getSafeUser();
      if (!user) return this.updateManuscript(m, true);

      const payload: any = {
          manuscript_id: m.manuscriptId,
          journal_code: m.journalCode,
          status: m.status,
          priority: m.priority,
          date_received: m.dateReceived,
          due_date: m.dueDate,
          completed_date: m.completedDate,
          billed_date: m.billedDate,
          date_updated: new Date().toISOString(),
          date_status_changed: m.dateStatusChanged,
          query_reason: m.queryReason,
          date_queried: m.dateQueried,
          date_emailed: m.dateEmailed,
          notes: m.notes
      };

      const { data, error } = await supabase
        .from('manuscripts')
        .update(payload)
        .eq('id', m.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return mapToManuscript(data);
    } catch (err: any) {
      if (isNetworkError(err)) {
        console.warn("Network issue detected during updateManuscript, syncing locally.");
        return this.updateManuscript(m, true);
      }
      throw err;
    }
  },

  async updateManuscripts(ids: string[], updates: Partial<Manuscript>, forceLocal = false): Promise<void> {
    if (!isSupabaseConfigured || forceLocal) {
      const current = getLocalManuscripts();
      const now = new Date().toISOString();
      const updated = current.map((item: Manuscript) => 
        ids.includes(item.id) ? { ...item, ...updates, dateUpdated: now } : item
      );
      localStorage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify(updated));
      return;
    }

    try {
      const user = await getSafeUser();
      if (!user) return this.updateManuscripts(ids, updates, true);

      const dbUpdates: any = {
         date_updated: new Date().toISOString()
      };
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.priority) dbUpdates.priority = updates.priority;
      if (updates.dateStatusChanged) dbUpdates.date_status_changed = updates.dateStatusChanged;
      if (updates.completedDate !== undefined) dbUpdates.completed_date = updates.completedDate;
      if (updates.billedDate !== undefined) dbUpdates.billed_date = updates.billedDate;
      if (updates.queryReason !== undefined) dbUpdates.query_reason = updates.queryReason;
      if (updates.dateQueried !== undefined) dbUpdates.date_queried = updates.dateQueried;
      if (updates.dateEmailed !== undefined) dbUpdates.date_emailed = updates.dateEmailed;
      
      const { error } = await supabase
        .from('manuscripts')
        .update(dbUpdates)
        .in('id', ids)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (err: any) {
      if (isNetworkError(err)) {
        console.warn("Network issue detected during bulk update, syncing locally.");
        return this.updateManuscripts(ids, updates, true);
      }
      throw err;
    }
  },

  async deleteManuscript(id: string, forceLocal = false): Promise<void> {
    if (!isSupabaseConfigured || forceLocal) {
      const current = getLocalManuscripts();
      const updated = current.filter((item: Manuscript) => item.id !== id);
      localStorage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify(updated));
      return;
    }

    try {
      const user = await getSafeUser();
      if (!user) return this.deleteManuscript(id, true);

      const { error } = await supabase
        .from('manuscripts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (err: any) {
      if (isNetworkError(err)) {
        console.warn("Network issue detected during deleteManuscript, syncing locally.");
        return this.deleteManuscript(id, true);
      }
      throw err;
    }
  },

  async getUserSettings(forceLocal = false) {
    if (!isSupabaseConfigured || forceLocal) {
      return getLocalSettings();
    }

    try {
      const user = await getSafeUser();
      if (!user) return getLocalSettings();

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return getLocalSettings();

      return {
        targetPerCycle: data.target_per_cycle,
        userSchedule: {
          daysOff: data.days_off || [],
          weeklyWeights: data.weekly_weights || [1, 1, 1, 1, 1, 1, 1]
        }
      };
    } catch (err: any) {
      if (isNetworkError(err)) {
        console.warn("Network issue detected during getUserSettings, falling back to local settings.");
        return getLocalSettings();
      }
      return getLocalSettings();
    }
  },

  async updateTarget(target: number, forceLocal = false): Promise<void> {
    if (!isSupabaseConfigured || forceLocal) {
      const current = getLocalSettings() || { targetPerCycle: 50, userSchedule: { daysOff: [], weeklyWeights: [1, 1, 1, 1, 1, 1, 1] } };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...current, targetPerCycle: target }));
      return;
    }

    try {
      const user = await getSafeUser();
      if (!user) return this.updateTarget(target, true);

      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, target_per_cycle: target }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (err: any) {
      if (isNetworkError(err)) {
        console.warn("Network issue detected during updateTarget, syncing locally.");
        return this.updateTarget(target, true);
      }
      throw err;
    }
  },

  async updateSchedule(schedule: UserSchedule, forceLocal = false): Promise<void> {
    if (!isSupabaseConfigured || forceLocal) {
      const current = getLocalSettings() || { targetPerCycle: 50, userSchedule: { daysOff: [], weeklyWeights: [1, 1, 1, 1, 1, 1, 1] } };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...current, userSchedule: schedule }));
      return;
    }

    try {
      const user = await getSafeUser();
      if (!user) return this.updateSchedule(schedule, true);

      const { error } = await supabase
        .from('user_settings')
        .upsert({ 
          user_id: user.id, 
          days_off: schedule.daysOff, 
          weekly_weights: schedule.weeklyWeights 
        }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (err: any) {
      if (isNetworkError(err)) {
        console.warn("Network issue detected during updateSchedule, syncing locally.");
        return this.updateSchedule(schedule, true);
      }
      throw err;
    }
  }
};
