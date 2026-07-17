import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Badge, StatCard } from '../components/UI';
import { Pause, Play, StopCircle, RefreshCcw, Download } from 'lucide-react';
import { useUI } from '../store/ui';

const STATUS_TONES: Record<string, 'success' | 'warn' | 'danger' | 'info' | 'muted'> = {
  QUEUED: 'info', SENDING: 'info', ACCEPTED: 'success', FAILED: 'danger', RETRYING: 'warn', SKIPPED: 'muted', SUPPRESSED: 'muted', CANCELLED: 'muted',
};

export default function CampaignDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { toast, openConfirm } = useUI();
  const [campaign, setCampaign] = useState<any>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('');

  const refresh = async () => {
    const c = await window.cosmic.getCampaign(id);
    if (c.ok) setCampaign(c.data);
    const r = await window.cosmic.listRecipients({ id, status: filter || undefined, limit: 1000 });
    if (r.ok) setRecipients(r.data as any[]);
  };

  useEffect(() => {
    void refresh();
    const off = window.cosmic.onCampaignProgress((row: any) => {
      if (row?.id === id) refresh();
    });
    const t = setInterval(refresh, 3000);
    return () => { off(); clearInterval(t); };
  }, [id, filter]);

  if (!campaign) return <div className="p-8 text-cosmic-muted">Loading…</div>;

  const pct = campaign.total > 0 ? Math.round(((campaign.accepted + campaign.failed) / campaign.total) * 100) : 0;

  const doPause = () => window.cosmic.pauseCampaign(id).then(refresh);
  const doResume = () => window.cosmic.resumeCampaign(id).then(refresh);
  const doCancel = () => openConfirm({
    title: 'Cancel this campaign?',
    description: 'Any queued recipients will be marked as cancelled. This cannot be undone.',
    destructive: true,
    confirmLabel: 'Cancel campaign',
    onConfirm: async () => { await window.cosmic.cancelCampaign(id); await refresh(); },
  });
  const doRetry = () => window.cosmic.retryFailedCampaign(id).then(refresh);

  const exportReport = async (format: 'csv' | 'json') => {
    const r = await window.cosmic.exportCampaign(id, format);
    if (!r.ok) return toast({ kind: 'error', title: 'Export failed', description: r.error });
    await window.cosmic.saveFile({
      defaultPath: `campaign-${campaign.name}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
      content: r.data,
    });
  };

  return (
    <div className="pb-10">
      <PageHeader
        title={campaign.name}
        subtitle={campaign.subject}
        actions={
          <>
            <Badge tone={STATUS_TONES[campaign.status] ?? 'muted'}>{campaign.status}</Badge>
            {campaign.status === 'SENDING' || campaign.status === 'QUEUED' ? (
              <button data-testid="btn-pause" className="cs-btn cs-btn-ghost" onClick={doPause}><Pause size={14}/> Pause</button>
            ) : campaign.status === 'PAUSED' || campaign.status === 'FAILED' ? (
              <button data-testid="btn-resume" className="cs-btn cs-btn-primary" onClick={doResume}><Play size={14}/> Resume</button>
            ) : null}
            <button data-testid="btn-cancel" className="cs-btn cs-btn-ghost text-red-400" onClick={doCancel}><StopCircle size={14}/> Cancel</button>
            <button data-testid="btn-retry-failed" className="cs-btn cs-btn-ghost" onClick={doRetry}><RefreshCcw size={14}/> Retry failed</button>
            <button data-testid="btn-export-csv" className="cs-btn cs-btn-ghost" onClick={() => exportReport('csv')}><Download size={14}/> CSV</button>
            <button data-testid="btn-export-json" className="cs-btn cs-btn-ghost" onClick={() => exportReport('json')}><Download size={14}/> JSON</button>
          </>
        }
      />

      <div className="px-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard testid="camp-total" label="Total" value={campaign.total} />
        <StatCard testid="camp-accepted" label="Accepted by SMTP" value={campaign.accepted} tone="success" />
        <StatCard testid="camp-failed" label="Failed" value={campaign.failed} tone="danger" />
        <StatCard testid="camp-progress" label="Progress" value={`${pct}%`} />
      </div>

      <div className="px-8 mt-6">
        <div className="cs-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium">Recipients</div>
            <select className="cs-input max-w-[200px]" value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="recipient-filter">
              <option value="">All statuses</option>
              {Object.keys(STATUS_TONES).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-cosmic-muted border-b border-cosmic-border">
                <tr>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Attempts</th>
                  <th className="text-left px-3 py-2">Last attempt</th>
                  <th className="text-left px-3 py-2">SMTP response</th>
                  <th className="text-left px-3 py-2">Message ID</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} className="border-b border-white/5" data-testid={`recipient-row-${r.email}`}>
                    <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                    <td className="px-3 py-2"><Badge tone={STATUS_TONES[r.status] ?? 'muted'}>{r.status}</Badge></td>
                    <td className="px-3 py-2">{r.attempts}</td>
                    <td className="px-3 py-2 text-cosmic-muted font-mono text-xs">{r.last_attempt_at ? new Date(r.last_attempt_at).toLocaleString() : '—'}</td>
                    <td className="px-3 py-2 text-cosmic-muted text-xs max-w-[300px] truncate" title={r.smtp_response_message ?? ''}>{r.smtp_response_message ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-cosmic-muted">{r.message_id ?? '—'}</td>
                  </tr>
                ))}
                {recipients.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-cosmic-muted">No recipients match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
