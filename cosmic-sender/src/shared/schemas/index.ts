import { z } from 'zod';

/* ------------------------------ Enums ------------------------------ */
export const EncryptionType = z.enum(['NONE', 'STARTTLS', 'SSL_TLS']);
export type EncryptionType = z.infer<typeof EncryptionType>;

export const ProviderKind = z.enum([
  'AMAZON_SES',
  'STANDARD_SMTP',
  'GMAIL',
  'MICROSOFT_365',
  'ZOHO',
  'SENDGRID',
  'MAILGUN',
  'CUSTOM_SMTP',
]);
export type ProviderKind = z.infer<typeof ProviderKind>;

export const CampaignStatus = z.enum([
  'DRAFT',
  'SCHEDULED',
  'QUEUED',
  'SENDING',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
]);
export type CampaignStatus = z.infer<typeof CampaignStatus>;

export const RecipientStatus = z.enum([
  'QUEUED',
  'SENDING',
  'ACCEPTED',
  'FAILED',
  'RETRYING',
  'SKIPPED',
  'SUPPRESSED',
  'CANCELLED',
]);
export type RecipientStatus = z.infer<typeof RecipientStatus>;

/* ---------------------------- Validators --------------------------- */
export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address');

export const hostnameSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/, 'Invalid hostname');

export const portSchema = z.number().int().min(1).max(65535);
export const slugSchema = z.string().trim().min(1).max(64).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must be kebab-case');

/* ----------------------------- Provider ---------------------------- */
export const ProviderInputSchema = z.object({
  guid: z.string().uuid().optional(),
  kind: ProviderKind,
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  host: hostnameSchema,
  port: portSchema,
  encryption: EncryptionType,
  username: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(1024),
  default_from_name: z.string().trim().min(1).max(120),
  default_from_email: emailSchema,
  reply_to: emailSchema.optional().or(z.literal('')),
  hourly_limit: z.number().int().min(1).max(1_000_000).default(1000),
  daily_limit: z.number().int().min(1).max(10_000_000).default(10000),
  rate_limit_per_minute: z.number().int().min(1).max(600).default(10),
  connection_timeout_ms: z.number().int().min(1000).max(120000).default(30000),
  max_retries: z.number().int().min(0).max(10).default(3),
  enabled: z.boolean().default(true),
  region: z.string().trim().max(64).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});
export type ProviderInput = z.infer<typeof ProviderInputSchema>;

export const ProviderPublicSchema = ProviderInputSchema.omit({ password: true }).extend({
  guid: z.string().uuid(),
  has_credentials: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ProviderPublic = z.infer<typeof ProviderPublicSchema>;

/* ----------------------- Sender identity --------------------------- */
export const SenderIdentityInputSchema = z.object({
  id: z.string().uuid().optional(),
  provider_guid: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  reply_to: emailSchema.optional().or(z.literal('')),
  domain: z.string().trim().max(253).optional().or(z.literal('')),
  verified: z.boolean().default(false),
  is_default: z.boolean().default(false),
  notes: z.string().max(2000).optional().or(z.literal('')),
});
export type SenderIdentityInput = z.infer<typeof SenderIdentityInputSchema>;

/* ------------------------------ Contact --------------------------- */
export const ContactInputSchema = z.object({
  id: z.string().uuid().optional(),
  email: emailSchema,
  first_name: z.string().max(120).optional().or(z.literal('')),
  last_name: z.string().max(120).optional().or(z.literal('')),
  full_name: z.string().max(240).optional().or(z.literal('')),
  phone: z.string().max(64).optional().or(z.literal('')),
  company: z.string().max(160).optional().or(z.literal('')),
  city: z.string().max(120).optional().or(z.literal('')),
  state: z.string().max(120).optional().or(z.literal('')),
  country: z.string().max(120).optional().or(z.literal('')),
  tags: z.array(z.string()).default([]),
  custom_1: z.string().max(500).optional().or(z.literal('')),
  custom_2: z.string().max(500).optional().or(z.literal('')),
  custom_3: z.string().max(500).optional().or(z.literal('')),
  source: z.string().max(160).optional().or(z.literal('')),
  consent_status: z.enum(['UNKNOWN', 'OPTED_IN', 'OPTED_OUT']).default('UNKNOWN'),
  consent_date: z.string().optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
  active: z.boolean().default(true),
});
export type ContactInput = z.infer<typeof ContactInputSchema>;

/* ------------------------------ List ------------------------------ */
export const ListInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional().or(z.literal('')),
});
export type ListInput = z.infer<typeof ListInputSchema>;

