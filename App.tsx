import React, { useState } from 'react';
import { Manuscript, Status } from './types';
import Dashboard from './components/Dashboard';
import ManuscriptList from './components/ManuscriptList';
import ManuscriptForm from './components/ManuscriptForm';
import BulkImportModal from './components/BulkImportModal';
import GamificationHub from './components/AchievementsModal'; 
import DeveloperGuideModal from './components/DeveloperGuideModal';
import HistoryReport from './components/HistoryReport';
import { Auth } from './components/Auth';
import { LayoutDashboard, List, Plus, ShieldCheck, LogOut, Loader2, Database, Trophy, History, Upload } from 'lucide-react';
import { calculateXP, calculateLevel } from './services/gamification';
import { useAppData } from './hooks/useAppData';

const App: React.FC = () => {
  const {
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
    handleQuickUpdate,
    handleBulkUpdate,
    handleBulkImport: appDataBulkImport,
    handleSignOut
  } = useAppData();

  // UI States
  const [view, setView] = useState<'dashboard' | 'list' | 'history'>('dashboard');
  const [listFilter, setListFilter] = useState<Status | 'ALL' | 'PENDING_GROUP' | 'HANDOVER'>('ALL'); 
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isGamificationOpen, setIsGamificationOpen] = useState(false);
  const [isDevOpen, setIsDevOpen] = useState(false);
  // Daily report removed
  const [editingId, setEditingId] = useState<string | null>(null);

  // Bulk Review Queue State
  const [bulkQueue, setBulkQueue] = useState<string[]>([]);
  const [isBulkReview, setIsBulkReview] = useState(false);

  const handleSave = async (manuscript: Manuscript) => {
    const result = await saveManuscript(manuscript, !!editingId);
    
    if (result) {
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
    }
  };

  const handleBulkImport = async (newItems: Manuscript[]) => {
    await appDataBulkImport(newItems);
    setListFilter('ALL');
    setView('list'); 
  };

  const handleBulkReview = (ids: string[]) => {
    if (ids.length === 0) return;
    setIsBulkReview(true);
    setBulkQueue(ids.slice(1));
    setEditingId(ids[0]);
    setIsFormOpen(true);
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
              {/* Daily Report removed */}
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

      {/* Daily Report modal removed */}
    </div>
  );
};

export default App;
