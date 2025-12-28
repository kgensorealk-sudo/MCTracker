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
  dateUpdated: row.date_updated,
  dateStatusChanged: row.date_status_changed,
  issueTypes: row.issue_types || [],
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('manuscripts')
      .select('*')
      .eq('user_id', user.id) // Enforce user isolation
      .order('date_updated', { ascending: false });
      
    if (error) throw error;
    return data.map(mapToManuscript);
  },

  async createManuscript(m: Manuscript) {
    if (!isSupabaseConfigured) {
      const current = await this.getManuscripts();
      // Ensure we have an ID (Frontend usually provides one, but just in case)
      const newItem = { ...m, id: m.id || crypto.randomUUID() };
      const updated = [newItem, ...current];
      localStorage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify(updated));
      return newItem;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('manuscripts')
      .insert([{
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
        issue_types: m.issueTypes,
        notes: m.notes
      }])
      .select()
      .single();

    if (error) throw error;
    return mapToManuscript(data);
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

    const { data, error } = await supabase
      .from('manuscripts')
      .update({
        manuscript_id: m.manuscriptId,
        journal_code: m.journalCode,
        status: m.status,
        priority: m.priority,
        date_received: m.dateReceived,
        due_date: m.dueDate,
        completed_date: m.completedDate,
        date_updated: new Date().toISOString(),
        date_status_changed: m.dateStatusChanged,
        issue_types: m.issueTypes,
        notes: m.notes
      })
      .eq('id', m.id)
      .eq('user_id', user.id) // Ensure we only update our own records
      .select()
      .single();

    if (error) throw error;
    return mapToManuscript(data);
  },

  async updateManuscripts(ids: string[], updates: Partial<Manuscript>) {
    // Helper to apply updates
    const applyUpdates = (original: Manuscript) => ({
       ...original,
       ...updates,
       dateUpdated: new Date().toISOString(),
       // If status changes, update status date
       dateStatusChanged: (updates.status && updates.status !== original.status) 
          ? new Date().toISOString() 
          : original.dateStatusChanged
    });

    if (!isSupabaseConfigured) {
      const current = await this.getManuscripts();
      const updated = current.map((item: Manuscript) => 
        ids.includes(item.id) ? applyUpdates(item) : item
      );
      localStorage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify(updated));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Prepare DB object
    // Note: We can't use the smart logic inside mapToManuscript for bulk updates easily via SQL
    // so we assume the caller has set dateStatusChanged/completedDate correctly in 'updates' 
    // OR we just update the fields provided.
    
    // Convert camelCase updates to snake_case for DB
    const dbUpdates: any = {
       date_updated: new Date().toISOString()
    };
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.priority) dbUpdates.priority = updates.priority;
    if (updates.dateStatusChanged) dbUpdates.date_status_changed = updates.dateStatusChanged;
    if (updates.completedDate !== undefined) dbUpdates.completed_date = updates.completedDate;
    
    const { error } = await supabase
      .from('manuscripts')
      .update(dbUpdates)
      .in('id', ids)
      .eq('user_id', user.id);

    if (error) throw error;
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
      .eq('user_id', user.id); // Ensure we only delete our own records
    if (error) throw error;
  },

  // --- User Settings ---

  async getUserSettings() {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) return JSON.parse(stored);
      // Default offline settings
      return {
        targetPerCycle: 50,
        userSchedule: { 
          daysOff: [], 
          weeklyWeights: [1, 1, 1, 1, 1, 1, 1] // Default: All days are work days
        }
      };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    let { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code === 'PGRST116') {
       // Row doesn't exist (legacy user?), create it
       const { data: newData, error: createError } = await supabase
         .from('user_settings')
         .insert([{ user_id: user.id }])
         .select()
         .single();
       if (createError) throw createError;
       data = newData;
    } else if (error) {
      throw error;
    }

    // Determine weekly weights.
    // Logic: If 'weekly_weights' doesn't exist in DB (it might not yet), 
    // fall back to 'exclude_weekends' boolean.
    // If that doesn't exist, default to [1,1,1,1,1,1,1].
    let weeklyWeights = data.weekly_weights;
    if (!weeklyWeights) {
      if (data.exclude_weekends) {
        // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
        weeklyWeights = [0, 1, 1, 1, 1, 1, 0];
      } else {
        weeklyWeights = [1, 1, 1, 1, 1, 1, 1];
      }
    }

    return {
      targetPerCycle: data.target_per_cycle,
      userSchedule: { 
        daysOff: (data.days_off as string[]) || [],
        weeklyWeights: weeklyWeights
      } as UserSchedule
    };
  },

  async updateTarget(target: number) {
    if (!isSupabaseConfigured) {
      const current = await this.getUserSettings();
      const updated = { ...current, targetPerCycle: target };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('user_settings')
      .update({ target_per_cycle: target })
      .eq('user_id', user.id);
    if (error) throw error;
  },

  async updateSchedule(schedule: UserSchedule) {
    if (!isSupabaseConfigured) {
      const current = await this.getUserSettings();
      const updated = { ...current, userSchedule: schedule };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // --- Strategy: 3-Tier Fallback Save ---
    
    // Attempt 1: Full Update (Preferred - New Schema)
    // Tries to save 'weekly_weights' AND 'days_off'
    const { error: err1 } = await supabase
      .from('user_settings')
      .update({ 
        days_off: schedule.daysOff,
        weekly_weights: schedule.weeklyWeights
      })
      .eq('user_id', user.id);
      
    if (!err1) return; // Success!

    // Helper to identify missing column errors
    const isSchemaError = (err: any) => 
        err.message?.includes('weekly_weights') || 
        err.message?.includes('exclude_weekends') ||
        err.message?.includes('column') ||
        err.code === '42703' || 
        err.message?.includes('schema cache');

    // If err1 was a schema error, try fallback
    if (isSchemaError(err1)) {
        console.warn("Primary schedule update failed (New Schema). Attempting legacy fallback.");

        // Attempt 2: Legacy Update (Exclude Weekends)
        // Convert weights back to simple boolean if possible
        const excludeWeekends = (schedule.weeklyWeights[0] === 0 && schedule.weeklyWeights[6] === 0);
        
        const { error: err2 } = await supabase
            .from('user_settings')
            .update({ 
                days_off: schedule.daysOff,
                exclude_weekends: excludeWeekends
            })
            .eq('user_id', user.id);

        if (!err2) return; // Success on legacy!

        // If err2 was ALSO a schema error (even legacy column missing), try minimal
        if (isSchemaError(err2)) {
             console.warn("Legacy schedule update failed. Attempting minimal save (Days Off only).");
             
             // Attempt 3: Minimal Update (Days Off only)
             // This should almost always work if the table exists
             const { error: err3 } = await supabase
                .from('user_settings')
                .update({ 
                    days_off: schedule.daysOff 
                })
                .eq('user_id', user.id);
            
            if (!err3) return; // Success on minimal!
            
             // If even minimal fails, throw the minimal error
             throw new Error("DB Update Failed (Minimal): " + err3.message);
        }
        
        // If err2 failed but NOT because of schema (e.g. permission/network), throw it
        throw new Error("DB Update Failed (Legacy): " + err2.message);
    }

    // If err1 failed but NOT because of schema, throw it
    throw new Error("DB Update Failed: " + err1.message);
  }
};