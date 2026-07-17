import { getDb } from './db';
import { AppSettingsSchema, type AppSettings } from '@shared/schemas';

const DEFAULTS: AppSettings = AppSettingsSchema.parse({});

export function getSettings(): AppSettings {
  const db = getDb();
  const rows = db.prepare(`SELECT key, value FROM settings`).all() as Array<{ key: string; value: string }>;
  const obj: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      obj[r.key] = JSON.parse(r.value);
    } catch {
      obj[r.key] = r.value;
    }
  }
  return AppSettingsSchema.parse({ ...DEFAULTS, ...obj });
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const merged = AppSettingsSchema.parse({ ...current, ...patch });
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
  const txn = db.transaction(() => {
    for (const [k, v] of Object.entries(merged)) {
      stmt.run(k, JSON.stringify(v));
    }
  });
  txn();
  return merged;
}
