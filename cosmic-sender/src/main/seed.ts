import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { saveCredential, newCredentialRef } from './credentials';
import { logActivity } from './logger';

/**
 * Seeds fake demo data on first run to give the user something to explore.
 * All credentials are placeholders and clearly named "demo".
 */
export async function seedDemoData(): Promise<void> {
  const db = getDb();
  const existing = db.prepare(`SELECT COUNT(*) as c FROM mail_providers`).get() as { c: number };
  if (existing.c > 0) return;

  const now = new Date().toISOString();

  // --- Providers (disabled by default; credentials are placeholders)
  const providers = [
    {
      guid: randomUUID(),
      kind: 'AMAZON_SES',
      name: 'Amazon SES (Demo)',
      slug: 'ses-demo',
      host: 'email-smtp.eu-central-1.amazonaws.com',
      port: 587,
      encryption: 'STARTTLS',
      username: 'AKIA_PLACEHOLDER_DEMO',
      default_from_name: 'Cosmic Sender Demo',
      default_from_email: 'demo@example.com',
      rate_limit_per_minute: 14,
      region: 'eu-central-1',
    },
    {
      guid: randomUUID(),
      kind: 'STANDARD_SMTP',
      name: 'Business SMTP (Demo)',
      slug: 'business-demo',
      host: 'smtp.example.com',
      port: 465,
      encryption: 'SSL_TLS',
      username: 'demo@example.com',
      default_from_name: 'Demo Business',
      default_from_email: 'no-reply@example.com',
      rate_limit_per_minute: 30,
      region: '',
    },
  ];

  const insert = db.prepare(
    `INSERT INTO mail_providers (guid,kind,name,slug,host,port,encryption,username,credential_ref,default_from_name,default_from_email,
      reply_to,hourly_limit,daily_limit,rate_limit_per_minute,connection_timeout_ms,max_retries,enabled,region,notes,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );

  for (const p of providers) {
    const ref = newCredentialRef();
    await saveCredential(ref, 'PLACEHOLDER_DEMO_PASSWORD_DO_NOT_USE');
    insert.run(
      p.guid,
      p.kind,
      p.name,
      p.slug,
      p.host,
      p.port,
      p.encryption,
      p.username,
      ref,
      p.default_from_name,
      p.default_from_email,
      null,
      1000,
      10000,
      p.rate_limit_per_minute,
      30000,
      3,
      0, // disabled
      p.region || null,
      'Demo provider — placeholder credentials. Replace before sending.',
      now,
      now,
    );
    db.prepare(
      `INSERT INTO sender_identities (id,provider_guid,name,email,reply_to,domain,verified,is_default,notes,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      randomUUID(),
      p.guid,
      p.default_from_name,
      p.default_from_email,
      null,
      p.default_from_email.split('@')[1],
      0,
      1,
      'Demo identity',
      now,
      now,
    );
  }

  // --- Contacts
  const contacts = [
    { email: 'ada@example.com', first_name: 'Ada', last_name: 'Lovelace', company: 'Analytical Ltd' },
    { email: 'grace@example.com', first_name: 'Grace', last_name: 'Hopper', company: 'Compilers Co' },
    { email: 'linus@example.com', first_name: 'Linus', last_name: 'Torvalds', company: 'Kernel Corp' },
    { email: 'margaret@example.com', first_name: 'Margaret', last_name: 'Hamilton', company: 'Apollo Systems' },
    { email: 'katherine@example.com', first_name: 'Katherine', last_name: 'Johnson', company: 'NASA Demo' },
  ];
  const contactIds: string[] = [];
  const insertC = db.prepare(
    `INSERT INTO contacts (id,email,first_name,last_name,full_name,phone,company,city,state,country,tags,custom_1,custom_2,custom_3,source,consent_status,consent_date,notes,active,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  for (const c of contacts) {
    const id = randomUUID();
    contactIds.push(id);
    insertC.run(
      id,
      c.email,
      c.first_name,
      c.last_name,
      `${c.first_name} ${c.last_name}`,
      null,
      c.company,
      null,
      null,
      null,
      JSON.stringify(['demo']),
      null,
      null,
      null,
      'demo-seed',
      'OPTED_IN',
      now,
      null,
      1,
      now,
      now,
    );
  }

  // --- Lists
  const list1 = randomUUID();
  const list2 = randomUUID();
  db.prepare(`INSERT INTO contact_lists (id,name,description,created_at,updated_at) VALUES (?,?,?,?,?)`).run(
    list1,
    'Beta Users',
    'Demo beta users list',
    now,
    now,
  );
  db.prepare(`INSERT INTO contact_lists (id,name,description,created_at,updated_at) VALUES (?,?,?,?,?)`).run(
    list2,
    'VIP Contacts',
    'Demo VIP list',
    now,
    now,
  );
  const memInsert = db.prepare(`INSERT OR IGNORE INTO contact_list_members (list_id, contact_id, added_at) VALUES (?, ?, ?)`);
  for (const cid of contactIds) memInsert.run(list1, cid, now);
  memInsert.run(list2, contactIds[0], now);
  memInsert.run(list2, contactIds[1], now);

  // --- Templates
  const templates = [
    {
      name: 'Welcome — Account Created',
      category: 'ACCOUNT_UPDATE',
      subject: 'Welcome to {company|our service}, {first_name|there}!',
      preheader: 'Your account is ready.',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1e2130">
  <h1 style="margin:0 0 12px">Hello {first_name|there},</h1>
  <p>Your account has been created. Welcome aboard!</p>
  <p style="margin-top:24px">— The Team</p>
</div>`,
      text: 'Hello {first_name|there},\n\nYour account has been created. Welcome aboard!\n\n— The Team',
    },
    {
      name: 'Monthly Newsletter',
      category: 'NEWSLETTER',
      subject: '{company|Your} monthly update',
      preheader: "What's new this month.",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
  <h2>Hi {first_name|there},</h2>
  <p>Here's what's new this month at {company|our team}.</p>
  <p><a href="{unsubscribe_url}">Unsubscribe</a></p>
</div>`,
      text: "Hi {first_name|there},\n\nHere's what's new this month.\n\nUnsubscribe: {unsubscribe_url}",
    },
    {
      name: 'Transactional — Receipt',
      category: 'TRANSACTIONAL',
      subject: 'Your receipt from {company|our store}',
      preheader: 'Thank you for your purchase.',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
  <h2>Thanks {first_name|there}!</h2>
  <p>Your purchase has been received.</p>
</div>`,
      text: 'Thanks {first_name|there}! Your purchase has been received.',
    },
  ];
  const tInsert = db.prepare(
    `INSERT INTO templates (id,name,category,subject,preheader,html_body,text_body,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
  );
  for (const t of templates) tInsert.run(randomUUID(), t.name, t.category, t.subject, t.preheader, t.html, t.text, now, now);

  logActivity('Demo data seeded (2 providers, 5 contacts, 2 lists, 3 templates)');
}
