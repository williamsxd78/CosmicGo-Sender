import { PERSONALIZATION_KEYS, type PersonalizationKey } from './schemas';

/**
 * Personalization variable engine. Supports:
 *   {first_name}
 *   {first_name|there}          (fallback)
 *   {company|your company}
 *
 * Missing variables with no fallback are returned in `missing`.
 * The rendered output uses an empty string for those (the caller decides
 * whether to warn / skip).
 */
export interface RenderResult {
  output: string;
  missing: string[];
}

const VAR_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)(?:\|([^}]*))?\}/g;

export function renderPersonalization(
  template: string,
  data: Record<string, string | undefined | null>,
): RenderResult {
  const missing: string[] = [];
  const output = template.replace(VAR_RE, (_full, key: string, fallback?: string) => {
    const val = data[key];
    if (val != null && val !== '') return String(val);
    if (fallback != null) return fallback;
    missing.push(key);
    return '';
  });
  return { output, missing: Array.from(new Set(missing)) };
}

export function extractVariables(template: string): string[] {
  const set = new Set<string>();
  for (const m of template.matchAll(VAR_RE)) set.add(m[1]);
  return Array.from(set);
}

export function isKnownPersonalizationKey(k: string): k is PersonalizationKey {
  return (PERSONALIZATION_KEYS as readonly string[]).includes(k);
}
