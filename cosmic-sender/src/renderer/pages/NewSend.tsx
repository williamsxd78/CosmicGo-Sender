import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Field } from '../components/UI';
import { Send, Eye, FileText, Users, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useUI } from '../store/ui';

type RecipientMode = 'MANUAL' | 'LIST' | 'CSV';

export default function NewSend() {
  const nav = useNavigate();
  const { toast, openConfirm } = useUI();

  const [providers, setProviders] = useState<any[]>([]);
  const [identities, setIdentities] = useState<any[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  const [name, setName] = useState('');
  const [providerGuid, setProviderGuid] = useState('');
  const [senderIdentityId, setSenderIdentityId] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [htmlBody, setHtmlBody] = useState('<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1e2130">\n  <h2>Hello {first_name|there},</h2>\n  <p>Your message body goes here.</p>\n  <p>— {company|The Team}</p>\n</div>');
  const [textBody, setTextBody] = useState('Hello {first_name|there},\n\nYour message body goes here.\n\n— {company|The Team}');
  const [rate, setRate] = useState(10);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('LIST');
  const [selectedListId, setSelectedListId] = useState('');
  const [manualEmails, setManualEmails] = useState('');
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [promotional, setPromotional] = useState(false);
  const [unsubscribeUrl, setUnsubscribeUrl] = useState('');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile' | 'text'>('desktop');
  const [preflight, setPreflight] = useState<any>(null);
  const [testTo, setTestTo] = useState('');
  const [attachments, setAttachments] = useState<Array<{ path: string; name: string; size_bytes: number }>>([]);

  useEffect(() => {
    (async () => {
      const [p, i, l, c, t] = await Promise.all([
        window.cosmic.listProviders(),
        window.cosmic.listIdentities(),
        window.cosmic.listLists(),
        window.cosmic.listContacts({ limit: 500 }),
        window.cosmic.listTemplates(),
      ]);
      if (p.ok) setProviders(p.data as any[]);
      if (i.ok) setIdentities(i.data as any[]);
      if (l.ok) setLists(l.data as any[]);
      if (c.ok) setContacts((c.data as any).rows);
      if (t.ok) setTemplates(t.data as any[]);
    })();
  }, []);

  const identitiesForProvider = useMemo(
    () => identities.filter((i) => i.provider_guid === providerGuid),
    [identities, providerGuid],
  );

  const recipientSource = useMemo(() => {
    if (recipientMode === 'MANUAL') {
      const emails = manualEmails.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      return { kind: 'MANUAL', emails } as const;
    }
    if (recipientMode === 'LIST') return { kind: 'LIST', list_id: selectedListId } as const;
    return { kind: 'CSV', contact_ids: contactIds } as const;
  }, [recipientMode, manualEmails, selectedListId, contactIds]);

  const previewData = useMemo(() => ({
    first_name: 'Ada', last_name: 'Lovelace', full_name: 'Ada Lovelace',
    company: 'Analytical Ltd', email: 'ada@example.com', unsubscribe_url: unsubscribeUrl,
  }), [unsubscribeUrl]);

  const rendered = useMemo(() => {
    const render = (t: string) => t.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)(?:\|([^}]*))?\}/g, (_full, k, fb) => (previewData as any)[k] ?? fb ?? '');
    return { subject: render(subject), preheader: render(preheader), html: render(htmlBody), text: render(textBody) };
  }, [subject, preheader, htmlBody, textBody, previewData]);

  const loadTemplate = (t: any) => {
    setSubject(t.subject); setPreheader(t.preheader ?? ''); setHtmlBody(t.html_body); setTextBody(t.text_body);
    toast({ kind: 'success', title: `Loaded template: ${t.name}` });
  };

  const attachFiles = async () => {
    const res = await window.cosmic.openFile({ multiSelections: true });
    if (!res.ok) return;
    const d = res.data as any;
    if (d.canceled) return;
    setAttachments([...attachments, ...(d.files ?? [])]);
  };

  const buildInput = () => ({
    name,
    provider_guid: providerGuid,
    sender_identity_id: senderIdentityId,
    reply_to: replyTo,
    subject,
    preheader,
    html_body: htmlBody,
    text_body: textBody,
    attachments: attachments.map((a) => ({ filename: a.name, path: a.path, size_bytes: a.size_bytes })),
    recipient_source: recipientSource,
    rate_per_minute: rate,
    promotional,
    unsubscribe_url: unsubscribeUrl,
    tracking_opens: false,
    tracking_clicks: false,
  });

  const runPreflight = async () => {
    if (!name.trim() || !providerGuid || !senderIdentityId || !subject.trim()) {
      return toast({ kind: 'error', title: 'Missing fields', description: 'Provide a campaign name, provider, sender identity and subject.' });
    }
    const res = await window.cosmic.preflight(buildInput());
    if (!res.ok) return toast({ kind: 'error', title: 'Preflight failed', description: res.error });
    setPreflight(res.data);
  };

  const startCampaign = async () => {
    if (!preflight?.ok) return;
    openConfirm({
      title: 'Start campaign?',
      description: `${preflight.final_queued} recipient(s) will be queued at ${rate}/min (~${preflight.estimated_minutes} minutes). This will actually send emails.`,
      confirmLabel: 'Start sending',
      onConfirm: async () => {
        const res = await window.cosmic.createAndStartCampaign(buildInput(), true);
        if (!res.ok) return toast({ kind: 'error', title: 'Failed to start', description: res.error });
        toast({ kind: 'success', title: 'Campaign started' });
        nav(`/campaigns/${(res.data as any).id}`);
      },
    });
  };

  const sendTest = async () => {
    if (!providerGuid || !senderIdentityId || !testTo) return toast({ kind: 'error', title: 'Missing fields' });
    const res = await window.cosmic.sendTestEmail({
      guid: providerGuid, identity_id: senderIdentityId, to: testTo,
      subject: rendered.subject || 'Test', html: rendered.html, text: rendered.text,
    });
    if (!res.ok) return toast({ kind: 'error', title: 'Send failed', description: res.error });
    const r = res.data as any;
    toast({ kind: r.ok ? 'success' : 'error', title: r.ok ? 'Test email accepted' : 'Test send failed', description: r.ok ? undefined : r.error?.message });
  };

  return (
    <div className="pb-10">
      <PageHeader
        title="New Send"
        subtitle="Compose a personalized campaign. Preflight will verify recipients, suppression and rate limits before you can start."
      />
      <div className="px-8 grid grid-cols-1 xl:grid-cols-[1fr_460px] gap-6">
        <div className="space-y-4">
          <div className="cs-card p-5 space-y-3" data-testid="compose-basic">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Campaign name"><input data-testid="campaign-name" className="cs-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Sending rate / minute"><input data-testid="campaign-rate" className="cs-input" type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></Field>
              <Field label="SMTP provider">
                <select data-testid="campaign-provider" className="cs-input" value={providerGuid} onChange={(e) => { setProviderGuid(e.target.value); setSenderIdentityId(''); }}>
                  <option value="">— select —</option>
                  {providers.filter((p) => p.enabled).map((p) => <option key={p.guid} value={p.guid}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Sender identity">
                <select data-testid="campaign-identity" className="cs-input" value={senderIdentityId} onChange={(e) => setSenderIdentityId(e.target.value)}>
                  <option value="">— select —</option>
                  {identitiesForProvider.map((i) => <option key={i.id} value={i.id}>{i.name} &lt;{i.email}&gt;</option>)}
                </select>
              </Field>
              <Field label="Reply-to (optional)"><input className="cs-input" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} /></Field>
              <label className="text-sm flex items-center gap-2 mt-6">
                <input type="checkbox" checked={promotional} onChange={(e) => setPromotional(e.target.checked)} /> Promotional campaign
              </label>
            </div>
            {promotional && (
              <Field label="Unsubscribe URL" hint="Required for promotional campaigns. Use {unsubscribe_url} in your template.">
                <input className="cs-input" value={unsubscribeUrl} onChange={(e) => setUnsubscribeUrl(e.target.value)} />
              </Field>
            )}
          </div>

          <div className="cs-card p-5 space-y-3" data-testid="compose-content">
            <div className="flex items-center justify-between">
              <div className="font-medium">Content</div>
              <div className="flex gap-2">
                {templates.length > 0 && (
                  <select className="cs-input max-w-[240px]" defaultValue="" onChange={(e) => {
                    const t = templates.find((x) => x.id === e.target.value);
                    if (t) loadTemplate(t);
                  }}>
                    <option value="">Load template…</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
              </div>
            </div>
            <Field label="Subject" hint="Supports {first_name|there}, {company|your company}, etc.">
              <input data-testid="campaign-subject" className="cs-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
            <Field label="Preheader"><input className="cs-input" value={preheader} onChange={(e) => setPreheader(e.target.value)} /></Field>
            <Field label="HTML body">
              <textarea data-testid="campaign-html" className="cs-input min-h-[220px] font-mono text-xs" value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)} />
            </Field>
            <Field label="Plain text body">
              <textarea data-testid="campaign-text" className="cs-input min-h-[120px] font-mono text-xs" value={textBody} onChange={(e) => setTextBody(e.target.value)} />
            </Field>
            <div>
              <div className="text-xs uppercase text-cosmic-muted mb-1">Attachments (max 10 MB per file · 20 MB total)</div>
              <div className="flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <span key={i} className="cs-badge cs-badge-info">{a.name} · {(a.size_bytes / 1024).toFixed(1)} KB
                    <button className="ml-1 text-red-400" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}>×</button>
                  </span>
                ))}
                <button className="cs-btn cs-btn-ghost" onClick={attachFiles}><FileText size={14}/> Add file</button>
              </div>
            </div>
          </div>

          <div className="cs-card p-5 space-y-3" data-testid="compose-recipients">
            <div className="flex items-center justify-between">
              <div className="font-medium">Recipients</div>
              <div className="flex gap-1">
                {(['LIST','MANUAL','CSV'] as RecipientMode[]).map((m) => (
                  <button key={m} data-testid={`rmode-${m}`} onClick={() => setRecipientMode(m)}
                    className={`cs-btn cs-btn-ghost ${recipientMode === m ? 'ring-1 ring-cosmic-accent text-white' : ''}`}>
                    {m === 'LIST' ? 'From list' : m === 'MANUAL' ? 'Manual' : 'From contacts'}
                  </button>
                ))}
              </div>
            </div>

            {recipientMode === 'LIST' && (
              <select data-testid="recipient-list" className="cs-input" value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)}>
                <option value="">— select a list —</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.member_count})</option>)}
              </select>
            )}

            {recipientMode === 'MANUAL' && (
              <Field label="Emails (comma or newline separated)">
                <textarea data-testid="recipient-manual" className="cs-input min-h-[120px] font-mono text-xs" value={manualEmails} onChange={(e) => setManualEmails(e.target.value)} />
              </Field>
            )}

            {recipientMode === 'CSV' && (
              <div>
                <div className="text-xs text-cosmic-muted mb-2">Select individual contacts from your database.</div>
                <div className="cs-panel max-h-56 overflow-y-auto">
                  {contacts.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 text-sm">
                      <input type="checkbox" checked={contactIds.includes(c.id)} onChange={(e) => {
                        if (e.target.checked) setContactIds([...contactIds, c.id]);
                        else setContactIds(contactIds.filter((x) => x !== c.id));
                      }} />
                      <span className="font-mono text-xs">{c.email}</span>
                      <span className="text-cosmic-muted text-xs">{[c.first_name, c.last_name].filter(Boolean).join(' ')}</span>
                    </label>
                  ))}
                </div>
                <div className="text-xs text-cosmic-muted mt-1">{contactIds.length} selected</div>
              </div>
            )}
          </div>

          <div className="cs-card p-5" data-testid="compose-test">
            <div className="font-medium mb-3">Send a test</div>
            <div className="flex gap-2">
              <input data-testid="test-to" className="cs-input" placeholder="test@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <button data-testid="test-send" className="cs-btn cs-btn-ghost" onClick={sendTest}><Send size={14}/> Send test</button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button data-testid="btn-preflight" className="cs-btn cs-btn-ghost" onClick={runPreflight}><Sparkles size={14}/> Run preflight</button>
            <button data-testid="btn-start-campaign" className="cs-btn cs-btn-primary" disabled={!preflight?.ok} onClick={startCampaign}><Send size={14}/> Start campaign</button>
          </div>

          {preflight && (
            <div className="cs-card p-5" data-testid="preflight-summary">
              <div className="flex items-center gap-2">
                {preflight.ok ? <CheckCircle2 className="text-emerald-400" size={18}/> : <AlertTriangle className="text-red-400" size={18}/>}
                <span className="font-medium">{preflight.ok ? 'Preflight passed' : 'Preflight has errors'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                <Stat label="Input" value={preflight.total_input} />
                <Stat label="Duplicates" value={preflight.duplicates} />
                <Stat label="Invalid" value={preflight.invalid} />
                <Stat label="Suppressed" value={preflight.suppressed} />
                <Stat label="Final queued" value={preflight.final_queued} highlight />
                <Stat label="ETA (min)" value={preflight.estimated_minutes} />
              </div>
              {preflight.errors.length > 0 && (
                <ul className="text-sm text-red-400 mt-3 list-disc pl-5">{preflight.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
              )}
              {preflight.warnings.length > 0 && (
                <ul className="text-sm text-amber-400 mt-3 list-disc pl-5">{preflight.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>
              )}
            </div>
          )}
        </div>

        <div className="cs-card p-5 sticky top-4 h-fit" data-testid="preview-panel">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium">Preview <span className="text-cosmic-muted text-xs">(personalized for demo contact)</span></div>
            <div className="flex gap-1">
              {(['desktop','mobile','text'] as const).map((m) => (
                <button key={m} data-testid={`preview-${m}`} onClick={() => setPreviewMode(m)}
                  className={`cs-btn cs-btn-ghost ${previewMode === m ? 'ring-1 ring-cosmic-accent text-white' : ''}`}>{m}</button>
              ))}
            </div>
          </div>
          <div className="text-xs text-cosmic-muted mb-1">Subject</div>
          <div className="text-sm mb-2 font-medium break-words">{rendered.subject || <span className="text-cosmic-muted">— no subject —</span>}</div>
          <div className="text-xs text-cosmic-muted mb-1">Preheader</div>
          <div className="text-xs mb-3 text-cosmic-muted break-words">{rendered.preheader}</div>
          {previewMode === 'text' ? (
            <pre className="text-xs whitespace-pre-wrap font-mono cs-panel p-3">{rendered.text}</pre>
          ) : (
            <div className={`cs-panel overflow-hidden mx-auto ${previewMode === 'mobile' ? 'w-[360px]' : 'w-full'}`}>
              <iframe title="preview" data-testid="preview-iframe" className="bg-white w-full h-[420px]" sandbox="" srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:;">${rendered.html}`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`cs-panel px-3 py-2 ${highlight ? 'ring-1 ring-cosmic-accent' : ''}`}>
      <div className="text-[10px] uppercase text-cosmic-muted">{label}</div>
      <div className="font-display text-lg">{value}</div>
    </div>
  );
}
