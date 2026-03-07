# Architecture

This document describes the technical architecture of Night PM for contributors who want to understand how the pieces fit together.

## Overview

Night PM is an Electron app with three processes:

1. **Main Process** (Node.js) -- manages windows, IPC, settings, AI provider connections, and MCP tools.
2. **Renderer Process** (React) -- the UI. Communicates with the main process exclusively through IPC via the preload bridge.
3. **AI Engine** (external) -- an AI CLI (Claude Code, Gemini CLI, Codex, or OpenCode) that Night PM spawns or connects to as a subprocess.

```
+-----------------------+         +----------------------+
|   Renderer (React)    |  IPC    |    Main Process      |
|                       |<------->|                      |
|  Sidebar / FileTree   |         |  engine.ts           |
|  TabBar / ContentArea |         |  providers/claude.ts  |
|  ThoughtsOverlay      |         |  providers/gemini.ts  |
|  AIConsole            |         |  providers/codex.ts   |
|  SettingsPanel        |         |  providers/opencode.ts|
|  CalendarView         |         |  mcp-tools.ts        |
|  TodosView            |         |  settings.ts         |
|  ContactsView         |         |  ipc-handlers.ts     |
+-----------------------+         +----------+-----------+
                                             |
                                    spawns / connects
                                             |
                                  +----------v-----------+
                                  |   AI Engine (CLI)     |
                                  |   Claude / Gemini /   |
                                  |   Codex / OpenCode    |
                                  +-----------------------+
```

## Data Model

All data is stored as plain files in the project directory. There is no database.

### Project Structure

```
my-project/
  info.md              # Project description, Markdown
  calendar.json        # Array of CalendarEvent objects
  todos.json           # Array of Todo objects
  contacts.json        # Array of Contact objects
  thoughts.json        # Array of Thought objects
  docs/                # Markdown documents
    meeting-notes.md
    design-spec.md
  .nightpm/            # Night PM config (optional)
    AGENT.md           # Shared AI instructions
    CLAUDE.md          # Claude-specific instructions
    GEMINI.md          # Gemini-specific instructions
    mcp.json           # Additional MCP servers
    agents.json        # Custom agent definitions
```

### Data Schemas

**CalendarEvent**
```json
{ "id": "uuid", "title": "string", "description": "string", "start": "ISO8601", "end": "ISO8601", "allDay": false, "createdOn": "ISO8601" }
```

**Todo**
```json
{ "id": "uuid", "title": "string", "description": "string", "dueDate": "ISO8601", "createdOn": "ISO8601", "updatedOn": "ISO8601", "status": "created|blocked|done" }
```

**Contact**
```json
{ "id": "uuid", "name": "string", "title": "string", "info": "string", "relatedContacts": [{ "relatedContactId": "uuid", "relationship": "string" }] }
```

**Thought**
```json
{ "thought": "string", "actionsTriggered": ["string"], "createdOn": "ISO8601" }
```

## Provider System

The provider system is the core abstraction that lets Night PM work with multiple AI engines.

### Interface

Every provider implements `AIProvider` from `src/main/providers/types.ts`:

```typescript
interface AIProvider {
  readonly id: ProviderId;        // 'claude' | 'gemini' | 'codex' | 'opencode'
  readonly displayName: string;
  startSession(opts: StartSessionOpts): Promise<void>;
  sendFollowup(key, text, send, ...channels): Promise<void>;
  stopSession(key: string): void;
  listSessions(projectPath: string): Promise<SessionInfo[]>;
}
```

### Engine

`src/main/engine.ts` is the orchestrator. It:

1. Initializes all four providers with their config getters.
2. Reads `settings.provider` to determine which one is active.
3. Loads project instructions (AGENT.md + provider override).
4. Delegates `startConversation`, `sendFollowup`, `stopConversation`, and `listSessions` to the active provider.

### Message Flow

```
User types thought
       |
       v
ThoughtsOverlay calls window.nightAPI.ai.thought(text)
       |
       v
preload.ts → ipcRenderer.invoke('ai:thought', text)
       |
       v
main.ts IPC handler → engine.startConversation(...)
       |
       v
engine.ts → activeProvider.startSession(opts)
       |
       v
Provider adapter (e.g. claude.ts) → spawns AI process, sends prompt
       |
       v
AI process streams responses back
       |
       v
Provider adapter → sends to renderer via IPC channels (ai:message, ai:progress, ai:done)
       |
       v
ThoughtsOverlay receives messages and renders them
```

