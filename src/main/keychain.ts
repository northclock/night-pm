import keytar from 'keytar';

const SERVICE = 'Night PM';

// All the secret keys managed in the OS keychain.
// These never touch the settings JSON file on disk.
export type SecretKey =
  | 'claude.anthropicApiKey'
  | 'gemini.apiKey'
  | 'codex.apiKey'
  | 'opencode.apiKey';

export async function getSecret(key: SecretKey): Promise<string> {
  try {
    return (await keytar.getPassword(SERVICE, key)) ?? '';
  } catch {
    return '';
  }
}

export async function setSecret(key: SecretKey, value: string): Promise<void> {
  try {
    if (value) {
      await keytar.setPassword(SERVICE, key, value);
    } else {
      await keytar.deletePassword(SERVICE, key);
    }
  } catch (err) {
    console.error(`[keychain] Failed to set ${key}:`, err);
  }
}

export async function deleteSecret(key: SecretKey): Promise<void> {
  try {
    await keytar.deletePassword(SERVICE, key);
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

// Load all secrets at once for convenience.
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
