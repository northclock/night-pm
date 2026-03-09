import { query, listSessions } from "@anthropic-ai/claude-agent-sdk";
import type {
  SDKMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { app } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { createProjectMcpServer } from "../mcp-tools";
import type {
  AIProvider,
  StartSessionOpts,
  MessageCallback,
  SessionInfo,
} from "./types";

function resolveClaudeCliPath(): string {
  const candidates = [
    path.join(
      app.getAppPath(),
      "node_modules",
      "@anthropic-ai",
      "claude-agent-sdk",
      "cli.js",
    ),
    path.join(
      process.cwd(),
      "node_modules",
      "@anthropic-ai",
      "claude-agent-sdk",
      "cli.js",
    ),
    path.join(
      __dirname,
      "..",
      "..",
      "node_modules",
      "@anthropic-ai",
      "claude-agent-sdk",
      "cli.js",
    ),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

class MessageQueue {
  private queue: SDKUserMessage[] = [];
  private resolve: ((val: IteratorResult<SDKUserMessage>) => void) | null =
    null;
  private done = false;

  enqueue(msg: SDKUserMessage) {
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r({ value: msg, done: false });
    } else {
      this.queue.push(msg);
    }
  }

  finish() {
    this.done = true;
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r({ value: undefined as never, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return {
      next: (): Promise<IteratorResult<SDKUserMessage>> => {
        if (this.queue.length > 0) {
          return Promise.resolve({ value: this.queue.shift()!, done: false });
        }
        if (this.done) {
          return Promise.resolve({ value: undefined as never, done: true });
        }
        return new Promise((r) => {
          this.resolve = r;
        });
      },
    };
  }
}

interface ClaudeSession {
  iterator: AsyncIterator<SDKMessage>;
  inputQueue: MessageQueue;
  abortController: AbortController;
  sessionId?: string;
  isRunning: boolean;
  send: MessageCallback;
  messageChannel: string;
  progressChannel: string;
  doneChannel: string;
}

function transformMessage(msg: SDKMessage): unknown | null {
  if (msg.type === "assistant") {
    const blocks: unknown[] = [];
    for (const block of msg.message?.content ?? []) {
      if (block.type === "text") {
        blocks.push({ type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        blocks.push({
          type: "tool_use",
          id: block.id,
          tool: block.name,
          input: block.input,
        });
      } else if (block.type === "thinking") {
        blocks.push({
          type: "thinking",
          text: (block as { text?: string }).text ?? "",
        });
      }
    }
    return blocks;
  }
  if (msg.type === "tool_progress") {
    return {
      type: "tool_progress",
      tool: msg.tool_name,
      elapsedSeconds: msg.elapsed_time_seconds,
    };
  }
  if (msg.type === "result") {
    return {
      type: "result",
      cost: msg.subtype === "success" ? msg.total_cost_usd : 0,
      inputTokens: msg.usage?.input_tokens ?? 0,
      outputTokens: msg.usage?.output_tokens ?? 0,
      numTurns: msg.num_turns,
      stopReason: msg.stop_reason,
      sessionId: msg.session_id,
      isError: msg.is_error,
      result: msg.subtype === "success" ? msg.result : undefined,
      errors:
        msg.subtype !== "success"
          ? (msg as { errors?: string[] }).errors
          : undefined,
    };
  }
  if (msg.type === "system" && "subtype" in msg && msg.subtype === "init") {
    return {
      type: "system",
      model: (msg as { model?: string }).model,
      tools: (msg as { tools?: string[] }).tools,
      mcpServers: (msg as { mcp_servers?: unknown[] }).mcp_servers,
    };
  }
  if (msg.type === "user" && "tool_use_result" in msg && msg.tool_use_result) {
    return {
      type: "tool_result",
      output:
        typeof msg.tool_use_result === "string"
          ? msg.tool_use_result
          : JSON.stringify(msg.tool_use_result),
    };
  }
  return null;
}

function emitMessage(session: ClaudeSession, msg: SDKMessage) {
  const transformed = transformMessage(msg);
  if (!transformed) return;
  if (msg.type === "tool_progress") {
    session.send(session.progressChannel, transformed);
  } else if (msg.type === "result") {
    session.sessionId = msg.session_id;
    session.send(session.doneChannel, transformed);
  } else if (Array.isArray(transformed)) {
    for (const block of transformed)
      session.send(session.messageChannel, block);
  } else {
    session.send(session.messageChannel, transformed);
  }
}

async function drainUntilResult(session: ClaudeSession): Promise<void> {
  session.isRunning = true;
  try {
    while (true) {
      const { value, done } = await session.iterator.next();
      if (done || session.abortController.signal.aborted) break;
      emitMessage(session, value);
      if (value.type === "result") {
        session.sessionId = value.session_id;
        break;
      }
    }
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[claude] Error:", errMsg);
      session.send(session.messageChannel, { type: "error", message: errMsg });
    }
  } finally {
    session.isRunning = false;
  }
}

function makeUserMessage(text: string, sessionId: string): SDKUserMessage {
  return {
    type: "user",
    session_id: sessionId,
    message: { role: "user", content: [{ type: "text", text }] },
    parent_tool_use_id: null,
  } as SDKUserMessage;
}

function loadProjectMcpServers(projectPath: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(
      path.join(projectPath, ".nightpm", "mcp.json"),
      "utf-8",
    );
    return JSON.parse(raw).servers || {};
  } catch {
    return {};
  }
}

function loadProjectAgents(
  projectPath: string,
): Record<string, unknown> | undefined {
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(projectPath, ".nightpm", "agents.json"),
        "utf-8",
      ),
    );
  } catch {
    return undefined;
  }
}

export interface ClaudeConfig {
  authMode: "auto" | "vertex" | "api-key";
  anthropicApiKey: string;
  vertexProjectId: string;
  vertexRegion: string;
  model: string;
  permissionMode: string;
  effort: string;
  maxTurns: number;
  skills: string[];
}

const sessions = new Map<string, ClaudeSession>();

function buildEnv(cfg: ClaudeConfig): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  if (cfg.authMode === "vertex") {
    env.CLAUDE_CODE_USE_VERTEX = "1";
    env.ANTHROPIC_VERTEX_PROJECT_ID = cfg.vertexProjectId;
    env.CLOUD_ML_REGION = cfg.vertexRegion || "global";
  } else if (cfg.authMode === "api-key" && cfg.anthropicApiKey) {
    env.ANTHROPIC_API_KEY = cfg.anthropicApiKey;
  }
  // 'auto' — inherit whatever the CLI already has configured
  return env;
}

