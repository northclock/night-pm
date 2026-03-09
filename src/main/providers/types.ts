export type ProviderId = 'claude' | 'gemini' | 'codex' | 'opencode';

export type AIMessage =
  | { type: 'text'; text: string; isPartial?: boolean }
  | { type: 'tool_use'; id: string; tool: string; input: unknown }
  | { type: 'tool_result'; id?: string; tool?: string; output: string; isError?: boolean }
  | { type: 'tool_progress'; tool: string; elapsedSeconds: number }
  | { type: 'thinking'; text: string }
  | { type: 'error'; message: string }
  | { type: 'system'; text?: string; model?: string; tools?: string[]; mcpServers?: unknown[] };

export type AIResult = {
  type: 'result';
  cost: number;
  inputTokens: number;
  outputTokens: number;
  numTurns: number;
  stopReason: string | null;
  sessionId: string;
  isError: boolean;
  result?: string;
  errors?: string[];
};

export type SessionInfo = {
  sessionId: string;
  summary: string;
  lastModified: number;
  firstPrompt?: string;
};

export type MessageCallback = (channel: string, ...args: unknown[]) => void;

export interface StartSessionOpts {
  key: string;
  projectPath: string;
  rootPath?: string;
  initialPrompt: string;
  send: MessageCallback;
  messageChannel: string;
  progressChannel: string;
  doneChannel: string;
  isThought?: boolean;
  resumeSessionId?: string;
  systemInstructions?: string;
  setActiveProject?: (projectPath: string) => void;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly displayName: string;

  startSession(opts: StartSessionOpts): Promise<void>;
  sendFollowup(
    key: string,
    text: string,
    send: MessageCallback,
    messageChannel: string,
    progressChannel: string,
    doneChannel: string,
  ): Promise<void>;
  stopSession(key: string): void;
  listSessions(projectPath: string): Promise<SessionInfo[]>;
}

export interface ProviderAvailability {
  id: ProviderId;
  displayName: string;
  available: boolean;
  installUrl: string;
  description: string;
}
