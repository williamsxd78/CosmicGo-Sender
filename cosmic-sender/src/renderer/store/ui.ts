import { create } from 'zustand';

type Toast = { id: string; kind: 'success' | 'error' | 'info' | 'warn'; title: string; description?: string };
type Confirm = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
};

interface UIState {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
  confirm: Confirm;
  openConfirm: (c: Omit<Confirm, 'open'>) => void;
  closeConfirm: () => void;
  locked: boolean;
  setLocked: (v: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  theme: 'dark',
  setTheme: (t) => {
    const html = document.documentElement;
    if (t === 'dark') {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
    }
    set({ theme: t });
  },
  toasts: [],
  toast: (t) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, ...t }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  confirm: { open: false, title: '' },
  openConfirm: (c) => set({ confirm: { open: true, ...c } }),
  closeConfirm: () => set({ confirm: { open: false, title: '' } }),
  locked: false,
  setLocked: (v) => set({ locked: v }),
}));
