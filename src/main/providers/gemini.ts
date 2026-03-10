import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { getShellPath } from '../detect-providers';
import type { AIProvider, AIMessage, AIResult, StartSessionOpts, MessageCallback, SessionInfo } from './types';

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

interface GeminiSession {
  process: ChildProcess;
  key: string;
  send: MessageCallback;
  messageChannel: string;
  progressChannel: string;
  doneChannel: string;
  isRunning: boolean;
  geminiSessionId?: string;
}

const sessions = new Map<string, GeminiSession>();

function buildPrompt(prompt: string, systemInstructions?: string): string {
  if (systemInstructions) {
    return `${systemInstructions}\n\n${prompt}`;
  }
  return prompt;
}

function tryParseAccumulated(
  buffer: string,
  onMessage: (parsed: unknown) => void,
): void {
  const trimmed = buffer.trim();
  if (!trimmed) return;

  // Try parsing the whole buffer as a single JSON object first (Gemini CLI
  // outputs pretty-printed JSON, not JSON Lines).
  try {
    onMessage(JSON.parse(trimmed));
    return;
  } catch {
    // Not valid yet — fall through to line-by-line attempt
  }

  // Fallback: try each line as an independent JSON object (JSONL style)
  for (const line of trimmed.split('\n')) {
    const l = line.trim();
    if (!l) continue;
    try {
      onMessage(JSON.parse(l));
    } catch {
      // Fragment of a multi-line object — ignore
    }
  }
}

function mapGeminiOutput(raw: unknown): AIMessage | AIMessage[] | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  // Top-level "response" field — Gemini CLI's --output-format json wraps the
  // final answer in { session_id, response, stats }.
  if (typeof obj.response === 'string') {
    return { type: 'text', text: obj.response };
  }

  // Text content
  if (obj.text != null && typeof obj.text === 'string') {
    return { type: 'text', text: obj.text };
  }

  // Partial / streaming text
  if (obj.partialText != null && typeof obj.partialText === 'string') {
    return { type: 'text', text: obj.partialText, isPartial: true };
  }

  // Response with parts array (Gemini structured output)
  if (Array.isArray(obj.parts)) {
    const messages: AIMessage[] = [];
    for (const part of obj.parts as Record<string, unknown>[]) {
      if (part.text && typeof part.text === 'string') {
        messages.push({ type: 'text', text: part.text });
      } else if (part.functionCall) {
        const fc = part.functionCall as Record<string, unknown>;
        messages.push({
          type: 'tool_use',
          id: (fc.id as string) || String(Date.now()),
          tool: fc.name as string,
          input: fc.args ?? {},
        });
      } else if (part.functionResponse) {
        const fr = part.functionResponse as Record<string, unknown>;
        messages.push({
          type: 'tool_result',
          tool: fr.name as string,
          output: typeof fr.response === 'string' ? fr.response : JSON.stringify(fr.response),
        });
      }
    }
    return messages.length ? messages : null;
  }

  // Tool call
  if (obj.functionCall || obj.toolCall) {
    const fc = (obj.functionCall ?? obj.toolCall) as Record<string, unknown>;
    return {
      type: 'tool_use',
      id: (fc.id as string) || String(Date.now()),
      tool: (fc.name as string) || 'unknown',
      input: fc.args ?? fc.arguments ?? {},
    };
  }

  // Tool result
  if (obj.functionResponse || obj.toolResult) {
    const fr = (obj.functionResponse ?? obj.toolResult) as Record<string, unknown>;
    return {
      type: 'tool_result',
      tool: fr.name as string,
      output: typeof fr.response === 'string' ? fr.response : JSON.stringify(fr.response ?? fr.output ?? ''),
    };
  }

  // Error
  if (obj.error) {
    const errData = obj.error as Record<string, unknown>;
    const message = typeof errData === 'string'
      ? errData
      : (errData.message as string) ?? JSON.stringify(errData);
    return { type: 'error', message };
  }

  // Content wrapper (some Gemini CLI versions wrap in content.parts)
  if (obj.content && typeof obj.content === 'object') {
    return mapGeminiOutput(obj.content);
  }

  return null;
}

function emitAIMessages(session: GeminiSession, raw: unknown) {
  const mapped = mapGeminiOutput(raw);
  if (!mapped) return;

  const messages = Array.isArray(mapped) ? mapped : [mapped];
  for (const msg of messages) {
    if (msg.type === 'tool_progress') {
      session.send(session.progressChannel, msg);
    } else {
      session.send(session.messageChannel, msg);
    }
  }

  // Capture session id if the CLI provides one
  const obj = raw as Record<string, unknown>;
  if (obj.sessionId && typeof obj.sessionId === 'string') {
    session.geminiSessionId = obj.sessionId;
  }
  if (obj.session_id && typeof obj.session_id === 'string') {
    session.geminiSessionId = obj.session_id;
  }
}

