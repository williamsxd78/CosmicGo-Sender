import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { getDb } from './db';
import { getProviderRow } from './providers';
import { sendMessage } from './smtp';
import { logActivity, logTechnical } from './logger';
import { isSuppressed } from './suppression';
import { CampaignInputSchema, emailSchema, type CampaignInput, type CampaignStatus, type RecipientStatus } from '@shared/schemas';
import { renderPersonalization } from '@shared/personalization';

/* ---------------------------- Types ---------------------------- */
export interface CampaignRow {
  id: string;
  name: string;
  provider_guid: string;
  sender_identity_id: string;
  reply_to: string | null;
  subject: string;
  preheader: string | null;
  html_body: string;
  text_body: string;
  attachments_json: string;
  rate_per_minute: number;
  scheduled_at: string | null;
  promotional: number;
  unsubscribe_url: string | null;
  tracking_opens: number;
  tracking_clicks: number;
  status: CampaignStatus;
  total: number;
  accepted: number;
  failed: number;
  skipped: number;
  suppressed: number;
  cancelled: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface RecipientRow {
  id: string;
  campaign_id: string;
  email: string;
  merge_data_json: string;
  personalized_subject: string | null;
  status: RecipientStatus;
  attempts: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  smtp_response_category: string | null;
  smtp_response_message: string | null;
  message_id: string | null;
}

/* ------------------------ Preflight & CRUD ---------------------- */

export interface PreflightSummary {
  ok: boolean;
  warnings: string[];
  errors: string[];
  total_input: number;
  valid: number;
  duplicates: number;
  invalid: number;
  suppressed: number;
  final_queued: number;
  estimated_minutes: number;
}

export interface ResolvedRecipient {
  email: string;
  data: Record<string, string>;
}

function resolveRecipients(input: CampaignInput): ResolvedRecipient[] {
  const db = getDb();
  const rs = input.recipient_source;
  if (rs.kind === 'MANUAL') {
    return rs.emails.map((email) => ({ email: email.trim().toLowerCase(), data: { email: email.trim() } }));
  }
  if (rs.kind === 'LIST') {
    const rows = db
      .prepare(
        `SELECT c.* FROM contacts c INNER JOIN contact_list_members m ON m.contact_id = c.id WHERE m.list_id = ?`,
      )
      .all(rs.list_id) as any[];
    return rows.map((r) => ({ email: r.email.toLowerCase(), data: contactToMergeData(r) }));
  }
  // CSV or ad-hoc contact ids
  if (rs.contact_ids.length === 0) return [];
  const placeholders = rs.contact_ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM contacts WHERE id IN (${placeholders})`).all(...rs.contact_ids) as any[];
  return rows.map((r) => ({ email: r.email.toLowerCase(), data: contactToMergeData(r) }));
}

function contactToMergeData(row: any): Record<string, string> {
  const fullName = row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ');
  return {
    email: row.email,
    first_name: row.first_name ?? '',
    last_name: row.last_name ?? '',
    full_name: fullName,
    company: row.company ?? '',
    phone: row.phone ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    country: row.country ?? '',
    custom_1: row.custom_1 ?? '',
    custom_2: row.custom_2 ?? '',
    custom_3: row.custom_3 ?? '',
  };
}

export function preflight(input: CampaignInput): PreflightSummary {
  const parsed = CampaignInputSchema.parse(input);
  const warnings: string[] = [];
  const errors: string[] = [];
  const db = getDb();

  const provider = getProviderRow(parsed.provider_guid);
  if (!provider) errors.push('Selected provider does not exist.');
  else if (!provider.enabled) errors.push('Selected provider is disabled.');

  const identity = db.prepare(`SELECT * FROM sender_identities WHERE id = ?`).get(parsed.sender_identity_id);
  if (!identity) errors.push('Selected sender identity does not exist.');

  if (parsed.promotional && !parsed.unsubscribe_url) {
    warnings.push('This is a promotional campaign but no unsubscribe URL is configured.');
  }

  if (provider && parsed.rate_per_minute > provider.rate_limit_per_minute) {
    warnings.push(
      `Sending rate ${parsed.rate_per_minute}/min exceeds provider maximum ${provider.rate_limit_per_minute}/min. It will be capped.`,
    );
  }

  const attachments = parsed.attachments;
  const maxTotalMb = 20;
  const maxPerMb = 10;
  const blocked = /\.(exe|bat|cmd|scr|msi|ps1|vbs|js)$/i;
  let totalBytes = 0;
  for (const a of attachments) {
    if (blocked.test(a.filename)) errors.push(`Attachment "${a.filename}" has a blocked file type.`);
    if (a.size_bytes > maxPerMb * 1024 * 1024) errors.push(`Attachment "${a.filename}" exceeds ${maxPerMb} MB.`);
    totalBytes += a.size_bytes;
    if (!fs.existsSync(a.path)) errors.push(`Attachment file not found: ${a.filename}`);
  }
  if (totalBytes > maxTotalMb * 1024 * 1024) errors.push(`Total attachments exceed ${maxTotalMb} MB.`);

  const resolved = resolveRecipients(parsed);
  const total_input = resolved.length;

  // Dedup by email
  const seen = new Set<string>();
  const deduped: ResolvedRecipient[] = [];
  let duplicates = 0;
  for (const r of resolved) {
    if (seen.has(r.email)) {
      duplicates += 1;
      continue;
    }
    seen.add(r.email);
    deduped.push(r);
  }

  let invalid = 0;
  let suppressed = 0;
  const valid: ResolvedRecipient[] = [];
  for (const r of deduped) {
    if (!emailSchema.safeParse(r.email).success) {
      invalid += 1;
      continue;
    }
    if (isSuppressed(r.email)) {
      suppressed += 1;
      continue;
    }
    valid.push(r);
  }

  if (valid.length === 0) errors.push('No valid recipients remain after suppression and validation.');

  const rate = Math.min(parsed.rate_per_minute, provider?.rate_limit_per_minute ?? parsed.rate_per_minute);
  const estimated_minutes = rate > 0 ? Math.ceil(valid.length / rate) : 0;

  return {
    ok: errors.length === 0,
    warnings,
    errors,
    total_input,
    valid: valid.length,
    duplicates,
    invalid,
    suppressed,
    final_queued: valid.length,
    estimated_minutes,
  };
}

export function createCampaign(input: CampaignInput): CampaignRow {
  const parsed = CampaignInputSchema.parse(input);
  const id = parsed.id ?? randomUUID();
  const now = new Date().toISOString();
  const db = getDb();

  // Resolve, dedupe, validate, filter suppression
  const resolved = resolveRecipients(parsed);
  const seen = new Set<string>();
  const finalList: ResolvedRecipient[] = [];
  for (const r of resolved) {
    if (seen.has(r.email)) continue;
    seen.add(r.email);
    if (!emailSchema.safeParse(r.email).success) continue;
    if (isSuppressed(r.email)) continue;
    finalList.push(r);
  }

  const attachmentsJson = JSON.stringify(parsed.attachments ?? []);
  db.prepare(
    `INSERT INTO campaigns (id,name,provider_guid,sender_identity_id,reply_to,subject,preheader,html_body,text_body,
      attachments_json,rate_per_minute,scheduled_at,promotional,unsubscribe_url,tracking_opens,tracking_clicks,
      status,total,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    parsed.name,
    parsed.provider_guid,
    parsed.sender_identity_id,
    parsed.reply_to || null,
    parsed.subject,
    parsed.preheader || null,
    parsed.html_body,
    parsed.text_body,
    attachmentsJson,
    parsed.rate_per_minute,
    parsed.scheduled_at || null,
    parsed.promotional ? 1 : 0,
    parsed.unsubscribe_url || null,
    parsed.tracking_opens ? 1 : 0,
    parsed.tracking_clicks ? 1 : 0,
    'QUEUED',
    finalList.length,
    now,
    now,
  );

  const insertRcp = db.prepare(
    `INSERT OR IGNORE INTO campaign_recipients (id,campaign_id,email,merge_data_json,personalized_subject,status,attempts)
     VALUES (?,?,?,?,?,?,0)`,
  );
  const txn = db.transaction(() => {
    for (const r of finalList) {
      const subjectRender = renderPersonalization(parsed.subject, {
        ...r.data,
        unsubscribe_url: parsed.unsubscribe_url ?? '',
      });
      insertRcp.run(randomUUID(), id, r.email, JSON.stringify(r.data), subjectRender.output, 'QUEUED');
    }
  });
  txn();

  logActivity(`Campaign "${parsed.name}" created with ${finalList.length} recipients`, id);
  return db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id) as CampaignRow;
}

