import React, { useState, useEffect } from 'react';
import { Manuscript, Status, UserSchedule } from './types';
import Dashboard from './components/Dashboard';
import ManuscriptList from './components/ManuscriptList';
import ManuscriptForm from './components/ManuscriptForm';
import BulkImportModal from './components/BulkImportModal';
import GamificationHub from './components/AchievementsModal'; 
import DeveloperGuideModal from './components/DeveloperGuideModal';
import { Auth } from './components/Auth';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { dataService } from './services/dataService';
import { LayoutDashboard, List, Plus, ShieldCheck, Upload, LogOut, Loader2, Database, Trophy, RefreshCw } from 'lucide-react';
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
  const [view, setView] = useState<'dashboard' | 'list'>('dashboard');
  const [listFilter, setListFilter] = useState<Status | 'ALL' | 'PENDING_GROUP'>('ALL'); 
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isGamificationOpen, setIsGamificationOpen] = useState(false);
  const [isDevOpen, setIsDevOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Bulk Review Queue State
  const [bulkQueue, setBulkQueue] = useState<string[]>([]);
  const [isBulkReview, setIsBulkReview] = useState(false);

  // Auth & Initial Load
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
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
    if (session && isSupabaseConfigured) {
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
      // alert("Failed to load data. Please check your connection.");
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
      
      // Bulk Review Logic: Move to next item or close
      if (isBulkReview && bulkQueue.length > 0) {
        const nextId = bulkQueue[0];
        setBulkQueue(prev => prev.slice(1));
        setEditingId(nextId);
        // Do not close form, ManuscriptForm will update via useEffect on initialData change
      } else {
        // Queue finished or normal save
        setIsFormOpen(false);
        setEditingId(null);
        setIsBulkReview(false);
        setBulkQueue([]);
      }
    } catch (error) {
      console.error("Error saving:", error);
      alert("Failed to save record.");
    } finally {
      setDataLoading(false);
    }
  };

  const handleQuickUpdate = async (id: string, updates: Partial<Manuscript>) => {
    // Optimistic Update
    setManuscripts(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));

    const original = manuscripts.find(m => m.id === id);
    if (!original) return;

    // Prepare full object for DB
    const updatedManuscript = { 
      ...original, 
      ...updates, 
      dateUpdated: new Date().toISOString() 
    };

    // If status changed, update status date
    if (updates.status && updates.status !== original.status) {
      updatedManuscript.dateStatusChanged = new Date().toISOString();
      if (updatedManuscript.status === Status.WORKED && !updatedManuscript.completedDate) {
        updatedManuscript.completedDate = new Date().toISOString();
      }
    }

    try {
      await dataService.updateManuscript(updatedManuscript);
    } catch (error) {
      console.error("Quick update failed:", error);
      alert("Failed to update record.");
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
    } catch (error) {
      console.error("Bulk update failed:", error);
      alert("Failed to update multiple records.");
      loadData(); 
    } finally {
      setDataLoading(false);
    }
  };

  // Start the interactive review queue
  const handleBulkReview = (ids: string[]) => {
    if (ids.length === 0) return;
    
    setIsBulkReview(true);
    // Queue is everything AFTER the first one
    setBulkQueue(ids.slice(1));
    // Immediately open the first one
    setEditingId(ids[0]);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this record? This action cannot be undone.")) {
      setDataLoading(true);
      try {
        await dataService.deleteManuscript(id);
        setManuscripts(prev => prev.filter(m => m.id !== id));
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Failed to delete record.");
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
    } catch (error) {
      console.error("Bulk import failed:", error);
      alert("Some items failed to import.");
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
    dataService.updateSchedule(schedule).catch(err => {
      console.error("Schedule sync failed:", err);
      if (err.message && (err.message.includes('weekly_weights') || err.message.includes('column') || err.message.includes('relation'))) {
         alert("Database schema mismatch detected. Please go to 'Dev Setup' (database icon) and run the updated SQL script.");
      }
    });
  };

  // UI Handlers
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

  const handleViewChange = (newView: 'dashboard' | 'list') => {
    if (newView === 'list') {
      setListFilter('ALL'); 
    }
    setView(newView);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setManuscripts([]);
  };

  // Construct data for the form.
  // If in Bulk Review mode, we override status to WORKED and completedDate to Today
  const getEditingData = () => {
    if (!editingId) return undefined;
    const m = manuscripts.find(x => x.id === editingId);
    if (!m) return undefined;
    
    if (isBulkReview) {
       return {
         ...m,
         status: Status.WORKED,
         // Default to now if not already set, or override? 
         // User wants to "Mark as worked", so we pre-fill.
         completedDate: m.completedDate || new Date().toISOString(),
         dateStatusChanged: new Date().toISOString()
       };
    }
    return m;
  };

  const user = session?.user;
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Analyst';

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-slate-200 text-center animate-fade-in">
          <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-6">
            <Database className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-3">Setup Required</h1>
          <p className="text-slate-600 mb-6 leading-relaxed">
            Please connect your Supabase project to start tracking.
          </p>
          <div className="bg-slate-50 rounded-lg p-4 text-left text-sm font-mono text-slate-700 border border-slate-200 mb-6 overflow-x-auto shadow-inner">
            <div className="flex items-center gap-2 mb-2 border-b border-slate-200 pb-2">
               <span className="font-semibold text-slate-500">.env</span>
            </div>
            <p className="whitespace-nowrap">VITE_SUPABASE_URL=...</p>
            <p className="whitespace-nowrap">VITE_SUPABASE_ANON_KEY=...</p>
          </div>
          <p className="text-xs text-slate-400">
            Configure these variables in your project settings.
          </p>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-sm">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden sm:block">MasterCopy <span className="text-blue-600">Tracker</span></h1>
            {dataLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin ml-2" />}
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => handleViewChange('dashboard')}
                className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'dashboard' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <div className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4" /> <span className="hidden sm:inline">Overview</span></div>
              </button>
              <button 
                onClick={() => handleViewChange('list')}
                className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <div className="flex items-center gap-2"><List className="w-4 h-4" /> <span className="hidden sm:inline">Workflow List</span></div>
              </button>
            </nav>
            
            <div className="hidden md:flex flex-col items-end mr-2 pl-4 border-l border-slate-200">
                <span className="text-sm font-semibold text-slate-800 leading-tight">{userName}</span>
                <button 
                  onClick={() => setIsGamificationOpen(true)}
                  className="text-[10px] text-blue-600 uppercase tracking-wider font-bold hover:underline"
                >
                  View Profile & Rewards
                </button>
            </div>

            <div className="flex gap-2">
               <button
                onClick={() => loadData()}
                className="bg-white hover:bg-slate-50 text-slate-500 hover:text-blue-600 border border-slate-200 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
                title="Sync / Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsDevOpen(true)}
                className="bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
                title="Developer Settings"
              >
                <Database className="w-4 h-4" />
                <span className="hidden lg:inline">Dev Setup</span>
              </button>
              <button
                onClick={() => setIsGamificationOpen(true)}
                className="bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-200 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
                title="Achievements"
              >
                <Trophy className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsImportOpen(true)}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
                title="Import"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setEditingId(null); setIsFormOpen(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Log Work</span>
              </button>
              <button
                onClick={handleSignOut}
                className="bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 ${view === 'list' ? 'max-w-[95%]' : 'max-w-7xl'}`}>
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
        ) : (
          <ManuscriptList 
            manuscripts={manuscripts} 
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUpdate={handleQuickUpdate}
            onBulkUpdate={handleBulkUpdate}
            onBulkReview={handleBulkReview} // Passed new handler
            activeFilter={listFilter}
          />
        )}
      </main>

      {/* Modals */}
      {isFormOpen && (
        <ManuscriptForm 
          initialData={getEditingData()} // Uses pre-filled logic for bulk review
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
    </div>
  );
};

export default App;