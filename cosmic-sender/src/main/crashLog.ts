/**
 * Crash logger — writes fatal early-startup errors to a plain text file at
 *   %APPDATA%/CosmicSender/startup-crash.log      (Windows)
 *   ~/Library/Application Support/CosmicSender/startup-crash.log (macOS)
 *   ~/.config/CosmicSender/startup-crash.log       (Linux)
 *
 * Used BEFORE the SQLite DB or logger are guaranteed to be usable. Also shows
 * a modal error box so the user is never left with a silent black-hole crash.
 */
import fs from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';

function crashLogPath(): string {
  try {
    // app.getPath('userData') works even before app.ready in Electron 20+.
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'startup-crash.log');
  } catch {
    return path.join(process.env.TEMP || process.env.TMPDIR || '/tmp', 'CosmicSender-startup-crash.log');
  }
}

export function recordFatalCrash(scope: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const line = [
    `[${new Date().toISOString()}] FATAL in ${scope}: ${message}`,
    stack ? stack : '',
    `platform=${process.platform} arch=${process.arch} electron=${process.versions.electron} node=${process.versions.node}`,
    `resourcesPath=${process.resourcesPath ?? ''} __dirname=${__dirname}`,
    '---',
    '',
  ].join('\n');
  try {
    fs.appendFileSync(crashLogPath(), line);
  } catch {
    /* ignore */
  }
  // Best-effort dialog. Only works if Electron has finished bootstrapping enough.
  try {
    dialog.showErrorBox(
      'Cosmic Sender failed to start',
      `${scope}: ${message}\n\nA full crash log has been written to:\n${crashLogPath()}\n\nPlease share this file when reporting the issue.`,
    );
  } catch {
    /* ignore */
  }
}
