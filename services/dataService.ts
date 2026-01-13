

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Manuscript, UserSchedule } from '../types';

// Map DB snake_case to TS camelCase
const mapToManuscript = (row: any): Manuscript => ({
  id: row.id,
  manuscriptId: row.manuscript_id,
  journalCode: row.journal_code,
  status: row.status,
  priority: row.priority,
  dateReceived: row.date_received,
  dueDate: row.due_date,
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

// Helper to catch network errors during user check
const getSafeUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    console.warn("User fetch failed (network issue):", err);
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
      console.warn("Supabase fetch failed, falling back to local:", err);
      return getLocalManuscripts();
    }
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
      console.warn("Remote create failed, syncing locally:", err);
      return this.createManuscript(m, true);
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
      console.warn("Remote update failed, syncing locally:", err);
      return this.updateManuscript(m, true);
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
      console.warn("Remote bulk update failed, syncing locally:", err);
      return this.updateManuscripts(ids, updates, true);
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
      console.warn("Remote delete failed, syncing locally:", err);
      return this.deleteManuscript(id, true);
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
      console.warn("Supabase settings fetch failed, falling back to local:", err);
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
      console.warn("Remote target update failed, syncing locally:", err);
      return this.updateTarget(target, true);
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

      // Fix: Use correct camelCase property names from the UserSchedule interface
      const { error } = await supabase
        .from('user_settings')
        .upsert({ 
          user_id: user.id, 
          days_off: schedule.daysOff, 
          weekly_weights: schedule.weeklyWeights 
        }, { onConflict: 'user_id' });

      if (error) throw error;
    } catch (err: any) {
      console.warn("Remote schedule update failed, syncing locally:", err);
      return this.updateSchedule(schedule, true);
    }
  }
};
