import { useEffect, useState } from 'react';
import { PageHeader, StatCard } from '../components/UI';
import { useNavigate } from 'react-router-dom';
import { Send, PlusCircle } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const nav = useNavigate();

  useEffect(() => {
    void refresh();
    const off = window.cosmic.onCampaignProgress(() => refresh());
    const t = setInterval(() => refresh(), 8000);
    return () => { off(); clearInterval(t); };
  }, []);

  async function refresh() {
    const res = await window.cosmic.dashboardStats();
    if (res.ok) setStats(res.data);
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Dashboard"
        subtitle="An overview of your sending activity, providers, and queue."
        actions={
          <button data-testid="dash-new-send" className="cs-btn cs-btn-primary" onClick={() => nav('/new')}>
            <PlusCircle size={16} /> New send
          </button>
        }
      />

      <div className="px-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="dash-stats">
        <StatCard testid="stat-queued-today" label="Queued today" value={stats?.queued_today ?? '—'} />
        <StatCard testid="stat-accepted-today" label="Accepted by SMTP today" value={stats?.accepted_today ?? '—'} tone="success" hint="Acceptance is not the same as delivery." />
        <StatCard testid="stat-failed-today" label="Failed today" value={stats?.failed_today ?? '—'} tone="danger" />
        <StatCard testid="stat-remaining" label="Remaining daily capacity" value={stats?.remaining_daily_capacity ?? '—'} />
        <StatCard testid="stat-active" label="Active campaigns" value={stats?.active_campaigns ?? '—'} />
        <StatCard testid="stat-providers" label="Enabled providers" value={stats?.enabled_providers ?? '—'} />
        <StatCard testid="stat-contacts" label="Contacts" value={stats?.contacts_total ?? '—'} />
        <StatCard testid="stat-suppression" label="Suppression list" value={stats?.suppression_total ?? '—'} />
      </div>

      {stats && stats.enabled_providers === 0 && (
        <div className="px-8 mt-6">
          <div className="cs-card p-5 flex items-center gap-4" data-testid="onboarding-banner">
            <div className="h-12 w-12 rounded-xl bg-cosmic-accent/15 grid place-items-center text-cosmic-accent text-xl animate-pulse-glow">✦</div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg">Welcome to Cosmic Sender</div>
              <div className="text-sm text-cosmic-muted">Add an SMTP provider (Gmail, Amazon SES, Zoho, SendGrid…) to start sending. Test the connection, add a sender identity, then compose your first campaign.</div>
            </div>
            <button className="cs-btn cs-btn-primary" onClick={() => nav('/providers')} data-testid="onboarding-add-provider">Add SMTP provider</button>
          </div>
        </div>
      )}

      <div className="px-8 mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="cs-card p-5 xl:col-span-2" data-testid="dash-volume-chart">
          <div className="flex items-center justify-between">
            <div className="font-display text-lg">Sending volume · last 14 days</div>
            <div className="text-xs text-cosmic-muted">Green = accepted, red = failed</div>
          </div>
          <VolumeChart data={stats?.volume_series ?? []} />
        </div>
        <div className="cs-card p-5" data-testid="dash-provider-usage">
          <div className="font-display text-lg mb-3">Provider usage</div>
          {(stats?.provider_usage ?? []).length === 0 ? (
            <div className="text-sm text-cosmic-muted">No provider activity yet.</div>
          ) : (
            <ul className="space-y-3">
              {(stats?.provider_usage ?? []).slice(0, 6).map((r: any) => {
                const total = (r.accepted || 0) + (r.failed || 0);
                const pct = total > 0 ? Math.round(((r.accepted || 0) / total) * 100) : 0;
                return (
                  <li key={r.provider} className="text-sm">
                    <div className="flex justify-between">
                      <span>{r.provider}</span>
                      <span className="text-cosmic-muted">{r.accepted ?? 0} accepted</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="px-8 mt-8">
        <div className="cs-card p-5" data-testid="dash-activity">
          <div className="font-display text-lg mb-3">Recent activity</div>
          {(stats?.recent_activity ?? []).length === 0 ? (
            <div className="text-sm text-cosmic-muted">No recent activity.</div>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {stats.recent_activity.map((r: any, i: number) => (
                <li key={i} className="py-2 flex items-start gap-3">
                  <span className="text-xs text-cosmic-muted mt-0.5 w-40 shrink-0 font-mono">{new Date(r.ts).toLocaleString()}</span>
                  <span className={`cs-badge ${r.level === 'error' ? 'cs-badge-danger' : r.level === 'warn' ? 'cs-badge-warn' : 'cs-badge-info'}`}>{r.level}</span>
                  <span className="flex-1">{r.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function VolumeChart({ data }: { data: Array<{ day: string; accepted: number; failed: number }> }) {
  if (!data || data.length === 0) {
    return <div className="text-sm text-cosmic-muted mt-6">No data yet — start your first campaign to see volume trends.</div>;
  }
  const max = Math.max(1, ...data.map((d) => (d.accepted || 0) + (d.failed || 0)));
  return (
    <div className="flex items-end gap-2 h-52 mt-6">
      {data.map((d) => {
        const total = (d.accepted || 0) + (d.failed || 0);
        const h = (total / max) * 100;
        const successPct = total > 0 ? (d.accepted / total) * 100 : 0;
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.accepted} accepted / ${d.failed} failed`}>
            <div className="w-full rounded-md overflow-hidden bg-white/5" style={{ height: `${h}%`, minHeight: 4 }}>
              <div className="w-full bg-red-500/60" style={{ height: `${100 - successPct}%` }} />
              <div className="w-full bg-emerald-500/70" style={{ height: `${successPct}%` }} />
            </div>
            <div className="text-[10px] text-cosmic-muted font-mono">{d.day.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}
