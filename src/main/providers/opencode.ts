import { createOpencode } from '@opencode-ai/sdk';
import type { AIProvider, StartSessionOpts, MessageCallback, SessionInfo } from './types';

export interface OpenCodeConfig {
  provider: string;
  apiKey: string;
  model: string;
}

interface TrackedSession {
  sessionId: string;
  isRunning: boolean;
  send: MessageCallback;
  messageChannel: string;
  progressChannel: string;
  doneChannel: string;
}

type OpenCodeClient = Awaited<ReturnType<typeof createOpencode>>['client'];

const sessions = new Map<string, TrackedSession>();
let sharedClient: OpenCodeClient | null = null;
let clientInitializing: Promise<OpenCodeClient> | null = null;

async function ensureClient(cfg: OpenCodeConfig): Promise<OpenCodeClient> {
  if (sharedClient) return sharedClient;
  if (clientInitializing) return clientInitializing;

  clientInitializing = (async () => {
    try {
      const modelStr = cfg.model || 'anthropic/claude-3-5-sonnet';
      const { client } = await createOpencode({
        config: { model: modelStr } as never,
      });
      sharedClient = client;
      return client;
    } catch (err) {
      clientInitializing = null;
      throw err;
    }
  })();

  return clientInitializing;
}

function extractTextFromParts(parts: unknown[]): string {
  const texts: string[] = [];
  for (const part of parts) {
    if (part && typeof part === 'object' && 'type' in part) {
      const p = part as Record<string, unknown>;
      if (p.type === 'text' && typeof p.text === 'string') {
        texts.push(p.text);
      }
    }
  }
  return texts.join('\n');
}

function emitResponseParts(
  parts: unknown[],
  send: MessageCallback,
  messageChannel: string,
): void {
  for (const part of parts) {
    if (!part || typeof part !== 'object' || !('type' in part)) continue;
    const p = part as Record<string, unknown>;

    if (p.type === 'text' && typeof p.text === 'string') {
      send(messageChannel, { type: 'text', text: p.text });
    } else if (p.type === 'tool-invocation' || p.type === 'tool_use') {
      send(messageChannel, {
        type: 'tool_use',
        id: String(p.toolCallId ?? p.id ?? ''),
        tool: String(p.toolName ?? p.tool ?? p.name ?? 'unknown'),
        input: p.args ?? p.input ?? {},
      });
    } else if (p.type === 'tool-result' || p.type === 'tool_result') {
      send(messageChannel, {
        type: 'tool_result',
        id: String(p.toolCallId ?? p.id ?? ''),
        tool: String(p.toolName ?? p.tool ?? ''),
        output: typeof p.result === 'string' ? p.result : JSON.stringify(p.result ?? p.output ?? ''),
        isError: Boolean(p.isError),
      });
    } else if (p.type === 'reasoning' || p.type === 'thinking') {
      const text = typeof p.text === 'string' ? p.text : typeof p.reasoning === 'string' ? p.reasoning : '';
      if (text) send(messageChannel, { type: 'thinking', text });
    }
  }
}

function emitResult(
  session: TrackedSession,
  response: Record<string, unknown>,
  isError: boolean,
  errorMessages?: string[],
): void {
  const metadata = (response.metadata ?? response.usage ?? {}) as Record<string, unknown>;
  const parts = Array.isArray(response.parts) ? response.parts as unknown[] : [];

  session.send(session.doneChannel, {
    type: 'result',
    cost: typeof metadata.cost === 'number' ? metadata.cost : 0,
    inputTokens: typeof metadata.inputTokens === 'number' ? metadata.inputTokens : 0,
    outputTokens: typeof metadata.outputTokens === 'number' ? metadata.outputTokens : 0,
    numTurns: typeof metadata.turns === 'number' ? metadata.turns : 1,
    stopReason: typeof response.stopReason === 'string' ? response.stopReason : null,
    sessionId: session.sessionId,
    isError,
    result: isError ? undefined : extractTextFromParts(parts),
    errors: errorMessages,
  });
}

async function runPrompt(
  client: OpenCodeClient,
  session: TrackedSession,
  text: string,
  cfg: OpenCodeConfig,
): Promise<void> {
  session.isRunning = true;

  try {
    const [providerID, modelID] = parseModel(cfg);

    const result = await client.session.prompt({
      path: { id: session.sessionId },
      body: {
        parts: [{ type: 'text', text }],
        model: { providerID, modelID },
      },
    } as never);

    const data = (result as Record<string, unknown>)?.data ?? result;
    const response = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;

    const parts = Array.isArray(response.parts) ? response.parts as unknown[] : [];
    emitResponseParts(parts, session.send, session.messageChannel);

    const messages = Array.isArray(response.messages) ? response.messages : [];
    for (const msg of messages) {
      if (msg && typeof msg === 'object' && 'parts' in msg) {
        const msgParts = Array.isArray((msg as Record<string, unknown>).parts)
          ? (msg as Record<string, unknown>).parts as unknown[]
          : [];
        emitResponseParts(msgParts, session.send, session.messageChannel);
      }
    }

    emitResult(session, response, false);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[opencode] Prompt error:', errMsg);
    session.send(session.messageChannel, { type: 'error', message: errMsg });
    emitResult(session, {}, true, [errMsg]);
  } finally {
    session.isRunning = false;
  }
}

