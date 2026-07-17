import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 px-8 pt-8 pb-6">
      <div>
        <h1 className="font-display text-3xl leading-tight tracking-tight" data-testid="page-title">{title}</h1>
        {subtitle && <p className="text-sm text-cosmic-muted mt-1 max-w-2xl" data-testid="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action, testid }: { title: string; description?: string; action?: ReactNode; testid?: string }) {
  return (
    <div className="cs-card p-10 text-center" data-testid={testid ?? 'empty-state'}>
      <div className="mx-auto h-12 w-12 rounded-full bg-cosmic-accent/15 grid place-items-center animate-pulse-glow">
        <span className="text-cosmic-accent text-xl">✦</span>
      </div>
      <div className="font-display text-xl mt-4">{title}</div>
      {description && <div className="text-sm text-cosmic-muted mt-2 max-w-md mx-auto">{description}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = 'default', testid }: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'success' | 'danger' | 'warn';
  testid?: string;
}) {
  const toneClasses = {
    default: 'text-cosmic-text',
    success: 'text-emerald-400',
    danger: 'text-red-400',
    warn: 'text-amber-400',
  }[tone];
  return (
    <div className="cs-card p-5" data-testid={testid}>
      <div className="text-xs uppercase tracking-widest text-cosmic-muted">{label}</div>
      <div className={`font-display text-3xl mt-2 ${toneClasses}`}>{value}</div>
      {hint && <div className="text-xs text-cosmic-muted mt-1">{hint}</div>}
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-cosmic-muted mb-1.5">{label}</span>
      {children}
      {hint && !error && <span className="block text-[11px] text-cosmic-muted mt-1">{hint}</span>}
      {error && <span className="block text-[11px] text-red-400 mt-1">{error}</span>}
    </label>
  );
}

export function Badge({ tone = 'muted', children }: { tone?: 'success' | 'warn' | 'danger' | 'info' | 'muted'; children: ReactNode }) {
  const cls = `cs-badge cs-badge-${tone}`;
  return <span className={cls}>{children}</span>;
}
