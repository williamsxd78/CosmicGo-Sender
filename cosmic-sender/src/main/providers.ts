import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { newCredentialRef, saveCredential, readCredential, deleteCredential } from './credentials';
import { ProviderInputSchema, type ProviderInput } from '@shared/schemas';
import { logTechnical, logActivity } from './logger';

export interface ProviderRow {
  guid: string;
  kind: string;
  name: string;
  slug: string;
  host: string;
  port: number;
  encryption: 'NONE' | 'STARTTLS' | 'SSL_TLS';
  username: string;
  credential_ref: string;
  default_from_name: string;
  default_from_email: string;
  reply_to: string | null;
  hourly_limit: number;
  daily_limit: number;
  rate_limit_per_minute: number;
  connection_timeout_ms: number;
  max_retries: number;
  enabled: number;
  region: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPublic(r: ProviderRow) {
  return {
    guid: r.guid,
    kind: r.kind as ProviderInput['kind'],
    name: r.name,
    slug: r.slug,
    host: r.host,
    port: r.port,
    encryption: r.encryption,
    username: r.username,
    default_from_name: r.default_from_name,
    default_from_email: r.default_from_email,
    reply_to: r.reply_to ?? '',
    hourly_limit: r.hourly_limit,
    daily_limit: r.daily_limit,
    rate_limit_per_minute: r.rate_limit_per_minute,
    connection_timeout_ms: r.connection_timeout_ms,
    max_retries: r.max_retries,
    enabled: !!r.enabled,
    region: r.region ?? '',
    notes: r.notes ?? '',
    has_credentials: !!r.credential_ref,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function listProviders() {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM mail_providers ORDER BY created_at DESC`).all() as ProviderRow[];
  return rows.map(rowToPublic);
}

export function getProviderRow(guid: string): ProviderRow | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM mail_providers WHERE guid = ?`).get(guid) as ProviderRow | undefined;
}

export async function createProvider(input: ProviderInput) {
  const parsed = ProviderInputSchema.parse(input);
  const guid = parsed.guid ?? randomUUID();
  const now = new Date().toISOString();
  const credentialRef = newCredentialRef();
  await saveCredential(credentialRef, parsed.password);
  const db = getDb();
  db.prepare(
    `INSERT INTO mail_providers (guid, kind, name, slug, host, port, encryption, username, credential_ref,
      default_from_name, default_from_email, reply_to, hourly_limit, daily_limit, rate_limit_per_minute,
      connection_timeout_ms, max_retries, enabled, region, notes, created_at, updated_at)
     VALUES (@guid,@kind,@name,@slug,@host,@port,@encryption,@username,@credential_ref,
      @default_from_name,@default_from_email,@reply_to,@hourly_limit,@daily_limit,@rate_limit_per_minute,
      @connection_timeout_ms,@max_retries,@enabled,@region,@notes,@created_at,@updated_at)`,
  ).run({
    guid,
    kind: parsed.kind,
    name: parsed.name,
    slug: parsed.slug,
    host: parsed.host,
    port: parsed.port,
    encryption: parsed.encryption,
    username: parsed.username,
    credential_ref: credentialRef,
    default_from_name: parsed.default_from_name,
    default_from_email: parsed.default_from_email,
    reply_to: parsed.reply_to || null,
    hourly_limit: parsed.hourly_limit,
    daily_limit: parsed.daily_limit,
    rate_limit_per_minute: parsed.rate_limit_per_minute,
    connection_timeout_ms: parsed.connection_timeout_ms,
    max_retries: parsed.max_retries,
    enabled: parsed.enabled ? 1 : 0,
    region: parsed.region || null,
    notes: parsed.notes || null,
    created_at: now,
    updated_at: now,
  });
  logTechnical('provider', 'Provider created', { slug: parsed.slug, kind: parsed.kind });
  logActivity(`Provider "${parsed.name}" added`);
  return rowToPublic(getProviderRow(guid)!);
}

export async function updateProvider(guid: string, input: ProviderInput & { password?: string }) {
  const existing = getProviderRow(guid);
  if (!existing) throw new Error('Provider not found');
  const parsed = ProviderInputSchema.partial({ password: true }).parse(input);
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE mail_providers SET
       kind=@kind, name=@name, slug=@slug, host=@host, port=@port, encryption=@encryption,
       username=@username, default_from_name=@default_from_name, default_from_email=@default_from_email,
       reply_to=@reply_to, hourly_limit=@hourly_limit, daily_limit=@daily_limit,
       rate_limit_per_minute=@rate_limit_per_minute, connection_timeout_ms=@connection_timeout_ms,
       max_retries=@max_retries, enabled=@enabled, region=@region, notes=@notes, updated_at=@updated_at
     WHERE guid=@guid`,
  ).run({
    guid,
    kind: parsed.kind ?? existing.kind,
    name: parsed.name ?? existing.name,
    slug: parsed.slug ?? existing.slug,
    host: parsed.host ?? existing.host,
    port: parsed.port ?? existing.port,
    encryption: parsed.encryption ?? existing.encryption,
    username: parsed.username ?? existing.username,
    default_from_name: parsed.default_from_name ?? existing.default_from_name,
    default_from_email: parsed.default_from_email ?? existing.default_from_email,
    reply_to: parsed.reply_to ?? existing.reply_to,
    hourly_limit: parsed.hourly_limit ?? existing.hourly_limit,
    daily_limit: parsed.daily_limit ?? existing.daily_limit,
    rate_limit_per_minute: parsed.rate_limit_per_minute ?? existing.rate_limit_per_minute,
    connection_timeout_ms: parsed.connection_timeout_ms ?? existing.connection_timeout_ms,
    max_retries: parsed.max_retries ?? existing.max_retries,
    enabled: (parsed.enabled ?? !!existing.enabled) ? 1 : 0,
    region: parsed.region ?? existing.region,
    notes: parsed.notes ?? existing.notes,
    updated_at: now,
  });
  if (input.password) {
    await saveCredential(existing.credential_ref, input.password);
    logTechnical('provider', 'Provider credentials updated', { slug: existing.slug });
  }
  logActivity(`Provider "${parsed.name ?? existing.name}" updated`);
  return rowToPublic(getProviderRow(guid)!);
}

export async function deleteProvider(guid: string) {
  const existing = getProviderRow(guid);
  if (!existing) return;
  const db = getDb();
  db.prepare(`DELETE FROM mail_providers WHERE guid = ?`).run(guid);
  await deleteCredential(existing.credential_ref);
  logActivity(`Provider "${existing.name}" deleted`);
}

export async function duplicateProvider(guid: string) {
  const existing = getProviderRow(guid);
  if (!existing) throw new Error('Provider not found');
  const password = (await readCredential(existing.credential_ref)) ?? '';
  const copy: ProviderInput = {
    kind: existing.kind as ProviderInput['kind'],
    name: `${existing.name} (Copy)`,
    slug: `${existing.slug}-copy-${Math.floor(Math.random() * 10000)}`,
    host: existing.host,
    port: existing.port,
    encryption: existing.encryption,
    username: existing.username,
    password,
    default_from_name: existing.default_from_name,
    default_from_email: existing.default_from_email,
    reply_to: existing.reply_to ?? '',
    hourly_limit: existing.hourly_limit,
    daily_limit: existing.daily_limit,
    rate_limit_per_minute: existing.rate_limit_per_minute,
    connection_timeout_ms: existing.connection_timeout_ms,
    max_retries: existing.max_retries,
    enabled: false,
    region: existing.region ?? '',
    notes: existing.notes ?? '',
  };
  return createProvider(copy);
}

/* ---------------------- Sender identities ---------------------- */

export interface SenderIdentityRow {
  id: string;
  provider_guid: string;
  name: string;
  email: string;
  reply_to: string | null;
  domain: string | null;
  verified: number;
  is_default: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function listIdentities(providerGuid?: string) {
  const db = getDb();
  if (providerGuid) {
    return db.prepare(`SELECT * FROM sender_identities WHERE provider_guid = ? ORDER BY created_at DESC`).all(providerGuid) as SenderIdentityRow[];
  }
  return db.prepare(`SELECT * FROM sender_identities ORDER BY created_at DESC`).all() as SenderIdentityRow[];
}

export function upsertIdentity(input: {
  id?: string;
  provider_guid: string;
  name: string;
  email: string;
  reply_to?: string;
  domain?: string;
  verified?: boolean;
  is_default?: boolean;
  notes?: string;
}): SenderIdentityRow {
  const id = input.id ?? randomUUID();
  const now = new Date().toISOString();
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM sender_identities WHERE id = ?`).get(id) as SenderIdentityRow | undefined;

  if (input.is_default) {
    db.prepare(`UPDATE sender_identities SET is_default = 0 WHERE provider_guid = ?`).run(input.provider_guid);
  }

  if (existing) {
    db.prepare(
      `UPDATE sender_identities SET provider_guid=?, name=?, email=?, reply_to=?, domain=?, verified=?, is_default=?, notes=?, updated_at=? WHERE id=?`,
    ).run(
      input.provider_guid,
      input.name,
      input.email,
      input.reply_to || null,
      input.domain || null,
      input.verified ? 1 : 0,
      input.is_default ? 1 : 0,
      input.notes || null,
      now,
      id,
    );
  } else {
    db.prepare(
      `INSERT INTO sender_identities (id, provider_guid, name, email, reply_to, domain, verified, is_default, notes, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      input.provider_guid,
      input.name,
      input.email,
      input.reply_to || null,
      input.domain || null,
      input.verified ? 1 : 0,
      input.is_default ? 1 : 0,
      input.notes || null,
      now,
      now,
    );
  }
  return db.prepare(`SELECT * FROM sender_identities WHERE id = ?`).get(id) as SenderIdentityRow;
}

export function deleteIdentity(id: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM sender_identities WHERE id = ?`).run(id);
}
