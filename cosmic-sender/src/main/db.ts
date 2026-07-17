import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import Database from 'better-sqlite3';

let db: Database.Database | null = null;

export function getDataDir(): string {
  const override = process.env.COSMIC_SENDER_DATA_DIR;
  if (override && override.trim()) return override;
  return path.join(app.getPath('userData'));
}

export function getDbPath(): string {
  return path.join(getDataDir(), 'cosmic-sender.db');
}

export function getDb(): Database.Database {
  if (db) return db;
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  return db;
}

/**
 * Runs SQL migration files under `migrations/` (bundled as extraResources).
 * We keep it simple: a `_schema_versions` table tracks applied filenames.
 */
export function runMigrations(migrationsDir: string): void {
  const conn = getDb();
  conn.exec(
    `CREATE TABLE IF NOT EXISTS _schema_versions (
       filename TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     );`,
  );
  const applied = new Set(conn.prepare(`SELECT filename FROM _schema_versions`).all().map((r: any) => r.filename));

  if (!fs.existsSync(migrationsDir)) return;
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const insert = conn.prepare(`INSERT INTO _schema_versions (filename, applied_at) VALUES (?, ?)`);
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf-8');
    const runAll = conn.transaction(() => {
      conn.exec(sql);
      insert.run(f, new Date().toISOString());
    });
    runAll();
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
