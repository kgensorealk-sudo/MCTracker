import React, { useState, useEffect } from 'react';
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
import { LayoutDashboard, List, Plus, ShieldCheck, Upload, LogOut, Loader2, Database, Trophy, RefreshCw, History, WifiOff, Mail } from 'lucide-react';
import { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Data States
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [targetPerCycle, setTargetPerCycle] = useState<number>(50);
  const [userSchedule, setUserSchedule] = useState<UserSchedule>({ daysOff: [], weeklyWeights: [1, 1, 1, 1, 1, 1, 1] });

  // UI States
  const [view, setView] = useState<'dashboard' | 'list' | 'history'>('dashboard');
  const [listFilter, setListFilter] = useState<Status | 'ALL' | 'PENDING_GROUP'>('ALL'); 
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isGamificationOpen, setIsGamificationOpen] = useState(false);
  const [isDevOpen, setIsDevOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Bulk Review Queue State
  const [bulkQueue, setBulkQueue] = useState<string[]>([]);
  const [isBulkReview, setIsBulkReview] = useState(false);

  // Auth & Initial Load
  useEffect(() => {
    // OFFLINE MODE: If no Supabase config, mock a session to allow local usage
    if (!isSupabaseConfigured) {
      console.log('App running in Offline Mode (LocalStorage)');
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
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    }).catch(err => {
      console.error("Supabase auth error:", err);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Data when Session exists
  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    setDataLoading(true);
    try {
      const [mss, settings] = await Promise.all([
        dataService.getManuscripts(),
        dataService.getUserSettings()
      ]);
      
      setManuscripts(mss);
      if (settings) {
        setTargetPerCycle(settings.targetPerCycle);
        setUserSchedule(settings.userSchedule);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setDataLoading(false);
    }
  };

  const handleSave = async (manuscript: Manuscript) => {
    setDataLoading(true);
    try {
      if (editingId) {
        const updated = await dataService.updateManuscript(manuscript);
        setManuscripts(prev => prev.map(m => m.id === updated.id ? updated : m));
      } else {
        const created = await dataService.createManuscript(manuscript);
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

  const handleQuickUpdate = async (id: string, updates: Partial<Manuscript>) => {
    setManuscripts(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    const original = manuscripts.find(m => m.id === id);
    if (!original) return;

    const updatedManuscript = { 
      ...original, 
      ...updates, 
      dateUpdated: new Date().toISOString() 
    };

    if (updates.status && updates.status !== original.status) {
      updatedManuscript.dateStatusChanged = new Date().toISOString();
      if (updatedManuscript.status === Status.WORKED && !updatedManuscript.completedDate) {
        updatedManuscript.completedDate = new Date().toISOString();
      }
    }

    try {
      await dataService.updateManuscript(updatedManuscript);
    } catch (error: any) {
      console.error("Quick update failed:", error);
      alert(`Failed to update record: ${error.message || 'Unknown error'}`);
      setManuscripts(prev => prev.map(m => m.id === id ? original : m));
    }
  };

  const handleBulkUpdate = async (ids: string[], updates: Partial<Manuscript>) => {
    if (ids.length === 0) return;
    setDataLoading(true);

    const now = new Date().toISOString();
    const finalUpdates = { ...updates, dateStatusChanged: now };

    if (updates.status === Status.WORKED) {
      finalUpdates.completedDate = now;
    }

    setManuscripts(prev => prev.map(m => 
      ids.includes(m.id) ? { ...m, ...finalUpdates, dateUpdated: now } : m
    ));

    try {
      await dataService.updateManuscripts(ids, finalUpdates);
    } catch (error: any) {
      console.error("Bulk update failed:", error);
      alert(`Failed to update multiple records: ${error.message || 'Unknown error'}`);
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
    if (window.confirm("Are you sure you want to delete this record? This action cannot be undone.")) {
      setDataLoading(true);
      try {
        await dataService.deleteManuscript(id);
        setManuscripts(prev => prev.filter(m => m.id !== id));
      } catch (error: any) {
        console.error("Error deleting:", error);
        alert(`Failed to delete record: ${error.message || 'Unknown error'}`);
      } finally {
        setDataLoading(false);
      }
    }
  };

  const handleBulkImport = async (newItems: Manuscript[]) => {
    setDataLoading(true);
    try {
      const createdItems: Manuscript[] = [];
      for (const item of newItems) {
        const created = await dataService.createManuscript(item);
        createdItems.push(created);
      }
      setManuscripts(prev => [...createdItems, ...prev]);
      setListFilter('ALL');
      setView('list'); 
    } catch (error: any) {
      console.error("Bulk import failed:", error);
      alert(`Some items failed to import: ${error.message || 'Error'}`);
      loadData();
    } finally {
      setDataLoading(false);
    }
  };

  const handleUpdateTarget = (target: number) => {
    setTargetPerCycle(target);
    dataService.updateTarget(target).catch(console.error);
  };

  const handleUpdateSchedule = (schedule: UserSchedule) => {
    setUserSchedule(schedule);
    dataService.updateSchedule(schedule).catch((err: any) => {
      console.error("Schedule sync failed:", err);
      if (err.message && (err.message.includes('weekly_weights') || err.message.includes('column') || err.message.includes('relation'))) {
         alert("Database schema mismatch detected. Please go to 'Dev Setup' (database icon) and run the updated SQL script.");
      }
    });
  };

  const handleMarkReported = async (ids: string[]) => {
    const now = new Date().toISOString();
    setManuscripts(prev => prev.map(m => ids.includes(m.id) ? { ...m, dateEmailed: now } : m));
    try {
      await dataService.updateManuscripts(ids, { dateEmailed: now });
    } catch (error: any) {
      console.error("Failed to mark reported: " + (error.message || "Unknown persistence error"));
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
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      window.location.reload();
    }
    setManuscripts([]);
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
      <div className="fixed top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-50/50 to-transparent -z-10 pointer-events-none"></div>

      <header className="glass border-b border-slate-200/60 sticky top-0 z-30 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 ring-1 ring-black/5">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden sm:block">MasterCopy <span className="text-blue-600">Tracker</span></h1>
            {dataLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin ml-2" />}
            {!isSupabaseConfigured && (
              <div className="hidden md:flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-[10px] font-bold text-amber-700 ml-2">
                 <WifiOff className="w-3 h-3" /> Offline Mode
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/50">
              <button 
                onClick={() => handleViewChange('dashboard')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${view === 'dashboard' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
              >
                <div className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4" /> <span className="hidden sm:inline">Overview</span></div>
              </button>
              <button 
                onClick={() => handleViewChange('list')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${view === 'list' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
              >
                <div className="flex items-center gap-2"><List className="w-4 h-4" /> <span className="hidden sm:inline">Files</span></div>
              </button>
              <button 
                onClick={() => handleViewChange('history')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${view === 'history' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
              >
                <div className="flex items-center gap-2"><History className="w-4 h-4" /> <span className="hidden sm:inline">Reports</span></div>
              </button>
            </nav>
            
            <div className="hidden md:flex flex-col items-end mr-2 pl-4 border-l border-slate-200">
                <span className="text-sm font-semibold text-slate-800 leading-tight">{userName}</span>
                <button 
                  onClick={() => setIsGamificationOpen(true)}
                  className="text-[10px] text-blue-600 uppercase tracking-wider font-bold hover:underline"
                >
                  View Rewards
                </button>
            </div>

            <div className="flex gap-2">
               <button
                onClick={() => setIsReportOpen(true)}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm transition-all hover:shadow hover:-translate-y-0.5 active:translate-y-0"
                title="Email Daily Report"
              >
                <Mail className="w-4 h-4" />
                <span className="hidden xl:inline">Daily Report</span>
              </button>
              <button
                onClick={() => setIsDevOpen(true)}
                className="bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm transition-all hover:shadow hover:-translate-y-0.5 active:translate-y-0"
                title="Developer Settings"
              >
                <Database className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsGamificationOpen(true)}
                className="bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm transition-all hover:shadow hover:-translate-y-0.5 active:translate-y-0"
              >
                <Trophy className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setEditingId(null); setIsFormOpen(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Log Work</span>
              </button>
              <button
                onClick={handleSignOut}
                className="bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm transition-all hover:shadow"
              >
                <LogOut className="w-4 h-4" />
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
              activeFilter={listFilter}
            />
          ) : (
            <HistoryReport 
              manuscripts={manuscripts}
              userName={userName}
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