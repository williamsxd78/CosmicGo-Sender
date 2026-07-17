import { useUI } from '../store/ui';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmHost() {
  const { confirm, closeConfirm } = useUI();
  if (!confirm.open) return null;
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 backdrop-blur-sm" data-testid="confirm-modal">
      <div className="cs-card p-6 w-[440px] max-w-[90vw] animate-fade-up">
        <div className="flex items-start gap-3">
          <div className={`h-10 w-10 rounded-full grid place-items-center ${confirm.destructive ? 'bg-red-500/15 text-red-400' : 'bg-cosmic-accent/15 text-cosmic-accent'}`}>
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-base" data-testid="confirm-title">{confirm.title}</div>
            {confirm.description && (
              <div className="text-sm text-cosmic-muted mt-1" data-testid="confirm-description">{confirm.description}</div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button className="cs-btn cs-btn-ghost" onClick={closeConfirm} data-testid="confirm-cancel">Cancel</button>
          <button
            className={`cs-btn ${confirm.destructive ? 'cs-btn-danger' : 'cs-btn-primary'}`}
            data-testid="confirm-ok"
            onClick={() => {
              const fn = confirm.onConfirm;
              closeConfirm();
              fn?.();
            }}
          >
            {confirm.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
