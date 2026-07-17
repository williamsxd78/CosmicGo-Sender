import { useEffect, useState } from 'react';
import { PageHeader, EmptyState, Badge } from '../components/UI';
import { useNavigate } from 'react-router-dom';

const STATUS_TONES: Record<string, 'success' | 'warn' | 'danger' | 'info' | 'muted'> = {
  DRAFT: 'muted', SCHEDULED: 'info', QUEUED: 'info', SENDING: 'info',
  PAUSED: 'warn', COMPLETED: 'success', CANCELLED: 'muted', FAILED: 'danger',
};

export default function History() {
  const [rows, setRows] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      const r = await window.cosmic.listCampaigns();
      if (r.ok) setRows(r.data as any[]);
    })();
  }, []);

  const filtered = statusFilter ? rows.filter((r) => r.status === statusFilter) : rows;

  return (
    <div className="pb-10">
      <PageHeader
        title="Send History"
        subtitle="Full log of every campaign, filterable by status."
        actions={
          <select className="cs-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="history-filter">
            <option value="">All statuses</option>
            {Object.keys(STATUS_TONES).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        }
      />
      <div className="px-8">
        {filtered.length === 0 ? (
          <EmptyState testid="history-empty" title="No history" description="Once you send campaigns they will appear here." />
        ) : (
          <div className="cs-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-cosmic-muted border-b border-cosmic-border">
                <tr>
                  <th className="text-left px-4 py-3">Campaign</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Accepted</th>
                  <th className="text-left px-4 py-3">Failed</th>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="text-left px-4 py-3">Completed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer" onClick={() => nav(`/campaigns/${r.id}`)}>
                    <td className="px-4 py-3">
                      <div>{r.name}</div>
                      <div className="text-xs text-cosmic-muted">{r.subject}</div>
                    </td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONES[r.status] ?? 'muted'}>{r.status}</Badge></td>
                    <td className="px-4 py-3">{r.total}</td>
                    <td className="px-4 py-3 text-emerald-400">{r.accepted}</td>
                    <td className="px-4 py-3 text-red-400">{r.failed}</td>
                    <td className="px-4 py-3 text-xs font-mono text-cosmic-muted">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs font-mono text-cosmic-muted">{r.completed_at ? new Date(r.completed_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
