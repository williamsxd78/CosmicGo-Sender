/**
 * Small helper to sanitize objects/strings so that secrets never leak into
 * technical logs, error messages or exports.
 */
const SECRET_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'api_key',
  'apikey',
  'authorization',
  'auth',
  'token',
  'access_token',
  'refresh_token',
  'credential_ref',
  'x-amz-security-token',
]);

const REDACTED = '[REDACTED]';

export function maskSecrets<T>(input: T): T {
  if (input == null) return input;
  if (typeof input === 'string') {
    return input.replace(/(password\s*[:=]\s*)([^\s,;}"]+)/gi, `$1${REDACTED}`) as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((v) => maskSecrets(v)) as unknown as T;
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (SECRET_KEYS.has(k.toLowerCase())) {
        out[k] = REDACTED;
      } else {
        out[k] = maskSecrets(v);
      }
    }
    return out as unknown as T;
  }
  return input;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return REDACTED;
  const shownUser = user.length <= 2 ? user[0] + '*' : user[0] + '***' + user[user.length - 1];
  return `${shownUser}@${domain}`;
}

export function maskUsername(username: string): string {
  if (!username) return '';
  if (username.length <= 4) return '*'.repeat(username.length);
  return username.slice(0, 2) + '***' + username.slice(-2);
}