function parseModel(cfg: OpenCodeConfig): [string, string] {
  const model = cfg.model || 'anthropic/claude-3-5-sonnet';
  const slashIdx = model.indexOf('/');
  if (slashIdx > 0) {
    return [model.slice(0, slashIdx), model.slice(slashIdx + 1)];
  }
  return [cfg.provider || 'anthropic', model];
}

export function createOpenCodeProvider(getConfig: () => Promise<OpenCodeConfig>): AIProvider {
  return {
    id: 'opencode',
    displayName: 'OpenCode',

    async startSession(opts: StartSessionOpts) {
      this.stopSession(opts.key);

      const cfg = await getConfig();
      let client: OpenCodeClient;
      try {
        client = await ensureClient(cfg);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[opencode] Failed to start server:', errMsg);
        opts.send(opts.messageChannel, { type: 'error', message: `OpenCode server failed to start: ${errMsg}` });
        opts.send(opts.doneChannel, {
          type: 'result', cost: 0, inputTokens: 0, outputTokens: 0,
          numTurns: 0, stopReason: 'error', sessionId: '', isError: true,
          errors: [errMsg],
        });
        return;
      }

      let sessionId: string;
      try {
        const title = opts.initialPrompt.slice(0, 80) || 'Night PM Session';
        const created = await client.session.create({
          body: { title },
        } as never);

        const data = (created as Record<string, unknown>)?.data ?? created;
        sessionId = String((data as Record<string, unknown>)?.id ?? '');
        if (!sessionId) throw new Error('Session creation returned no ID');
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[opencode] Session creation error:', errMsg);
        opts.send(opts.messageChannel, { type: 'error', message: `Failed to create session: ${errMsg}` });
        opts.send(opts.doneChannel, {
          type: 'result', cost: 0, inputTokens: 0, outputTokens: 0,
          numTurns: 0, stopReason: 'error', sessionId: '', isError: true,
          errors: [errMsg],
        });
        return;
      }

      const session: TrackedSession = {
        sessionId,
        isRunning: false,
        send: opts.send,
        messageChannel: opts.messageChannel,
        progressChannel: opts.progressChannel,
        doneChannel: opts.doneChannel,
      };

      sessions.set(opts.key, session);

      opts.send(opts.messageChannel, {
        type: 'system',
        model: cfg.model,
      });

      await runPrompt(client, session, opts.initialPrompt, cfg);
    },

    async sendFollowup(key, text, send, messageChannel, progressChannel, doneChannel) {
      const session = sessions.get(key);
      if (!session) {
        send(messageChannel, { type: 'error', message: 'No active conversation. Send a new message to start.' });
        return;
      }
      if (session.isRunning) {
        send(messageChannel, { type: 'error', message: 'Please wait for the current response to finish.' });
        return;
      }

      session.send = send;
      session.messageChannel = messageChannel;
      session.progressChannel = progressChannel;
      session.doneChannel = doneChannel;

      const cfg = await getConfig();
      let client: OpenCodeClient;
      try {
        client = await ensureClient(cfg);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        send(messageChannel, { type: 'error', message: `OpenCode server unavailable: ${errMsg}` });
        return;
      }

      await runPrompt(client, session, text, cfg);
    },

    stopSession(key) {
      const session = sessions.get(key);
      if (!session) return;
      sessions.delete(key);

      if (session.isRunning && sharedClient) {
        try {
          sharedClient.session.abort({
            path: { id: session.sessionId },
          } as never).catch((err: unknown) => {
            console.error('[opencode] Abort error:', err instanceof Error ? err.message : err);
          });
        } catch (err) {
          console.error('[opencode] Abort error:', err instanceof Error ? err.message : err);
        }
      }
    },

    async listSessions(_projectPath: string): Promise<SessionInfo[]> {
      try {
        const cfg = await getConfig();
        const client = await ensureClient(cfg);
        const result = await client.session.list();
        const data = (result as Record<string, unknown>)?.data ?? result;

        if (!Array.isArray(data)) return [];

        return data.map((s: unknown) => {
          const session = s as Record<string, unknown>;
          return {
            sessionId: String(session.id ?? ''),
            summary: String(session.title ?? session.summary ?? ''),
            lastModified: typeof session.updatedAt === 'number'
              ? session.updatedAt
              : typeof session.updated_at === 'number'
                ? session.updated_at
                : Date.now(),
            firstPrompt: typeof session.firstPrompt === 'string' ? session.firstPrompt : undefined,
          };
        });
      } catch (err) {
        console.error('[opencode] listSessions error:', err instanceof Error ? err.message : err);
        return [];
      }
    },
  };
}