/* ---------------------------- Engine ---------------------------- */

const RETRY_SCHEDULE_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

export class CampaignEngine extends EventEmitter {
  private controllers = new Map<string, { paused: boolean; cancelled: boolean }>();
  private running = new Set<string>();

  private db() {
    return getDb();
  }

  isRunning(campaignId: string): boolean {
    return this.running.has(campaignId);
  }

  async start(campaignId: string): Promise<void> {
    if (this.running.has(campaignId)) return;
    this.running.add(campaignId);
    this.controllers.set(campaignId, { paused: false, cancelled: false });
    const now = new Date().toISOString();
    this.db()
      .prepare(`UPDATE campaigns SET status='SENDING', started_at=coalesce(started_at, ?), updated_at=? WHERE id=?`)
      .run(now, now, campaignId);
    logActivity('Campaign started', campaignId);
    this.emitProgress(campaignId);

    try {
      await this.processLoop(campaignId);
    } finally {
      this.running.delete(campaignId);
      this.controllers.delete(campaignId);
    }
  }

  pause(campaignId: string): void {
    const c = this.controllers.get(campaignId);
    if (c) c.paused = true;
    this.db().prepare(`UPDATE campaigns SET status='PAUSED', updated_at=? WHERE id=?`).run(new Date().toISOString(), campaignId);
    logActivity('Campaign paused by user', campaignId);
    this.emitProgress(campaignId);
  }

