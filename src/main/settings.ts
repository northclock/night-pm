import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProviderId } from './providers/types';

export interface ClaudeSettings {
  authMode: 'vertex' | 'api-key';
  anthropicApiKey: string;
  vertexProjectId: string;
  vertexRegion: string;
  model: string;
  permissionMode: string;
  effort: string;
}

export interface GeminiSettings {
  apiKey: string;
  model: string;
}

export interface CodexSettings {
  apiKey: string;
  model: string;
}

export interface OpenCodeSettings {
  provider: string;
  apiKey: string;
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

const DEFAULTS: AppSettings = {
  provider: '' as ProviderId,

  claude: {
    authMode: 'vertex',
    anthropicApiKey: '',
    vertexProjectId: '',
    vertexRegion: 'global',
    model: '',
    permissionMode: 'bypassPermissions',
    effort: 'high',
  },
  gemini: {
    apiKey: '',
    model: '',
  },
  codex: {
    apiKey: '',
    model: '',
  },
  opencode: {
    provider: 'anthropic',
    apiKey: '',
    model: '',
  },

  maxTurns: 25,
  skills: [],
  lastProjectPath: '',
  selectedProjectPath: '',
  theme: 'dark',
};

let cached: AppSettings | null = null;

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'night-pm-settings.json');
}

function migrateV1(parsed: Record<string, unknown>): Record<string, unknown> {
  if (parsed.claude) return parsed;

  const claude: Record<string, unknown> = {
    authMode: parsed.authMode ?? 'vertex',
    anthropicApiKey: parsed.anthropicApiKey ?? parsed.geminiApiKey ?? '',
    vertexProjectId: parsed.vertexProjectId ?? '',
    vertexRegion: parsed.vertexRegion ?? 'global',
    model: parsed.claudeModel ?? '',
    permissionMode: parsed.defaultPermissionMode ?? 'bypassPermissions',
    effort: parsed.effort ?? 'high',
  };

  const migrated: Record<string, unknown> = {
    provider: parsed.provider ?? 'claude',
    claude,
    gemini: parsed.gemini ?? DEFAULTS.gemini,
    codex: parsed.codex ?? DEFAULTS.codex,
    opencode: parsed.opencode ?? DEFAULTS.opencode,
    maxTurns: parsed.maxTurns ?? 25,
    skills: parsed.skills ?? [],
    lastProjectPath: parsed.lastProjectPath ?? '',
    selectedProjectPath: parsed.selectedProjectPath ?? '',
    theme: (parsed.theme as 'light' | 'dark') ?? 'dark',
  };

  return migrated;
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

export function loadSettings(): AppSettings {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8');
    let parsed = JSON.parse(raw);
    parsed = migrateV1(parsed);
    cached = deepMerge(DEFAULTS as unknown as Record<string, unknown>, parsed) as unknown as AppSettings;
  } catch {
    cached = { ...DEFAULTS };
  }
  return cached;
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const merged = deepMerge(current as unknown as Record<string, unknown>, settings as unknown as Record<string, unknown>) as unknown as AppSettings;
  fs.writeFileSync(getSettingsPath(), JSON.stringify(merged, null, 2), 'utf-8');
  cached = merged;
  return merged;
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return loadSettings()[key];
}