/* ---------------------------- Template ---------------------------- */
export const TemplateCategory = z.enum([
  'TRANSACTIONAL',
  'ACCOUNT_UPDATE',
  'NOTIFICATION',
  'NEWSLETTER',
  'ANNOUNCEMENT',
  'SUPPORT',
  'CUSTOM',
]);
export type TemplateCategory = z.infer<typeof TemplateCategory>;

export const TemplateInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  category: TemplateCategory.default('CUSTOM'),
  subject: z.string().max(500).default(''),
  preheader: z.string().max(500).optional().or(z.literal('')),
  html_body: z.string().max(2_000_000).default(''),
  text_body: z.string().max(500_000).default(''),
});
export type TemplateInput = z.infer<typeof TemplateInputSchema>;

/* ---------------------------- Suppression ------------------------- */
export const SuppressionReason = z.enum([
  'UNSUBSCRIBED',
  'HARD_BOUNCE',
  'COMPLAINT',
  'MANUAL',
  'INVALID',
  'DO_NOT_CONTACT',
  'IMPORTED',
]);
export type SuppressionReason = z.infer<typeof SuppressionReason>;

export const SuppressionInputSchema = z.object({
  email: emailSchema,
  reason: SuppressionReason.default('MANUAL'),
  source: z.string().max(160).optional().or(z.literal('')),
  campaign_id: z.string().uuid().optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
export type SuppressionInput = z.infer<typeof SuppressionInputSchema>;

/* ---------------------------- Campaign ---------------------------- */
export const AttachmentSpecSchema = z.object({
  filename: z.string().min(1).max(255),
  path: z.string().min(1),
  size_bytes: z.number().int().nonnegative(),
});
export type AttachmentSpec = z.infer<typeof AttachmentSpecSchema>;

export const RecipientSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('MANUAL'), emails: z.array(emailSchema) }),
  z.object({ kind: z.literal('LIST'), list_id: z.string().uuid() }),
  z.object({ kind: z.literal('CSV'), contact_ids: z.array(z.string().uuid()) }),
]);
export type RecipientSource = z.infer<typeof RecipientSourceSchema>;

export const CampaignInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  provider_guid: z.string().uuid(),
  sender_identity_id: z.string().uuid(),
  reply_to: emailSchema.optional().or(z.literal('')),
  subject: z.string().trim().min(1).max(500),
  preheader: z.string().max(500).optional().or(z.literal('')),
  html_body: z.string().max(2_000_000),
  text_body: z.string().max(500_000),
  attachments: z.array(AttachmentSpecSchema).default([]),
  recipient_source: RecipientSourceSchema,
  rate_per_minute: z.number().int().min(1).max(600).default(10),
  scheduled_at: z.string().optional().or(z.literal('')),
  promotional: z.boolean().default(false),
  unsubscribe_url: z.string().url().optional().or(z.literal('')),
  tracking_opens: z.boolean().default(false),
  tracking_clicks: z.boolean().default(false),
});
export type CampaignInput = z.infer<typeof CampaignInputSchema>;

/* ---------------------------- Settings ---------------------------- */
export const AppSettingsSchema = z.object({
  theme: z.enum(['light', 'dark']).default('dark'),
  auto_lock_minutes: z.union([z.literal(0), z.literal(5), z.literal(15), z.literal(30), z.literal(60)]).default(15),
  confirm_before_sending: z.boolean().default(true),
  default_rate_per_minute: z.number().int().min(1).max(600).default(10),
  attachment_max_mb_per_file: z.number().min(1).max(50).default(10),
  attachment_max_mb_total: z.number().min(1).max(100).default(20),
  minimize_to_tray: z.boolean().default(true),
  launch_on_startup: z.boolean().default(false),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

/* ------------------------- Personalization ------------------------ */
export const PERSONALIZATION_KEYS = [
  'email',
  'first_name',
  'last_name',
  'full_name',
  'company',
  'phone',
  'city',
  'state',
  'country',
  'custom_1',
  'custom_2',
  'custom_3',
  'unsubscribe_url',
] as const;
export type PersonalizationKey = (typeof PERSONALIZATION_KEYS)[number];
