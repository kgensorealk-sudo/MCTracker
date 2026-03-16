import React, { useState, useEffect } from 'react';
import { Manuscript, Status, Note } from '../types';
import ConfirmDialog from './ConfirmDialog';
import { X, Save, Edit2, Trash2, Plus, RefreshCw, ArrowRight, AlertTriangle, AlertCircle, Mail, CheckSquare, Copy, Check } from 'lucide-react';

interface ManuscriptFormProps {
  initialData?: Manuscript;
  onSave: (manuscript: Manuscript) => void;
  onCancel: () => void;
  isQueueMode?: boolean;
  queueLength?: number;
  existingManuscripts: Manuscript[];
}

const ManuscriptForm: React.FC<ManuscriptFormProps> = ({ initialData, onSave, onCancel, isQueueMode = false, queueLength = 0, existingManuscripts }) => {
  // Animation State
  const [isClosing, setIsClosing] = useState(false);

  const [formData, setFormData] = useState<Partial<Manuscript>>(
    initialData || {
      manuscriptId: '',
      journalCode: '',
      status: Status.UNTOUCHED,
      priority: 'Normal',
      notes: [],
      dateReceived: new Date().toISOString(),
      dateStatusChanged: new Date().toISOString(),
      completedDate: undefined,
    }
  );
  
  const [error, setError] = useState<string | null>(null);
  const [prevStatus, setPrevStatus] = useState<Status>(initialData?.status || Status.UNTOUCHED);
  
  const [currentNote, setCurrentNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (formData.manuscriptId) {
      navigator.clipboard.writeText(formData.manuscriptId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setPrevStatus(initialData.status);
      setCurrentNote('');
      setEditingNoteId(null);
      setError(null);
    }
  }, [initialData?.id]);

  useEffect(() => {
    if (formData.status && formData.status !== prevStatus) {
      const now = new Date().toISOString();
      const updates: Partial<Manuscript> = { dateStatusChanged: now };
      if (formData.status === Status.WORKED && !formData.completedDate) {
        updates.completedDate = now;
      }
      
      setFormData(prev => ({ 
        ...prev, 
        ...updates
      }));
      setPrevStatus(formData.status);
    }
  }, [formData.status, prevStatus, formData.completedDate]);

  // Graceful Close Handler
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onCancel();
    }, 200); // Match animation duration
  };

  const formatDateForInput = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const handleSaveNote = () => {
    if (!currentNote.trim()) return;

    if (editingNoteId) {
      setFormData(prev => ({
        ...prev,
        notes: prev.notes?.map(n => 
          n.id === editingNoteId 
            ? { ...n, content: currentNote, timestamp: Date.now() } 
            : n
        ) || []
      }));
      setEditingNoteId(null);
    } else {
      const newNote: Note = {
        id: Date.now().toString(),
        content: currentNote,
        timestamp: Date.now()
      };
      setFormData(prev => ({
        ...prev,
        notes: [newNote, ...(prev.notes || [])]
      }));
    }
    setCurrentNote('');
  };

  const handleEditClick = (note: Note) => {
    setCurrentNote(note.content);
    setEditingNoteId(note.id);
  };

  const handleCancelEdit = () => {
    setCurrentNote('');
    setEditingNoteId(null);
  };

  const handleDeleteNote = (noteId: string) => {
    setConfirmDeleteNote(noteId);
  };

  const confirmDelete = () => {
    if (!confirmDeleteNote) return;
    setFormData(prev => ({
      ...prev,
      notes: prev.notes?.filter(n => n.id !== confirmDeleteNote) || []
    }));
    if (editingNoteId === confirmDeleteNote) {
      handleCancelEdit();
    }
    setConfirmDeleteNote(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.manuscriptId || !formData.journalCode) return;

    const duplicate = existingManuscripts.find(
       m => m.manuscriptId.toLowerCase() === formData.manuscriptId?.toLowerCase() && m.id !== (initialData?.id || '')
    );

    if (duplicate) {
      setError(`Duplicate found! Manuscript ID "${formData.manuscriptId}" already exists.`);
      return;
    }

    // Handle auto-note if status changed and no manual note was added
    let finalNotes = [...(formData.notes || [])];
    const statusChanged = formData.status !== initialData?.status;
    const manualNoteAdded = finalNotes.length > (initialData?.notes?.length || 0);

    if (statusChanged && !manualNoteAdded) {
      const statusLabels: Record<Status, string> = {
        [Status.WORKED]: 'Completed / Worked',
        [Status.PENDING]: 'Pending (Queried)',
        [Status.PENDING_JM]: 'Queried to JM',
        [Status.PENDING_TL]: 'TL Query Raised',
        [Status.PENDING_CED]: 'Email CED Sent',
        [Status.BILLED]: 'Marked as Billed',
        [Status.UNTOUCHED]: 'Reset to Untouched'
      };
      
      const autoNote: Note = {
        id: crypto.randomUUID(),
        content: `Status updated to: ${statusLabels[formData.status!] || formData.status}`,
        timestamp: Date.now()
      };
      finalNotes = [autoNote, ...finalNotes];
    }

    const manuscript: Manuscript = {
      id: initialData?.id || crypto.randomUUID(),
      manuscriptId: formData.manuscriptId!,
      journalCode: formData.journalCode!,
      status: formData.status || Status.UNTOUCHED,
      pendingFlags: formData.pendingFlags || { jm: false, tl: false, ced: false },
      priority: formData.priority || 'Normal',
      dateReceived: formData.dateReceived || new Date().toISOString(),
      dueDate: formData.dueDate,
      completedDate: formData.status === Status.WORKED ? formData.completedDate : undefined,
      dateUpdated: new Date().toISOString(),
      dateStatusChanged: formData.dateStatusChanged || new Date().toISOString(),
      notes: finalNotes,
    };
    
    // For save, we usually don't need exit animation, but let's do it for consistency
    setIsClosing(true);
    setTimeout(() => onSave(manuscript), 200);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md ${isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 ${isClosing ? 'modal-content-exit' : 'modal-content-enter'}`}>
        <div className="flex justify-between items-center p-6 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {isQueueMode ? `Reviewing (${queueLength + 1} remaining)` : (initialData ? 'Edit Manuscript' : 'New Manuscript Worklog')}
            </h2>
            {isQueueMode && <p className="text-xs text-blue-600 font-medium">Bulk Mode: Verify details and click Next</p>}
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center gap-2 text-sm font-medium animate-pulse">
               <AlertTriangle className="w-4 h-4" />
               {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Manuscript ID</label>
              <div className="relative group/id">
                <input
                  required
                  type="text"
                  placeholder="e.g. JRNL-2023-456"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium pr-12"
                  value={formData.manuscriptId}
                  onChange={e => {
                    setFormData({...formData, manuscriptId: e.target.value});
                    setError(null);
                  }}
                />
                {formData.manuscriptId && (
                  <button 
                    type="button"
                    onClick={handleCopy}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${copied ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                    title="Copy Manuscript ID"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Journal Code</label>
              <input
                required
                type="text"
                placeholder="e.g. NEJM, NATURE"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium"
                value={formData.journalCode}
                onChange={e => setFormData({...formData, journalCode: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Date Sent (Received)</label>
              <input
                type="date"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-slate-600"
                value={formatDateForInput(formData.dateReceived)}
                onChange={e => setFormData({...formData, dateReceived: new Date(e.target.value).toISOString()})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Due Date</label>
              <input
                type="date"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-slate-600"
                value={formatDateForInput(formData.dueDate)}
                onChange={e => setFormData({...formData, dueDate: new Date(e.target.value).toISOString()})}
              />
            </div>
          </div>

          <div className={`p-5 rounded-2xl border ${isQueueMode ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50/50 border-slate-200'}`}>
            <h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest flex items-center gap-2">
               Status & Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Current Status</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, status: Status.WORKED})}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${formData.status === Status.WORKED ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-100' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                  >
                    Worked
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, status: Status.PENDING})}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${formData.status === Status.PENDING || [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(formData.status as Status) ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-100' : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                  >
                    Pending
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, status: Status.UNTOUCHED})}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${formData.status === Status.UNTOUCHED ? 'bg-slate-600 text-white border-slate-600 shadow-md shadow-slate-100' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    Untouched
                  </button>
                </div>

                {(formData.status === Status.PENDING || [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(formData.status as Status)) && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-3">Active Queries (Select all that apply)</p>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const flags = formData.pendingFlags || { jm: false, tl: false, ced: false };
                          const newFlags = { ...flags, jm: !flags.jm };
                          setFormData({
                            ...formData,
                            status: Status.PENDING,
                            pendingFlags: newFlags
                          });
                        }}
                        className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${formData.pendingFlags?.jm || formData.status === Status.PENDING_JM ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-100' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'}`}
                      >
                        <span className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" /> JM Query
                        </span>
                        {(formData.pendingFlags?.jm || formData.status === Status.PENDING_JM) && <CheckSquare className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const flags = formData.pendingFlags || { jm: false, tl: false, ced: false };
                          const newFlags = { ...flags, tl: !flags.tl };
                          setFormData({
                            ...formData,
                            status: Status.PENDING,
                            pendingFlags: newFlags
                          });
                        }}
                        className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${formData.pendingFlags?.tl || formData.status === Status.PENDING_TL ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-100' : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                      >
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> TL Query
                        </span>
                        {(formData.pendingFlags?.tl || formData.status === Status.PENDING_TL) && <CheckSquare className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const flags = formData.pendingFlags || { jm: false, tl: false, ced: false };
                          const newFlags = { ...flags, ced: !flags.ced };
                          setFormData({
                            ...formData,
                            status: Status.PENDING,
                            pendingFlags: newFlags
                          });
                        }}
                        className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${formData.pendingFlags?.ced || formData.status === Status.PENDING_CED ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-100' : 'bg-white text-violet-600 border-violet-200 hover:bg-violet-50'}`}
                      >
                        <span className="flex items-center gap-2">
                          <Mail className="w-4 h-4" /> Email CED
                        </span>
                        {(formData.pendingFlags?.ced || formData.status === Status.PENDING_CED) && <CheckSquare className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <select
                    className="w-full pl-3 pr-8 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 appearance-none bg-white font-medium"
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as Status})}
                  >
                    <option value={Status.UNTOUCHED}>Untouched (New)</option>
                    <option value={Status.PENDING}>Pending (Multi-Query)</option>
                    <option value={Status.WORKED}>Completed</option>
                    <option value={Status.BILLED}>Billed</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>
              
              {formData.status === Status.WORKED ? (
                <div>
                  <label className="block text-sm font-bold text-emerald-700 mb-1.5">Date Completed</label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2.5 border border-emerald-300 bg-emerald-50 text-emerald-900 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-semibold"
                    value={formatDateForInput(formData.completedDate)}
                    onChange={e => setFormData({...formData, completedDate: new Date(e.target.value).toISOString()})}
                    title="The actual date work was finished"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Status Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-slate-600"
                    value={formatDateForInput(formData.dateStatusChanged)}
                    onChange={e => setFormData({...formData, dateStatusChanged: new Date(e.target.value).toISOString()})}
                    title="Date when the status changed"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Priority</label>
                <div className="relative">
                  <select
                    className={`w-full pl-3 pr-8 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 appearance-none font-medium ${
                       formData.priority === 'Urgent' ? 'bg-red-50 border-red-200 text-red-700' :
                       formData.priority === 'High' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                       'bg-white border-slate-300 text-slate-700'
                    }`}
                    value={formData.priority}
                    onChange={e => setFormData({...formData, priority: e.target.value as any})}
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Remarks {editingNoteId && <span className="text-blue-600 ml-2 font-normal animate-pulse">(Editing Mode)</span>}
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                className={`flex-1 px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 transition-all ${
                  editingNoteId ? 'border-blue-300 bg-blue-50' : 'border-slate-300 bg-slate-50 focus:bg-white'
                }`}
                placeholder={editingNoteId ? "Update your remark..." : "Add a remark or note..."}
                value={currentNote}
                onChange={e => setCurrentNote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSaveNote())}
              />
              <button
                type="button"
                onClick={handleSaveNote}
                className={`px-4 py-2 text-white rounded-xl font-medium flex items-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm ${
                   editingNoteId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-800'
                }`}
              >
                {editingNoteId ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingNoteId ? 'Update' : 'Add'}
              </button>
              {editingNoteId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3 py-2 text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 font-medium transition-colors"
                  title="Cancel Edit"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="bg-slate-50/50 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2 border border-slate-200 shadow-inner custom-scrollbar">
              {formData.notes?.length === 0 && <p className="text-slate-400 text-sm text-center py-2">No remarks added yet.</p>}
              {formData.notes?.map(note => (
                <div key={note.id} className={`text-sm bg-white p-3 rounded-lg border shadow-sm flex justify-between items-start group transition-all ${
                  editingNoteId === note.id ? 'border-blue-400 ring-2 ring-blue-50' : 'border-slate-100 hover:border-slate-300'
                }`}>
                  <div className="flex-1 mr-2">
                    <p className="text-slate-700 whitespace-pre-wrap">{note.content}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">{new Date(note.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleEditClick(note)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="Edit Remark"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete Remark"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
            >
              {isQueueMode ? 'Skip Remaining' : 'Cancel'}
            </button>
            <button
              type="submit"
              className={`px-8 py-2.5 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 ${
                  isQueueMode ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {isQueueMode ? (
                  <>
                    <Save className="w-4 h-4" />
                    {queueLength > 0 ? 'Save & Next' : 'Save & Finish'}
                    {queueLength > 0 && <ArrowRight className="w-4 h-4 ml-1" />}
                  </>
              ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Record
                  </>
              )}
            </button>
          </div>
        </form>
      </div>
      <ConfirmDialog 
        isOpen={!!confirmDeleteNote}
        title="Delete Remark"
        message="Are you sure you want to delete this remark? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteNote(null)}
      />
    </div>
  );
};

export default ManuscriptForm;