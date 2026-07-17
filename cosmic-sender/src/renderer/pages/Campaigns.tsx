import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, EmptyState, Badge } from '../components/UI';
import { Play, Pause, StopCircle, RefreshCcw } from 'lucide-react';

const STATUS_TONES: Record<string, 'success' | 'warn' | 'danger' | 'info' | 'muted'> = {
  DRAFT: 'muted', SCHEDULED: 'info', QUEUED: 'info', SENDING: 'info',
  PAUSED: 'warn', COMPLETED: 'success', CANCELLED: 'muted', FAILED: 'danger',
};

export default function Campaigns() {
  const [rows, setRows] = useState<any[]>([]);
  const nav = useNavigate();

  const refresh = async () => {
    const r = await window.cosmic.listCampaigns();
    if (r.ok) setRows(r.data as any[]);
  };
  useEffect(() => {
    void refresh();
    const off = window.cosmic.onCampaignProgress(() => refresh());
    const t = setInterval(refresh, 5000);
    return () => { off(); clearInterval(t); };
  }, []);

  return (
    <div className="pb-10">
      <PageHeader title="Campaigns" subtitle="All campaigns you've created. Click one to see recipient-level details." />
      <div className="px-8">
        {rows.length === 0 ? (
          <EmptyState testid="campaigns-empty" title="No campaigns yet" description="Head to New Send to compose and launch your first campaign." />
        ) : (
          <div className="cs-card overflow-hidden">
            <table className="w-full text-sm" data-testid="campaigns-table">
              <thead className="text-xs uppercase text-cosmic-muted border-b border-cosmic-border">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Accepted</th>
                  <th className="text-left px-4 py-3">Failed</th>
                  <th className="text-left px-4 py-3">Rate</th>
                  <th className="text-left px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pct = r.total > 0 ? Math.round(((r.accepted + r.failed) / r.total) * 100) : 0;
                  return (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer" onClick={() => nav(`/campaigns/${r.id}`)} data-testid={`campaign-row-${r.id}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-cosmic-muted">{r.subject}</div>
                        <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden w-64">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{ width: `${pct}%` }}/>
                        </div>
                      </td>
                      <td className="px-4 py-3"><Badge tone={STATUS_TONES[r.status] ?? 'muted'}>{r.status}</Badge></td>
                      <td className="px-4 py-3">{r.total}</td>
                      <td className="px-4 py-3 text-emerald-400">{r.accepted}</td>
                      <td className="px-4 py-3 text-red-400">{r.failed}</td>
                      <td className="px-4 py-3 text-cosmic-muted">{r.rate_per_minute}/min</td>
                      <td className="px-4 py-3 text-cosmic-muted text-xs font-mono">{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
