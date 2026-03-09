import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClaudeProvider } from './providers/claude';
import { createGeminiProvider } from './providers/gemini';
import { createCodexProvider } from './providers/codex';
import { createOpenCodeProvider } from './providers/opencode';
import type { AIProvider, ProviderId, MessageCallback, SessionInfo } from './providers/types';
import { loadSettingsSync } from './settings';
import { getSecret } from './keychain';

const NIGHT_PM_INSTRUCTIONS = `You are Night PM, a calm and intelligent personal product management assistant.
You have tools for managing the user's project data (contacts, todos, calendar, thoughts, ideas, secrets, standups).
When the user shares a thought:
- If it mentions a person, check if they exist first, then add or update the contact
- If it describes a task, add it as a todo
- If it mentions completing something, find the task and mark it done
- If it's an accomplishment, add it as a completed task
- If it describes a meeting or event, add a calendar event
- If it's a half-baked idea, store it with idea_add
- If it's private/sensitive, store it with secret_add (secrets are NEVER used in document generation; the thought is automatically removed from the thought log)
- If the user asks for a standup, daily update, or status report, use standup_generate — it compiles tasks and events and saves to standup.json
- If the thought seems to belong to a different project, use project_list to discover available projects and project_set_active to switch
- Otherwise, acknowledge the thought naturally
Be concise and helpful. Always confirm what actions you took.`;

function loadProjectContext(projectPath: string): string {
  const nipmPath = path.join(projectPath, 'project.nipm');
  try {
    const raw = fs.readFileSync(nipmPath, 'utf-8');
    const nipm = JSON.parse(raw) as Record<string, unknown>;
    const parts: string[] = [];
    if (nipm.name) parts.push(`Active project: "${nipm.name}"`);
    if (nipm.description) parts.push(`Description: ${nipm.description}`);
    if (nipm.whoAmI) parts.push(`Your role: ${nipm.whoAmI}`);
    if (Array.isArray(nipm.tags) && nipm.tags.length > 0) parts.push(`Tags: ${nipm.tags.join(', ')}`);
    return parts.length > 0 ? parts.join('\n') : '';
  } catch {
    return '';
  }
}

function loadInstructions(
  projectPath: string,
  providerId: ProviderId,
  isThought: boolean,
): string | undefined {
  let shared = '';
  let providerSpecific = '';

  const agentMdPath = path.join(projectPath, '.nightpm', 'AGENT.md');
  try { shared = fs.readFileSync(agentMdPath, 'utf-8'); } catch { /* empty */ }

  if (!shared) {
    const claudeMdPath = path.join(projectPath, '.nightpm', 'CLAUDE.md');
    try { shared = fs.readFileSync(claudeMdPath, 'utf-8'); } catch { /* empty */ }
  }

  const providerFiles: Record<ProviderId, string> = {
    claude: 'CLAUDE.md',
    gemini: 'GEMINI.md',
    codex: 'CODEX.md',
    opencode: 'OPENCODE.md',
  };
  const overridePath = path.join(projectPath, '.nightpm', providerFiles[providerId]);
  try { providerSpecific = fs.readFileSync(overridePath, 'utf-8'); } catch { /* empty */ }

  const parts: string[] = [];

  const projectCtx = loadProjectContext(projectPath);
  if (projectCtx) parts.push(projectCtx);

  if (isThought) parts.push(NIGHT_PM_INSTRUCTIONS);
  if (shared) parts.push(shared);
  if (providerSpecific) parts.push(providerSpecific);

  return parts.length > 0 ? parts.join('\n\n').trim() : undefined;
}

const providers = new Map<ProviderId, AIProvider>();

function initProviders() {
  if (providers.size > 0) return;

  providers.set('claude', createClaudeProvider(async () => {
    const s = loadSettingsSync();
    const anthropicApiKey = await getSecret('claude.anthropicApiKey');
    return {
      authMode: s.claude.authMode,
      anthropicApiKey,
      vertexProjectId: s.claude.vertexProjectId,
      vertexRegion: s.claude.vertexRegion,
      model: s.claude.model,
      permissionMode: s.claude.permissionMode,
      effort: s.claude.effort,
      maxTurns: s.maxTurns,
      skills: s.skills,
    };
  }));

  providers.set('gemini', createGeminiProvider(async () => {
    const s = loadSettingsSync();
    const apiKey = await getSecret('gemini.apiKey');
    return { apiKey, model: s.gemini.model };
  }));

  providers.set('codex', createCodexProvider(async () => {
    const s = loadSettingsSync();
    const apiKey = await getSecret('codex.apiKey');
    return { apiKey, model: s.codex.model };
  }));

  providers.set('opencode', createOpenCodeProvider(async () => {
    const s = loadSettingsSync();
    const apiKey = await getSecret('opencode.apiKey');
    return { provider: s.opencode.provider, apiKey, model: s.opencode.model };
  }));
}

function getActiveProvider(): AIProvider {
  initProviders();
  const settings = loadSettingsSync();
  const provider = providers.get(settings.provider);
  if (!provider) throw new Error(`Unknown provider: ${settings.provider}`);
  return provider;
}

export async function startConversation(
  key: string,
  projectPath: string,
  initialPrompt: string,
  send: MessageCallback,
  messageChannel: string,
  progressChannel: string,
  doneChannel: string,
  options?: {
    isThought?: boolean;
    resumeSessionId?: string;
    rootPath?: string;
    setActiveProject?: (projectPath: string) => void;
  },
) {
  const provider = getActiveProvider();
  const instructions = loadInstructions(
    projectPath, provider.id,
    options?.isThought ?? false,
  );

  await provider.startSession({
    key, projectPath, initialPrompt, send,
    messageChannel, progressChannel, doneChannel,
    isThought: options?.isThought,
    resumeSessionId: options?.resumeSessionId,
    systemInstructions: instructions,
    rootPath: options?.rootPath,
    setActiveProject: options?.setActiveProject,
  });
}

export async function sendFollowup(
  key: string,
  text: string,
  send: MessageCallback,
  messageChannel: string,
  progressChannel: string,
  doneChannel: string,
) {
  const provider = getActiveProvider();
  await provider.sendFollowup(key, text, send, messageChannel, progressChannel, doneChannel);
}

export function stopConversation(key: string) {
  initProviders();
  for (const provider of providers.values()) {
    provider.stopSession(key);
  }
}

export async function listSessions(projectPath: string): Promise<SessionInfo[]> {
  const provider = getActiveProvider();
  return provider.listSessions(projectPath);
}

export function getActiveProviderId(): ProviderId {
  return loadSettingsSync().provider;
}
