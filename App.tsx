
import React, { useState, useEffect, useRef } from 'react';
import { Manuscript, Status, UserSchedule } from './types';
import Dashboard from './components/Dashboard';
import ManuscriptList from './components/ManuscriptList';
import ManuscriptForm from './components/ManuscriptForm';
import BillingReconciliationModal from './components/BillingReconciliationModal';
import HistoryReport from './components/HistoryReport';
import { Auth } from './components/Auth';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { dataService } from './services/dataService';
import { LayoutDashboard, List, Plus, ShieldCheck, LogOut, Loader2, DollarSign } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!isSupabaseConfigured);
  const authInitRef = useRef(false);

  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [targetPerCycle, setTargetPerCycle] = useState<number>(50);
  const [userSchedule, setUserSchedule] = useState<UserSchedule>({ daysOff: [], weeklyWeights: [1, 1, 1, 1, 1, 1, 1] });

  const [view, setView] = useState<'dashboard' | 'list' | 'billing'>('dashboard');
  const [listFilter, setListFilter] = useState<Status | 'ALL' | 'PENDING_GROUP' | 'URGENT'>('ALL'); 
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const initAuth = async () => {
    if (!isSupabaseConfigured) {
      setIsOffline(true);
      setSession({ user: { id: 'offline-user', email: 'guest@local.dev', user_metadata: { full_name: 'Guest Analyst' } } } as any);
      setLoading(false);
      return;
    }
    try {
      const auth = supabase.auth as any;
      const s = auth.session ? auth.session() : (await auth.getSession?.())?.data?.session;
      if (s) setSession(s);
      setLoading(false);
    } catch { setIsOffline(true); setLoading(false); }
  };

  useEffect(() => {
    if (authInitRef.current) return;
    authInitRef.current = true;
    initAuth();
    const authListener = (supabase.auth as any).onAuthStateChange?.((_e: any, s: any) => { 
      // Stabilization: Only update session if user ID actually changed to prevent redundant loadData triggers
      setSession((prev: any) => {
        if (s?.user?.id === prev?.user?.id) return prev;
        return s;
      }); 
      if (!s && !isOffline) setSession(null);
    });
    
    return () => {
      const subscription = authListener?.data?.subscription || authListener?.data || authListener;
      if (subscription?.unsubscribe) subscription.unsubscribe();
      else if (typeof subscription === 'function') (subscription as any)();
    };
  }, [isOffline]);

  // Load data when session is established or connectivity changes
  useEffect(() => {
    if (session) loadData();
  }, [session?.user?.id, isOffline]);

  const loadData = async () => {
    if (dataLoading) return;
    setDataLoading(true);
    try {
      const [mss, settings] = await Promise.all([
        dataService.getManuscripts(isOffline), 
        dataService.getUserSettings(isOffline)
      ]);
      setManuscripts(mss);
      if (settings) { 
        setTargetPerCycle(settings.targetPerCycle); 
        setUserSchedule(settings.userSchedule); 
      }
    } finally { setDataLoading(false); }
  };

  const handleSave = async (manuscript: Manuscript) => {
    setDataLoading(true);
    try {
      const result = editingId ? await dataService.updateManuscript(manuscript, isOffline) : await dataService.createManuscript(manuscript, isOffline);
      setManuscripts(prev => editingId ? prev.map(m => m.id === result.id ? result : m) : [result, ...prev]);
      setIsFormOpen(false); 
      setEditingId(null);
    } finally { setDataLoading(false); }
  };

  const handleQuickUpdate = async (id: string, updates: Partial<Manuscript>) => {
    const original = manuscripts.find(m => m.id === id);
    if (!original) return;
    const now = new Date().toISOString();
    let updated = { ...original, ...updates, dateUpdated: now };
    if (updates.status && updates.status !== original.status) {
      updated.dateStatusChanged = now;
      if ([Status.WORKED, Status.BILLED].includes(updates.status) && !original.completedDate) updated.completedDate = now;
    }
    // Optimistic Update
    setManuscripts(prev => prev.map(m => m.id === id ? updated : m));
    try {
      await dataService.updateManuscript(updated, isOffline);
    } catch (error) {
      console.error("Failed to update status", error);
      // Rollback on failure
      setManuscripts(prev => prev.map(m => m.id === id ? original : m));
    }
  };

  const handleReconcileBilling = async (ids: string[], billedDate: string) => {
    setDataLoading(true);
    const originalManuscripts = [...manuscripts];
    
    // Optimistic Update: Update UI immediately
    setManuscripts(prev => prev.map(m => ids.includes(m.id) ? { 
      ...m, 
      status: Status.BILLED, 
      billedDate,
      dateStatusChanged: new Date().toISOString()
    } : m));

    try {
      await dataService.updateManuscripts(ids, { 
        status: Status.BILLED, 
        billedDate: billedDate,
        dateStatusChanged: new Date().toISOString()
      }, isOffline);
      setIsBillingOpen(false);
    } catch (error) {
      console.error("Billing update failed", error);
      // Rollback to original state if DB update failed
      setManuscripts(originalManuscripts);
      alert("Failed to reconcile billing. Please check your connection.");
    } finally { 
      setDataLoading(false); 
    }
  };

  const handleEdit = (m: Manuscript) => {
    setEditingId(m.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    setDataLoading(true);
    try { 
      await dataService.deleteManuscript(id, isOffline); 
      setManuscripts(prev => prev.filter(m => m.id !== id)); 
    } finally { setDataLoading(false); }
  };

  const handleViewChange = (v: any) => { if (v === 'list') setListFilter('ALL'); setView(v); };

  const user = session?.user;
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Analyst';

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>;
  if (!session) return <Auth />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      <header className="glass border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200"><ShieldCheck className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none">MasterCopy</h1>
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Workflow Analyst</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button onClick={() => handleViewChange('dashboard')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${view === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><LayoutDashboard className="w-4 h-4 mr-2 inline" />Overview</button>
            <button onClick={() => handleViewChange('list')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${view === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List className="w-4 h-4 mr-2 inline" />Worklog</button>
            <button onClick={() => handleViewChange('billing')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${view === 'billing' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><DollarSign className="w-4 h-4 mr-2 inline" />Reconcile</button>
          </nav>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsBillingOpen(true)} className="p-2.5 text-slate-400 hover:text-indigo-600 transition-all rounded-xl" title="Batch Reconcile Billing">
              <DollarSign className="w-5 h-5" />
            </button>
            <button onClick={() => { setEditingId(null); setIsFormOpen(true); }} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-black flex items-center gap-2 shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all"><Plus className="w-4 h-4" /> Log File</button>
            <button onClick={() => (supabase.auth as any).signOut().then(() => window.location.reload())} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all border border-transparent"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>
      <main className={`flex-1 w-full mx-auto px-8 py-10 ${view === 'list' || view === 'billing' ? 'max-w-full' : 'max-w-7xl'}`}>
        {view === 'dashboard' && <Dashboard userName={userName} manuscripts={manuscripts} target={targetPerCycle} userSchedule={userSchedule} onUpdateTarget={t => {setTargetPerCycle(t); dataService.updateTarget(t, isOffline);}} onFilterClick={f => {setListFilter(f); setView('list');}} onUpdateSchedule={s => {setUserSchedule(s); dataService.updateSchedule(s, isOffline);}} />}
        {view === 'list' && <ManuscriptList manuscripts={manuscripts} onEdit={handleEdit} onDelete={handleDelete} onUpdate={handleQuickUpdate} onBulkUpdate={()=>{}} onRefresh={loadData} activeFilter={listFilter} />}
        {view === 'billing' && <HistoryReport manuscripts={manuscripts} userName={userName} />}
      </main>
      {isFormOpen && <ManuscriptForm initialData={manuscripts.find(x => x.id === editingId)} onSave={handleSave} onCancel={() => setIsFormOpen(false)} existingManuscripts={manuscripts} />}
      {isBillingOpen && <BillingReconciliationModal manuscripts={manuscripts} onConfirm={handleReconcileBilling} onClose={() => setIsBillingOpen(false)} />}
    </div>
  );
};

export default App;
