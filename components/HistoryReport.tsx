
import React, { useMemo } from 'react';
import { Manuscript, Status } from '../types';
import { Calendar, DollarSign, FileText, CheckCircle } from 'lucide-react';

interface HistoryReportProps {
  manuscripts: Manuscript[];
  userName: string;
}

const HistoryReport: React.FC<HistoryReportProps> = ({ manuscripts }) => {
  const groupedData = useMemo(() => {
    const billed = manuscripts.filter(m => m.status === Status.BILLED && m.billedDate);
    const groups: Record<string, Manuscript[]> = {};
    
    billed.forEach(m => {
      const date = new Date(m.billedDate!);
      const key = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    
    return Object.entries(groups).sort((a, b) => {
      const dateA = new Date(a[1][0].billedDate!);
      const dateB = new Date(b[1][0].billedDate!);
      return dateB.getTime() - dateA.getTime();
    });
  }, [manuscripts]);

  return (
    <div className="space-y-8 animate-page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Billing Reconciliation</h2>
          <p className="text-sm text-slate-500 font-medium">History of confirmed publication-ready files.</p>
        </div>
      </div>

      <div className="space-y-12">
        {groupedData.length === 0 ? (
          <div className="bg-white rounded-[2rem] border border-slate-200 p-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
               <FileText className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-400 font-bold">No billed manuscripts found. Group your WORKED files to see them here.</p>
          </div>
        ) : (
          groupedData.map(([cycle, items]) => (
            <section key={cycle} className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-wider">{cycle}</h3>
                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black">{items.length} Files</span>
              </div>
              
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5">Manuscript ID</th>
                      <th className="px-8 py-5">Journal</th>
                      <th className="px-8 py-5">Billed On</th>
                      <th className="px-8 py-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-8 py-5 font-black text-slate-800">{m.manuscriptId}</td>
                        <td className="px-8 py-5 text-xs font-bold text-slate-500 uppercase">{m.journalCode}</td>
                        <td className="px-8 py-5 text-xs font-bold text-slate-400">{new Date(m.billedDate!).toLocaleDateString()}</td>
                        <td className="px-8 py-5 text-right">
                          <span className="inline-flex items-center gap-1 text-indigo-600 font-black text-[10px] uppercase">
                            <CheckCircle className="w-3.5 h-3.5" /> Billed
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryReport;
