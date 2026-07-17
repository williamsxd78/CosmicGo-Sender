import { useEffect, useState } from 'react';
import { PageHeader } from '../components/UI';

export default function Logs() {
  const [tab, setTab] = useState<'activity' | 'technical'>('activity');
  const [rows, setRows] = useState<any[]>([]);

  const refresh = async () => {
    const res = tab === 'activity' ? await window.cosmic.activityLogs({ limit: 500 }) : await window.cosmic.technicalLogs({ limit: 500 });
    if (res.ok) setRows(res.data as any[]);
  };
  useEffect(() => { void refresh(); const t = setInterval(refresh, 4000); return () => clearInterval(t); }, [tab]);

  return (
    <div className="pb-10">
      <PageHeader
        title="System Logs"
        subtitle="Separate user-facing activity log and technical log. Secrets are automatically masked."
        actions={
          <div className="flex gap-1">
            <button data-testid="logs-activity-tab" className={`cs-btn cs-btn-ghost ${tab === 'activity' ? 'ring-1 ring-cosmic-accent text-white' : ''}`} onClick={() => setTab('activity')}>Activity</button>
            <button data-testid="logs-technical-tab" className={`cs-btn cs-btn-ghost ${tab === 'technical' ? 'ring-1 ring-cosmic-accent text-white' : ''}`} onClick={() => setTab('technical')}>Technical</button>
          </div>
        }
      />
      <div className="px-8">
        <div className="cs-card p-3 max-h-[70vh] overflow-y-auto">
          {rows.length === 0 ? <div className="p-4 text-cosmic-muted text-sm">No logs yet.</div> : (
            <ul className="divide-y divide-white/5 text-xs font-mono" data-testid="logs-list">
              {rows.map((r) => (
                <li key={r.id} className="py-1.5 px-2 flex items-start gap-3">
                  <span className="text-cosmic-muted w-44 shrink-0">{new Date(r.ts).toLocaleString()}</span>
                  <span className={`cs-badge ${r.level === 'error' ? 'cs-badge-danger' : r.level === 'warn' ? 'cs-badge-warn' : 'cs-badge-info'}`}>{r.level}</span>
                  {r.scope && <span className="text-cosmic-accent">[{r.scope}]</span>}
                  <span className="flex-1 break-all">{r.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