  cancel(campaignId: string): void {
    const c = this.controllers.get(campaignId);
    if (c) c.cancelled = true;
    const db = this.db();
    db.prepare(`UPDATE campaign_recipients SET status='CANCELLED' WHERE campaign_id=? AND status IN ('QUEUED','RETRYING')`).run(campaignId);
    db.prepare(`UPDATE campaigns SET status='CANCELLED', updated_at=?, completed_at=? WHERE id=?`).run(
      new Date().toISOString(),
      new Date().toISOString(),
      campaignId,
    );
    logActivity('Campaign cancelled', campaignId);
    this.emitProgress(campaignId);
  }

  async resume(campaignId: string): Promise<void> {
    const row = this.db().prepare(`SELECT status FROM campaigns WHERE id=?`).get(campaignId) as { status: string } | undefined;
    if (!row) return;
    if (row.status !== 'PAUSED' && row.status !== 'FAILED' && row.status !== 'QUEUED') return;
    await this.start(campaignId);
  }

  async retryFailed(campaignId: string): Promise<void> {
    this.db()
      .prepare(
        `UPDATE campaign_recipients SET status='QUEUED', next_attempt_at=NULL WHERE campaign_id=? AND status='FAILED'`,
      )
      .run(campaignId);
    this.db().prepare(`UPDATE campaigns SET status='QUEUED', updated_at=? WHERE id=?`).run(new Date().toISOString(), campaignId);
    await this.start(campaignId);
  }

  private emitProgress(campaignId: string): void {
    const db = this.db();
    const c = db.prepare(`SELECT * FROM campaigns WHERE id=?`).get(campaignId);
    if (c) this.emit('progress', c);
  }

