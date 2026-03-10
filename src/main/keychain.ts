import { safeStorage, app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type SecretKey =
  | 'claude.anthropicApiKey'
  | 'gemini.apiKey'
  | 'codex.apiKey'
  | 'opencode.apiKey';

function getSecretsPath(): string {
  return path.join(app.getPath('userData'), 'night-pm-secrets.enc');
}

function loadStore(): Record<string, string> {
  try {
    const buf = fs.readFileSync(getSecretsPath());
    if (!safeStorage.isEncryptionAvailable()) return {};
    const decrypted = safeStorage.decryptString(buf);
    return JSON.parse(decrypted);
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, string>): void {
  if (!safeStorage.isEncryptionAvailable()) return;
  const encrypted = safeStorage.encryptString(JSON.stringify(store));
  fs.writeFileSync(getSecretsPath(), encrypted);
}

export async function getSecret(key: SecretKey): Promise<string> {
  try {
    return loadStore()[key] ?? '';
  } catch {
    return '';
  }
}

export async function setSecret(key: SecretKey, value: string): Promise<void> {
  try {
    const store = loadStore();
    if (value) {
      store[key] = value;
    } else {
      delete store[key];
    }
    saveStore(store);
  } catch (err) {
    console.error(`[keychain] Failed to set ${key}:`, err);
  }
}

export async function deleteSecret(key: SecretKey): Promise<void> {
  try {
    const store = loadStore();
    delete store[key];
    saveStore(store);
  } catch {
    // Already gone — fine
  }
}

export async function clearAllSecrets(): Promise<void> {
  const keys: SecretKey[] = [
    'claude.anthropicApiKey',
    'gemini.apiKey',
    'codex.apiKey',
    'opencode.apiKey',
  ];
  await Promise.all(keys.map(deleteSecret));
}

export async function loadSecrets(): Promise<Record<SecretKey, string>> {
  const [claudeKey, geminiKey, codexKey, opencodeKey] = await Promise.all([
    getSecret('claude.anthropicApiKey'),
    getSecret('gemini.apiKey'),
    getSecret('codex.apiKey'),
    getSecret('opencode.apiKey'),
  ]);
  return {
    'claude.anthropicApiKey': claudeKey,
    'gemini.apiKey': geminiKey,
    'codex.apiKey': codexKey,
    'opencode.apiKey': opencodeKey,
  };
}
