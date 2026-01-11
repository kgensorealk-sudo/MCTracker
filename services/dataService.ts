import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Manuscript, UserSchedule } from '../types';

// Map DB snake_case to TS camelCase
const mapToManuscript = (row: any): Manuscript => ({
  id: row.id,
  manuscriptId: row.manuscript_id,
  journalCode: row.journal_code,
  status: row.status,
  priority: row.priority,
  // Fix: Object literal may only specify known properties. Using camelCase to match Manuscript interface.
  dateReceived: row.date_received,
  dueDate: row.due_date,
  completedDate: row.completed_date,
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

export const dataService = {
  // --- Manuscripts ---
  
  async getManuscripts() {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(STORAGE_KEYS.MANUSCRIPTS);
      return stored ? JSON.parse(stored) : [];
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('manuscripts')
        .select('*')
        .eq('user_id', user.id) // Enforce user isolation
        .order('date_updated', { ascending: false });
        
      if (error) throw new Error(error.message);
      return data.map(mapToManuscript);
    } catch (err: any) {
      throw new Error(err.message || "Failed to fetch manuscripts");
    }
  },

  async createManuscript(m: Manuscript) {
    if (!isSupabaseConfigured) {
      const current = await this.getManuscripts();
      const newItem = { ...m, id: m.id || crypto.randomUUID() };
      const updated = [newItem, ...current];
      localStorage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify(updated));
      return newItem;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const payload: any = {
        user_id: user.id,
        manuscript_id: m.manuscriptId,
        journal_code: m.journalCode,
        status: m.status,
        priority: m.priority,
        date_received: m.dateReceived,
        due_date: m.dueDate,
        completed_date: m.completedDate,
        date_updated: new Date().toISOString(),
        date_status_changed: m.dateStatusChanged,
        query_reason: m.queryReason,
        date_queried: m.dateQueried,
        date_emailed: m.dateEmailed,
        notes: m.notes
    };

    let attempt = 0;
    const maxAttempts = 5; 

    while (attempt < maxAttempts) {
        const { data, error } = await supabase
          .from('manuscripts')
          .insert([payload])
          .select()
          .single();

        if (!error) return mapToManuscript(data);

        // More aggressive error detection for missing columns
        const isColumnError = error.code === '42703' || 
                             error.message.includes('column') || 
                             error.message.includes('schema cache');

        if (isColumnError) {
            const msg = error.message.toLowerCase();
            const missingCol = msg.includes('query_reason') ? 'query_reason' : 
                               msg.includes('date_queried') ? 'date_queried' :
                               msg.includes('date_emailed') ? 'date_emailed' : null;
            
            if (missingCol && payload[missingCol] !== undefined) {
                delete payload[missingCol];
                attempt++;
                continue;
            }
        }
        throw new Error(error.message || "Unknown DB Error during creation");
    }
    throw new Error("Failed to create manuscript: Database schema incompatible.");
  },

  async updateManuscript(m: Manuscript) {
    if (!isSupabaseConfigured) {
      const current = await this.getManuscripts();
      const updated = current.map((item: Manuscript) => item.id === m.id ? m : item);
      localStorage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify(updated));
      return m;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const payload: any = {
        manuscript_id: m.manuscriptId,
        journal_code: m.journalCode,
        status: m.status,
        priority: m.priority,
        date_received: m.dateReceived,
        due_date: m.dueDate,
        completed_date: m.completedDate,
        date_updated: new Date().toISOString(),
        date_status_changed: m.dateStatusChanged,
        query_reason: m.queryReason,
        date_queried: m.dateQueried,
        date_emailed: m.dateEmailed,
        notes: m.notes
    };

    let attempt = 0;
    const maxAttempts = 5;

    while (attempt < maxAttempts) {
        const { data, error } = await supabase
          .from('manuscripts')
          .update(payload)
          .eq('id', m.id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (!error) return mapToManuscript(data);

        const isColumnError = error.code === '42703' || 
                             error.message.includes('column') || 
                             error.message.includes('schema cache');

        if (isColumnError) {
            const msg = error.message.toLowerCase();
            const missingCol = msg.includes('query_reason') ? 'query_reason' : 
                               msg.includes('date_queried') ? 'date_queried' :
                               msg.includes('date_emailed') ? 'date_emailed' : null;

            if (missingCol && payload[missingCol] !== undefined) {
                delete payload[missingCol];
                attempt++;
                continue;
            }
        }
        throw new Error(error.message || "Unknown DB Error during update");
    }
    throw new Error("Failed to update manuscript: Database schema incompatible.");
  },

  async updateManuscripts(ids: string[], updates: Partial<Manuscript>) {
    if (!isSupabaseConfigured) {
      const current = await this.getManuscripts();
      const now = new Date().toISOString();
      const updated = current.map((item: Manuscript) => 
        ids.includes(item.id) ? { ...item, ...updates, dateUpdated: now } : item
      );
      localStorage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify(updated));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const dbUpdates: any = {
       date_updated: new Date().toISOString()
    };
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.priority) dbUpdates.priority = updates.priority;
    if (updates.dateStatusChanged) dbUpdates.date_status_changed = updates.dateStatusChanged;
    if (updates.completedDate !== undefined) dbUpdates.completed_date = updates.completedDate;
    if (updates.queryReason !== undefined) dbUpdates.query_reason = updates.queryReason;
    if (updates.dateQueried !== undefined) dbUpdates.date_queried = updates.dateQueried;
    if (updates.dateEmailed !== undefined) dbUpdates.date_emailed = updates.dateEmailed;
    
    let attempt = 0;
    const maxAttempts = 5;

    while (attempt < maxAttempts) {
        const { error } = await supabase
          .from('manuscripts')
          .update(dbUpdates)
          .in('id', ids)
          .eq('user_id', user.id);

        if (!error) return;

        const isColumnError = error.code === '42703' || 
                             error.message.includes('column') || 
                             error.message.includes('schema cache');

        if (isColumnError) {
            const msg = error.message.toLowerCase();
            const missingCol = msg.includes('query_reason') ? 'query_reason' : 
                               msg.includes('date_queried') ? 'date_queried' :
                               msg.includes('date_emailed') ? 'date_emailed' : null;
            
            if (missingCol && dbUpdates[missingCol] !== undefined) {
                delete dbUpdates[missingCol];
                attempt++;
                continue;
            }
        }
        throw new Error(error.message || "Unknown DB Error during bulk update");
    }
    throw new Error("Failed to bulk update: Database schema incompatible.");
  },

  async deleteManuscript(id: string) {
    if (!isSupabaseConfigured) {
      const current = await this.getManuscripts();
      const updated = current.filter((item: Manuscript) => item.id !== id);
      localStorage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify(updated));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { error } = await supabase
      .from('manuscripts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw new Error(error.message);
  },

  async getUserSettings() {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? JSON.parse(stored) : null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
      targetPerCycle: data.target_per_cycle,
      userSchedule: {
        daysOff: data.days_off || [],
        weeklyWeights: data.weekly_weights || [1, 1, 1, 1, 1, 1, 1]
      }
    };
  },

  async updateTarget(target: number) {
    if (!isSupabaseConfigured) {
      const current = await this.getUserSettings() || { targetPerCycle: 50, userSchedule: { daysOff: [], weeklyWeights: [1, 1, 1, 1, 1, 1, 1] } };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...current, targetPerCycle: target }));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, target_per_cycle: target }, { onConflict: 'user_id' });

    if (error) throw new Error(error.message);
  },

  async updateSchedule(schedule: UserSchedule) {
    if (!isSupabaseConfigured) {
      const current = await this.getUserSettings() || { targetPerCycle: 50, userSchedule: { daysOff: [], weeklyWeights: [1, 1, 1, 1, 1, 1, 1] } };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...current, userSchedule: schedule }));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { error } = await supabase
      .from('user_settings')
      .upsert({ 
        user_id: user.id, 
        days_off: schedule.daysOff, 
        weekly_weights: schedule.weeklyWeights 
      }, { onConflict: 'user_id' });

    if (error) throw new Error(error.message);
  }
};