  private async processLoop(campaignId: string): Promise<void> {
    const db = this.db();
    const campaign = db.prepare(`SELECT * FROM campaigns WHERE id=?`).get(campaignId) as CampaignRow | undefined;
    if (!campaign) return;
    const provider = getProviderRow(campaign.provider_guid);
    if (!provider) {
      db.prepare(`UPDATE campaigns SET status='FAILED', updated_at=? WHERE id=?`).run(new Date().toISOString(), campaignId);
      logActivity('Campaign failed: provider missing', campaignId, 'error');
      this.emitProgress(campaignId);
      return;
    }
    const identity = db
      .prepare(`SELECT * FROM sender_identities WHERE id=?`)
      .get(campaign.sender_identity_id) as { name: string; email: string; reply_to: string | null } | undefined;
    if (!identity) {
      db.prepare(`UPDATE campaigns SET status='FAILED', updated_at=? WHERE id=?`).run(new Date().toISOString(), campaignId);
      logActivity('Campaign failed: sender identity missing', campaignId, 'error');
      this.emitProgress(campaignId);
      return;
    }

    const rate = Math.min(campaign.rate_per_minute, provider.rate_limit_per_minute);
    const intervalMs = Math.max(100, Math.floor(60_000 / rate));

    const attachments = (JSON.parse(campaign.attachments_json) as Array<{ filename: string; path: string }>).map((a) => ({
      filename: a.filename,
      path: a.path,
    }));

    while (true) {
      const controller = this.controllers.get(campaignId);
      if (!controller) return;
      if (controller.cancelled) return;
      if (controller.paused) return;

      const now = new Date().toISOString();
      // Pick next recipient: queued, or retrying with next_attempt_at <= now
      const rcp = db
        .prepare(
          `SELECT * FROM campaign_recipients
           WHERE campaign_id = ? AND (status = 'QUEUED' OR (status = 'RETRYING' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)))
           ORDER BY attempts ASC, rowid ASC
           LIMIT 1`,
        )
        .get(campaignId, now) as RecipientRow | undefined;

      if (!rcp) {
        // Check if any retrying pending in future
        const future = db
          .prepare(
            `SELECT MIN(next_attempt_at) as t FROM campaign_recipients WHERE campaign_id=? AND status='RETRYING'`,
          )
          .get(campaignId) as { t: string | null };
        if (future.t) {
          const waitMs = Math.min(60_000, Math.max(1000, new Date(future.t).getTime() - Date.now()));
          await sleep(waitMs);
          continue;
        }
        // Nothing left
        const summary = db
          .prepare(
            `SELECT COUNT(*) as c FROM campaign_recipients WHERE campaign_id=? AND status IN ('QUEUED','RETRYING','SENDING')`,
          )
          .get(campaignId) as { c: number };
        if (summary.c === 0) {
          const failedCount = (db.prepare(`SELECT COUNT(*) as c FROM campaign_recipients WHERE campaign_id=? AND status='FAILED'`).get(campaignId) as { c: number }).c;
          const finalStatus = failedCount > 0 ? 'COMPLETED' : 'COMPLETED';
          db.prepare(`UPDATE campaigns SET status=?, completed_at=?, updated_at=? WHERE id=?`).run(
            finalStatus,
            new Date().toISOString(),
            new Date().toISOString(),
            campaignId,
          );
          logActivity('Campaign completed', campaignId);
          this.emitProgress(campaignId);
        }
        return;
      }

      // Reserve
      db.prepare(`UPDATE campaign_recipients SET status='SENDING' WHERE id=?`).run(rcp.id);

      const mergeData = { ...(JSON.parse(rcp.merge_data_json) as Record<string, string>), unsubscribe_url: campaign.unsubscribe_url ?? '' };
      const subject = renderPersonalization(campaign.subject, mergeData).output || campaign.subject;
      const htmlBody = renderPersonalization(campaign.html_body, mergeData).output;
      const textBody = renderPersonalization(campaign.text_body, mergeData).output;

      const headers: Record<string, string> = {};
      if (campaign.unsubscribe_url) {
        headers['List-Unsubscribe'] = `<${campaign.unsubscribe_url}>`;
        headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
      }

      const start = Date.now();
      const result = await sendMessage({
        provider: {
          ...(provider as any),
          enabled: !!provider.enabled,
          reply_to: provider.reply_to ?? '',
          region: provider.region ?? '',
          notes: provider.notes ?? '',
          has_credentials: true,
          kind: provider.kind as any,
        },
        from: { name: identity.name, email: identity.email },
        replyTo: campaign.reply_to || identity.reply_to || undefined,
        to: rcp.email,
        subject,
        html: htmlBody,
        text: textBody,
        headers,
        attachments,
      });

      const attempts = rcp.attempts + 1;
      const nowIso = new Date().toISOString();
      if (result.ok) {
        db.prepare(
          `UPDATE campaign_recipients SET status='ACCEPTED', attempts=?, last_attempt_at=?, message_id=?, smtp_response_message=?, smtp_response_category='2xx' WHERE id=?`,
        ).run(attempts, nowIso, result.messageId ?? null, result.response ?? null, rcp.id);
        db.prepare(`UPDATE campaigns SET accepted=accepted+1, updated_at=? WHERE id=?`).run(nowIso, campaignId);
        logActivity(`Email accepted for ${rcp.email}`, campaignId);
      } else {
        const permanent = !!result.permanent;
        if (result.error?.code === 'AUTH_FAILED') {
          // Auth failure — stop the whole campaign
          db.prepare(
            `UPDATE campaign_recipients SET status='FAILED', attempts=?, last_attempt_at=?, smtp_response_category=?, smtp_response_message=? WHERE id=?`,
          ).run(attempts, nowIso, result.error.code, result.error.message, rcp.id);
          db.prepare(`UPDATE campaigns SET failed=failed+1, status='PAUSED', updated_at=? WHERE id=?`).run(nowIso, campaignId);
          logActivity(`Provider authentication failed. Campaign paused.`, campaignId, 'error');
          logTechnical('campaign', 'Auth failed — pausing campaign', { campaignId });
          this.emitProgress(campaignId);
          return;
        }

        if (permanent || attempts >= provider.max_retries + 1) {
          db.prepare(
            `UPDATE campaign_recipients SET status='FAILED', attempts=?, last_attempt_at=?, smtp_response_category=?, smtp_response_message=? WHERE id=?`,
          ).run(attempts, nowIso, result.error?.code ?? 'UNKNOWN', result.error?.message ?? '', rcp.id);
          db.prepare(`UPDATE campaigns SET failed=failed+1, updated_at=? WHERE id=?`).run(nowIso, campaignId);
          logActivity(`Email failed for ${rcp.email}: ${result.error?.message ?? 'unknown'}`, campaignId, 'warn');
        } else {
          const delay = RETRY_SCHEDULE_MS[Math.min(attempts - 1, RETRY_SCHEDULE_MS.length - 1)];
          const nextAt = new Date(Date.now() + delay).toISOString();
          db.prepare(
            `UPDATE campaign_recipients SET status='RETRYING', attempts=?, last_attempt_at=?, next_attempt_at=?, smtp_response_category=?, smtp_response_message=? WHERE id=?`,
          ).run(attempts, nowIso, nextAt, result.error?.code ?? 'UNKNOWN', result.error?.message ?? '', rcp.id);
          logActivity(`Retrying temporary error for ${rcp.email}`, campaignId);
        }
      }

      this.emitProgress(campaignId);

      // Rate limiting sleep
      const elapsed = Date.now() - start;
      const wait = Math.max(0, intervalMs - elapsed);
      if (wait > 0) await sleep(wait);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* ------------------------- Queries / exports -------------------- */

export function listCampaigns() {
  const db = getDb();
  return db.prepare(`SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 500`).all();
}

export function getCampaign(id: string) {
  const db = getDb();
  return db.prepare(`SELECT * FROM campaigns WHERE id=?`).get(id);
}

export function listRecipients(campaignId: string, opts: { status?: RecipientStatus; limit?: number } = {}) {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 500, 5000);
  if (opts.status) {
    return db.prepare(`SELECT * FROM campaign_recipients WHERE campaign_id=? AND status=? ORDER BY rowid ASC LIMIT ?`).all(campaignId, opts.status, limit);
  }
  return db.prepare(`SELECT * FROM campaign_recipients WHERE campaign_id=? ORDER BY rowid ASC LIMIT ?`).all(campaignId, limit);
}

export function exportCampaign(campaignId: string, format: 'csv' | 'json'): string {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT email, status, attempts, last_attempt_at, smtp_response_category, smtp_response_message, message_id, personalized_subject
       FROM campaign_recipients WHERE campaign_id=? ORDER BY rowid ASC`,
    )
    .all(campaignId) as any[];
  if (format === 'json') return JSON.stringify(rows, null, 2);
  // CSV
  const headers = ['email', 'status', 'attempts', 'last_attempt_at', 'smtp_response_category', 'smtp_response_message', 'message_id', 'personalized_subject'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      headers
        .map((h) => {
          const v = r[h];
          if (v == null) return '';
          const s = String(v).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(','),
    );
  }
  return lines.join('\n');
}

/* --------------------- Recover interrupted campaigns ------------ */
export function recoverInterrupted(): void {
  const db = getDb();
  // Any recipient stuck in SENDING at boot must go back to QUEUED
  db.prepare(`UPDATE campaign_recipients SET status='QUEUED' WHERE status='SENDING'`).run();
  // Any campaign that was SENDING becomes PAUSED so user can confirm resume
  const changed = db.prepare(`UPDATE campaigns SET status='PAUSED' WHERE status='SENDING'`).run();
  if (changed.changes > 0) {
    logActivity(`Recovered ${changed.changes} interrupted campaign(s). They are paused for review.`, undefined, 'warn');
  }
}