function emitResult(session: GeminiSession, exitCode: number | null) {
  const result: AIResult = {
    type: 'result',
    cost: 0,
    inputTokens: 0,
    outputTokens: 0,
    numTurns: 1,
    stopReason: exitCode === 0 ? 'end_turn' : 'error',
    sessionId: session.geminiSessionId ?? '',
    isError: exitCode !== 0,
    result: exitCode === 0 ? undefined : `Process exited with code ${exitCode}`,
    errors: exitCode !== 0 ? [`Gemini CLI exited with code ${exitCode}`] : undefined,
  };
  session.send(session.doneChannel, result);
}

function spawnGemini(
  args: string[],
  config: GeminiConfig,
  projectPath: string,
): ChildProcess {
  const env: Record<string, string | undefined> = { ...process.env, PATH: getShellPath() };
  if (config.apiKey) {
    env.GEMINI_API_KEY = config.apiKey;
  }

  return spawn('gemini', args, {
    cwd: projectPath,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
}

function runSession(session: GeminiSession) {
  const proc = session.process;
  let stdoutBuffer = '';
  let stderrBuffer = '';

  session.isRunning = true;

  proc.stdout?.on('data', (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    stderrBuffer += chunk.toString();
  });

  proc.on('error', (err) => {
    session.isRunning = false;
    session.send(session.messageChannel, {
      type: 'error',
      message: `Failed to start Gemini CLI: ${err.message}`,
    } as const);
    emitResult(session, 1);
    sessions.delete(session.key);
  });

  proc.on('close', (code) => {
    // Gemini CLI outputs a single pretty-printed JSON object on stdout.
    // Parse the full accumulated buffer once the process exits.
    if (stdoutBuffer.trim()) {
      tryParseAccumulated(stdoutBuffer, (parsed) => {
        emitAIMessages(session, parsed);
      });
    }

    if (code !== 0 && stderrBuffer.trim()) {
      session.send(session.messageChannel, {
        type: 'error',
        message: stderrBuffer.trim(),
      } as const);
    }

    session.isRunning = false;
    emitResult(session, code);
    sessions.delete(session.key);
  });
}

export function createGeminiProvider(getConfig: () => Promise<GeminiConfig>): AIProvider {
  return {
    id: 'gemini',
    displayName: 'Gemini',

    async startSession(opts: StartSessionOpts): Promise<void> {
      this.stopSession(opts.key);

      const config = await getConfig();
      const prompt = buildPrompt(opts.initialPrompt, opts.systemInstructions);

      const args = ['--output-format', 'json', '--yolo', '-p', prompt];

      if (config.model) {
        args.unshift('--model', config.model);
      }

      if (opts.resumeSessionId) {
        args.unshift('--resume', opts.resumeSessionId);
      }

      const proc = spawnGemini(args, config, opts.projectPath);

      const session: GeminiSession = {
        process: proc,
        key: opts.key,
        send: opts.send,
        messageChannel: opts.messageChannel,
        progressChannel: opts.progressChannel,
        doneChannel: opts.doneChannel,
        isRunning: false,
      };

      sessions.set(opts.key, session);
      runSession(session);

      return new Promise<void>((resolve) => {
        proc.on('close', () => resolve());
        proc.on('error', () => resolve());
      });
    },

    async sendFollowup(
      key: string,
      text: string,
      send: MessageCallback,
      messageChannel: string,
      progressChannel: string,
      doneChannel: string,
    ): Promise<void> {
      const existing = sessions.get(key);
      if (existing?.isRunning) {
        send(messageChannel, {
          type: 'error',
          message: 'Please wait for the current response to finish.',
        } as const);
        return;
      }

      const resumeId = existing?.geminiSessionId;

      // Kill previous process if still lingering
      this.stopSession(key);

      const config = await getConfig();
      const args = ['--output-format', 'json', '--yolo', '-p', text];

      if (config.model) {
        args.unshift('--model', config.model);
      }

      if (resumeId) {
        args.unshift('--resume', resumeId);
      }

      const projectPath = process.cwd();
      const proc = spawnGemini(args, config, projectPath);

      const session: GeminiSession = {
        process: proc,
        key,
        send,
        messageChannel,
        progressChannel,
        doneChannel,
        isRunning: false,
        geminiSessionId: resumeId,
      };

      sessions.set(key, session);
      runSession(session);

      return new Promise<void>((resolve) => {
        proc.on('close', () => resolve());
        proc.on('error', () => resolve());
      });
    },

    stopSession(key: string): void {
      const session = sessions.get(key);
      if (session) {
        session.isRunning = false;
        try {
          session.process.kill('SIGTERM');
        } catch {
          // Process may already be dead
        }
        sessions.delete(key);
      }
    },

    async listSessions(_projectPath: string): Promise<SessionInfo[]> {
      return [];
    },
  };
}
