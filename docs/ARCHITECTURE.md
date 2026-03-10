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
|  ContactsView         |         |  keychain.ts         |
|  IdeasView            |         |  ipc-handlers.ts     |
|  SecretsView          |         |                      |
|  ProjectInfoView      |         |                      |
|  DocChatPanel         |         |                      |
|  AllCalendarsView     |         |                      |
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

A folder is a project if and only if it contains a `project.nipm` file.

```
my-project/
  project.nipm          # Project identity (JSON)
  info.md               # Project description, Markdown
  calendar.json         # Array of CalendarEvent objects
  todos.json            # Array of Todo objects
  contacts.json         # Array of Contact objects
  thoughts.json         # Array of Thought objects
  ideas.json            # Array of Idea objects
  secrets.json          # Array of Secret objects (private)
  docs/                 # Markdown documents
    meeting-notes.md
    design-spec.md
  .nightpm/             # Night PM config (optional)
    AGENT.md            # Shared AI instructions
    CLAUDE.md           # Claude-specific instructions
    GEMINI.md           # Gemini-specific instructions
    mcp.json            # Additional MCP servers
    agents.json         # Custom agent definitions
```

### Data Schemas

**ProjectInfo (project.nipm)**
```json
{ "name": "string", "description": "string", "whoAmI": "string", "created": "ISO8601", "tags": ["string"] }
```

**CalendarEvent**
```json
{ "id": "uuid", "title": "string", "description": "string", "start": "ISO8601", "end": "ISO8601", "allDay": false, "createdOn": "ISO8601", "recurrence": { "frequency": "daily|weekly|monthly|yearly", "interval": 1, "endDate": "ISO8601" } }
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

**Idea**
```json
{ "id": "uuid", "title": "string", "description": "string", "createdOn": "ISO8601", "tags": ["string"] }
```

**Secret**
```json
{ "id": "uuid", "text": "string", "createdOn": "ISO8601" }
```

## Project Identity and Context

The `project.nipm` file serves as the project identifier. When a project is active, `engine.ts` reads this file and prepends the project context (name, description, whoAmI, tags) to every AI conversation's system prompt -- thoughts, console, and document chat sessions alike.

This means the AI always knows which project it's working on and what role the user plays.

### Nested Project Discovery

Projects can be nested arbitrarily (e.g., "Company" containing "Product A" and "Product B"). The `project_list` MCP tool recursively scans from the root directory and returns a tree structure of all projects. Non-project folders are traversed but not included as nodes.

## Provider System

The provider system is the core abstraction that lets Night PM work with multiple AI engines.

### Interface

Every provider implements `AIProvider` from `src/main/providers/types.ts`:

```typescript
interface AIProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  startSession(opts: StartSessionOpts): Promise<void>;
  sendFollowup(key, text, send, ...channels): Promise<void>;
  stopSession(key: string): void;
  listSessions(projectPath: string): Promise<SessionInfo[]>;
}
```

### Engine

`src/main/engine.ts` is the orchestrator. It:

1. Initializes all four providers with their async config getters.
2. Reads `settings.provider` to determine which one is active.
3. Loads project context from `project.nipm` and project instructions (AGENT.md + provider override).
4. Optionally appends document context for doc-chat sessions.
5. Delegates `startConversation`, `sendFollowup`, `stopConversation`, and `listSessions` to the active provider.

### Message Flow

```
User types thought
       |
       v
ThoughtsOverlay calls window.nightAPI.ai.thought(text)
       |
       v
preload.ts -> ipcRenderer.invoke('ai:thought', text)
       |
       v
main.ts IPC handler -> engine.startConversation(...)
       |
       v
engine.ts -> loadProjectContext + loadInstructions -> activeProvider.startSession(opts)
       |
       v
Provider adapter (e.g. claude.ts) -> spawns AI process, sends prompt
       |
       v
AI process streams responses back
       |
       v
Provider adapter -> sends to renderer via IPC channels (ai:message, ai:progress, ai:done)
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

## Calendar System

The calendar supports three view modes:

- **Month view**: Traditional grid with events overlaid on days.
- **Week view**: 7-column hourly grid with events positioned by time.
- **Day view**: Single-column hourly grid.

### Recurring Events

Events can have a `recurrence` field with `frequency` (daily/weekly/monthly/yearly), optional `interval` (every N units), and optional `endDate`. Recurring events are expanded into virtual instances at render time within the visible date range. The base event is stored once; instances are generated on the fly.

### All-Calendars View

Accessible from the sidebar calendar icon. Scans all project directories under `rootPath` for `calendar.json` files, merges events, and prefixes titles with the project name.

## Document Editor AI Chat

The TipTap markdown editor includes a toggleable AI chat side panel (`DocChatPanel`). This panel reuses the thought system -- when the user sends a message, it calls the same `ai:thought` IPC with the file path as context. The AI engine reads the file directly using its file access tools rather than having the content injected into the system prompt.

