import { describe, it, expect } from 'vitest';
import { renderPersonalization, extractVariables } from '../src/shared/personalization';
import { ProviderInputSchema, emailSchema, hostnameSchema } from '../src/shared/schemas';
import { maskSecrets, maskEmail } from '../src/shared/mask';

describe('personalization', () => {
  it('renders variables', () => {
    const r = renderPersonalization('Hello {first_name}, from {company}', { first_name: 'Ada', company: 'Acme' });
    expect(r.output).toBe('Hello Ada, from Acme');
    expect(r.missing).toEqual([]);
  });
  it('uses fallbacks', () => {
    const r = renderPersonalization('Hi {first_name|there}, welcome to {company|our team}', { first_name: '' });
    expect(r.output).toBe('Hi there, welcome to our team');
  });
  it('reports missing', () => {
    const r = renderPersonalization('Hi {first_name}', {});
    expect(r.output).toBe('Hi ');
    expect(r.missing).toEqual(['first_name']);
  });
  it('extracts variables', () => {
    expect(extractVariables('a {x} b {y|def} c {x}')).toEqual(['x', 'y']);
  });
});

describe('schemas', () => {
  it('validates emails', () => {
    expect(emailSchema.safeParse('ok@example.com').success).toBe(true);
    expect(emailSchema.safeParse('nope').success).toBe(false);
    expect(emailSchema.safeParse('a@b').success).toBe(false);
  });
  it('validates hostnames', () => {
    expect(hostnameSchema.safeParse('smtp.example.com').success).toBe(true);
    expect(hostnameSchema.safeParse('bad host').success).toBe(false);
  });
  it('validates providers', () => {
    const good = ProviderInputSchema.safeParse({
      kind: 'AMAZON_SES', name: 'Test', slug: 'test-slug',
      host: 'email-smtp.eu-central-1.amazonaws.com', port: 587, encryption: 'STARTTLS',
      username: 'AKIA', password: 'x'.repeat(16),
      default_from_name: 'X', default_from_email: 'x@y.com',
      hourly_limit: 100, daily_limit: 1000, rate_limit_per_minute: 10,
      connection_timeout_ms: 30000, max_retries: 3, enabled: true,
    });
    expect(good.success).toBe(true);

    const bad = ProviderInputSchema.safeParse({ ...good.data!, port: 999999 } as any);
    expect(bad.success).toBe(false);
  });
});

describe('mask', () => {
  it('masks nested secrets', () => {
    const masked = maskSecrets({ user: 'a', password: 'x', nested: { api_key: 'y', ok: 1 } });
    expect(masked.password).toBe('[REDACTED]');
    expect(masked.nested.api_key).toBe('[REDACTED]');
    expect(masked.nested.ok).toBe(1);
  });
  it('masks emails partially', () => {
    expect(maskEmail('ada@example.com')).toContain('@example.com');
  });
});
