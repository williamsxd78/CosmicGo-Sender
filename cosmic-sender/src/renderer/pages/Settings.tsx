import { useEffect, useState } from 'react';
import { PageHeader, Field } from '../components/UI';
import { useUI } from '../store/ui';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [appState, setAppState] = useState<any>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const { toast, setTheme } = useUI();

  useEffect(() => {
    (async () => {
      const s = await window.cosmic.getSettings();
      if (s.ok) setSettings(s.data);
      const st = await window.cosmic.appState();
      if (st.ok) setAppState(st.data);
    })();
  }, []);

  if (!settings) return <div className="p-8 text-cosmic-muted">Loading…</div>;

  const save = async (patch: any) => {
    const r = await window.cosmic.updateSettings(patch);
    if (r.ok) {
      setSettings(r.data);
      if (patch.theme) setTheme(patch.theme);
      toast({ kind: 'success', title: 'Settings saved' });
    } else toast({ kind: 'error', title: 'Failed', description: r.error });
  };

  const changePw = async () => {
    if (next.length < 8) return toast({ kind: 'error', title: 'Password too short' });
    if (next !== next2) return toast({ kind: 'error', title: 'Passwords do not match' });
    const r = await window.cosmic.changePassword(current, next);
    if (!r.ok) return toast({ kind: 'error', title: 'Failed', description: r.error });
    setCurrent(''); setNext(''); setNext2('');
    toast({ kind: 'success', title: 'Password changed' });
  };

  return (
    <div className="pb-10">
      <PageHeader title="Settings" subtitle="Preferences, security and defaults." />

      <div className="px-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="cs-card p-5 space-y-3" data-testid="settings-appearance">
          <div className="font-display text-xl">Appearance</div>
          <Field label="Theme">
            <select className="cs-input" value={settings.theme} onChange={(e) => save({ theme: e.target.value })}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </Field>
        </div>

        <div className="cs-card p-5 space-y-3" data-testid="settings-security">
          <div className="font-display text-xl">Security</div>
          <Field label="Auto-lock" hint="Locks the app after inactivity. 0 = never.">
            <select className="cs-input" value={settings.auto_lock_minutes} onChange={(e) => save({ auto_lock_minutes: Number(e.target.value) as any })}>
              <option value={0}>Never</option>
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
            </select>
          </Field>
          <div className="text-xs text-cosmic-muted">Credential backend: <span className="text-cosmic-text">{appState?.credential_backend ?? '—'}</span></div>
          <div className="border-t border-cosmic-border pt-3 mt-3 space-y-2">
            <Field label="Current password"><input type="password" className="cs-input" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
            <Field label="New password"><input type="password" className="cs-input" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
            <Field label="Confirm new password"><input type="password" className="cs-input" value={next2} onChange={(e) => setNext2(e.target.value)} /></Field>
            <button className="cs-btn cs-btn-primary" onClick={changePw} data-testid="settings-change-password">Change password</button>
          </div>
        </div>

        <div className="cs-card p-5 space-y-3" data-testid="settings-defaults">
          <div className="font-display text-xl">Sending defaults</div>
          <Field label="Default rate / minute">
            <input type="number" className="cs-input" value={settings.default_rate_per_minute}
              onChange={(e) => save({ default_rate_per_minute: Number(e.target.value) })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.confirm_before_sending} onChange={(e) => save({ confirm_before_sending: e.target.checked })} />
            Confirm before starting each campaign
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.minimize_to_tray} onChange={(e) => save({ minimize_to_tray: e.target.checked })} />
            Minimize to system tray when window is closed
          </label>
        </div>

        <div className="cs-card p-5 space-y-3" data-testid="settings-attachments">
          <div className="font-display text-xl">Attachment limits</div>
          <Field label="Max size per file (MB)">
            <input type="number" className="cs-input" value={settings.attachment_max_mb_per_file}
              onChange={(e) => save({ attachment_max_mb_per_file: Number(e.target.value) })} />
          </Field>
          <Field label="Max total per email (MB)">
            <input type="number" className="cs-input" value={settings.attachment_max_mb_total}
              onChange={(e) => save({ attachment_max_mb_total: Number(e.target.value) })} />
          </Field>
        </div>

        <div className="cs-card p-5 space-y-1 xl:col-span-2" data-testid="settings-about">
          <div className="font-display text-xl">About</div>
          <div className="text-sm text-cosmic-muted">Cosmic Sender · v{appState?.app_version} · Platform: {appState?.platform}</div>
          <div className="text-xs text-cosmic-muted mt-2">This application is for authorized email use only. It does not include scraping, spam-filter evasion or domain impersonation features.</div>
        </div>
      </div>
    </div>
  );
}
