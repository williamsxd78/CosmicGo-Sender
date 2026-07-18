import bcrypt from 'bcryptjs';
import { getDb } from './db';
import { logTechnical } from './logger';

let sessionUnlocked = false;
let lastActivityAt = Date.now();

export function isUnlocked(): boolean {
  // If no password has been set, treat the app as unlocked (no auth wall).
  // Users can optionally set a password from Settings → Security.
  if (!hasPasswordSet()) {
    if (!sessionUnlocked) sessionUnlocked = true;
    return true;
  }
  return sessionUnlocked;
}

export function touchSession(): void {
  lastActivityAt = Date.now();
}

export function lockSession(): void {
  sessionUnlocked = false;
}

export function hasPasswordSet(): boolean {
  const db = getDb();
  const row = db.prepare(`SELECT id FROM users WHERE id = 1`).get();
  return !!row;
}

export async function setInitialPassword(plain: string): Promise<void> {
  if (typeof plain !== 'string' || plain.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(plain, salt);
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `INSERT INTO users (id, password_hash, password_algo, created_at, updated_at)
     VALUES (1, ?, 'bcrypt', ?, ?)
     ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, password_algo = excluded.password_algo, updated_at = excluded.updated_at`,
  ).run(hash, now, now);
  sessionUnlocked = true;
  lastActivityAt = Date.now();
  logTechnical('auth', 'Local admin password initialized');
}

export async function verifyPassword(plain: string): Promise<boolean> {
  const db = getDb();
  const row = db.prepare(`SELECT password_hash FROM users WHERE id = 1`).get() as { password_hash: string } | undefined;
  if (!row) return false;
  try {
    const ok = await bcrypt.compare(plain, row.password_hash);
    if (ok) {
      sessionUnlocked = true;
      lastActivityAt = Date.now();
    }
    return ok;
  } catch {
    return false;
  }
}

export async function changePassword(current: string, next: string): Promise<void> {
  const ok = await verifyPassword(current);
  if (!ok) throw new Error('Current password is incorrect');
  await setInitialPassword(next);
}

export function startAutoLockWatcher(getAutoLockMinutes: () => number, onLock: () => void): NodeJS.Timeout {
  return setInterval(() => {
    const minutes = getAutoLockMinutes();
    if (minutes <= 0) return;
    const elapsed = (Date.now() - lastActivityAt) / 60000;
    if (sessionUnlocked && elapsed >= minutes) {
      sessionUnlocked = false;
      onLock();
      logTechnical('auth', 'Session auto-locked');
    }
  }, 30_000);
}
