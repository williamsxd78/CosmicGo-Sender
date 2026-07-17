import { useState } from 'react';
import { useUI } from '../store/ui';
import { Sparkles, ArrowRight, Sun, Moon, ShieldCheck } from 'lucide-react';
import { Field } from '../components/UI';

interface StepProps { onNext: () => void; onBack?: () => void; }

export default function Setup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    'Welcome',
    'Create password',
    'Choose theme',
    'Add first SMTP',
    'Test provider',
    'Add sender identity',
    'Send test email',
    'Finish',
  ];
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const { theme, setTheme, toast } = useUI();
  const [providerId, setProviderId] = useState<string | null>(null);
  const [identityId, setIdentityId] = useState<string | null>(null);

  const [form, setForm] = useState({
    kind: 'AMAZON_SES',
    name: 'My Amazon SES',
    slug: 'my-ses',
    host: 'email-smtp.eu-central-1.amazonaws.com',
    port: 587,
    encryption: 'STARTTLS',
    username: '',
    password: '',
    default_from_name: 'Cosmic Sender',
    default_from_email: '',
    reply_to: '',
    rate_limit_per_minute: 10,
    daily_limit: 500,
    hourly_limit: 200,
    connection_timeout_ms: 30000,
    max_retries: 3,
    enabled: true,
    region: 'eu-central-1',
  });

  const [identity, setIdentity] = useState({ name: '', email: '', reply_to: '', domain: '', verified: false, is_default: true });
  const [testTo, setTestTo] = useState('');

  const stepPercent = (step / (steps.length - 1)) * 100;

  return (
    <div className="min-h-full grid place-items-center py-10 px-4" data-testid="setup-wizard">
      <div className="cs-card w-full max-w-2xl p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 grid place-items-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <div className="font-display text-2xl leading-tight">Welcome to Cosmic Sender</div>
            <div className="text-xs uppercase tracking-widest text-cosmic-muted">
              First-run setup · Step {step + 1} of {steps.length}
            </div>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden my-6">
          <div className="h-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 transition-all" style={{ width: `${stepPercent}%` }} />
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <p className="text-cosmic-muted">
              A premium, secure desktop application for sending opt-in, transactional and other authorized emails.
              Credentials are stored in your operating system's credential manager — never in plain text.
            </p>
            <div className="cs-panel p-4 flex items-start gap-3">
              <ShieldCheck className="text-emerald-400 mt-0.5" size={18} />
              <div className="text-sm text-cosmic-muted">
                This app is designed for authorized email use only. It does not include list harvesting,
                CAPTCHA bypass or spam-filter evasion. Please only send to recipients who have opted in.
              </div>
            </div>
            <div className="flex justify-end">
              <button data-testid="setup-next" className="cs-btn cs-btn-primary" onClick={() => setStep(1)}>
                Get started <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4" data-testid="setup-step-password">
            <Field label="Create a local admin password" hint="At least 8 characters. Used to unlock this app.">
              <input data-testid="setup-password" className="cs-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Confirm password">
              <input data-testid="setup-password2" className="cs-input" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
            </Field>
            <div className="flex justify-end">
              <button
                data-testid="setup-password-next"
                className="cs-btn cs-btn-primary"
                onClick={async () => {
                  if (password.length < 8) return toast({ kind: 'error', title: 'Password too short', description: 'Use at least 8 characters.' });
                  if (password !== password2) return toast({ kind: 'error', title: 'Passwords do not match' });
                  const res = await window.cosmic.setInitialPassword(password);
                  if (!res.ok) return toast({ kind: 'error', title: 'Could not set password', description: res.error });
                  toast({ kind: 'success', title: 'Password set' });
                  setStep(2);
                }}
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4" data-testid="setup-step-theme">
            <div className="grid grid-cols-2 gap-4">
              <button
                data-testid="setup-theme-dark"
                onClick={() => setTheme('dark')}
                className={`cs-card p-4 text-left transition-transform hover:-translate-y-0.5 ${theme === 'dark' ? 'ring-2 ring-cosmic-accent' : ''}`}
              >
                <Moon />
                <div className="mt-2 font-medium">Dark</div>
                <div className="text-xs text-cosmic-muted">Premium and easy on the eyes</div>
              </button>
              <button
                data-testid="setup-theme-light"
                onClick={() => setTheme('light')}
                className={`cs-card p-4 text-left transition-transform hover:-translate-y-0.5 ${theme === 'light' ? 'ring-2 ring-cosmic-accent' : ''}`}
              >
                <Sun />
                <div className="mt-2 font-medium">Light</div>
                <div className="text-xs text-cosmic-muted">Clean and bright</div>
              </button>
            </div>
            <NextBackButtons onNext={async () => {
              await window.cosmic.updateSettings({ theme });
              setStep(3);
            }} onBack={() => setStep(1)} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4" data-testid="setup-step-provider">
            <p className="text-sm text-cosmic-muted">
              Add your first SMTP provider. Amazon SES SMTP credentials are region-specific — pick the same region
              you configured in AWS.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kind">
                <select data-testid="setup-provider-kind" className="cs-input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  <option value="AMAZON_SES">Amazon SES</option>
                  <option value="STANDARD_SMTP">Standard SMTP</option>
                  <option value="GMAIL">Gmail</option>
                  <option value="MICROSOFT_365">Microsoft 365</option>
                  <option value="ZOHO">Zoho</option>
                  <option value="SENDGRID">SendGrid</option>
                  <option value="MAILGUN">Mailgun</option>
                  <option value="CUSTOM_SMTP">Custom SMTP</option>
                </select>
              </Field>
              <Field label="Name">
                <input data-testid="setup-provider-name" className="cs-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Slug">
                <input className="cs-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </Field>
              <Field label="Region">
                <input className="cs-input" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
              </Field>
              <Field label="Host">
                <input data-testid="setup-provider-host" className="cs-input" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
              </Field>
              <Field label="Port">
                <input data-testid="setup-provider-port" className="cs-input" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
              </Field>
              <Field label="Encryption">
                <select data-testid="setup-provider-encryption" className="cs-input" value={form.encryption} onChange={(e) => setForm({ ...form, encryption: e.target.value })}>
                  <option value="STARTTLS">STARTTLS</option>
                  <option value="SSL_TLS">SSL/TLS</option>
                  <option value="NONE">None</option>
                </select>
              </Field>
              <Field label="Username">
                <input data-testid="setup-provider-username" className="cs-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </Field>
              <Field label="Password">
                <input data-testid="setup-provider-password" className="cs-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </Field>
              <Field label="Default From Name">
                <input className="cs-input" value={form.default_from_name} onChange={(e) => setForm({ ...form, default_from_name: e.target.value })} />
              </Field>
              <Field label="Default From Email">
                <input data-testid="setup-provider-from-email" className="cs-input" value={form.default_from_email} onChange={(e) => setForm({ ...form, default_from_email: e.target.value })} />
              </Field>
              <Field label="Rate limit / minute">
                <input className="cs-input" type="number" value={form.rate_limit_per_minute} onChange={(e) => setForm({ ...form, rate_limit_per_minute: Number(e.target.value) })} />
              </Field>
            </div>
            <NextBackButtons
              nextLabel="Save & continue"
              onNext={async () => {
                const res = await window.cosmic.createProvider(form);
                if (!res.ok) return toast({ kind: 'error', title: 'Could not save provider', description: res.error });
                setProviderId((res.data as any).guid);
                toast({ kind: 'success', title: 'Provider saved' });
                setStep(4);
              }}
              onBack={() => setStep(2)}
            />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4" data-testid="setup-step-test">
            <p className="text-sm text-cosmic-muted">
              Let's verify that Cosmic Sender can reach your SMTP server and authenticate. No email will be sent yet.
            </p>
            <button
              data-testid="setup-test-connection"
              className="cs-btn cs-btn-primary"
              onClick={async () => {
                if (!providerId) return;
                const res = await window.cosmic.testProvider(providerId);
                if (res.ok) {
                  const r = res.data as any;
                  toast({ kind: r.ok ? 'success' : 'error', title: r.ok ? 'Connection successful' : 'Connection failed', description: r.message });
                } else {
                  toast({ kind: 'error', title: 'Test failed', description: res.error });
                }
              }}
            >
              Run connection test
            </button>
            <NextBackButtons onNext={() => setStep(5)} onBack={() => setStep(3)} />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4" data-testid="setup-step-identity">
            <p className="text-sm text-cosmic-muted">
              Add a verified sender identity. This is the "From:" address you're authorized to use with your provider.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sender name">
                <input data-testid="setup-identity-name" className="cs-input" value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} />
              </Field>
              <Field label="Sender email">
                <input data-testid="setup-identity-email" className="cs-input" value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })} />
              </Field>
              <Field label="Reply-to (optional)">
                <input className="cs-input" value={identity.reply_to} onChange={(e) => setIdentity({ ...identity, reply_to: e.target.value })} />
              </Field>
              <Field label="Domain (optional)">
                <input className="cs-input" value={identity.domain} onChange={(e) => setIdentity({ ...identity, domain: e.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-sm mt-4 col-span-2">
                <input type="checkbox" checked={identity.verified} onChange={(e) => setIdentity({ ...identity, verified: e.target.checked })} />
                Mark as verified (I have completed verification with the provider)
              </label>
            </div>
            <NextBackButtons
              nextLabel="Save identity"
              onNext={async () => {
                if (!providerId) return;
                const res = await window.cosmic.upsertIdentity({ ...identity, provider_guid: providerId });
                if (!res.ok) return toast({ kind: 'error', title: 'Could not save identity', description: res.error });
                setIdentityId((res.data as any).id);
                toast({ kind: 'success', title: 'Identity saved' });
                setStep(6);
              }}
              onBack={() => setStep(4)}
            />
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4" data-testid="setup-step-testemail">
            <Field label="Send a test email to" hint="This will actually send one message using your provider.">
              <input data-testid="setup-test-to" className="cs-input" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            </Field>
            <button
              data-testid="setup-send-test"
              className="cs-btn cs-btn-primary"
              onClick={async () => {
                if (!providerId || !identityId) return;
                if (!testTo) return toast({ kind: 'error', title: 'Enter a recipient' });
                const res = await window.cosmic.sendTestEmail({
                  guid: providerId,
                  identity_id: identityId,
                  to: testTo,
                  subject: 'Cosmic Sender — test message',
                  html: '<h2>It works!</h2><p>This test email was sent from Cosmic Sender.</p>',
                  text: 'It works! This test email was sent from Cosmic Sender.',
                });
                if (!res.ok) return toast({ kind: 'error', title: 'Send failed', description: res.error });
                const r = res.data as any;
                toast({ kind: r.ok ? 'success' : 'error', title: r.ok ? 'Test email accepted by SMTP' : 'Send failed', description: r.ok ? 'SMTP accepted the message (delivery is not guaranteed until the recipient confirms).' : r.error?.message });
              }}
            >
              Send test email
            </button>
            <div className="text-[11px] text-cosmic-muted">
              Note: "Accepted by SMTP" ≠ "Delivered". Real delivery is only confirmed by the provider or the recipient.
            </div>
            <NextBackButtons nextLabel="Skip / Continue" onNext={() => setStep(7)} onBack={() => setStep(5)} />
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4" data-testid="setup-step-done">
            <div className="cs-panel p-4">
              <div className="font-medium">You're all set!</div>
              <div className="text-sm text-cosmic-muted mt-1">You can now open the dashboard and start composing campaigns.</div>
            </div>
            <div className="flex justify-end">
              <button data-testid="setup-done" className="cs-btn cs-btn-primary" onClick={onDone}>Open dashboard <ArrowRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NextBackButtons({ onNext, onBack, nextLabel = 'Continue' }: InstanceType<any> & { onNext: () => void; onBack?: () => void; nextLabel?: string }) {
  return (
    <div className="flex justify-between">
      {onBack ? <button className="cs-btn cs-btn-ghost" onClick={onBack} data-testid="setup-back">Back</button> : <span />}
      <button className="cs-btn cs-btn-primary" onClick={onNext} data-testid="setup-next">{nextLabel} <ArrowRight size={16} /></button>
    </div>
  );
}
