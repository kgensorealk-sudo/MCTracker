import React, { useState, useEffect, useRef } from 'react';
import { Manuscript, Status, UserSchedule } from './types';
import Dashboard from './components/Dashboard';
import ManuscriptList from './components/ManuscriptList';
import ManuscriptForm from './components/ManuscriptForm';
import BulkImportModal from './components/BulkImportModal';
import GamificationHub from './components/AchievementsModal'; 
import DeveloperGuideModal from './components/DeveloperGuideModal';
import HistoryReport from './components/HistoryReport';
import DailyReportModal from './components/DailyReportModal';
import { Auth } from './components/Auth';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { dataService } from './services/dataService';
import { LayoutDashboard, List, Plus, ShieldCheck, LogOut, Loader2, Database, Trophy, History, Mail, Upload } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { calculateXP, calculateLevel } from './services/gamification';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!isSupabaseConfigured);
  const authInitRef = useRef(false);

  // Data States
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [targetPerCycle, setTargetPerCycle] = useState<number>(50);
  const [userSchedule, setUserSchedule] = useState<UserSchedule>({ daysOff: [], weeklyWeights: [1, 1, 1, 1, 1, 1, 1] });

  // UI States
  const [view, setView] = useState<'dashboard' | 'list' | 'history'>('dashboard');
  const [listFilter, setListFilter] = useState<Status | 'ALL' | 'PENDING_GROUP' | 'HANDOVER'>('ALL'); 
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isGamificationOpen, setIsGamificationOpen] = useState(false);
  const [isDevOpen, setIsDevOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Bulk Review Queue State
  const [bulkQueue, setBulkQueue] = useState<string[]>([]);
  const [isBulkReview, setIsBulkReview] = useState(false);

  // Robust Local Date Check
  const isTodayLocal = (dateString?: string) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  };

  const enterOfflineMode = () => {
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
  };

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
  }, []);

  // Priority Escalation Logic
  const autoEscalate = async (items: Manuscript[]) => {
    const escalatedIds: string[] = [];
    const updatedItems = items.map(m => {
      const isDueToday = isTodayLocal(m.dueDate);
      const isPendingReview = [Status.UNTOUCHED, Status.PENDING_TL, Status.PENDING_CED].includes(m.status);
      
      if (isDueToday && isPendingReview && m.priority === 'Normal') {
        escalatedIds.push(m.id);
        return { ...m, priority: 'High' as const, dateUpdated: new Date().toISOString() };
      }
      return m;
    });

    if (escalatedIds.length > 0) {
      try {
        await dataService.updateManuscripts(escalatedIds, { priority: 'High' as const }, isOffline);
      } catch (e) {
        console.error("Auto-escalation sync failed:", e);
      }
    }
    return updatedItems;
  };

  // Fetch Data
  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session, isOffline]);

  const loadData = async () => {
    if (dataLoading) return;
    setDataLoading(true);
    try {
      const [mss, settings] = await Promise.all([
        dataService.getManuscripts(isOffline),
        dataService.getUserSettings(isOffline)
      ]);
      
      const escalatedMss = await autoEscalate(mss || []);
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
  };

  const applyEscalationRule = (m: Manuscript): Manuscript => {
    const isDueToday = isTodayLocal(m.dueDate);
    const isPendingReview = [Status.UNTOUCHED, Status.PENDING_TL, Status.PENDING_CED].includes(m.status);
    
    if (isDueToday && isPendingReview && m.priority === 'Normal') {
      return { ...m, priority: 'High' as const };
    }
    return m;
  };

  const handleSave = async (manuscript: Manuscript) => {
    setDataLoading(true);
    try {
      const processedManuscript = applyEscalationRule(manuscript);
      
      if (editingId) {
        const updated = await dataService.updateManuscript(processedManuscript, isOffline);
        setManuscripts(prev => prev.map(m => m.id === updated.id ? updated : m));
      } else {
        const created = await dataService.createManuscript(processedManuscript, isOffline);
        setManuscripts(prev => [created, ...prev]);
      }
      
      if (isBulkReview && bulkQueue.length > 0) {
        const nextId = bulkQueue[0];
        setBulkQueue(prev => prev.slice(1));
        setEditingId(nextId);
      } else {
        setIsFormOpen(false);
        setEditingId(null);
        setIsBulkReview(false);
        setBulkQueue([]);
      }
    } catch (error: any) {
      console.error("Error saving:", error);
      alert(`Failed to save record: ${error.message || 'Unknown error'}`);
    } finally {
      setDataLoading(false);
    }
  };

  const generateAutoRemark = (oldStatus: Status, newStatus: Status): string => {
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

  const handleQuickUpdate = async (id: string, updates: Partial<Manuscript>) => {
    const original = manuscripts.find(m => m.id === id);
    if (!original) return;

    const now = new Date().toISOString();
    let updatedManuscript = { 
      ...original, 
      ...updates, 
      dateUpdated: now 
    };

    updatedManuscript = applyEscalationRule(updatedManuscript);

    // Automatic remark handling for status changes
    // FIX: Only add auto-remark if no custom notes were provided in the updates object
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
      item = applyEscalationRule(item);
      
      // FIX: Only add auto-remark if no custom notes were provided in the updates object
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

  const handleBulkReview = (ids: string[]) => {
    if (ids.length === 0) return;
    setIsBulkReview(true);
    setBulkQueue(ids.slice(1));
    setEditingId(ids[0]);
    setIsFormOpen(true);
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
        const processed = applyEscalationRule(item);
        const created = await dataService.createManuscript(processed, isOffline);
        createdItems.push(created);
      }
      setManuscripts(prev => [...createdItems, ...prev]);
      setListFilter('ALL');
      setView('list'); 
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

  const handleEdit = (m: Manuscript) => {
    setEditingId(m.id);
    setIsFormOpen(true);
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setIsBulkReview(false);
    setBulkQueue([]);
  };

  const handleDashboardFilter = (filter: Status | 'ALL' | 'PENDING_GROUP') => {
    setListFilter(filter);
    setView('list');
  };

  const handleViewChange = (newView: 'dashboard' | 'list' | 'history') => {
    if (newView === 'list') {
      setListFilter('ALL'); 
    }
    setView(newView);
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

  const getEditingData = () => {
    if (!editingId) return undefined;
    const m = manuscripts.find(x => x.id === editingId);
    if (!m) return undefined;
    if (isBulkReview) {
       return {
         ...m,
         status: Status.WORKED,
         completedDate: m.completedDate || new Date().toISOString(),
         dateStatusChanged: new Date().toISOString()
       };
    }
    return m;
  };

  const user = session?.user;
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Analyst';
  const levelData = calculateLevel(calculateXP(manuscripts, targetPerCycle));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      <div className="fixed top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-50/40 to-transparent -z-10 pointer-events-none"></div>

      {/* Modern Improved Header */}
      <div className="h-[2px] w-full bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-500 sticky top-0 z-50"></div>
      <header className="glass border-b border-slate-200/60 sticky top-[2px] z-40 transition-all duration-300 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo & Status Cluster */}
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl shadow-lg shadow-indigo-200 ring-1 ring-white/20 transition-transform hover:scale-110 active:scale-95 cursor-pointer">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div className="hidden lg:block">
              <h1 className="text-xl font-black text-slate-800 tracking-tight leading-tight">MasterCopy <span className="text-indigo-600">Analyst</span></h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${isOffline ? 'bg-amber-400' : 'bg-emerald-500 pulse-glow'}`}></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isOffline ? 'Offline Sync' : 'Live Workspace'}</span>
              </div>
            </div>
            {dataLoading && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin ml-2" />}
          </div>
          
          {/* Central Navigation Cluster */}
          <nav className="flex items-center bg-slate-100/60 p-1.5 rounded-2xl border border-slate-200/50 backdrop-blur-md shadow-inner mx-4">
            <button 
              onClick={() => handleViewChange('dashboard')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${view === 'dashboard' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
            >
              <LayoutDashboard className="w-4 h-4" /> <span className="hidden xl:inline">Overview</span>
            </button>
            <button 
              onClick={() => handleViewChange('list')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${view === 'list' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
            >
              <List className="w-4 h-4" /> <span className="hidden xl:inline">Worklog</span>
            </button>
            <button 
              onClick={() => handleViewChange('history')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${view === 'history' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
            >
              <History className="w-4 h-4" /> <span className="hidden xl:inline">Analytics</span>
            </button>
          </nav>
          
          {/* Action & Profile Cluster */}
          <div className="flex items-center gap-6">
            
            {/* Action Buttons Group */}
            <div className="hidden sm:flex items-center gap-2 pr-6 border-r border-slate-200">
               <button
                onClick={() => setIsReportOpen(true)}
                className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all hover:scale-110 active:scale-95"
                title="Daily Report"
              >
                <Mail className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsGamificationOpen(true)}
                className="p-2.5 text-slate-500 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all hover:scale-110 active:scale-95"
                title="Achievements"
              >
                <Trophy className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsImportOpen(true)}
                className="p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all hover:scale-110 active:scale-95"
                title="Bulk Import"
              >
                <Upload className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsDevOpen(true)}
                className="p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all hover:scale-110 active:scale-95"
                title="Database Settings"
              >
                <Database className="w-5 h-5" />
              </button>
            </div>

            {/* Profile & CTA Group */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-800 leading-tight">{userName}</span>
                    <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-slate-900 text-white text-[10px] font-black shadow-sm">
                      {levelData.level}
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsGamificationOpen(true)}
                    className="text-[9px] text-indigo-600 uppercase tracking-[0.15em] font-black hover:underline"
                  >
                    Level Progress
                  </button>
              </div>

              <button
                onClick={() => { setEditingId(null); setIsFormOpen(true); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl text-sm font-black flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" /> <span className="hidden md:inline">Log New Work</span>
              </button>

              <button
                onClick={handleSignOut}
                className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-rose-100"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 ${view === 'list' ? 'max-w-[95%]' : 'max-w-7xl'}`}>
        <div key={view} className="animate-page-enter">
          {view === 'dashboard' ? (
            <Dashboard 
              userName={userName}
              manuscripts={manuscripts} 
              target={targetPerCycle}
              userSchedule={userSchedule}
              onUpdateTarget={handleUpdateTarget}
              onFilterClick={handleDashboardFilter}
              onUpdateSchedule={handleUpdateSchedule}
            />
          ) : view === 'list' ? (
            <ManuscriptList 
              manuscripts={manuscripts} 
              onEdit={handleEdit}
              onDelete={handleDelete}
              onUpdate={handleQuickUpdate}
              onBulkUpdate={handleBulkUpdate}
              onBulkReview={handleBulkReview}
              onRefresh={loadData}
              activeFilter={listFilter}
            />
          ) : (
            <HistoryReport 
              manuscripts={manuscripts}
              userName={userName}
              onBulkUpdate={handleBulkUpdate}
            />
          )}
        </div>
      </main>

      {isFormOpen && (
        <ManuscriptForm 
          initialData={getEditingData()}
          onSave={handleSave}
          onCancel={handleFormCancel}
          isQueueMode={isBulkReview}
          queueLength={bulkQueue.length}
          existingManuscripts={manuscripts}
        />
      )}

      {isImportOpen && (
        <BulkImportModal
          onImport={handleBulkImport}
          onClose={() => setIsImportOpen(false)}
          existingManuscripts={manuscripts}
        />
      )}

      {isGamificationOpen && (
        <GamificationHub
          manuscripts={manuscripts}
          target={targetPerCycle}
          userName={userName}
          onClose={() => setIsGamificationOpen(false)}
        />
      )}

      {isDevOpen && (
        <DeveloperGuideModal
          onClose={() => setIsDevOpen(false)}
        />
      )}

      {isReportOpen && (
        <DailyReportModal
          manuscripts={manuscripts}
          onClose={() => setIsReportOpen(false)}
          onMarkReported={handleMarkReported}
        />
      )}
    </div>
  );
};

export default App;