export function createClaudeProvider(
  getConfig: () => Promise<ClaudeConfig>,
): AIProvider {
  return {
    id: "claude",
    displayName: "Claude",

    async startSession(opts: StartSessionOpts) {
      this.stopSession(opts.key);
      const cfg = await getConfig();
      const abortController = new AbortController();
      const inputQueue = new MessageQueue();
      const mcpServer = createProjectMcpServer(opts.projectPath);
      const projectMcpServers = loadProjectMcpServers(opts.projectPath);
      const agents = loadProjectAgents(opts.projectPath);

      const mergedMcpServers: Record<string, unknown> = {
        "night-pm": mcpServer,
        ...projectMcpServers,
      };

      const q = query({
        prompt: inputQueue as unknown as AsyncIterable<SDKUserMessage>,
        options: {
          systemPrompt: opts.systemInstructions
            ? {
                type: "preset",
                preset: "claude_code",
                append: opts.systemInstructions,
              }
            : { type: "preset", preset: "claude_code" },
          cwd: opts.projectPath,
          mcpServers: mergedMcpServers as Record<string, never>,
          permissionMode: (cfg.permissionMode || "bypassPermissions") as never,
          model: cfg.model || undefined,
          env: buildEnv(cfg),
          effort: (cfg.effort || "high") as never,
          maxTurns: cfg.maxTurns || 25,
          tools: { type: "preset", preset: "claude_code" },
          includePartialMessages: true,
          abortController,
          resume: opts.resumeSessionId,
          skills: cfg.skills?.length ? cfg.skills : undefined,
          agents: agents as never,
          settingSources: ["project"] as never,
          allowDangerouslySkipPermissions: true,
          pathToClaudeCodeExecutable: resolveClaudeCliPath(),
          stderr: (data: string) => {
            console.error(`[claude:${opts.key}:stderr]`, data);
          },
        },
      });

      const iterator = q[Symbol.asyncIterator]();
      const session: ClaudeSession = {
        iterator,
        inputQueue,
        abortController,
        isRunning: false,
        send: opts.send,
        messageChannel: opts.messageChannel,
        progressChannel: opts.progressChannel,
        doneChannel: opts.doneChannel,
      };
      sessions.set(opts.key, session);
      inputQueue.enqueue(makeUserMessage(opts.initialPrompt, ""));
      await drainUntilResult(session);
    },

    async sendFollowup(
      key,
      text,
      send,
      messageChannel,
      progressChannel,
      doneChannel,
    ) {
      const session = sessions.get(key);
      if (!session) {
        send(messageChannel, {
          type: "error",
          message: "No active conversation. Send a new message to start.",
        });
        return;
      }
      if (session.isRunning) {
        send(messageChannel, {
          type: "error",
          message: "Please wait for the current response to finish.",
        });
        return;
      }
      session.send = send;
      session.messageChannel = messageChannel;
      session.progressChannel = progressChannel;
      session.doneChannel = doneChannel;
      session.inputQueue.enqueue(
        makeUserMessage(text, session.sessionId ?? ""),
      );
      await drainUntilResult(session);
    },

    stopSession(key) {
      const session = sessions.get(key);
      if (session) {
        session.abortController.abort();
        session.inputQueue.finish();
        sessions.delete(key);
      }
    },

    async listSessions(projectPath) {
      try {
        const result = await listSessions({ dir: projectPath, limit: 50 });
        return result.map((s) => ({
          sessionId: s.sessionId,
          summary: s.summary,
          lastModified: s.lastModified,
          firstPrompt: s.firstPrompt,
        }));
      } catch {
        return [];
      }
    },
  };
}
