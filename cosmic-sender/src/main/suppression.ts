import { getDb } from './db';
import { SuppressionInputSchema, type SuppressionInput, emailSchema } from '@shared/schemas';
import Papa from 'papaparse';
import fs from 'node:fs';

export function listSuppression(search?: string) {
  const db = getDb();
  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    return db.prepare(`SELECT * FROM suppression_list WHERE lower(email) LIKE ? ORDER BY created_at DESC LIMIT 2000`).all(q);
  }
  return db.prepare(`SELECT * FROM suppression_list ORDER BY created_at DESC LIMIT 2000`).all();
}

export function isSuppressed(email: string): boolean {
  const db = getDb();
  const row = db.prepare(`SELECT email FROM suppression_list WHERE lower(email) = lower(?)`).get(email);
  return !!row;
}

export function addSuppression(input: SuppressionInput) {
  const parsed = SuppressionInputSchema.parse(input);
  const db = getDb();
  db.prepare(
    `INSERT INTO suppression_list (email, reason, source, campaign_id, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET reason=excluded.reason, source=excluded.source, notes=excluded.notes`,
  ).run(
    parsed.email.toLowerCase(),
    parsed.reason,
    parsed.source || null,
    parsed.campaign_id || null,
    parsed.notes || null,
    new Date().toISOString(),
  );
  return db.prepare(`SELECT * FROM suppression_list WHERE lower(email) = lower(?)`).get(parsed.email);
}

export function removeSuppression(email: string): boolean {
  const db = getDb();
  const r = db.prepare(`DELETE FROM suppression_list WHERE lower(email) = lower(?)`).run(email);
  return r.changes > 0;
}

export function importSuppressionCsv(filePath: string): { imported: number; invalid: number } {
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  const parsed = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true });
  let imported = 0;
  let invalid = 0;
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO suppression_list (email, reason, source, notes, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  const now = new Date().toISOString();
  const txn = db.transaction((rows: Record<string, string>[]) => {
    for (const row of rows) {
      const email = (row.email ?? row.Email ?? '').trim();
      if (!email || !emailSchema.safeParse(email).success) {
        invalid += 1;
        continue;
      }
      stmt.run(
        email.toLowerCase(),
        row.reason || 'IMPORTED',
        row.source || 'csv-import',
        row.notes || null,
        row.created_at || now,
      );
      imported += 1;
    }
  });
  txn(parsed.data);
  return { imported, invalid };
}

export function exportSuppressionCsv(): string {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM suppression_list ORDER BY email`).all() as Array<{
    email: string;
    reason: string;
    source: string | null;
    campaign_id: string | null;
    notes: string | null;
    created_at: string;
  }>;
  return Papa.unparse(rows);
}
