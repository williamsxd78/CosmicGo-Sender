import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { TemplateInputSchema, type TemplateInput } from '@shared/schemas';

export function listTemplates() {
  const db = getDb();
  return db.prepare(`SELECT * FROM templates ORDER BY updated_at DESC`).all();
}

export function upsertTemplate(input: TemplateInput) {
  const parsed = TemplateInputSchema.parse(input);
  const id = parsed.id ?? randomUUID();
  const now = new Date().toISOString();
  const db = getDb();
  const existing = db.prepare(`SELECT id FROM templates WHERE id = ?`).get(id);
  if (existing) {
    db.prepare(
      `UPDATE templates SET name=?, category=?, subject=?, preheader=?, html_body=?, text_body=?, updated_at=? WHERE id=?`,
    ).run(parsed.name, parsed.category, parsed.subject, parsed.preheader || null, parsed.html_body, parsed.text_body, now, id);
  } else {
    db.prepare(
      `INSERT INTO templates (id,name,category,subject,preheader,html_body,text_body,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).run(id, parsed.name, parsed.category, parsed.subject, parsed.preheader || null, parsed.html_body, parsed.text_body, now, now);
  }
  return db.prepare(`SELECT * FROM templates WHERE id = ?`).get(id);
}

export function deleteTemplate(id: string) {
  const db = getDb();
  db.prepare(`DELETE FROM templates WHERE id = ?`).run(id);
}
