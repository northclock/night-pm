import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProviderId } from './providers/types';
import { loadSecrets, setSecret } from './keychain';
import type { SecretKey } from './keychain';

export interface ClaudeSettings {
  authMode: 'auto' | 'vertex' | 'api-key';
  anthropicApiKey: string;  // loaded from keychain at runtime, never saved to disk
  vertexProjectId: string;
  vertexRegion: string;
  model: string;
  permissionMode: string;
  effort: string;
}

export interface GeminiSettings {
  apiKey: string;           // loaded from keychain at runtime, never saved to disk
  model: string;
}

export interface CodexSettings {
  apiKey: string;           // loaded from keychain at runtime, never saved to disk
  model: string;
}

export interface OpenCodeSettings {
  provider: string;
  apiKey: string;           // loaded from keychain at runtime, never saved to disk
  model: string;
}

export interface AppSettings {
  provider: ProviderId;

  claude: ClaudeSettings;
  gemini: GeminiSettings;
  codex: CodexSettings;
  opencode: OpenCodeSettings;

  maxTurns: number;
  skills: string[];
  lastProjectPath: string;
  selectedProjectPath: string;
  theme: 'light' | 'dark';
}

// What actually gets written to / read from the JSON file on disk.
// API keys are deliberately absent — they live in the OS keychain.
type PersistedSettings = Omit<AppSettings,
  'claude' | 'gemini' | 'codex' | 'opencode'
> & {
  claude: Omit<ClaudeSettings, 'anthropicApiKey'>;
  gemini: Omit<GeminiSettings, 'apiKey'>;
  codex: Omit<CodexSettings, 'apiKey'>;
  opencode: Omit<OpenCodeSettings, 'apiKey'>;
};

const DISK_DEFAULTS: PersistedSettings = {
  provider: '' as ProviderId,
  claude: {
    authMode: 'auto',
    vertexProjectId: '',
    vertexRegion: 'global',
    model: '',
    permissionMode: 'bypassPermissions',
    effort: 'high',
  },
  gemini: { model: '' },
  codex: { model: '' },
  opencode: { provider: 'anthropic', model: '' },
  maxTurns: 25,
  skills: [],
  lastProjectPath: '',
  selectedProjectPath: '',
  theme: 'light',
};

let diskCached: PersistedSettings | null = null;

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'night-pm-settings.json');
}

function migrateDiskV1(parsed: Record<string, unknown>): PersistedSettings {
  // Already in new shape
  if (parsed.claude && typeof (parsed.claude as Record<string, unknown>).authMode === 'string') {
    return deepMerge(
      DISK_DEFAULTS as unknown as Record<string, unknown>,
      parsed,
    ) as unknown as PersistedSettings;
  }

  const claude: Record<string, unknown> = {
    authMode: parsed.authMode ?? 'auto',
    vertexProjectId: parsed.vertexProjectId ?? '',
    vertexRegion: parsed.vertexRegion ?? 'global',
    model: parsed.claudeModel ?? '',
    permissionMode: parsed.defaultPermissionMode ?? 'bypassPermissions',
    effort: parsed.effort ?? 'high',
  };

  return deepMerge(DISK_DEFAULTS as unknown as Record<string, unknown>, {
    provider: parsed.provider ?? 'claude',
    claude,
    gemini: { model: (parsed.gemini as Record<string, unknown> | undefined)?.model ?? '' },
    codex: { model: (parsed.codex as Record<string, unknown> | undefined)?.model ?? '' },
    opencode: {
      provider: (parsed.opencode as Record<string, unknown> | undefined)?.provider ?? 'anthropic',
      model: (parsed.opencode as Record<string, unknown> | undefined)?.model ?? '',
    },
    maxTurns: parsed.maxTurns ?? 25,
    skills: parsed.skills ?? [],
    lastProjectPath: parsed.lastProjectPath ?? '',
    selectedProjectPath: parsed.selectedProjectPath ?? '',
    theme: (parsed.theme as 'light' | 'dark') ?? 'light',
  }) as unknown as PersistedSettings;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
      target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function loadDiskSettings(): PersistedSettings {
  if (diskCached) return diskCached;
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8');
    let parsed = JSON.parse(raw) as Record<string, unknown>;
    // Strip any API keys that may have been written by old versions
    if (parsed.claude) delete (parsed.claude as Record<string, unknown>).anthropicApiKey;
    if (parsed.gemini) delete (parsed.gemini as Record<string, unknown>).apiKey;
    if (parsed.codex) delete (parsed.codex as Record<string, unknown>).apiKey;
    if (parsed.opencode) delete (parsed.opencode as Record<string, unknown>).apiKey;
    diskCached = migrateDiskV1(parsed);
  } catch {
    diskCached = { ...DISK_DEFAULTS };
  }
  return diskCached;
}

