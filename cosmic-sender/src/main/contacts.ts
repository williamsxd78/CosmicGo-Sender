import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { getDb } from './db';
import { ContactInputSchema, type ContactInput, emailSchema } from '@shared/schemas';
import Papa from 'papaparse';

export interface ContactRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  tags: string;
  custom_1: string | null;
  custom_2: string | null;
  custom_3: string | null;
  source: string | null;
  consent_status: string;
  consent_date: string | null;
  notes: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export function listContacts(opts: { search?: string; limit?: number; offset?: number } = {}) {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 500, 5000);
  const offset = opts.offset ?? 0;
  if (opts.search && opts.search.trim()) {
    const q = `%${opts.search.trim().toLowerCase()}%`;
    return db
      .prepare(
        `SELECT * FROM contacts
         WHERE lower(email) LIKE ? OR lower(coalesce(first_name,'')) LIKE ? OR lower(coalesce(last_name,'')) LIKE ? OR lower(coalesce(company,'')) LIKE ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(q, q, q, q, limit, offset) as ContactRow[];
  }
  return db.prepare(`SELECT * FROM contacts ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(limit, offset) as ContactRow[];
}

export function countContacts(): number {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) as c FROM contacts`).get() as { c: number };
  return row.c;
}

export function upsertContact(input: ContactInput): ContactRow {
  const parsed = ContactInputSchema.parse(input);
  const id = parsed.id ?? randomUUID();
  const now = new Date().toISOString();
  const db = getDb();
  const existing = db.prepare(`SELECT id FROM contacts WHERE lower(email) = lower(?)`).get(parsed.email) as { id: string } | undefined;
  const finalId = existing?.id ?? id;
  db.prepare(
    `INSERT INTO contacts (id,email,first_name,last_name,full_name,phone,company,city,state,country,tags,custom_1,custom_2,custom_3,source,consent_status,consent_date,notes,active,created_at,updated_at)
     VALUES (@id,@email,@first_name,@last_name,@full_name,@phone,@company,@city,@state,@country,@tags,@custom_1,@custom_2,@custom_3,@source,@consent_status,@consent_date,@notes,@active,@created_at,@updated_at)
     ON CONFLICT(email) DO UPDATE SET
       first_name=excluded.first_name, last_name=excluded.last_name, full_name=excluded.full_name,
       phone=excluded.phone, company=excluded.company, city=excluded.city, state=excluded.state, country=excluded.country,
       tags=excluded.tags, custom_1=excluded.custom_1, custom_2=excluded.custom_2, custom_3=excluded.custom_3,
       source=excluded.source, consent_status=excluded.consent_status, consent_date=excluded.consent_date,
       notes=excluded.notes, active=excluded.active, updated_at=excluded.updated_at`,
  ).run({
    id: finalId,
    email: parsed.email,
    first_name: parsed.first_name || null,
    last_name: parsed.last_name || null,
    full_name: parsed.full_name || null,
    phone: parsed.phone || null,
    company: parsed.company || null,
    city: parsed.city || null,
    state: parsed.state || null,
    country: parsed.country || null,
    tags: JSON.stringify(parsed.tags ?? []),
    custom_1: parsed.custom_1 || null,
    custom_2: parsed.custom_2 || null,
    custom_3: parsed.custom_3 || null,
    source: parsed.source || null,
    consent_status: parsed.consent_status,
    consent_date: parsed.consent_date || null,
    notes: parsed.notes || null,
    active: parsed.active ? 1 : 0,
    created_at: now,
    updated_at: now,
  });
  return db.prepare(`SELECT * FROM contacts WHERE id = ?`).get(finalId) as ContactRow;
}

export function deleteContact(id: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM contacts WHERE id = ?`).run(id);
}

export function bulkDeleteContacts(ids: string[]): number {
  const db = getDb();
  const stmt = db.prepare(`DELETE FROM contacts WHERE id = ?`);
  const txn = db.transaction((items: string[]) => {
    let n = 0;
    for (const id of items) {
      const res = stmt.run(id);
      n += res.changes;
    }
    return n;
  });
  return txn(ids);
}

/* ------------------------------- CSV ------------------------------- */

export interface CsvImportOptions {
  filePath: string;
  columnMap: Record<string, string>; // csv header -> contact field
  duplicateHandling: 'SKIP' | 'UPDATE' | 'FILL_MISSING' | 'REPLACE';
  source?: string;
}

export interface CsvImportReport {
  total: number;
  imported: number;
  updated: number;
  duplicates: number;
  invalid: number;
  suppressed: number;
  errors: Array<{ row: number; email?: string; error: string }>;
}

const CONTACT_FIELDS = new Set([
  'email',
  'first_name',
  'last_name',
  'full_name',
  'phone',
  'company',
  'city',
  'state',
  'country',
  'tags',
  'custom_1',
  'custom_2',
  'custom_3',
  'notes',
]);

