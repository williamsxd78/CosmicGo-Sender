import { getDb } from './db';
import { maskSecrets } from '@shared/mask';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export function logActivity(message: string, campaignId?: string, level: LogLevel = 'info'): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO activity_logs (ts, level, campaign_id, message) VALUES (?, ?, ?, ?)`,
  ).run(new Date().toISOString(), level, campaignId ?? null, message);
}

export function logTechnical(scope: string, message: string, meta?: unknown, level: LogLevel = 'info'): void {
  const db = getDb();
  const safeMeta = meta === undefined ? null : JSON.stringify(maskSecrets(meta));
  db.prepare(
    `INSERT INTO technical_logs (ts, level, scope, message, meta_json) VALUES (?, ?, ?, ?, ?)`,
  ).run(new Date().toISOString(), level, scope, message, safeMeta);
  if (process.env.COSMIC_SENDER_DEBUG === 'true') {
    // eslint-disable-next-line no-console
    console.log(`[${level}] [${scope}] ${message}`);
  }
}

export function listActivityLogs(limit = 500, campaignId?: string): Array<{
  id: number;
  ts: string;
  level: string;
  campaign_id: string | null;
  message: string;
}> {
  const db = getDb();
  if (campaignId) {
    return db
      .prepare(`SELECT * FROM activity_logs WHERE campaign_id = ? ORDER BY id DESC LIMIT ?`)
      .all(campaignId, limit) as any;
  }
  return db.prepare(`SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?`).all(limit) as any;
}

export function listTechnicalLogs(limit = 500): Array<{
  id: number;
  ts: string;
  level: string;
  scope: string;
  message: string;
  meta_json: string | null;
}> {
  const db = getDb();
  return db.prepare(`SELECT * FROM technical_logs ORDER BY id DESC LIMIT ?`).all(limit) as any;
}
