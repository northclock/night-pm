export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface FileStat {
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  mtime: number;
  ctime: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
  createdOn: string;
}

export interface Todo {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  createdOn: string;
  updatedOn: string;
  status: 'created' | 'blocked' | 'done';
}

export interface RelatedContact {
  relatedContactId: string;
  relationship: string;
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  info: string;
  relatedContacts: RelatedContact[];
}

export interface Thought {
  thought: string;
  actionsTriggered: string[];
  createdOn: string;
}

export interface OpenFile {
  path: string;
  name: string;
  content?: string;
}

export type ProviderId = 'claude' | 'gemini' | 'codex' | 'opencode';

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

/** @deprecated Use AIMessage */
export type ClaudeMessage = AIMessage;
/** @deprecated Use AIResult */
export type ClaudeResult = AIResult;

export type SessionInfo = {
  sessionId: string;
  summary: string;
  lastModified: number;
  firstPrompt?: string;
};

export interface ProviderAvailability {
  id: ProviderId;
  displayName: string;
  available: boolean;
  installUrl: string;
  description: string;
}

export interface NightAPI {
  app: {
    setActiveProject: (projectPath: string) => Promise<void>;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    onFullscreenChanged: (callback: (isFullscreen: boolean) => void) => () => void;
  };
  settings: {
    get: () => Promise<AppSettings>;
    set: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  };
  ai: {
    thought: (text: string) => Promise<void>;
    thoughtFollowup: (text: string) => Promise<void>;
    abort: () => Promise<void>;
    consoleRun: (command: string) => Promise<void>;
    consoleFollowup: (text: string) => Promise<void>;
    consoleAbort: () => Promise<void>;
    listSessions: () => Promise<SessionInfo[]>;
    resumeSession: (sessionId: string) => Promise<void>;
    hide: () => Promise<void>;
    detectProviders: () => Promise<ProviderAvailability[]>;
    getActiveProvider: () => Promise<ProviderId>;
    onMessage: (cb: (msg: AIMessage) => void) => () => void;
    onProgress: (cb: (msg: AIMessage) => void) => () => void;
    onDone: (cb: (result: AIResult) => void) => () => void;
    onConsoleMessage: (cb: (msg: AIMessage) => void) => () => void;
    onConsoleProgress: (cb: (msg: AIMessage) => void) => () => void;
    onConsoleDone: (cb: (result: AIResult) => void) => () => void;
  };
  fs: {
    readDir: (dirPath: string) => Promise<DirEntry[]>;
    readFile: (filePath: string) => Promise<string>;
    writeFile: (filePath: string, content: string) => Promise<void>;
    createFile: (filePath: string, content: string) => Promise<void>;
    createDir: (dirPath: string) => Promise<void>;
    deleteFile: (filePath: string) => Promise<void>;
    deleteDir: (dirPath: string) => Promise<void>;
    rename: (oldPath: string, newPath: string) => Promise<void>;
    stat: (filePath: string) => Promise<FileStat>;
    exists: (filePath: string) => Promise<boolean>;
    watch: (filePath: string) => Promise<void>;
    unwatch: (filePath: string) => Promise<void>;
    onFileChanged: (callback: (filePath: string, content: string) => void) => () => void;
  };
  dialog: {
    openDirectory: () => Promise<string | null>;
  };
  project: {
    scaffold: (parentPath: string, name: string) => Promise<string>;
  };
}

declare global {
  interface Window {
    nightAPI: NightAPI;
  }
}