export function importContactsCsv(opts: CsvImportOptions): CsvImportReport {
  const db = getDb();
  const raw = fs.readFileSync(opts.filePath, 'utf-8').replace(/^\uFEFF/, '');
  const parsed = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true });

  const report: CsvImportReport = {
    total: parsed.data.length,
    imported: 0,
    updated: 0,
    duplicates: 0,
    invalid: 0,
    suppressed: 0,
    errors: [],
  };

  const suppressed = new Set(
    (db.prepare(`SELECT lower(email) as email FROM suppression_list`).all() as Array<{ email: string }>).map((r) => r.email),
  );

  const findByEmail = db.prepare(`SELECT * FROM contacts WHERE lower(email) = lower(?)`);
  const insertContact = db.prepare(
    `INSERT INTO contacts (id,email,first_name,last_name,full_name,phone,company,city,state,country,tags,custom_1,custom_2,custom_3,source,consent_status,consent_date,notes,active,created_at,updated_at)
     VALUES (@id,@email,@first_name,@last_name,@full_name,@phone,@company,@city,@state,@country,@tags,@custom_1,@custom_2,@custom_3,@source,@consent_status,@consent_date,@notes,@active,@created_at,@updated_at)`,
  );

  const now = new Date().toISOString();

  const txn = db.transaction(() => {
    parsed.data.forEach((row, idx) => {
      try {
        const mapped: Record<string, string> = {};
        for (const [csvKey, field] of Object.entries(opts.columnMap)) {
          if (!field || !CONTACT_FIELDS.has(field)) continue;
          const val = row[csvKey];
          if (val != null) mapped[field] = String(val).trim();
        }
        const email = (mapped.email ?? '').toLowerCase();
        if (!email) {
          report.invalid += 1;
          report.errors.push({ row: idx + 2, error: 'Missing email' });
          return;
        }
        const emailCheck = emailSchema.safeParse(email);
        if (!emailCheck.success) {
          report.invalid += 1;
          report.errors.push({ row: idx + 2, email, error: 'Invalid email' });
          return;
        }
        if (suppressed.has(email)) {
          report.suppressed += 1;
          return;
        }
        const existing = findByEmail.get(email) as ContactRow | undefined;
        if (existing) {
          report.duplicates += 1;
          if (opts.duplicateHandling === 'SKIP') return;
          if (opts.duplicateHandling === 'UPDATE') {
            db.prepare(
              `UPDATE contacts SET first_name=?, last_name=?, full_name=?, phone=?, company=?, city=?, state=?, country=?,
                tags=?, custom_1=?, custom_2=?, custom_3=?, notes=?, updated_at=? WHERE id=?`,
            ).run(
              mapped.first_name || existing.first_name,
              mapped.last_name || existing.last_name,
              mapped.full_name || existing.full_name,
              mapped.phone || existing.phone,
              mapped.company || existing.company,
              mapped.city || existing.city,
              mapped.state || existing.state,
              mapped.country || existing.country,
              mapped.tags ? JSON.stringify(mapped.tags.split(',').map((s) => s.trim()).filter(Boolean)) : existing.tags,
              mapped.custom_1 || existing.custom_1,
              mapped.custom_2 || existing.custom_2,
              mapped.custom_3 || existing.custom_3,
              mapped.notes || existing.notes,
              now,
              existing.id,
            );
            report.updated += 1;
          } else if (opts.duplicateHandling === 'FILL_MISSING') {
            db.prepare(
              `UPDATE contacts SET first_name=coalesce(first_name,?), last_name=coalesce(last_name,?),
                phone=coalesce(phone,?), company=coalesce(company,?), city=coalesce(city,?), state=coalesce(state,?),
                country=coalesce(country,?), updated_at=? WHERE id=?`,
            ).run(
              mapped.first_name || null,
              mapped.last_name || null,
              mapped.phone || null,
              mapped.company || null,
              mapped.city || null,
              mapped.state || null,
              mapped.country || null,
              now,
              existing.id,
            );
            report.updated += 1;
          } else if (opts.duplicateHandling === 'REPLACE') {
            db.prepare(`DELETE FROM contacts WHERE id = ?`).run(existing.id);
            // fall through to insert
            insertOne();
            return;
          }
          return;
        }
        insertOne();

        function insertOne() {
          insertContact.run({
            id: randomUUID(),
            email,
            first_name: mapped.first_name || null,
            last_name: mapped.last_name || null,
            full_name: mapped.full_name || null,
            phone: mapped.phone || null,
            company: mapped.company || null,
            city: mapped.city || null,
            state: mapped.state || null,
            country: mapped.country || null,
            tags: JSON.stringify(mapped.tags ? mapped.tags.split(',').map((s) => s.trim()).filter(Boolean) : []),
            custom_1: mapped.custom_1 || null,
            custom_2: mapped.custom_2 || null,
            custom_3: mapped.custom_3 || null,
            source: opts.source || 'csv-import',
            consent_status: 'UNKNOWN',
            consent_date: null,
            notes: mapped.notes || null,
            active: 1,
            created_at: now,
            updated_at: now,
          });
          report.imported += 1;
        }
      } catch (err) {
        report.invalid += 1;
        report.errors.push({ row: idx + 2, error: (err as Error).message });
      }
    });
  });
  txn();
  return report;
}

export function exportContactsCsv(): string {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM contacts ORDER BY email`).all() as ContactRow[];
  const data = rows.map((r) => ({
    email: r.email,
    first_name: r.first_name ?? '',
    last_name: r.last_name ?? '',
    full_name: r.full_name ?? '',
    phone: r.phone ?? '',
    company: r.company ?? '',
    city: r.city ?? '',
    state: r.state ?? '',
    country: r.country ?? '',
    tags: (JSON.parse(r.tags) as string[]).join(','),
    custom_1: r.custom_1 ?? '',
    custom_2: r.custom_2 ?? '',
    custom_3: r.custom_3 ?? '',
    source: r.source ?? '',
    consent_status: r.consent_status,
    consent_date: r.consent_date ?? '',
    notes: r.notes ?? '',
    active: r.active ? 'yes' : 'no',
  }));
  return Papa.unparse(data);
}

export function detectCsvHeaders(filePath: string): { headers: string[]; preview: Record<string, string>[] } {
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  const parsed = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true, preview: 5 });
  return {
    headers: parsed.meta.fields ?? [],
    preview: parsed.data,
  };
}
