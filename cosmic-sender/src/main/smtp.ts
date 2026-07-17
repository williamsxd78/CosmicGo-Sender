import nodemailer, { Transporter } from 'nodemailer';
import type { EncryptionType, ProviderPublic } from '@shared/schemas';
import { readCredential } from './credentials';
import { logTechnical } from './logger';
import { maskUsername } from '@shared/mask';

export interface SmtpTestResult {
  ok: boolean;
  code:
    | 'OK'
    | 'DNS_FAILED'
    | 'TIMEOUT'
    | 'AUTH_FAILED'
    | 'TLS_FAILED'
    | 'RELAY_DENIED'
    | 'SENDER_REJECTED'
    | 'CONNECTION_REFUSED'
    | 'INVALID_ENCRYPTION'
    | 'UNKNOWN';
  message: string;
  details?: string;
}

function encryptionToTransport(encryption: EncryptionType, port: number) {
  if (encryption === 'SSL_TLS') return { secure: true, requireTLS: false };
  if (encryption === 'STARTTLS') return { secure: false, requireTLS: true };
  return { secure: port === 465, requireTLS: false };
}

export interface BuildOptions {
  provider: ProviderPublic & { username: string };
  password: string;
}

export function buildTransport({ provider, password }: BuildOptions): Transporter {
  const t = encryptionToTransport(provider.encryption, provider.port);
  return nodemailer.createTransport({
    host: provider.host,
    port: provider.port,
    secure: t.secure,
    requireTLS: t.requireTLS,
    auth: {
      user: provider.username,
      pass: password,
    },
    connectionTimeout: provider.connection_timeout_ms,
    greetingTimeout: provider.connection_timeout_ms,
    socketTimeout: provider.connection_timeout_ms,
    tls: {
      // Do not silently accept invalid certs on real providers.
      rejectUnauthorized: !provider.host.includes('localhost') && !provider.host.startsWith('127.'),
    },
  });
}

export async function buildTransportForProvider(provider: ProviderPublic & { username: string; credential_ref: string }): Promise<Transporter> {
  const password = await readCredential(provider.credential_ref);
  if (!password) throw new Error('No stored credentials for this provider');
  return buildTransport({ provider, password });
}

function classifyError(err: unknown): SmtpTestResult {
  const e = err as { code?: string; command?: string; response?: string; message?: string };
  const msg = e?.message ?? String(err);
  const code = (e?.code ?? '').toUpperCase();
  const resp = (e?.response ?? '').toLowerCase();

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { ok: false, code: 'DNS_FAILED', message: 'DNS lookup failed. Check the SMTP host.', details: msg };
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' && /timeout/i.test(msg)) {
    return { ok: false, code: 'TIMEOUT', message: 'The SMTP connection timed out.', details: msg };
  }
  if (code === 'ECONNREFUSED') {
    return { ok: false, code: 'CONNECTION_REFUSED', message: 'The server refused the connection. Check host and port.', details: msg };
  }
  if (code === 'EAUTH' || /535|534|530/.test(resp)) {
    return {
      ok: false,
      code: 'AUTH_FAILED',
      message: 'SMTP authentication failed. Check the username and password.',
      details: msg,
    };
  }
  if (code === 'ETLS' || /tls|ssl|handshake/i.test(msg)) {
    return { ok: false, code: 'TLS_FAILED', message: 'TLS negotiation failed. Try a different encryption setting.', details: msg };
  }
  if (/relay/i.test(resp) || /550 5\.7\.1/.test(resp)) {
    return { ok: false, code: 'RELAY_DENIED', message: 'SMTP relay denied by the server.', details: msg };
  }
  if (/sender|from address|not verified/i.test(resp)) {
    return { ok: false, code: 'SENDER_REJECTED', message: 'The sender identity was rejected by the SMTP provider.', details: msg };
  }
  return { ok: false, code: 'UNKNOWN', message: `SMTP error: ${msg}`, details: msg };
}

export async function testConnection(provider: ProviderPublic & { username: string; credential_ref: string }): Promise<SmtpTestResult> {
  try {
    const tx = await buildTransportForProvider(provider);
    await tx.verify();
    tx.close();
    logTechnical('smtp.test', 'Verify OK', {
      provider: provider.slug,
      host: provider.host,
      port: provider.port,
      encryption: provider.encryption,
      username: maskUsername(provider.username),
    });
    return { ok: true, code: 'OK', message: 'Connection successful. The server accepted authentication.' };
  } catch (err) {
    const result = classifyError(err);
    logTechnical('smtp.test', 'Verify failed', {
      provider: provider.slug,
      host: provider.host,
      port: provider.port,
      encryption: provider.encryption,
      code: result.code,
    }, 'warn');
    return result;
  }
}

export interface SendMessageOptions {
  provider: ProviderPublic & { username: string; credential_ref: string };
  from: { name: string; email: string };
  replyTo?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  attachments?: Array<{ filename: string; path: string }>;
}

export interface SendMessageResult {
  ok: boolean;
  messageId?: string;
  response?: string;
  error?: SmtpTestResult;
  permanent?: boolean;
}

const PERMANENT_5XX = /^(5[0-9][0-9])/;

export async function sendMessage(opts: SendMessageOptions): Promise<SendMessageResult> {
  try {
    const tx = await buildTransportForProvider(opts.provider);
    const info = await tx.sendMail({
      from: { name: opts.from.name, address: opts.from.email },
      replyTo: opts.replyTo || undefined,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      headers: opts.headers,
      attachments: opts.attachments,
    });
    tx.close();
    return { ok: true, messageId: info.messageId, response: info.response };
  } catch (err) {
    const classified = classifyError(err);
    const respCode = (err as { responseCode?: number }).responseCode;
    const permanent =
      classified.code === 'AUTH_FAILED' ||
      classified.code === 'SENDER_REJECTED' ||
      classified.code === 'RELAY_DENIED' ||
      (typeof respCode === 'number' && respCode >= 500 && respCode < 600) ||
      PERMANENT_5XX.test((err as { response?: string }).response ?? '');
    return { ok: false, error: classified, permanent };
  }
}
