
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Manuscript, UserSchedule } from '../types';

const mapToManuscript = (row: any): Manuscript => ({
  id: row.id,
  manuscriptId: row.manuscript_id,
  // Fixed property names to match Manuscript interface
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

const mapToDb = (m: Manuscript, userId: string) => ({
  user_id: userId,
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
});

const STORAGE_KEYS = {
  MANUSCRIPTS: 'mc_tracker_local_manuscripts',
  SETTINGS: 'mc_tracker_local_settings'
};

const getLocal = (key: string) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

const isNetworkError = (err: any): boolean => {
  if (!err) return false;
  const msg = err.message?.toLowerCase() || '';
  return msg.includes('fetch') || msg.includes('network') || msg.includes('aborted') || err.name === 'AbortError';
};

const getSafeUser = async () => {
  try {
    // Fix: Robust session handling for both Supabase v1 and v2
    const auth = supabase.auth as any;
    const session = auth.session ? auth.session() : (await auth.getSession?.())?.data?.session;
    return session?.user || null;
  } catch { return null; }
};

export const dataService = {
  async getManuscripts(forceLocal = false): Promise<Manuscript[]> {
    if (!isSupabaseConfigured || forceLocal) return getLocal(STORAGE_KEYS.MANUSCRIPTS) || [];
    try {
      const user = await getSafeUser();
      if (!user) return getLocal(STORAGE_KEYS.MANUSCRIPTS) || [];
      const { data, error } = await supabase.from('manuscripts').select('*').eq('user_id', user.id).order('date_updated', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapToManuscript);
    } catch (err) {
      return isNetworkError(err) ? getLocal(STORAGE_KEYS.MANUSCRIPTS) || [] : (()=>{throw err})() ;
    }
  },

  async createManuscript(m: Manuscript, forceLocal = false): Promise<Manuscript> {
    if (!isSupabaseConfigured || forceLocal) {
      const current = getLocal(STORAGE_KEYS.MANUSCRIPTS) || [];
      const newItem = { ...m, id: m.id || crypto.randomUUID() };
      localStorage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify([newItem, ...current]));
      return newItem;
    }
    try {
      const user = await getSafeUser();
      if (!user) return this.createManuscript(m, true);
      const { data, error } = await supabase.from('manuscripts').insert([mapToDb(m, user.id)]).select().single();
      if (error) throw error;
      return mapToManuscript(data);
    } catch (err) {
      return isNetworkError(err) ? this.createManuscript(m, true) : (()=>{throw err})() ;
    }
  },

  async updateManuscript(m: Manuscript, forceLocal = false): Promise<Manuscript> {
    if (!isSupabaseConfigured || forceLocal) {
      const current = getLocal(STORAGE_KEYS.MANUSCRIPTS) || [];
      const updated = current.map((item: Manuscript) => item.id === m.id ? m : item);
      localStorage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify(updated));
      return m;
    }
    try {
      const user = await getSafeUser();
      if (!user) return this.updateManuscript(m, true);
      const { data, error } = await supabase.from('manuscripts').update(mapToDb(m, user.id)).eq('id', m.id).eq('user_id', user.id).select().single();
      if (error) throw error;
      return mapToManuscript(data);
    } catch (err) {
      return isNetworkError(err) ? this.updateManuscript(m, true) : (()=>{throw err})() ;
    }
  },

  async updateManuscripts(ids: string[], updates: Partial<Manuscript>, forceLocal = false): Promise<void> {
    if (!isSupabaseConfigured || forceLocal) {
      const current = getLocal(STORAGE_KEYS.MANUSCRIPTS) || [];
      const now = new Date().toISOString();
      const updated = current.map((item: Manuscript) => ids.includes(item.id) ? { ...item, ...updates, dateUpdated: now } : item);
      localStorage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify(updated));
      return;
    }
    try {
      const user = await getSafeUser();
      if (!user) return this.updateManuscripts(ids, updates, true);
      const dbUpdates: any = { date_updated: new Date().toISOString() };
      Object.entries(updates).forEach(([k, v]) => {
        const dbKey = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        dbUpdates[dbKey] = v;
      });
      const { error } = await supabase.from('manuscripts').update(dbUpdates).in('id', ids).eq('user_id', user.id);
      if (error) throw error;
    } catch (err) {
      if (isNetworkError(err)) return this.updateManuscripts(ids, updates, true);
      throw err;
    }
  },

  async deleteManuscript(id: string, forceLocal = false): Promise<void> {
    if (!isSupabaseConfigured || forceLocal) {
      const updated = (getLocal(STORAGE_KEYS.MANUSCRIPTS) || []).filter((item: Manuscript) => item.id !== id);
      localStorage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify(updated));
      return;
    }
    try {
      const user = await getSafeUser();
      if (!user) return this.deleteManuscript(id, true);
      const { error } = await supabase.from('manuscripts').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    } catch (err) {
      if (isNetworkError(err)) return this.deleteManuscript(id, true);
      throw err;
    }
  },

  async getUserSettings(forceLocal = false) {
    if (!isSupabaseConfigured || forceLocal) return getLocal(STORAGE_KEYS.SETTINGS);
    try {
      const user = await getSafeUser();
      if (!user) return getLocal(STORAGE_KEYS.SETTINGS);
      const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return getLocal(STORAGE_KEYS.SETTINGS);
      return { targetPerCycle: data.target_per_cycle, userSchedule: { daysOff: data.days_off || [], weeklyWeights: data.weekly_weights || [1, 1, 1, 1, 1, 1, 1] } };
    } catch { return getLocal(STORAGE_KEYS.SETTINGS); }
  },

  async updateTarget(target: number, forceLocal = false): Promise<void> {
    if (!isSupabaseConfigured || forceLocal) {
      const current = getLocal(STORAGE_KEYS.SETTINGS) || { targetPerCycle: 50, userSchedule: { daysOff: [], weeklyWeights: [1, 1, 1, 1, 1, 1, 1] } };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...current, targetPerCycle: target }));
      return;
    }
    try {
      const user = await getSafeUser();
      if (!user) return this.updateTarget(target, true);
      const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, target_per_cycle: target }, { onConflict: 'user_id' });
      if (error) throw error;
    } catch (err) {
      if (isNetworkError(err)) return this.updateTarget(target, true);
      throw err;
    }
  },

  async updateSchedule(schedule: UserSchedule, forceLocal = false): Promise<void> {
    if (!isSupabaseConfigured || forceLocal) {
      const current = getLocal(STORAGE_KEYS.SETTINGS) || { targetPerCycle: 50, userSchedule: { daysOff: [], weeklyWeights: [1, 1, 1, 1, 1, 1, 1] } };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...current, userSchedule: schedule }));
      return;
    }
    try {
      const user = await getSafeUser();
      if (!user) return this.updateSchedule(schedule, true);
      // Fix: Correct property access from weekly_weights to weeklyWeights
      const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, days_off: schedule.daysOff, weekly_weights: schedule.weeklyWeights }, { onConflict: 'user_id' });
      if (error) throw error;
    } catch (err) {
      if (isNetworkError(err)) return this.updateSchedule(schedule, true);
      throw err;
    }
  }
};