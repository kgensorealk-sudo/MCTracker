import React from 'react';
import { X, Database, Copy, Check, Terminal, Info, History, Calculator } from 'lucide-react';

interface DeveloperGuideModalProps {
  onClose: () => void;
}

const DeveloperGuideModal: React.FC<DeveloperGuideModalProps> = ({ onClose }) => {
  const [copied, setCopied] = React.useState(false);

  const sqlContent = `-- 1. Shift Logs Table
CREATE TABLE IF NOT EXISTS shift_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE shift_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own logs" ON shift_logs;
CREATE POLICY "Users can view own logs" ON shift_logs FOR SELECT USING ( auth.uid() = user_id );

DROP POLICY IF EXISTS "Users can insert own logs" ON shift_logs;
CREATE POLICY "Users can insert own logs" ON shift_logs FOR INSERT WITH CHECK ( auth.uid() = user_id );

-- 2. Manuscripts Table
CREATE TABLE IF NOT EXISTS manuscripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  manuscript_id TEXT NOT NULL,
  journal_code TEXT NOT NULL,
  status TEXT DEFAULT 'UNTOUCHED',
  priority TEXT DEFAULT 'Normal',
  date_received TIMESTAMPTZ DEFAULT now(),
  due_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  date_updated TIMESTAMPTZ DEFAULT now(),
  date_status_changed TIMESTAMPTZ DEFAULT now(),
  issue_types TEXT[] DEFAULT '{}',
  notes JSONB DEFAULT '[]'
);

ALTER TABLE manuscripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own manuscripts" ON manuscripts;
CREATE POLICY "Users can manage own manuscripts" ON manuscripts FOR ALL USING ( auth.uid() = user_id );

-- 3. User Settings (Targets & Smart Pacing)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  target_per_cycle INTEGER DEFAULT 50,
  shift_state JSONB DEFAULT '{"status": "IDLE", "startTime": null, "lastActiveTime": null}',
  days_off TEXT[] DEFAULT '{}',
  weekly_weights JSONB DEFAULT '[1, 1, 1, 1, 1, 1, 1]',
  exclude_weekends BOOLEAN DEFAULT false
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own settings" ON user_settings;
CREATE POLICY "Users can manage own settings" ON user_settings FOR ALL USING ( auth.uid() = user_id );

-- Indexing
CREATE INDEX IF NOT EXISTS idx_shift_logs_user_date ON shift_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manuscripts_user_updated ON manuscripts (user_id, date_updated DESC);`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Database className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Database Setup & Developer Guide</h2>
              <p className="text-sm text-slate-500">Required configuration for Shift Timer and History features</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Context & Explanations */}
            <div className="lg:col-span-1 space-y-6">
              
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                  <Terminal className="w-4 h-4" /> Action Required
                </h3>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Run the updated SQL script on the right in your Supabase SQL Editor. It includes the new <code>weekly_weights</code> column needed for Smart Pacing.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" /> Why replace the old SQL?
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <History className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-700">Fixes Smart Pacing</h4>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1">
                        Adds the column needed to save your Saturday/Sunday intensity preferences.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Calculator className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-700">Better Performance</h4>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1">
                        Includes indexes for faster dashboard loading.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-700 mb-2">How to Apply</h3>
                <ol className="list-decimal pl-4 space-y-2 text-xs text-slate-600">
                  <li>Open <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">Supabase Dashboard</a>.</li>
                  <li>Go to <strong>SQL Editor</strong> (sidebar).</li>
                  <li>Click <strong>New Query</strong>.</li>
                  <li>Paste the code and click <strong>Run</strong>.</li>
                </ol>
              </div>
            </div>

            {/* Right Column: Code */}
            <div className="lg:col-span-2 flex flex-col h-full min-h-[400px]">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Database className="w-4 h-4 text-slate-400" /> Schema Script (Updated)
                </label>
                <button 
                  onClick={copyToClipboard}
                  className="text-xs flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:border-blue-200 transition-all active:scale-95"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied to Clipboard' : 'Copy SQL'}
                </button>
              </div>
              <div className="relative group flex-1">
                <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono overflow-auto h-full max-h-[500px] border border-slate-700 leading-relaxed shadow-inner">
                  {sqlContent}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeveloperGuideModal;