import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from './components/ConfirmDialog';
import { Manuscript, Status } from './types';
import Dashboard from './components/Dashboard';
import ManuscriptList from './components/ManuscriptList';
import ManuscriptForm from './components/ManuscriptForm';
import BulkImportModal from './components/BulkImportModal';
import GamificationHub from './components/AchievementsModal'; 
import DeveloperGuideModal from './components/DeveloperGuideModal';
import HistoryReport from './components/HistoryReport';
import DailyReportModal from './components/DailyReportModal';
import BillingReconciliationModal from './components/BillingReconciliationModal';
import { BillingCycleModal } from './components/BillingCycleModal';
import { Auth } from './components/Auth';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { useAppData } from './hooks/useAppData';
import { ACHIEVEMENTS } from './services/gamification';
import { LayoutDashboard, List, Plus, ShieldCheck, LogOut, Loader2, History, Mail, Upload, Trophy, User } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { ToastContainer, ToastType } from './components/Toast';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!isSupabaseConfigured);
  const authInitRef = useRef(false);

  const {
    manuscripts,
    setManuscripts,
    targetPerCycle,
    userSchedule,
    loadData,
    createManuscript,
    updateManuscript,
    updateManuscripts,
    deleteManuscript,
    updateTarget,
    updateSchedule,
    createManuscripts
  } = useAppData(isOffline);

  // UI States
  const [view, setView] = useState<'dashboard' | 'list' | 'history'>('dashboard');
  const [listFilter, setListFilter] = useState<Status | 'ALL' | 'PENDING_GROUP' | 'HANDOVER'>('ALL'); 
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isGamificationOpen, setIsGamificationOpen] = useState(false);
  const [hasNewAchievements, setHasNewAchievements] = useState(false);
  const [isDevOpen, setIsDevOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastType }[]>([]);

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  const [billingCycleModal, setBillingCycleModal] = useState<{
    isOpen: boolean;
    manuscripts: Manuscript | Manuscript[] | null;
  }>({
    isOpen: false,
    manuscripts: null,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Bulk Review Queue State
  const [bulkQueue, setBulkQueue] = useState<string[]>([]);
  const [isBulkReview, setIsBulkReview] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const openConfirm = (title: string, message: string, onConfirm: () => void, variant: 'danger' | 'warning' | 'info' = 'danger', confirmLabel?: string) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, variant, confirmLabel });
  };

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'n' || e.key === 'N') {
        setEditingId(null);
        setIsFormOpen(true);
      }
      if (e.key === 'd' || e.key === 'D') setView('dashboard');
      if (e.key === 'f' || e.key === 'F') setView('list');
      if (e.key === 'r' || e.key === 'R') setView('history');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check for new achievements
  useEffect(() => {
    if (manuscripts.length > 0) {
      const unlockedIds = ACHIEVEMENTS
        .filter(a => a.condition(manuscripts, targetPerCycle))
        .map(a => a.id);
      
      try {
        const seenIds = JSON.parse(localStorage.getItem('mc_tracker_seen_achievements') || '[]');
        const hasNew = unlockedIds.some(id => !seenIds.includes(id));
        setHasNewAchievements(hasNew);
      } catch (e) {
        console.error('Error parsing seen achievements', e);
        setHasNewAchievements(unlockedIds.length > 0);
      }
    }
  }, [manuscripts, targetPerCycle]);

  const handleOpenGamification = () => {
    setIsGamificationOpen(true);
    const unlockedIds = ACHIEVEMENTS
      .filter(a => a.condition(manuscripts, targetPerCycle))
      .map(a => a.id);
    localStorage.setItem('mc_tracker_seen_achievements', JSON.stringify(unlockedIds));
    setHasNewAchievements(false);
  };

  // Cycle Progress for Header
  const cycleProgress = useMemo(() => {
    if (manuscripts.length === 0) return 0;
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth();
    const year = now.getFullYear();
    let start: Date;
    let end: Date;

    if (day >= 11 && day <= 25) {
      start = new Date(year, month, 11);
      end = new Date(year, month, 25);
    } else {
      if (day >= 26) {
        start = new Date(year, month, 26);
        end = new Date(year, month + 1, 10);
      } else {
        start = new Date(year, month - 1, 26);
        end = new Date(year, month, 10);
      }
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const completed = manuscripts.filter(m => {
      if (m.status !== Status.WORKED && m.status !== Status.BILLED) return false;
      // Prioritize billedDate for financial cycle grouping, then completedDate
      const d = new Date(m.billedDate || m.completedDate || m.dateStatusChanged || m.dateUpdated);
      return d >= start && d <= end;
    }).length;

    return Math.min(100, Math.round((completed / targetPerCycle) * 100));
  }, [manuscripts, targetPerCycle]);

  const sortedCycles = useMemo(() => {
    const cycles: Record<string, { info: { id: string; label: string; startDate: Date; endDate: Date }; files: Manuscript[] }> = {};
    
    manuscripts.forEach(m => {
      if (m.status === Status.WORKED || m.status === Status.BILLED) {
        // Prioritize billedDate for financial cycle grouping, then completedDate
        const d = new Date(m.billedDate || m.completedDate || m.dateStatusChanged || m.dateUpdated || m.dateReceived);
        const day = d.getDate();
        const month = d.getMonth();
        const year = d.getFullYear();
        
        let label = "";
        let start: Date;
        let end: Date;
        
        if (day >= 11 && day <= 25) {
          label = `${d.toLocaleString('default', { month: 'short' })} 11-25`;
          start = new Date(year, month, 11);
          end = new Date(year, month, 25);
        } else {
          if (day >= 26) {
            label = `${d.toLocaleString('default', { month: 'short' })} 26 - Next 10`;
            start = new Date(year, month, 26);
            end = new Date(year, month + 1, 10);
          } else {
            const prev = new Date(year, month - 1, 26);
            label = `${prev.toLocaleString('default', { month: 'short' })} 26 - ${d.toLocaleString('default', { month: 'short' })} 10`;
            start = prev;
            end = new Date(year, month, 10);
          }
        }

        const id = start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') + (day >= 11 && day <= 25 ? '-C1' : '-C2');
        if (!cycles[id]) {
          cycles[id] = { 
            info: { id, label, startDate: start, endDate: end }, 
            files: [] 
          };
        }
        cycles[id].files.push(m);
      }
    });

    return Object.values(cycles).sort((a, b) => b.info.startDate.getTime() - a.info.startDate.getTime());
  }, [manuscripts]);

  const enterOfflineMode = () => {
    if (isOffline) return; 
    setIsOffline(true);
    setSession({
      access_token: 'offline_token',
      user: {
        id: 'offline-user',
        email: 'guest@local.dev',
        user_metadata: { full_name: 'Guest Analyst' },
      }
    } as any);
    setLoading(false);
  };

  useEffect(() => {
    if (authInitRef.current) return;
    authInitRef.current = true;

    const initAuth = async () => {
      const forceOffline = localStorage.getItem('mc_tracker_force_offline') === 'true';
      if (!isSupabaseConfigured || forceOffline) {
        enterOfflineMode();
        return;
      }
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          setSession(currentSession);
        }
        setLoading(false);
      } catch (err) {
        console.error("Auth init error:", err);
        enterOfflineMode();
      }
    };
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        setIsOffline(false);
      } else if (!isOffline) {
        setSession(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadData();
  }, [session, isOffline, loadData]);

  const handleSave = async (manuscript: Manuscript) => {
    try {
      if (editingId) {
        await updateManuscript(manuscript);
        showToast(`Manuscript ${manuscript.manuscriptId} updated`);
      } else {
        await createManuscript(manuscript);
        showToast(`Manuscript ${manuscript.manuscriptId} created`);
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
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  const handleQuickUpdate = async (id: string, updates: Partial<Manuscript>) => {
    await handleBulkUpdate([id], updates);
  };

  const handleConfirmBillingCycle = async (billedDate: string) => {
    const pending = (window as any)._pendingBillingUpdate;
    if (!pending) return;

    const { ids, updates } = pending;
    delete (window as any)._pendingBillingUpdate;

    setBillingCycleModal({ isOpen: false, manuscripts: null });
    
    const finalUpdates = { ...updates };
    if (billedDate !== 'original') {
      finalUpdates.billedDate = billedDate;
    }

    await executeBulkUpdate(ids, finalUpdates);
  };

  const handleBulkUpdate = async (ids: string[], updates: Partial<Manuscript>) => {
    if (ids.length === 0) return;

    // Intercept Status.BILLED to show cycle selection if billedDate is not provided
    if (updates.status === Status.BILLED && !updates.billedDate) {
      const targetMss = manuscripts.filter(m => ids.includes(m.id));
      setBillingCycleModal({
        isOpen: true,
        manuscripts: targetMss.length === 1 ? targetMss[0] : targetMss
      });
      
      // Store the update intent
      (window as any)._pendingBillingUpdate = { ids, updates };
      return;
    }

    await executeBulkUpdate(ids, updates);
    
    // Show toast for status changes
    if (updates.status) {
      const statusLabels: Record<Status, string> = {
        [Status.WORKED]: 'Submitted / Worked',
        [Status.PENDING]: 'Pending Query',
        [Status.PENDING_JM]: 'Queried to JM',
        [Status.PENDING_TL]: 'TL Query Raised',
        [Status.PENDING_CED]: 'Email CED Sent',
        [Status.BILLED]: 'Marked as Billed',
        [Status.UNTOUCHED]: 'Reset to Untouched'
      };
      const label = statusLabels[updates.status] || updates.status;
      const count = ids.length;
      showToast(`${count} item${count > 1 ? 's' : ''} marked as ${label}`);
    }
  };

  const executeBulkUpdate = async (ids: string[], updates: Partial<Manuscript>) => {
    const now = new Date().toISOString();
    const updatedManuscripts = manuscripts.map(m => {
      if (!ids.includes(m.id)) return m;
      const itemUpdates: any = { ...updates, dateUpdated: now };
      if (updates.status && updates.status !== m.status) {
        itemUpdates.dateStatusChanged = now;
        if ((updates.status === Status.WORKED || updates.status === Status.BILLED) && !m.completedDate) {
          itemUpdates.completedDate = now;
        }
        
        if (updates.status === Status.BILLED && !updates.billedDate && !m.billedDate) {
          itemUpdates.billedDate = updates.completedDate || itemUpdates.completedDate || m.completedDate || now;
        }
        
        if (!updates.notes) {
          const statusLabels: Record<Status, string> = {
            [Status.WORKED]: 'Completed / Worked',
            [Status.PENDING]: 'Pending Query',
            [Status.PENDING_JM]: 'Queried to JM',
            [Status.PENDING_TL]: 'TL Query Raised',
            [Status.PENDING_CED]: 'Email CED Sent',
            [Status.BILLED]: 'Marked as Billed',
            [Status.UNTOUCHED]: 'Reset to Untouched'
          };
          
          const autoNote = {
            id: crypto.randomUUID(),
            content: `Status updated to: ${statusLabels[updates.status] || updates.status}`,
            timestamp: Date.now()
          };
          
          itemUpdates.notes = [autoNote, ...(m.notes || [])];
        }
      }
      return { ...m, ...itemUpdates };
    });

    setManuscripts(updatedManuscripts);
    
    try { 
      for (const id of ids) {
        const m = updatedManuscripts.find(item => item.id === id);
        if (m) {
          const finalUpdates = { ...updates };
          if (updates.status && updates.status !== m.status) {
            (finalUpdates as any).dateStatusChanged = now;
            if ((updates.status === Status.WORKED || updates.status === Status.BILLED) && !m.completedDate) {
              (finalUpdates as any).completedDate = now;
            }
            if (!updates.notes) {
              (finalUpdates as any).notes = m.notes;
            }
          }
          await updateManuscripts([id], finalUpdates);
        }
      }
    } catch (error) {
      console.error("Bulk update error:", error);
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
    openConfirm(
      "Delete Record",
      "Are you sure you want to delete this record permanently? This action cannot be undone.",
      async () => {
        try {
          await deleteManuscript(id);
          showToast('Manuscript deleted', 'info');
        } catch (error) {
          console.error("Delete error:", error);
        }
      }
    );
  };

  const handleBulkDelete = async (ids: string[]) => {
    openConfirm(
      "Bulk Delete",
      `Are you sure you want to delete ${ids.length} records permanently? This action cannot be undone.`,
      async () => {
        try {
          for (const id of ids) {
            await deleteManuscript(id);
          }
          showToast(`${ids.length} manuscripts deleted`, 'info');
        } catch (error) {
          console.error("Bulk delete error:", error);
        }
      }
    );
  };

  const handleBulkImport = async (newItems: Manuscript[]) => {
    try {
      await createManuscripts(newItems);
      await loadData();
      setListFilter('ALL');
      setView('list'); 
      showToast(`${newItems.length} items imported successfully`);
    } catch (error: any) {
      console.error("Bulk import error:", error);
      const errorMessage = error.message || "Failed to import items. Please check your connection or database setup.";
      openConfirm(
        "Import Error",
        errorMessage,
        () => {},
        'info',
        'Acknowledged'
      );
    }
  };

  const handleMarkReported = async (ids: string[]) => {
    const now = new Date().toISOString();
    await updateManuscripts(ids, { dateEmailed: now });
    showToast(`${ids.length} items marked as reported`);
  };

  const handleUpdateRate = (cycleId: string, rate: { usd: number; php: number }) => {
    const newRates = { ...(userSchedule.cycleRates || {}), [cycleId]: rate };
    const updatedSchedule = { ...userSchedule, cycleRates: newRates };
    updateSchedule(updatedSchedule);
    showToast(`Billing rates updated for ${cycleId}`, 'info');
  };

  const handleSignOut = async () => {
    localStorage.removeItem('mc_tracker_force_offline');
    if (isSupabaseConfigured && !isOffline) await supabase.auth.signOut();
    window.location.reload();
  };

  const user = session?.user;
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Analyst';

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium text-sm animate-pulse">Initializing Analyst Workspace...</p>
      </div>
    </div>
  );

  if (!session) return <Auth />;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col relative text-slate-900">
      <header className={`sticky top-0 z-40 w-full transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-2xl border-b border-slate-200/60 h-16 shadow-sm shadow-slate-200/20' : 'bg-transparent h-20 sm:h-24'}`}>
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Logo & Progress */}
          <div className="flex items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2.5 group cursor-pointer" onClick={() => setView('dashboard')}>
              <div className={`bg-slate-900 rounded-xl shadow-lg shadow-slate-200 group-hover:scale-110 transition-all duration-300 ${scrolled ? 'p-1.5' : 'p-2.5'}`}>
                <ShieldCheck className={`${scrolled ? 'w-4 h-4' : 'w-6 h-6'} text-white transition-all duration-300`} />
              </div>
              <div className="hidden md:block">
                <h1 className={`font-black tracking-tight text-slate-900 leading-none transition-all duration-300 ${scrolled ? 'text-sm' : 'text-lg'}`}>MasterCopy</h1>
                {!scrolled && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 animate-fade-in">Analyst Hub</p>}
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className={`relative flex items-center justify-center transition-all duration-300 ${scrolled ? 'w-8 h-8' : 'w-10 h-10'}`}>
                <svg className="w-full h-full -rotate-90">
                  <circle cx={scrolled ? 16 : 20} cy={scrolled ? 16 : 20} r={scrolled ? 13 : 16} fill="none" stroke="#f1f5f9" strokeWidth="3" />
                  <circle 
                    cx={scrolled ? 16 : 20} cy={scrolled ? 16 : 20} r={scrolled ? 13 : 16} fill="none" stroke="currentColor" strokeWidth="3" 
                    strokeDasharray={scrolled ? 81.6 : 100.5} 
                    strokeDashoffset={(scrolled ? 81.6 : 100.5) - ((scrolled ? 81.6 : 100.5) * cycleProgress / 100)}
                    className="text-brand-500 transition-all duration-700 ease-out"
                  />
                </svg>
                <span className={`absolute font-black text-slate-600 transition-all duration-300 ${scrolled ? 'text-[8px]' : 'text-[9px]'}`}>{cycleProgress}%</span>
              </div>
              {!scrolled && (
                <div className="hidden lg:block animate-fade-in">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cycle Progress</p>
                  <p className="text-xs font-black text-slate-700">Target: {targetPerCycle}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="hidden md:flex items-center bg-slate-100/50 p-1 rounded-2xl border border-slate-200/50">
            <button 
              onClick={() => setView('dashboard')} 
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${view === 'dashboard' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <LayoutDashboard className="w-4 h-4" /> <span>Overview</span>
            </button>
            <button 
              onClick={() => { setView('list'); setListFilter('ALL'); }} 
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${view === 'list' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <List className="w-4 h-4" /> <span>Files</span>
            </button>
            <button 
              onClick={() => setView('history')} 
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${view === 'history' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <History className="w-4 h-4" /> <span>Reports</span>
            </button>
          </nav>

          {/* Actions & User */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center bg-slate-100/50 p-1 rounded-2xl border border-slate-200/50 mr-2">
              <button 
                onClick={handleOpenGamification}
                className="p-2 text-slate-500 hover:text-amber-600 hover:bg-white rounded-xl transition-all duration-200 relative group"
                title="Achievements"
              >
                <Trophy className="w-5 h-5" />
                {hasNewAchievements && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full border-2 border-white"></span>
                )}
              </button>
              <button 
                onClick={() => setIsReportOpen(true)}
                className="p-2 text-slate-500 hover:text-brand-600 hover:bg-white rounded-xl transition-all duration-200"
                title="Daily Report"
              >
                <Mail className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsImportOpen(true)}
                className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-white rounded-xl transition-all duration-200"
                title="Bulk Import"
              >
                <Upload className="w-5 h-5" />
              </button>
            </div>

            <button 
              onClick={() => { setEditingId(null); setIsFormOpen(true); }} 
              className="bg-slate-900 hover:bg-slate-800 text-white p-2.5 rounded-2xl shadow-lg shadow-slate-200 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden lg:inline text-sm font-bold pr-1">New Entry</span>
            </button>

            <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>

            {/* User Profile */}
            <div className="flex items-center gap-3 pl-1">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-black text-slate-900 leading-none">{userName}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Level {Math.floor(manuscripts.length / 50) + 1}</span>
              </div>
              <button 
                onClick={handleSignOut}
                className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all group"
              >
                <User className="w-5 h-5 group-hover:hidden" />
                <LogOut className="w-5 h-5 hidden group-hover:block" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 ${view === 'list' ? 'max-w-full' : 'max-w-7xl'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {view === 'dashboard' && (
              <Dashboard 
                manuscripts={manuscripts} 
                target={targetPerCycle}
                userSchedule={userSchedule}
                onUpdateTarget={updateTarget}
                onFilterClick={(f) => { setListFilter(f); setView('list'); }}
                onUpdateSchedule={updateSchedule}
                onViewHistory={() => setView('history')}
              />
            )}
            {view === 'list' && (
              <ManuscriptList 
                manuscripts={manuscripts} 
                onEdit={(m) => { setEditingId(m.id); setIsFormOpen(true); }}
                onDelete={handleDelete}
                onUpdate={handleQuickUpdate}
                onBulkUpdate={handleBulkUpdate}
                onBulkDelete={handleBulkDelete}
                onBulkReview={handleBulkReview}
                activeFilter={listFilter}
              />
            )}
            {view === 'history' && (
              <HistoryReport 
                manuscripts={manuscripts}
                userName={userName}
                onBulkUpdate={handleBulkUpdate}
                cycleRates={userSchedule.cycleRates || {}}
                onUpdateRate={handleUpdateRate}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals */}
      {isFormOpen && (
        <ManuscriptForm 
          initialData={editingId ? manuscripts.find(m => m.id === editingId) : undefined}
          onSave={handleSave}
          onCancel={() => { setIsFormOpen(false); setEditingId(null); setIsBulkReview(false); }}
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
      {isBillingOpen && (
        <BillingReconciliationModal
          manuscripts={manuscripts}
          onClose={() => setIsBillingOpen(false)}
          sortedCycles={sortedCycles}
          onBulkUpdate={handleBulkUpdate}
          cycleRates={userSchedule.cycleRates || {}}
          onUpdateRate={handleUpdateRate}
        />
      )}
      {isReportOpen && (
        <DailyReportModal
          manuscripts={manuscripts}
          onClose={() => setIsReportOpen(false)}
          onMarkReported={handleMarkReported}
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
      {isDevOpen && <DeveloperGuideModal onClose={() => setIsDevOpen(false)} />}
      <BillingCycleModal
        isOpen={billingCycleModal.isOpen}
        onClose={() => setBillingCycleModal({ isOpen: false, manuscripts: null })}
        onConfirm={handleConfirmBillingCycle}
        manuscript={billingCycleModal.manuscripts}
      />

      <ConfirmDialog 
        {...confirmDialog}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default App;