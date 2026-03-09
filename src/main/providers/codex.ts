import { Codex } from '@openai/codex-sdk';
import type {
  AIProvider,
  StartSessionOpts,
  MessageCallback,
  SessionInfo,
} from './types';

export interface CodexConfig {
  apiKey: string;
  model: string;
}

interface CodexSession {
  thread: ReturnType<Codex['startThread']>;
  threadId: string;
  isRunning: boolean;
  send: MessageCallback;
  messageChannel: string;
  progressChannel: string;
  doneChannel: string;
  systemInstructions?: string;
  firstPromptSent: boolean;
}

const sessions = new Map<string, CodexSession>();
let turnCounter = 0;

function buildCodexInstance(cfg: CodexConfig): Codex {
  const env: Record<string, string | undefined> = { ...process.env };
  if (cfg.apiKey) {
    env.OPENAI_API_KEY = cfg.apiKey;
    env.CODEX_API_KEY = cfg.apiKey;
  }
  return new Codex({ env });
}

function nextSessionId(): string {
  return `codex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildPrompt(text: string, session: CodexSession): string {
  if (!session.firstPromptSent && session.systemInstructions) {
    session.firstPromptSent = true;
    return `${session.systemInstructions}\n\n${text}`;
  }
  session.firstPromptSent = true;
  return text;
}

async function streamTurn(
  session: CodexSession,
  prompt: string,
): Promise<void> {
  session.isRunning = true;
  const sessionId = session.threadId;
  let resultText = '';
  turnCounter++;
  const currentTurn = turnCounter;

  try {
    const { events } = await session.thread.runStreamed(prompt);

    for await (const event of events) {
      if (event.type === 'item.completed') {
        const item = (event as { item?: unknown }).item as
          | { type?: string; text?: string; content?: Array<{ type?: string; text?: string }>; name?: string; arguments?: string; call_id?: string; output?: string }
          | undefined;

        if (!item) continue;

        // agent_message — Codex SDK returns text directly on item.text
        if (item.type === 'agent_message' && typeof item.text === 'string') {
          resultText += item.text;
          session.send(session.messageChannel, { type: 'text', text: item.text });
        } else if (item.type === 'message' && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === 'output_text' || part.type === 'text') {
              const text = part.text ?? '';
              resultText += text;
              session.send(session.messageChannel, { type: 'text', text });
            }
          }
        } else if (item.type === 'function_call' || item.type === 'tool_call') {
          session.send(session.messageChannel, {
            type: 'tool_use',
            id: item.call_id ?? `tool-${currentTurn}-${Date.now()}`,
            tool: item.name ?? 'unknown',
            input: item.arguments ? tryParseJson(item.arguments) : {},
          });
        } else if (item.type === 'function_call_output' || item.type === 'tool_call_output') {
          session.send(session.messageChannel, {
            type: 'tool_result',
            output: item.output ?? '',
          });
        }
      } else if (event.type === 'turn.completed') {
        const turnData = event as {
          usage?: { input_tokens?: number; output_tokens?: number };
          stop_reason?: string;
        };
        session.send(session.doneChannel, {
          type: 'result',
          cost: 0,
          inputTokens: turnData.usage?.input_tokens ?? 0,
          outputTokens: turnData.usage?.output_tokens ?? 0,
          numTurns: currentTurn,
          stopReason: turnData.stop_reason ?? 'end_turn',
          sessionId,
          isError: false,
          result: resultText || undefined,
        });
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[codex] Stream error:', errMsg);
    session.send(session.messageChannel, { type: 'error', message: errMsg });
    session.send(session.doneChannel, {
      type: 'result',
      cost: 0,
      inputTokens: 0,
      outputTokens: 0,
      numTurns: currentTurn,
      stopReason: 'error',
      sessionId,
      isError: true,
      errors: [errMsg],
    });
  } finally {
    session.isRunning = false;
  }
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function createCodexProvider(getConfig: () => Promise<CodexConfig>): AIProvider {
  return {
    id: 'codex',
    displayName: 'Codex',

    async startSession(opts: StartSessionOpts) {
      this.stopSession(opts.key);

      const cfg = await getConfig();
      const codex = buildCodexInstance(cfg);
      const threadId = opts.resumeSessionId ?? nextSessionId();

      try {
        const thread = opts.resumeSessionId
          ? codex.resumeThread(opts.resumeSessionId)
          : codex.startThread({ workingDirectory: opts.projectPath, skipGitRepoCheck: true });

        const session: CodexSession = {
          thread,
          threadId,
          isRunning: false,
          send: opts.send,
          messageChannel: opts.messageChannel,
          progressChannel: opts.progressChannel,
          doneChannel: opts.doneChannel,
          systemInstructions: opts.systemInstructions,
          firstPromptSent: false,
        };

        sessions.set(opts.key, session);

        const prompt = buildPrompt(opts.initialPrompt, session);
        await streamTurn(session, prompt);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[codex] Failed to start session:', errMsg);
        opts.send(opts.messageChannel, { type: 'error', message: errMsg });
        opts.send(opts.doneChannel, {
          type: 'result',
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          numTurns: 0,
          stopReason: 'error',
          sessionId: threadId,
          isError: true,
          errors: [errMsg],
        });
      }
    },

    async sendFollowup(key, text, send, messageChannel, progressChannel, doneChannel) {
      const session = sessions.get(key);
      if (!session) {
        send(messageChannel, {
          type: 'error',
          message: 'No active Codex conversation. Send a new message to start.',
        });
        return;
      }
      if (session.isRunning) {
        send(messageChannel, {
          type: 'error',
          message: 'Please wait for the current response to finish.',
        });
        return;
      }

      session.send = send;
      session.messageChannel = messageChannel;
      session.progressChannel = progressChannel;
      session.doneChannel = doneChannel;

      try {
        await streamTurn(session, text);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[codex] Followup error:', errMsg);
        send(messageChannel, { type: 'error', message: errMsg });
      }
    },

    stopSession(key) {
      const session = sessions.get(key);
      if (session) {
        sessions.delete(key);
      }
    },

    async listSessions(_projectPath: string): Promise<SessionInfo[]> {
      return [];
    },
  };
}
