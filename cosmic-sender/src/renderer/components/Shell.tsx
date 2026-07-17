import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Send, FolderKanban, Server, Users, ListTree, FileText,
  ShieldOff, History as HistoryIcon, Settings as SettingsIcon, Terminal, Lock, Sun, Moon, Sparkles,
} from 'lucide-react';
import { useUI } from '../store/ui';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, testid: 'nav-dashboard' },
  { to: '/new', label: 'New Send', icon: Send, testid: 'nav-new' },
  { to: '/campaigns', label: 'Campaigns', icon: FolderKanban, testid: 'nav-campaigns' },
  { to: '/providers', label: 'SMTP Providers', icon: Server, testid: 'nav-providers' },
  { to: '/contacts', label: 'Contacts', icon: Users, testid: 'nav-contacts' },
  { to: '/lists', label: 'Lists', icon: ListTree, testid: 'nav-lists' },
  { to: '/templates', label: 'Templates', icon: FileText, testid: 'nav-templates' },
  { to: '/suppression', label: 'Suppression', icon: ShieldOff, testid: 'nav-suppression' },
  { to: '/history', label: 'Send History', icon: HistoryIcon, testid: 'nav-history' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, testid: 'nav-settings' },
  { to: '/logs', label: 'System Logs', icon: Terminal, testid: 'nav-logs' },
];

export default function Shell({ children }: { children: ReactNode }) {
  const { theme, setTheme, setLocked } = useUI();
  const nav = useNavigate();

  const handleLock = async () => {
    await window.cosmic.lock();
    setLocked(true);
    nav('/dashboard');
  };

  return (
    <div className="h-full w-full grid grid-cols-[260px_1fr] overflow-hidden" data-testid="app-shell">
      {/* Sidebar */}
      <aside className="relative flex flex-col h-full border-r border-cosmic-border bg-cosmic-panel">
        <div className="cs-grain absolute inset-0 pointer-events-none opacity-70" />
        <div className="relative flex items-center gap-3 px-5 py-5 border-b border-cosmic-border">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-indigo-500 grid place-items-center shadow-glow">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <div className="font-display text-lg leading-none tracking-tight">Cosmic Sender</div>
            <div className="text-[11px] uppercase tracking-widest text-cosmic-muted mt-1">Premium Desktop</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" data-testid="app-sidebar">
          {navItems.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={testid}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all ${
                  isActive
                    ? 'bg-cosmic-accent/15 text-white shadow-[inset_0_0_0_1px_rgba(124,92,255,0.35)]'
                    : 'text-cosmic-muted hover:text-white hover:bg-white/[0.04]'
                }`
              }
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="relative border-t border-cosmic-border p-3 space-y-2">
          <button
            data-testid="btn-toggle-theme"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="cs-btn cs-btn-ghost w-full justify-start"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button
            data-testid="btn-lock"
            onClick={handleLock}
            className="cs-btn cs-btn-ghost w-full justify-start"
          >
            <Lock size={16} />
            <span>Lock</span>
          </button>
        </div>
      </aside>

      <main className="relative h-full overflow-y-auto">
        <div className="cs-grain absolute inset-0 pointer-events-none" />
        <div className="relative animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
