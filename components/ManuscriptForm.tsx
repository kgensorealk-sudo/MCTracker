import React, { useState, useEffect } from 'react';
import { Manuscript, Status, IssueType, Note } from '../types';
import { X, Save, Edit2, Trash2, Plus, RefreshCw, ArrowRight, AlertTriangle } from 'lucide-react';

interface ManuscriptFormProps {
  initialData?: Manuscript;
  onSave: (manuscript: Manuscript) => void;
  onCancel: () => void;
  isQueueMode?: boolean;
  queueLength?: number;
  existingManuscripts: Manuscript[];
}

const ManuscriptForm: React.FC<ManuscriptFormProps> = ({ initialData, onSave, onCancel, isQueueMode = false, queueLength = 0, existingManuscripts }) => {
  const [formData, setFormData] = useState<Partial<Manuscript>>(
    initialData || {
      manuscriptId: '',
      journalCode: '',
      status: Status.UNTOUCHED,
      priority: 'Normal',
      issueTypes: [],
      notes: [],
      dateReceived: new Date().toISOString(),
      dateStatusChanged: new Date().toISOString(),
      completedDate: undefined,
    }
  );
  
  const [error, setError] = useState<string | null>(null);

  // Keep track of status to auto-update dateStatusChanged
  const [prevStatus, setPrevStatus] = useState<Status>(initialData?.status || Status.UNTOUCHED);
  
  // Note/Remark Logic
  const [currentNote, setCurrentNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Update form data when initialData changes (e.g. queue navigation)
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setPrevStatus(initialData.status);
      // Clear local inputs
      setCurrentNote('');
      setEditingNoteId(null);
      setError(null);
    }
  }, [initialData?.id]); // Only trigger when ID changes

  // Auto-update status date when status changes
  useEffect(() => {
    if (formData.status && formData.status !== prevStatus) {
      const now = new Date().toISOString();
      const updates: Partial<Manuscript> = { dateStatusChanged: now };
      
      // If moving to WORKED and no completedDate is set, default to now
      if (formData.status === Status.WORKED && !formData.completedDate) {
        updates.completedDate = now;
      }
      
      setFormData(prev => ({ ...prev, ...updates }));
      setPrevStatus(formData.status);
    }
  }, [formData.status, prevStatus, formData.completedDate]);

  const formatDateForInput = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const handleIssueToggle = (type: IssueType) => {
    const currentIssues = formData.issueTypes || [];
    if (currentIssues.includes(type)) {
      setFormData({ ...formData, issueTypes: currentIssues.filter(t => t !== type) });
    } else {
      setFormData({ ...formData, issueTypes: [...currentIssues, type] });
    }
  };

  const handleSaveNote = () => {
    if (!currentNote.trim()) return;

    if (editingNoteId) {
      // Update existing note
      setFormData(prev => ({
        ...prev,
        notes: prev.notes?.map(n => 
          n.id === editingNoteId 
            ? { ...n, content: currentNote, timestamp: Date.now() } // Update timestamp on edit
            : n
        ) || []
      }));
      setEditingNoteId(null);
    } else {
      // Add new note
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
    if (window.confirm('Are you sure you want to delete this remark?')) {
      setFormData(prev => ({
        ...prev,
        notes: prev.notes?.filter(n => n.id !== noteId) || []
      }));
      
      // If we were editing the deleted note, clear the input
      if (editingNoteId === noteId) {
        handleCancelEdit();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.manuscriptId || !formData.journalCode) return;

    // Check for Duplicate ID
    const duplicate = existingManuscripts.find(
       m => m.manuscriptId.toLowerCase() === formData.manuscriptId?.toLowerCase() && m.id !== (initialData?.id || '')
    );

    if (duplicate) {
      setError(`Duplicate found! Manuscript ID "${formData.manuscriptId}" already exists.`);
      return;
    }

    const manuscript: Manuscript = {
      id: initialData?.id || crypto.randomUUID(),
      manuscriptId: formData.manuscriptId!,
      journalCode: formData.journalCode!,
      status: formData.status || Status.UNTOUCHED,
      priority: formData.priority || 'Normal',
      issueTypes: formData.issueTypes || [],
      dateReceived: formData.dateReceived || new Date().toISOString(),
      dueDate: formData.dueDate,
      completedDate: formData.status === Status.WORKED ? formData.completedDate : undefined,
      dateUpdated: new Date().toISOString(),
      dateStatusChanged: formData.dateStatusChanged || new Date().toISOString(),
      notes: formData.notes || [],
    };
    onSave(manuscript);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {isQueueMode ? `Reviewing (${queueLength + 1} remaining)` : (initialData ? 'Edit Manuscript' : 'New Manuscript Worklog')}
            </h2>
            {isQueueMode && <p className="text-xs text-blue-600 font-medium">Bulk Mode: Verify details and click Next</p>}
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-center gap-2 text-sm font-medium animate-pulse">
               <AlertTriangle className="w-4 h-4" />
               {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Manuscript ID</label>
              <input
                required
                type="text"
                placeholder="e.g. JRNL-2023-456"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.manuscriptId}
                onChange={e => {
                  setFormData({...formData, manuscriptId: e.target.value});
                  setError(null); // Clear duplicate error on typing
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Journal Code</label>
              <input
                required
                type="text"
                placeholder="e.g. NEJM, NATURE"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.journalCode}
                onChange={e => setFormData({...formData, journalCode: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date Sent (Received)</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formatDateForInput(formData.dateReceived)}
                onChange={e => setFormData({...formData, dateReceived: new Date(e.target.value).toISOString()})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formatDateForInput(formData.dueDate)}
                onChange={e => setFormData({...formData, dueDate: new Date(e.target.value).toISOString()})}
              />
            </div>
          </div>

          <div className={`p-4 rounded-xl border ${isQueueMode ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
            <h3 className="text-sm font-semibold text-slate-800 mb-3 uppercase tracking-wider">Status & Priority</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Status</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value as Status})}
                >
                  <option value={Status.UNTOUCHED}>Untouched (New)</option>
                  <optgroup label="Pending / Issues">
                    <option value={Status.PENDING_JM}>Pending: JM Query</option>
                    <option value={Status.PENDING_TL}>Pending: TL Query</option>
                    <option value={Status.PENDING_CED}>Pending: Email CED</option>
                  </optgroup>
                  <option value={Status.WORKED}>Completed</option>
                </select>
              </div>
              
              {formData.status === Status.WORKED ? (
                <div>
                  <label className="block text-sm font-medium text-emerald-700 mb-1">Date Completed</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 border border-emerald-300 ring-1 ring-emerald-100 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    value={formatDateForInput(formData.completedDate)}
                    onChange={e => setFormData({...formData, completedDate: new Date(e.target.value).toISOString()})}
                    title="The actual date work was finished"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={formatDateForInput(formData.dateStatusChanged)}
                    onChange={e => setFormData({...formData, dateStatusChanged: new Date(e.target.value).toISOString()})}
                    title="Date when the status changed"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.priority}
                  onChange={e => setFormData({...formData, priority: e.target.value as any})}
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Quality Checks</label>
            <div className="flex flex-wrap gap-2">
              {Object.values(IssueType).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleIssueToggle(type)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    formData.issueTypes?.includes(type)
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Remarks {editingNoteId && <span className="text-blue-600 ml-2 font-normal">(Editing Mode)</span>}
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  editingNoteId ? 'border-blue-300 bg-blue-50' : 'border-slate-300'
                }`}
                placeholder={editingNoteId ? "Update your remark..." : "Add a remark or note..."}
                value={currentNote}
                onChange={e => setCurrentNote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSaveNote())}
              />
              <button
                type="button"
                onClick={handleSaveNote}
                className={`px-4 py-2 text-white rounded-lg font-medium flex items-center gap-2 ${
                   editingNoteId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-600 hover:bg-slate-700'
                }`}
              >
                {editingNoteId ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingNoteId ? 'Update' : 'Add'}
              </button>
              {editingNoteId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium"
                  title="Cancel Edit"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2 border border-slate-100">
              {formData.notes?.length === 0 && <p className="text-slate-400 text-sm text-center">No remarks added.</p>}
              {formData.notes?.map(note => (
                <div key={note.id} className={`text-sm bg-white p-2 rounded border shadow-sm flex justify-between items-start group ${
                  editingNoteId === note.id ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-200'
                }`}>
                  <div className="flex-1 mr-2">
                    <p className="text-slate-700 whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(note.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleEditClick(note)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit Remark"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete Remark"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
            >
              {isQueueMode ? 'Skip Remaining' : 'Cancel'}
            </button>
            <button
              type="submit"
              className={`px-6 py-2 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 ${
                  isQueueMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'
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
    </div>
  );
};

export default ManuscriptForm;