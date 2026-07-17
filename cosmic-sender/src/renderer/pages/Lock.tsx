import { useState } from 'react';
import { Lock as LockIcon, Sparkles } from 'lucide-react';
import { useUI } from '../store/ui';

export default function Lock({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useUI();

  const submit = async () => {
    setLoading(true);
    try {
      const res = await window.cosmic.login(password);
      if (!res.ok) {
        toast({ kind: 'error', title: 'Login failed', description: res.error });
        return;
      }
      onUnlocked();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full grid place-items-center" data-testid="lock-screen">
      <div className="cs-card p-8 w-[420px] max-w-[92vw]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 grid place-items-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <div className="font-display text-2xl leading-tight">Cosmic Sender</div>
            <div className="text-xs uppercase tracking-widest text-cosmic-muted">Locked</div>
          </div>
        </div>
        <div className="mt-6">
          <div className="relative">
            <LockIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cosmic-muted" />
            <input
              data-testid="lock-password"
              type="password"
              placeholder="Enter local admin password"
              className="cs-input pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoFocus
            />
          </div>
          <button
            data-testid="lock-unlock"
            disabled={loading}
            onClick={submit}
            className="cs-btn cs-btn-primary w-full justify-center mt-4"
          >
            {loading ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
}
