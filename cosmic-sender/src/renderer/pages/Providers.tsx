import { useEffect, useState } from 'react';
import { PageHeader, EmptyState, Field, Badge } from '../components/UI';
import { Plus, TestTube2, Copy, Trash2, Save, Edit3, ShieldCheck, ShieldOff } from 'lucide-react';
import { useUI } from '../store/ui';

const SES_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1', 'eu-north-1',
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'sa-east-1', 'ca-central-1', 'me-south-1', 'af-south-1',
];

export default function Providers() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [identities, setIdentities] = useState<any[]>([]);
  const { toast, openConfirm } = useUI();
  const [testResult, setTestResult] = useState<any>(null);

  const refresh = async () => {
    const r = await window.cosmic.listProviders();
    if (r.ok) setRows(r.data as any[]);
    const i = await window.cosmic.listIdentities();
    if (i.ok) setIdentities(i.data as any[]);
  };
  useEffect(() => { void refresh(); }, []);

  const empty = () => ({
    kind: 'STANDARD_SMTP', name: '', slug: '', host: '', port: 587,
    encryption: 'AUTO', username: '', password: '',
    default_from_name: '', default_from_email: '', reply_to: '',
    hourly_limit: 1000, daily_limit: 10000, rate_limit_per_minute: 10,
    connection_timeout_ms: 30000, max_retries: 3, enabled: true, region: 'eu-central-1', notes: '',
  });

  const save = async () => {
    if (!editing) return;
    const res = editing.guid
      ? await window.cosmic.updateProvider(editing.guid, editing)
      : await window.cosmic.createProvider(editing);
    if (!res.ok) return toast({ kind: 'error', title: 'Save failed', description: res.error });
    toast({ kind: 'success', title: editing.guid ? 'Provider updated' : 'Provider created' });
    setEditing(null);
    await refresh();
  };

  const del = (row: any) => {
    openConfirm({
      title: `Delete "${row.name}"?`,
      description: 'This removes the provider and its stored credentials. Campaigns using it will fail.',
      destructive: true,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        const res = await window.cosmic.deleteProvider(row.guid);
        if (!res.ok) return toast({ kind: 'error', title: 'Delete failed', description: res.error });
        toast({ kind: 'success', title: 'Provider deleted' });
        await refresh();
      },
    });
  };

  const dup = async (row: any) => {
    const res = await window.cosmic.duplicateProvider(row.guid);
    if (!res.ok) return toast({ kind: 'error', title: 'Duplicate failed', description: res.error });
    toast({ kind: 'success', title: 'Provider duplicated' });
    await refresh();
  };

  const test = async (row: any) => {
    setTestResult({ pending: true });
    const res = await window.cosmic.testProvider(row.guid);
    if (!res.ok) return setTestResult({ ok: false, message: res.error });
    setTestResult(res.data);
  };

  return (
    <div className="pb-10">
      <PageHeader
        title="SMTP Providers"
        subtitle="Add and manage SMTP endpoints. Credentials are stored in the OS credential manager, not the database."
        actions={
          <button data-testid="btn-add-provider" className="cs-btn cs-btn-primary" onClick={() => setEditing(empty())}>
            <Plus size={16} /> Add provider
          </button>
        }
      />

      <div className="px-8" data-testid="providers-list">
        {rows.length === 0 ? (
          <EmptyState
            testid="providers-empty"
            title="No providers yet"
            description="Add your first SMTP endpoint to start sending. Amazon SES, Gmail, Zoho, Microsoft 365, SendGrid, Mailgun and custom servers are supported."
            action={<button className="cs-btn cs-btn-primary" onClick={() => setEditing(empty())}><Plus size={16} /> Add provider</button>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {rows.map((row) => (
              <div key={row.guid} className="cs-card p-5" data-testid={`provider-card-${row.slug}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-cosmic-muted mt-0.5 font-mono">{row.host}:{row.port} · {row.encryption}</div>
                  </div>
                  {row.enabled ? <Badge tone="success"><ShieldCheck size={12}/> Enabled</Badge> : <Badge tone="muted"><ShieldOff size={12}/> Disabled</Badge>}
                </div>
                <div className="text-xs text-cosmic-muted mt-3 space-y-1">
                  <div>Kind: <span className="text-cosmic-text">{row.kind}</span></div>
                  <div>User: <span className="text-cosmic-text font-mono">{row.username}</span></div>
                  <div>From: <span className="text-cosmic-text">{row.default_from_name} &lt;{row.default_from_email}&gt;</span></div>
                  <div>Rate: {row.rate_limit_per_minute}/min · Daily: {row.daily_limit}</div>
                </div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  <button data-testid={`test-${row.slug}`} className="cs-btn cs-btn-ghost" onClick={() => test(row)}><TestTube2 size={14}/> Test</button>
                  <button className="cs-btn cs-btn-ghost" onClick={() => setEditing({ ...row, password: '' })}><Edit3 size={14}/> Edit</button>
                  <button className="cs-btn cs-btn-ghost" onClick={() => dup(row)}><Copy size={14}/> Duplicate</button>
                  <button className="cs-btn cs-btn-ghost text-red-400" onClick={() => del(row)}><Trash2 size={14}/> Delete</button>
                </div>
                <IdentitySection providerGuid={row.guid} identities={identities.filter((i) => i.provider_guid === row.guid)} onChange={refresh} />
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <ProviderForm
          value={editing}
          onCancel={() => setEditing(null)}
          onChange={setEditing}
          onSave={save}
          sesRegions={SES_REGIONS}
        />
      )}

      {testResult && (
        <div className="fixed inset-0 z-[150] grid place-items-center bg-black/60 backdrop-blur-sm" onClick={() => setTestResult(null)}>
          <div className="cs-card p-6 w-[520px]" data-testid="test-result-modal" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-xl mb-2">Connection test</div>
            {testResult.pending ? (
              <div className="text-sm text-cosmic-muted">Connecting…</div>
            ) : (
              <>
                <div className={`cs-badge ${testResult.ok ? 'cs-badge-success' : 'cs-badge-danger'}`}>
                  {testResult.ok ? 'Success' : testResult.code ?? 'Failed'}
                </div>
                <div className="text-sm mt-3">{testResult.message}</div>
                {testResult.details && <div className="text-xs text-cosmic-muted mt-2 font-mono break-all">{testResult.details}</div>}
              </>
            )}
            <div className="flex justify-end mt-6">
              <button className="cs-btn cs-btn-ghost" onClick={() => setTestResult(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart per-kind presets. When the user picks a "Kind", we prefill sensible
// defaults so they only need to enter username, password, and from-address.
// ---------------------------------------------------------------------------
const KIND_PRESETS: Record<string, {
  label: string;
  host: string;
  port: number;
  encryption: 'AUTO' | 'STARTTLS' | 'SSL_TLS' | 'NONE';
  usernameHint?: string;
  helpUrl?: string;
}> = {
  AMAZON_SES:    { label: 'Amazon SES',   host: 'email-smtp.eu-central-1.amazonaws.com', port: 587, encryption: 'STARTTLS', usernameHint: 'SMTP username from AWS SES (e.g. AKIA…)', helpUrl: 'https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html' },
  GMAIL:         { label: 'Gmail',        host: 'smtp.gmail.com',       port: 587, encryption: 'STARTTLS', usernameHint: 'Your Gmail address. Use an App Password, not your login password.', helpUrl: 'https://support.google.com/mail/answer/185833' },
  MICROSOFT_365: { label: 'Microsoft 365',host: 'smtp.office365.com',   port: 587, encryption: 'STARTTLS', usernameHint: 'Your full Microsoft 365 email address' },
  ZOHO:          { label: 'Zoho',         host: 'smtp.zoho.com',        port: 587, encryption: 'STARTTLS', usernameHint: 'Your Zoho email address' },
  SENDGRID:      { label: 'SendGrid',     host: 'smtp.sendgrid.net',    port: 587, encryption: 'STARTTLS', usernameHint: 'Literal string "apikey"' },
  MAILGUN:       { label: 'Mailgun',      host: 'smtp.mailgun.org',     port: 587, encryption: 'STARTTLS', usernameHint: 'postmaster@yourdomain.mailgun.org' },
  STANDARD_SMTP: { label: 'Standard SMTP',host: '',                     port: 587, encryption: 'AUTO' },
  CUSTOM_SMTP:   { label: 'Custom SMTP',  host: '',                     port: 587, encryption: 'AUTO' },
};

function ProviderForm({ value, onChange, onCancel, onSave, sesRegions }: any) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const preset = KIND_PRESETS[value.kind] ?? KIND_PRESETS.CUSTOM_SMTP;
  const isSes = value.kind === 'AMAZON_SES';

  const applyKindPreset = (kind: string) => {
    const p = KIND_PRESETS[kind] ?? KIND_PRESETS.CUSTOM_SMTP;
    onChange({
      ...value,
      kind,
      host: value.guid ? value.host : p.host,
      port: value.guid ? value.port : p.port,
      encryption: value.guid ? value.encryption : p.encryption,
    });
  };

  return (
    <div className="fixed inset-0 z-[150] grid place-items-center bg-black/60 backdrop-blur-sm" data-testid="provider-form">
      <div className="cs-card p-6 w-[640px] max-w-[95vw] max-h-[92vh] overflow-y-auto">
        <div className="font-display text-2xl mb-1">{value.guid ? 'Edit provider' : 'Add provider'}</div>
        <div className="text-xs text-cosmic-muted mb-4">Pick a provider type — we'll prefill host, port, and security. You only need to enter credentials.</div>

        {/* Kind picker as visual cards for common providers */}
        <div className="grid grid-cols-4 gap-2 mb-5" data-testid="kind-picker">
          {Object.entries(KIND_PRESETS).map(([k, p]) => (
            <button
              key={k}
              type="button"
              onClick={() => applyKindPreset(k)}
              data-testid={`kind-${k}`}
              className={`cs-panel px-2 py-2 text-xs text-center transition-all ${value.kind === k ? 'ring-2 ring-cosmic-accent text-white' : 'text-cosmic-muted hover:text-white hover:bg-white/[0.03]'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" hint="A friendly label — e.g. 'Work Gmail', 'Marketing SES'.">
            <input data-testid="provider-name" className="cs-input" value={value.name} onChange={(e) => {
              const name = e.target.value;
              const slug = value.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
              onChange({ ...value, name, slug });
            }} />
          </Field>
          <Field label="Enabled">
            <select className="cs-input" value={value.enabled ? 'yes' : 'no'} onChange={(e) => onChange({ ...value, enabled: e.target.value === 'yes' })}>
              <option value="yes">Enabled</option>
              <option value="no">Disabled</option>
            </select>
          </Field>

          {isSes && (
            <Field label="AWS Region" hint="Amazon SES SMTP credentials are region-specific.">
              <select className="cs-input" value={value.region ?? 'eu-central-1'} onChange={(e) => {
                const region = e.target.value;
                onChange({ ...value, region, host: `email-smtp.${region}.amazonaws.com` });
              }}>
                {sesRegions.map((r: string) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          )}

          <Field label="SMTP Host">
            <input data-testid="provider-host" className="cs-input" value={value.host} onChange={(e) => onChange({ ...value, host: e.target.value })} readOnly={isSes} />
          </Field>
          <Field label="Port" hint="587 = STARTTLS, 465 = SSL/TLS, 25 = plain (rare)">
            <input data-testid="provider-port" className="cs-input" type="number" value={value.port} onChange={(e) => onChange({ ...value, port: Number(e.target.value) })} />
          </Field>
          <Field label="Security" hint="Auto picks the right mode from the port.">
            <select data-testid="provider-encryption" className="cs-input" value={value.encryption} onChange={(e) => onChange({ ...value, encryption: e.target.value })}>
              <option value="AUTO">Auto (recommended)</option>
              <option value="STARTTLS">STARTTLS</option>
              <option value="SSL_TLS">SSL / TLS</option>
              <option value="NONE">None</option>
            </select>
          </Field>

          <Field label="Username" hint={preset.usernameHint}>
            <input data-testid="provider-username" className="cs-input" value={value.username} onChange={(e) => onChange({ ...value, username: e.target.value })} />
          </Field>
          <Field label="Password" hint={value.guid ? 'Leave blank to keep the stored password.' : 'Stored in Windows Credential Manager, never in the DB.'}>
            <input data-testid="provider-password" className="cs-input" type="password" value={value.password} onChange={(e) => onChange({ ...value, password: e.target.value })} />
          </Field>

          <Field label="From name">
            <input className="cs-input" value={value.default_from_name} onChange={(e) => onChange({ ...value, default_from_name: e.target.value })} placeholder="Your Company" />
          </Field>
          <Field label="From email">
            <input data-testid="provider-from-email" className="cs-input" value={value.default_from_email} onChange={(e) => onChange({ ...value, default_from_email: e.target.value })} placeholder="hello@yourdomain.com" />
          </Field>
        </div>

        {/* Advanced settings — hidden by default */}
        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-cosmic-accent hover:underline mt-5" data-testid="toggle-advanced">
          {showAdvanced ? '▾ Hide advanced settings' : '▸ Advanced settings (rate limits, retries, reply-to, notes)'}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3 mt-3 border-t border-cosmic-border pt-4" data-testid="advanced-settings">
            <Field label="Reply-to (optional)"><input className="cs-input" value={value.reply_to ?? ''} onChange={(e) => onChange({ ...value, reply_to: e.target.value })} /></Field>
            <Field label="Rate limit / minute"><input className="cs-input" type="number" value={value.rate_limit_per_minute} onChange={(e) => onChange({ ...value, rate_limit_per_minute: Number(e.target.value) })} /></Field>
            <Field label="Hourly limit"><input className="cs-input" type="number" value={value.hourly_limit} onChange={(e) => onChange({ ...value, hourly_limit: Number(e.target.value) })} /></Field>
            <Field label="Daily limit"><input className="cs-input" type="number" value={value.daily_limit} onChange={(e) => onChange({ ...value, daily_limit: Number(e.target.value) })} /></Field>
            <Field label="Connection timeout (ms)"><input className="cs-input" type="number" value={value.connection_timeout_ms} onChange={(e) => onChange({ ...value, connection_timeout_ms: Number(e.target.value) })} /></Field>
            <Field label="Max retries"><input className="cs-input" type="number" value={value.max_retries} onChange={(e) => onChange({ ...value, max_retries: Number(e.target.value) })} /></Field>
            <Field label="Slug (internal id)"><input className="cs-input" value={value.slug} onChange={(e) => onChange({ ...value, slug: e.target.value.toLowerCase() })} /></Field>
            <Field label="Notes"><input className="cs-input" value={value.notes ?? ''} onChange={(e) => onChange({ ...value, notes: e.target.value })} /></Field>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button className="cs-btn cs-btn-ghost" onClick={onCancel} data-testid="provider-cancel">Cancel</button>
          <button className="cs-btn cs-btn-primary" onClick={onSave} data-testid="provider-save"><Save size={14} /> Save provider</button>
        </div>
      </div>
    </div>
  );
}

function IdentitySection({ providerGuid, identities, onChange }: { providerGuid: string; identities: any[]; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', reply_to: '', domain: '', verified: false, is_default: false });
  const { toast, openConfirm } = useUI();

  const save = async () => {
    const res = await window.cosmic.upsertIdentity({ ...form, provider_guid: providerGuid });
    if (!res.ok) return toast({ kind: 'error', title: 'Failed', description: res.error });
    setAdding(false);
    setForm({ name: '', email: '', reply_to: '', domain: '', verified: false, is_default: false });
    onChange();
  };

  return (
    <div className="mt-5 border-t border-cosmic-border pt-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-cosmic-muted">Sender identities ({identities.length})</div>
        <button className="text-xs text-cosmic-accent hover:underline" onClick={() => setAdding((x) => !x)}>{adding ? 'Cancel' : '+ Add'}</button>
      </div>
      {adding && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <input placeholder="Name" className="cs-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Email" className="cs-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label className="text-xs col-span-2 flex items-center gap-2">
            <input type="checkbox" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} /> Verified in provider
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} /> Set as default
          </label>
          <button className="cs-btn cs-btn-primary col-span-2 justify-center" onClick={save}>Save identity</button>
        </div>
      )}
      <ul className="mt-3 space-y-1 text-sm">
        {identities.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2">
            <span>
              {i.name} &lt;<span className="font-mono text-xs">{i.email}</span>&gt;
              {i.is_default ? <span className="ml-2 cs-badge cs-badge-info">default</span> : null}
              {i.verified ? <span className="ml-2 cs-badge cs-badge-success">verified</span> : <span className="ml-2 cs-badge cs-badge-warn">unverified</span>}
            </span>
            <button className="text-xs text-red-400 hover:underline"
              onClick={() => openConfirm({
                title: 'Delete identity?', destructive: true, confirmLabel: 'Delete',
                onConfirm: async () => { await window.cosmic.deleteIdentity(i.id); onChange(); },
              })}
            >Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
