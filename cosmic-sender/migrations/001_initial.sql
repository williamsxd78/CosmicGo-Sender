-- Cosmic Sender initial schema (SQLite)
-- All timestamps stored as ISO-8601 UTC strings.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL DEFAULT 'bcrypt',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mail_providers (
  guid TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  encryption TEXT NOT NULL,
  username TEXT NOT NULL,
  credential_ref TEXT NOT NULL,
  default_from_name TEXT NOT NULL,
  default_from_email TEXT NOT NULL,
  reply_to TEXT,
  hourly_limit INTEGER NOT NULL DEFAULT 1000,
  daily_limit INTEGER NOT NULL DEFAULT 10000,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 10,
  connection_timeout_ms INTEGER NOT NULL DEFAULT 30000,
  max_retries INTEGER NOT NULL DEFAULT 3,
  enabled INTEGER NOT NULL DEFAULT 1,
  region TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_providers_enabled ON mail_providers(enabled);

CREATE TABLE IF NOT EXISTS sender_identities (
  id TEXT PRIMARY KEY,
  provider_guid TEXT NOT NULL REFERENCES mail_providers(guid) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  reply_to TEXT,
  domain TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider_guid, email)
);
CREATE INDEX IF NOT EXISTS idx_identities_provider ON sender_identities(provider_guid);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  phone TEXT,
  company TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  custom_1 TEXT,
  custom_2 TEXT,
  custom_3 TEXT,
  source TEXT,
  consent_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  consent_date TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts(created_at);

CREATE TABLE IF NOT EXISTS contact_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_list_members (
  list_id TEXT NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL,
  PRIMARY KEY (list_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_list_members_contact ON contact_list_members(contact_id);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'CUSTOM',
  subject TEXT NOT NULL DEFAULT '',
  preheader TEXT,
  html_body TEXT NOT NULL DEFAULT '',
  text_body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppression_list (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  reason TEXT NOT NULL DEFAULT 'MANUAL',
  source TEXT,
  campaign_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_guid TEXT NOT NULL REFERENCES mail_providers(guid),
  sender_identity_id TEXT NOT NULL REFERENCES sender_identities(id),
  reply_to TEXT,
  subject TEXT NOT NULL,
  preheader TEXT,
  html_body TEXT NOT NULL,
  text_body TEXT NOT NULL,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  rate_per_minute INTEGER NOT NULL DEFAULT 10,
  scheduled_at TEXT,
  promotional INTEGER NOT NULL DEFAULT 0,
  unsubscribe_url TEXT,
  tracking_opens INTEGER NOT NULL DEFAULT 0,
  tracking_clicks INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  total INTEGER NOT NULL DEFAULT 0,
  accepted INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  suppressed INTEGER NOT NULL DEFAULT 0,
  cancelled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON campaigns(created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_provider ON campaigns(provider_guid);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  merge_data_json TEXT NOT NULL DEFAULT '{}',
  personalized_subject TEXT,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  next_attempt_at TEXT,
  smtp_response_category TEXT,
  smtp_response_message TEXT,
  message_id TEXT,
  UNIQUE(campaign_id, email)
);
CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recipients_status ON campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_recipients_next_attempt ON campaign_recipients(next_attempt_at);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  campaign_id TEXT,
  message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity_logs(ts);
CREATE INDEX IF NOT EXISTS idx_activity_campaign ON activity_logs(campaign_id);

CREATE TABLE IF NOT EXISTS technical_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  scope TEXT,
  message TEXT NOT NULL,
  meta_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_technical_ts ON technical_logs(ts);
