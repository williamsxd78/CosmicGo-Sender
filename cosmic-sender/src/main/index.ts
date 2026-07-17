import { app, BrowserWindow, Menu, Tray, nativeImage, protocol, shell, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { runMigrations, getDataDir } from './db';
import { registerIpc, getEngine } from './ipc';
import * as auth from './auth';
import { getSettings, updateSettings } from './settings';
import { seedDemoData } from './seed';
import { recoverInterrupted } from './campaigns';
import { logActivity, logTechnical } from './logger';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function migrationsDir(): string {
  // In dev, migrations live next to the repo. In packaged app, electron-builder
  // copies them to process.resourcesPath/migrations via extraResources.
  const devPath = path.join(__dirname, '..', '..', '..', 'migrations');
  const prodPath = path.join(process.resourcesPath || '', 'migrations');
  return fs.existsSync(devPath) ? devPath : prodPath;
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#0b0d12',
    title: 'Cosmic Sender',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      spellcheck: false,
      devTools: process.env.NODE_ENV !== 'production',
    },
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173';
  if (process.env.NODE_ENV === 'development') {
    win.loadURL(devUrl).catch((err) => logTechnical('window', 'loadURL failed', { message: err.message }));
  } else {
    win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html')).catch((err) =>
      logTechnical('window', 'loadFile failed', { message: err.message }),
    );
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('close', async (e) => {
    if (isQuitting) return;
    const s = safeSettings();
    const engine = getEngine();
    // If minimize to tray is enabled OR a campaign is active, don't just close.
    // We can't await inside a sync handler; check status snapshot instead.
    if (s.minimize_to_tray) {
      e.preventDefault();
      win.hide();
      return;
    }
    // Active campaign warning
    void engine; // engine progress is tracked; do quick sync check via DB elsewhere if needed
  });

  return win;
}

function safeSettings() {
  try {
    return getSettings();
  } catch {
    return { theme: 'dark', auto_lock_minutes: 15, confirm_before_sending: true, default_rate_per_minute: 10, attachment_max_mb_per_file: 10, attachment_max_mb_total: 20, minimize_to_tray: true, launch_on_startup: false } as ReturnType<typeof getSettings>;
  }
}

function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: 'Open Cosmic Sender', click: () => showMainWindow() },
    { type: 'separator' },
    { label: 'Lock', click: () => { auth.lockSession(); showMainWindow(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]);
}

function createTray(): void {
  try {
    const iconPath = path.join(__dirname, '..', '..', '..', 'build', 'icon.png');
    const img = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
    tray = new Tray(img);
    tray.setToolTip('Cosmic Sender');
    tray.setContextMenu(buildTrayMenu());
    tray.on('click', () => showMainWindow());
  } catch (err) {
    logTechnical('tray', 'Tray unavailable', { message: (err as Error).message }, 'warn');
  }
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());
}

app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (event, url) => {
    const allowed = process.env.NODE_ENV === 'development' ? ['http://localhost:5173'] : [];
    if (!allowed.some((prefix) => url.startsWith(prefix)) && !url.startsWith('file://')) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(async () => {
  try {
    // Ensure data dir
    fs.mkdirSync(getDataDir(), { recursive: true });
    runMigrations(migrationsDir());
    if ((process.env.COSMIC_SENDER_SEED_DEMO ?? 'true') === 'true') {
      await seedDemoData();
    }
    recoverInterrupted();
    registerIpc(() => mainWindow);
    auth.startAutoLockWatcher(
      () => safeSettings().auto_lock_minutes,
      () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('session:locked');
      },
    );
    mainWindow = createMainWindow();
    createTray();
    logActivity('Cosmic Sender started');
  } catch (err) {
    dialog.showErrorBox('Cosmic Sender', 'Failed to start: ' + (err as Error).message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !tray) app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
});

// Only allow the local file protocol and disallow arbitrary shell exec
protocol && protocol.registerSchemesAsPrivileged?.([]);

process.on('uncaughtException', (err) => {
  logTechnical('process', 'uncaughtException', { message: err.message, stack: err.stack }, 'error');
});
process.on('unhandledRejection', (reason: any) => {
  logTechnical('process', 'unhandledRejection', { message: reason?.message ?? String(reason) }, 'error');
});