### Normalized Message Types

All providers emit the same message types to the renderer:

| Type | Description |
|------|-------------|
| `text` | Assistant text response |
| `tool_use` | AI is calling a tool (name + input) |
| `tool_result` | Tool execution result |
| `tool_progress` | Tool is still running (elapsed time) |
| `thinking` | AI reasoning (if supported) |
| `error` | Error message |
| `system` | System info (model, tools, MCP servers) |

## IPC Channels

All AI channels use the `ai:` prefix. Filesystem uses `fs:`. Settings use `settings:`.

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `ai:thought` | Renderer -> Main | Send a thought |
| `ai:thought-followup` | Renderer -> Main | Follow up in conversation |
| `ai:abort` | Renderer -> Main | Cancel thought conversation |
| `ai:console-run` | Renderer -> Main | Run console prompt |
| `ai:console-followup` | Renderer -> Main | Follow up in console |
| `ai:console-abort` | Renderer -> Main | Cancel console |
| `ai:message` | Main -> Renderer | Stream AI message (thoughts) |
| `ai:progress` | Main -> Renderer | Tool progress (thoughts) |
| `ai:done` | Main -> Renderer | Turn complete with result |
| `ai:console-message` | Main -> Renderer | Stream AI message (console) |
| `ai:console-progress` | Main -> Renderer | Tool progress (console) |
| `ai:console-done` | Main -> Renderer | Console turn complete |
| `ai:detect-providers` | Renderer -> Main | Check CLI availability |
| `ai:sessions-list` | Renderer -> Main | List past sessions |
| `ai:session-resume` | Renderer -> Main | Resume a session |

## MCP Integration

Night PM exposes its features as MCP tools in two ways:

1. **In-process** (Claude only): `src/main/mcp-tools.ts` uses `createSdkMcpServer()` from the Claude Agent SDK to create an in-process MCP server that gets passed directly to `query()`.

2. **Standalone server**: `mcp-server/` is a separate Node.js package that runs as a stdio MCP server. Any AI CLI can connect to it via config.

Both implementations share the same tool names, schemas, and file I/O logic. The in-process version imports from `src/main/file-io.ts`; the standalone version has its own copy in `mcp-server/src/utils/file-io.ts`.

## Window Management

- **Main window**: `titleBarStyle: 'hiddenInset'` with native macOS traffic lights. Title bar hidden in fullscreen.
- **Thoughts window**: Frameless, transparent, always-on-top overlay. Created once and shown/hidden via IPC. Activated by the global shortcut Shift+Cmd+Y.

## Settings

Settings are stored in `<userData>/night-pm-settings.json` (e.g. `~/Library/Application Support/night-pm/`).

The structure has per-provider config sub-objects (`claude`, `gemini`, `codex`, `opencode`) plus shared fields (`maxTurns`, `skills`, `lastProjectPath`, `selectedProjectPath`, `theme`).

The `theme` field (`'light' | 'dark'`) is synced bidirectionally: the renderer stores it in `localStorage` for instant no-flash loading, and persists it to the settings file as a backup. If `localStorage` is empty on startup, the saved setting seeds it.

Settings are loaded once and cached in memory. Saving writes to disk and updates the cache.

## Testing

Provider integration tests live in `src/test/` and use [Vitest](https://vitest.dev/).

```
src/test/
  setup.ts             # Loads .env (handles export prefixes)
  harness.ts           # Shared capture utilities and test helpers
  __mocks__/
    electron.ts        # Stubs for electron module (app, ipcMain)
  claude.test.ts       # Claude provider tests
  gemini.test.ts       # Gemini provider tests
  codex.test.ts        # Codex provider tests
  opencode.test.ts     # OpenCode provider tests
```

Each test creates a provider instance with real API keys from `.env`, sends a prompt through `startSession()`, and captures every `AIMessage` emitted via the `MessageCallback`. The tests verify:

- Messages flow through the callback (not silently dropped)
- Text responses are present and correctly typed
- The result summary (`AIResult`) is emitted on the done channel
- Multi-turn follow-ups retain conversation context

The `electron` module is aliased to a mock so that provider code importing `app.getAppPath()` works outside of Electron.

Run with `npm test` or target a single provider with `npm run test:gemini`, etc.
