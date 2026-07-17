import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { ListInputSchema, type ListInput } from '@shared/schemas';

export function listLists() {
  const db = getDb();
  const rows = db.prepare(
    `SELECT l.*, (SELECT COUNT(*) FROM contact_list_members m WHERE m.list_id = l.id) as member_count
     FROM contact_lists l ORDER BY l.created_at DESC`,
  ).all() as Array<{ id: string; name: string; description: string | null; member_count: number; created_at: string; updated_at: string }>;
  return rows;
}

export function upsertList(input: ListInput) {
  const parsed = ListInputSchema.parse(input);
  const id = parsed.id ?? randomUUID();
  const now = new Date().toISOString();
  const db = getDb();
  const existing = db.prepare(`SELECT id FROM contact_lists WHERE id = ?`).get(id);
  if (existing) {
    db.prepare(`UPDATE contact_lists SET name=?, description=?, updated_at=? WHERE id=?`).run(
      parsed.name,
      parsed.description || null,
      now,
      id,
    );
  } else {
    db.prepare(`INSERT INTO contact_lists (id, name, description, created_at, updated_at) VALUES (?,?,?,?,?)`).run(
      id,
      parsed.name,
      parsed.description || null,
      now,
      now,
    );
  }
  return db.prepare(`SELECT * FROM contact_lists WHERE id = ?`).get(id);
}

export function deleteList(id: string) {
  const db = getDb();
  db.prepare(`DELETE FROM contact_lists WHERE id = ?`).run(id);
}

export function addContactsToList(listId: string, contactIds: string[]): number {
  const db = getDb();
  const stmt = db.prepare(`INSERT OR IGNORE INTO contact_list_members (list_id, contact_id, added_at) VALUES (?, ?, ?)`);
  const now = new Date().toISOString();
  const txn = db.transaction((ids: string[]) => {
    let n = 0;
    for (const cid of ids) {
      const r = stmt.run(listId, cid, now);
      n += r.changes;
    }
    return n;
  });
  return txn(contactIds);
}

export function removeContactsFromList(listId: string, contactIds: string[]): number {
  const db = getDb();
  const stmt = db.prepare(`DELETE FROM contact_list_members WHERE list_id = ? AND contact_id = ?`);
  const txn = db.transaction((ids: string[]) => {
    let n = 0;
    for (const cid of ids) {
      const r = stmt.run(listId, cid);
      n += r.changes;
    }
    return n;
  });
  return txn(contactIds);
}

export function listMembers(listId: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT c.* FROM contacts c INNER JOIN contact_list_members m ON m.contact_id = c.id
       WHERE m.list_id = ? ORDER BY c.email`,
    )
    .all(listId);
}
