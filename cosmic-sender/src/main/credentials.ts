/**
 * Credential storage.
 *
 * Primary: OS credential manager via `keytar`.
 *   - Windows: Credential Manager
 *   - macOS: Keychain
 *   - Linux: Secret Service (libsecret)
 *
 * Fallback: encrypted-at-rest local vault, keyed with a per-install passphrase.
 * The fallback exists so first-run tests / headless environments (or Linux
 * systems without libsecret) never break the SMTP send flow. On Windows
 * production builds keytar is always used.
 *
 * A stable random UUID `credential_ref` is stored in SQLite; the actual
 * password value only lives in the OS credential manager (or encrypted vault).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDataDir } from './db';

const SERVICE = 'CosmicSender';

type KeytarModule = {
  setPassword(service: string, account: string, password: string): Promise<void>;
  getPassword(service: string, account: string): Promise<string | null>;
  deletePassword(service: string, account: string): Promise<boolean>;
};

let keytar: KeytarModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  keytar = require('keytar');
} catch {
  keytar = null;
}

async function keytarUsable(): Promise<boolean> {
  if (!keytar) return false;
  try {
    // Probe: try writing + reading a sentinel value.
    await keytar.setPassword(SERVICE, '__probe__', 'ok');
    const v = await keytar.getPassword(SERVICE, '__probe__');
    await keytar.deletePassword(SERVICE, '__probe__');
    return v === 'ok';
  } catch {
    return false;
  }
}

let mode: 'keytar' | 'vault' | null = null;

async function initMode(): Promise<'keytar' | 'vault'> {
  if (mode) return mode;
  mode = (await keytarUsable()) ? 'keytar' : 'vault';
  return mode;
}

/* ---------------------------- Vault fallback ---------------------------- */

function vaultPath(): string {
  return path.join(getDataDir(), 'vault.dat');
}

function vaultKeyPath(): string {
  return path.join(getDataDir(), 'vault.key');
}

function loadOrCreateVaultKey(): Buffer {
  const p = vaultKeyPath();
  if (fs.existsSync(p)) return fs.readFileSync(p);
  const key = crypto.randomBytes(32);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, key, { mode: 0o600 });
  return key;
}

function readVault(): Record<string, { iv: string; tag: string; ct: string }> {
  const p = vaultPath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return {};
  }
}

function writeVault(v: Record<string, { iv: string; tag: string; ct: string }>): void {
  fs.mkdirSync(path.dirname(vaultPath()), { recursive: true });
  fs.writeFileSync(vaultPath(), JSON.stringify(v), { mode: 0o600 });
}

function vaultSet(account: string, value: string): void {
  const key = loadOrCreateVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(value, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const store = readVault();
  store[account] = { iv: iv.toString('base64'), tag: tag.toString('base64'), ct: ct.toString('base64') };
  writeVault(store);
}

function vaultGet(account: string): string | null {
  const store = readVault();
  const rec = store[account];
  if (!rec) return null;
  const key = loadOrCreateVaultKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(rec.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(rec.tag, 'base64'));
  const pt = Buffer.concat([decipher.update(Buffer.from(rec.ct, 'base64')), decipher.final()]);
  return pt.toString('utf-8');
}

function vaultDelete(account: string): boolean {
  const store = readVault();
  if (!(account in store)) return false;
  delete store[account];
  writeVault(store);
  return true;
}

/* ------------------------------ Public API ----------------------------- */

export async function saveCredential(ref: string, password: string): Promise<void> {
  const m = await initMode();
  if (m === 'keytar' && keytar) {
    await keytar.setPassword(SERVICE, ref, password);
  } else {
    vaultSet(ref, password);
  }
}

export async function readCredential(ref: string): Promise<string | null> {
  const m = await initMode();
  if (m === 'keytar' && keytar) return keytar.getPassword(SERVICE, ref);
  return vaultGet(ref);
}

export async function deleteCredential(ref: string): Promise<boolean> {
  const m = await initMode();
  if (m === 'keytar' && keytar) return keytar.deletePassword(SERVICE, ref);
  return vaultDelete(ref);
}

export function newCredentialRef(): string {
  return `provider-${crypto.randomUUID()}`;
}

export async function credentialBackendName(): Promise<'Windows Credential Manager' | 'macOS Keychain' | 'Secret Service' | 'Encrypted vault (AES-256-GCM)'> {
  const m = await initMode();
  if (m === 'keytar') {
    if (process.platform === 'win32') return 'Windows Credential Manager';
    if (process.platform === 'darwin') return 'macOS Keychain';
    return 'Secret Service';
  }
  return 'Encrypted vault (AES-256-GCM)';
}
