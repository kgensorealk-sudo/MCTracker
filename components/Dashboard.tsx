
import React, { useMemo, useState, useEffect } from 'react';
import { Manuscript, Status, UserSchedule } from '../types';
import { Inbox, CheckCircle2, Clock, MessageSquare, Zap, Gauge } from 'lucide-react';

interface DashboardProps {
  userName: string;
  manuscripts: Manuscript[];
  target: number;
  userSchedule: UserSchedule;
  onUpdateTarget: (target: number) => void;
  onFilterClick: (status: Status | 'ALL' | 'PENDING_GROUP' | 'URGENT') => void;
  onUpdateSchedule: (schedule: UserSchedule) => void;
}

const HeaderClock: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right tabular-nums">
       <p className="text-xl font-black text-slate-900 leading-none mb-1">
          {currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
       </p>
       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currentDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</p>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ userName, manuscripts, onFilterClick }) => {
  const stats = useMemo(() => {
    const workedCount = manuscripts.filter(m => m.status === Status.WORKED || m.status === Status.BILLED).length;
    const pendingCount = manuscripts.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length;
    const jmCount = manuscripts.filter(m => m.status === Status.PENDING_JM).length;
    const urgentCount = manuscripts.filter(m => m.priority === 'Urgent' && m.status !== Status.WORKED).length;
    const untouchCount = manuscripts.filter(m => m.status === Status.UNTOUCHED).length;

    return { workedCount, pendingCount, jmCount, urgentCount, untouchCount };
  }, [manuscripts]);

  return (
    <div className="space-y-8 animate-page-enter">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-200 pb-8">
        <div>
           <h2 className="text-3xl font-black text-slate-900 tracking-tight">System Online, {userName}</h2>
           <p className="text-sm text-slate-500 font-medium">Tracking {manuscripts.length} total assignments.</p>
        </div>
        <HeaderClock />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between h-56 group cursor-pointer border border-slate-800" onClick={() => onFilterClick(Status.WORKED)}>
           <div>
              <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">Files Worked</p>
              <h3 className="text-6xl font-black tracking-tighter">{stats.workedCount}</h3>
           </div>
           <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
             Explore Worklog <CheckCircle2 className="w-4 h-4" />
           </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm flex flex-col justify-between h-56 group hover:border-indigo-200 transition-all cursor-pointer" onClick={() => onFilterClick('PENDING_GROUP')}>
           <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Files Pending</p>
              <h3 className="text-6xl font-black text-slate-900 tracking-tighter">{stats.pendingCount}</h3>
           </div>
           <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs">
             View Queue <Clock className="w-4 h-4" />
           </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm flex flex-col justify-between h-56 group hover:border-rose-200 transition-all cursor-pointer" onClick={() => onFilterClick(Status.PENDING_JM)}>
           <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">JM Queries</p>
              <h3 className="text-6xl font-black text-slate-900 tracking-tighter">{stats.jmCount}</h3>
           </div>
           <div className="flex items-center gap-2 text-rose-600 font-bold text-xs">
             Manage Inquiries <MessageSquare className="w-4 h-4" />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div onClick={() => onFilterClick('URGENT')} className="bg-rose-50 border border-rose-100 rounded-[2rem] p-8 flex items-center justify-between cursor-pointer hover:bg-rose-100 transition-colors">
            <div className="flex items-center gap-6">
               <div className="p-4 bg-rose-500 rounded-2xl text-white shadow-lg shadow-rose-200"><Zap className="w-6 h-6" /></div>
               <div>
                  <h4 className="font-black text-rose-900 uppercase text-xs tracking-widest">Urgent Backlog</h4>
                  <p className="text-xs text-rose-700 font-medium">Files requiring immediate action</p>
               </div>
            </div>
            <span className="text-4xl font-black text-rose-600">{stats.urgentCount}</span>
         </div>
         
         <div onClick={() => onFilterClick(Status.UNTOUCHED)} className="bg-slate-100 border border-slate-200 rounded-[2rem] p-8 flex items-center justify-between cursor-pointer hover:bg-slate-200 transition-colors">
            <div className="flex items-center gap-6">
               <div className="p-4 bg-slate-500 rounded-2xl text-white shadow-lg shadow-slate-200"><Gauge className="w-6 h-6" /></div>
               <div>
                  <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest">Untouched Queue</h4>
                  <p className="text-xs text-slate-700 font-medium">New files in processing pipeline</p>
               </div>
            </div>
            <span className="text-4xl font-black text-slate-600">{stats.untouchCount}</span>
         </div>
      </div>
    </div>
  );
};

export default Dashboard;