function saveDiskSettings(settings: Partial<PersistedSettings>): PersistedSettings {
  const current = loadDiskSettings();
  const merged = deepMerge(
    current as unknown as Record<string, unknown>,
    settings as unknown as Record<string, unknown>,
  ) as unknown as PersistedSettings;
  fs.writeFileSync(getSettingsPath(), JSON.stringify(merged, null, 2), 'utf-8');
  diskCached = merged;
  return merged;
}

// ─── Public API ──────────────────────────────────────────────────────────────

// Async: merges disk settings with secrets from keychain.
export async function loadSettings(): Promise<AppSettings> {
  const disk = loadDiskSettings();
  const secrets = await loadSecrets();

  return {
    ...disk,
    claude: { ...disk.claude, anthropicApiKey: secrets['claude.anthropicApiKey'] },
    gemini: { ...disk.gemini, apiKey: secrets['gemini.apiKey'] },
    codex: { ...disk.codex, apiKey: secrets['codex.apiKey'] },
    opencode: { ...disk.opencode, apiKey: secrets['opencode.apiKey'] },
  };
}

// Async: persists non-secret fields to disk, secrets to keychain.
export async function saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  // Extract API keys before writing to disk
  const keychainWrites: Promise<void>[] = [];

  if (settings.claude?.anthropicApiKey !== undefined) {
    keychainWrites.push(setSecret('claude.anthropicApiKey', settings.claude.anthropicApiKey));
  }
  if (settings.gemini?.apiKey !== undefined) {
    keychainWrites.push(setSecret('gemini.apiKey', settings.gemini.apiKey));
  }
  if (settings.codex?.apiKey !== undefined) {
    keychainWrites.push(setSecret('codex.apiKey', settings.codex.apiKey));
  }
  if (settings.opencode?.apiKey !== undefined) {
    keychainWrites.push(setSecret('opencode.apiKey', settings.opencode.apiKey));
  }

  // Build the disk-safe copy (strip API keys)
  const diskSafe: Partial<PersistedSettings> = { ...settings } as Partial<PersistedSettings>;
  if (diskSafe.claude) diskSafe.claude = { ...diskSafe.claude } as Omit<ClaudeSettings, 'anthropicApiKey'>;
  if (diskSafe.gemini) diskSafe.gemini = { ...diskSafe.gemini } as Omit<GeminiSettings, 'apiKey'>;
  if (diskSafe.codex) diskSafe.codex = { ...diskSafe.codex } as Omit<CodexSettings, 'apiKey'>;
  if (diskSafe.opencode) diskSafe.opencode = { ...diskSafe.opencode } as Omit<OpenCodeSettings, 'apiKey'>;

  delete (diskSafe.claude as Partial<ClaudeSettings> | undefined)?.anthropicApiKey;
  delete (diskSafe.gemini as Partial<GeminiSettings> | undefined)?.apiKey;
  delete (diskSafe.codex as Partial<CodexSettings> | undefined)?.apiKey;
  delete (diskSafe.opencode as Partial<OpenCodeSettings> | undefined)?.apiKey;

  await Promise.all(keychainWrites);
  saveDiskSettings(diskSafe);
  return loadSettings();
}

// Synchronous convenience used by providers that can't await at call time.
// Secrets won't be included — callers that need keys should use loadSettings().
export function loadSettingsSync(): Omit<AppSettings, 'claude' | 'gemini' | 'codex' | 'opencode'> & {
  claude: Omit<ClaudeSettings, 'anthropicApiKey'>;
  gemini: Omit<GeminiSettings, 'apiKey'>;
  codex: Omit<CodexSettings, 'apiKey'>;
  opencode: Omit<OpenCodeSettings, 'apiKey'>;
} {
  return loadDiskSettings();
}

export function getSetting<K extends keyof PersistedSettings>(key: K): PersistedSettings[K] {
  return loadDiskSettings()[key];
}
