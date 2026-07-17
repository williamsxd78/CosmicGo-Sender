import { useUI } from '../store/ui';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export default function ToastHost() {
  const { toasts, dismiss } = useUI();
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-[380px]" data-testid="toast-host">
      {toasts.map((t) => {
        const Icon =
          t.kind === 'success' ? CheckCircle2 :
          t.kind === 'error' ? XCircle :
          t.kind === 'warn' ? AlertTriangle : Info;
        const color =
          t.kind === 'success' ? 'text-emerald-400 border-emerald-500/40' :
          t.kind === 'error' ? 'text-red-400 border-red-500/40' :
          t.kind === 'warn' ? 'text-amber-400 border-amber-500/40' :
          'text-cyan-400 border-cyan-500/40';
        return (
          <div
            key={t.id}
            className={`cs-card p-3 pr-8 flex items-start gap-3 border ${color} animate-fade-up`}
            data-testid={`toast-${t.kind}`}
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm break-words">{t.title}</div>
              {t.description && <div className="text-xs text-cosmic-muted mt-0.5 break-words">{t.description}</div>}
            </div>
            <button
              className="absolute right-2 top-2 text-cosmic-muted hover:text-white"
              onClick={() => dismiss(t.id)}
              data-testid="toast-dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
