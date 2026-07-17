import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useUI } from './store/ui';
import Shell from './components/Shell';
import ToastHost from './components/ToastHost';
import ConfirmHost from './components/ConfirmHost';
import Setup from './pages/Setup';
import Lock from './pages/Lock';
import Dashboard from './pages/Dashboard';
import Providers from './pages/Providers';
import NewSend from './pages/NewSend';
import Campaigns from './pages/Campaigns';
import Contacts from './pages/Contacts';
import Lists from './pages/Lists';
import Templates from './pages/Templates';
import Suppression from './pages/Suppression';
import History from './pages/History';
import Logs from './pages/Logs';
import SettingsPage from './pages/Settings';
import CampaignDetail from './pages/CampaignDetail';

export default function App() {
  const [ready, setReady] = useState(false);
  const [firstRun, setFirstRun] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const { theme, setTheme, locked, setLocked } = useUI();

  useEffect(() => {
    (async () => {
      const state = await window.cosmic.appState();
      if (state.ok) {
        setFirstRun(state.data.first_run);
        setUnlocked(state.data.unlocked);
      }
      // Load settings for theme (only if unlocked; otherwise default dark)
      const s = await window.cosmic.getSettings();
      if (s.ok && s.data?.theme) setTheme(s.data.theme);
      else setTheme('dark');
      setReady(true);
    })();
    const off = window.cosmic.onSessionLocked(() => setLocked(true));
    return () => { off(); };
  }, []);

  useEffect(() => {
    // Ensure the html class matches current theme (in case setTheme wasn't called yet)
    const html = document.documentElement;
    if (theme === 'dark') { html.classList.add('dark'); html.classList.remove('light'); }
    else { html.classList.add('light'); html.classList.remove('dark'); }
  }, [theme]);

  if (!ready) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-cosmic-bg text-cosmic-text">
        <div data-testid="app-loading" className="text-sm text-cosmic-muted animate-pulse">Loading Cosmic Sender…</div>
      </div>
    );
  }

  if (firstRun) {
    return (
      <>
        <Setup
          onDone={() => {
            setFirstRun(false);
            setUnlocked(true);
          }}
        />
        <ToastHost />
        <ConfirmHost />
      </>
    );
  }

  if (!unlocked || locked) {
    return (
      <>
        <Lock onUnlocked={() => { setUnlocked(true); setLocked(false); }} />
        <ToastHost />
        <ConfirmHost />
      </>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/new" element={<NewSend />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/providers" element={<Providers />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/lists" element={<Lists />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/suppression" element={<Suppression />} />
        <Route path="/history" element={<History />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <ToastHost />
      <ConfirmHost />
    </Shell>
  );
}