Each document chat uses the conversation key `doc:<filePath>` so documents have independent chat histories. Messages are routed to the sender window (`event.sender`), so the ThoughtsOverlay (in its own window) and DocChatPanel (in the main window) never cross-talk. Document chat messages are also logged to `thoughts.json` (prefixed with the filename) for a unified thought history.

## File Explorer

### Context Menu and Inline Creation

Right-clicking a folder shows a context menu with **New Doc**, **New File**, **New Folder**, and **New Project**. Selecting any of these expands the folder and inserts an inline text input at the top of its children. The user types a name and presses Enter to create, or Escape to cancel. "New Doc" automatically appends `.md` and seeds the file with a `# Title` heading. Renaming also uses an inline input.

### Auto-Refresh

The sidebar registers a recursive directory watcher on the root path via `fs.watch(dirPath, { recursive: true })`. When files are created, deleted, or renamed, the watcher fires a debounced (500ms) `fs:dirChanged` event. The sidebar listens for this event and refreshes the file tree automatically.

Each expanded `FileTreeItem` wraps the parent's `onRefresh` callback so that it re-reads its own children before propagating the refresh upward. This ensures renames, deletions, and creations inside nested folders are immediately reflected without collapsing the tree.

## IPC Channels

All AI channels use the `ai:` prefix. Filesystem uses `fs:`. Settings use `settings:`.

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `ai:thought` | Renderer -> Main | Send a thought (optional filePath for doc chat) |
| `ai:thought-followup` | Renderer -> Main | Follow up in conversation (optional filePath) |
| `ai:abort` | Renderer -> Main | Cancel conversation (optional filePath for doc chat key) |
| `ai:console-run` | Renderer -> Main | Run console prompt |
| `ai:console-followup` | Renderer -> Main | Follow up in console |
| `ai:console-abort` | Renderer -> Main | Cancel console |
| `ai:message` | Main -> Renderer | Stream AI message (thoughts + doc chat) |
| `ai:progress` | Main -> Renderer | Tool progress (thoughts + doc chat) |
| `ai:done` | Main -> Renderer | Turn complete with result |
| `ai:console-message` | Main -> Renderer | Stream AI message (console) |
| `ai:console-done` | Main -> Renderer | Console turn complete |
| `ai:detect-providers` | Renderer -> Main | Check CLI availability |
| `ai:sessions-list` | Renderer -> Main | List past sessions |
| `ai:session-resume` | Renderer -> Main | Resume a session |
| `fs:watchDir` | Renderer -> Main | Start recursive dir watcher |
| `fs:unwatchDir` | Renderer -> Main | Stop recursive dir watcher |
| `fs:dirChanged` | Main -> Renderer | Directory contents changed |

## MCP Integration

Night PM exposes its features as MCP tools in two ways:

1. **In-process** (Claude only): `src/main/mcp-tools.ts` uses `createSdkMcpServer()` from the Claude Agent SDK to create an in-process MCP server that gets passed directly to `query()`. The server accepts `projectPath`, optional `rootPath` (for project scanning), and optional `setActiveProject` callback.

2. **HTTP/SSE server**: `src/main/mcp-http.ts` starts an HTTP server on localhost (default port 7777) when the app launches. It uses the standard `@modelcontextprotocol/sdk` SSE transport, so any MCP-compatible app (Claude Desktop, Cursor, Windsurf, Gemini CLI, etc.) can connect via the SSE endpoint. The server dynamically resolves the current active project path, so tool calls always operate on the project selected in Night PM. Connection configs are available in **Settings > MCP Server**.

## Settings and Autosave

Settings are stored in `<userData>/night-pm-settings.json`. API keys are encrypted on disk via Electron's `safeStorage` API (uses macOS Keychain, Windows DPAPI, or libsecret on Linux under the hood).

The SettingsPanel uses immediate autosave: every change to a setting immediately calls `window.nightAPI.settings.set()`. For AGENT.md and provider override `.md` files, writes happen on `onBlur` (when the textarea loses focus) since these are larger payloads hitting the filesystem.

A subtle "Auto-saved" indicator flashes in the header to confirm persistence.

## Window Management

- **Main window**: `titleBarStyle: 'hiddenInset'` with native macOS traffic lights. Title bar hidden in fullscreen.
- **Thoughts window**: Frameless, transparent, always-on-top overlay. Created once and shown/hidden via IPC. Activated by the global shortcut Shift+Cmd+Y.

## Testing

Provider integration tests live in `src/test/` and use [Vitest](https://vitest.dev/).

Each test creates a provider instance with real API keys from `.env`, sends a prompt through `startSession()`, and captures every `AIMessage` emitted via the `MessageCallback`.

Run with `npm test` or target a single provider with `npm run test:gemini`, etc.
