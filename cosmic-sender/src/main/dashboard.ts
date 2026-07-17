import { getDb } from './db';

export interface DashboardStats {
  queued_today: number;
  accepted_today: number;
  failed_today: number;
  skipped_today: number;
  suppressed_today: number;
  active_campaigns: number;
  enabled_providers: number;
  contacts_total: number;
  suppression_total: number;
  remaining_daily_capacity: number;
  volume_series: Array<{ day: string; accepted: number; failed: number }>;
  provider_usage: Array<{ provider: string; accepted: number; failed: number }>;
  recent_activity: Array<{ ts: string; level: string; message: string; campaign_id: string | null }>;
}

export function getDashboardStats(): DashboardStats {
  const db = getDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayIso = startOfDay.toISOString();

  const acceptedToday = (db
    .prepare(`SELECT COUNT(*) as c FROM campaign_recipients WHERE status='ACCEPTED' AND last_attempt_at >= ?`)
    .get(todayIso) as { c: number }).c;
  const failedToday = (db
    .prepare(`SELECT COUNT(*) as c FROM campaign_recipients WHERE status='FAILED' AND last_attempt_at >= ?`)
    .get(todayIso) as { c: number }).c;
  const queuedToday = (db
    .prepare(`SELECT COUNT(*) as c FROM campaign_recipients WHERE status='QUEUED'`)
    .get() as { c: number }).c;
  const activeCampaigns = (db
    .prepare(`SELECT COUNT(*) as c FROM campaigns WHERE status IN ('SENDING','QUEUED','PAUSED')`)
    .get() as { c: number }).c;
  const enabledProviders = (db.prepare(`SELECT COUNT(*) as c FROM mail_providers WHERE enabled=1`).get() as { c: number }).c;
  const contactsTotal = (db.prepare(`SELECT COUNT(*) as c FROM contacts`).get() as { c: number }).c;
  const suppressionTotal = (db.prepare(`SELECT COUNT(*) as c FROM suppression_list`).get() as { c: number }).c;

  // Volume last 14 days
  const seriesRaw = db
    .prepare(
      `SELECT substr(last_attempt_at, 1, 10) as day,
              SUM(CASE WHEN status='ACCEPTED' THEN 1 ELSE 0 END) as accepted,
              SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) as failed
       FROM campaign_recipients
       WHERE last_attempt_at IS NOT NULL AND last_attempt_at >= date('now','-13 day')
       GROUP BY day ORDER BY day ASC`,
    )
    .all() as Array<{ day: string; accepted: number; failed: number }>;

  const providerUsage = db
    .prepare(
      `SELECT p.name as provider,
              SUM(c.accepted) as accepted,
              SUM(c.failed) as failed
       FROM mail_providers p LEFT JOIN campaigns c ON c.provider_guid = p.guid
       GROUP BY p.guid ORDER BY accepted DESC`,
    )
    .all() as Array<{ provider: string; accepted: number; failed: number }>;

  const recent = db
    .prepare(`SELECT ts, level, message, campaign_id FROM activity_logs ORDER BY id DESC LIMIT 8`)
    .all() as Array<{ ts: string; level: string; message: string; campaign_id: string | null }>;

  // Estimated remaining capacity: sum of daily_limit across enabled providers minus today's accepted
  const capacityRow = db.prepare(`SELECT COALESCE(SUM(daily_limit),0) as total FROM mail_providers WHERE enabled=1`).get() as { total: number };
  const remaining = Math.max(0, capacityRow.total - acceptedToday);

  return {
    queued_today: queuedToday,
    accepted_today: acceptedToday,
    failed_today: failedToday,
    skipped_today: 0,
    suppressed_today: 0,
    active_campaigns: activeCampaigns,
    enabled_providers: enabledProviders,
    contacts_total: contactsTotal,
    suppression_total: suppressionTotal,
    remaining_daily_capacity: remaining,
    volume_series: seriesRaw,
    provider_usage: providerUsage,
    recent_activity: recent,
  };
}
