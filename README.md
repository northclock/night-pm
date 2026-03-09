# Night PM

A brainless product management app that sits on top of AI engines.

Night PM is a lightweight, file-based productivity system for managing products, organizing todos, and capturing thoughts as they come. It runs zero inference -- all intelligence comes from whichever AI CLI you bring (Claude, Gemini, Codex, or OpenCode). Every feature is an MCP tool, every piece of data is a plain file.

## Why Night PM?

Most PM tools lock your data in proprietary databases and charge for AI features on top. Night PM takes the opposite approach:

- **No inference, no LLM costs.** Night PM is a UI and toolset. You bring your own AI engine (Claude Code, Gemini CLI, Codex, OpenCode) and your own API keys.
- **Everything is a file.** Projects are folders. Todos, calendar events, contacts, and thoughts are JSON files. Documents are Markdown. AI engines can read and write them directly.
- **All features are MCP tools.** Every action (add a contact, create a todo, schedule an event) is exposed as an MCP tool that any compatible AI CLI can call.

## Features

- **VS Code-like interface** with a file tree sidebar, tabs, and specialized views
- **Quick Thought overlay** (Shift+Cmd+Y) -- pops up over any app, captures a thought, and the AI categorizes it into contacts, todos, events, or accomplishments
- **Multi-turn AI conversations** in the thoughts overlay and the AI console
- **Calendar views** (month, week, day) with recurring event support and an all-calendars aggregated view across projects
- **Todos view** with status tracking (created / blocked / done) and date-range filtering
- **Contacts view** with relationship mapping and duplicate detection
- **Ideas board** for half-baked thoughts (card-based with tags)
- **Secrets vault** for private notes (never used in document generation)
- **Standups** -- ask the AI to generate a standup summary from recent tasks and events
- **Project identity** (`project.nipm`) -- defines project name, description, your role, and tags; injected into every AI conversation
- **Nested project discovery** -- AI can discover all projects in your directory tree and switch between them
- **Markdown editor** (TipTap) with an AI chat side panel for document editing assistance
- **Multi-provider support** -- switch between Claude, Gemini, Codex, and OpenCode from settings
- **Per-project MCP** -- each project can define its own MCP server connections
- **Settings autosave** -- all changes persist immediately, no manual save button
- **Inline file creation** -- right-click a folder to create a doc, file, folder, or project with an inline name input
- **Auto-refresh file tree** -- file explorer updates automatically when files change on disk, including renames in nested folders
- **Light and dark themes**

## Quick Start

### Prerequisites

You need at least one AI CLI installed:

| Provider | Install |
|----------|---------|
| Claude Code | `npm install -g @anthropic-ai/claude-code` or [docs](https://docs.anthropic.com/en/docs/claude-code/overview) |
| Gemini CLI | `npm install -g @google/gemini-cli` or [GitHub](https://github.com/google-gemini/gemini-cli) |
| Codex | `npm install -g @openai/codex` or [GitHub](https://github.com/openai/codex) |
| OpenCode | See [opencode.ai](https://opencode.ai) |

### Install and Run

```bash
git clone https://github.com/lurose5/night-pm.git
cd night-pm
npm install
npm start
```

On first launch, Night PM detects which AI CLIs are available and prompts you to choose a default provider.

### Create a Project

1. Click **Open** in the sidebar and select a directory, or click **+ New Project** to scaffold one.
2. You can also right-click any folder in the file tree and select **New Doc**, **New File**, **New Folder**, or **New Project**. Names are entered inline in the tree (no popup dialog).
3. A project is identified by its `project.nipm` file and contains these files:

```
my-project/
  project.nipm         # Project identity (name, description, whoAmI, tags)
  info.md              # Project context (Markdown)
  calendar.json        # Events (with recurring event support)
  todos.json           # Tasks
  contacts.json        # People
  thoughts.json        # Thought log
  ideas.json           # Half-baked ideas
  secrets.json         # Private notes (excluded from doc generation)
  docs/                # Documents (Markdown files)
```

4. Double-click a project folder or right-click it and select **Set as Active Project**.
5. Press **Shift+Cmd+Y** anywhere to open the Quick Thought overlay.

## How It Works

```
You type a thought
        |
        v
   AI Engine (Claude / Gemini / Codex / OpenCode)
        |
        v
   MCP Tools (calendar_add_event, contact_add, todo_add_task, idea_add, ...)
        |
        v
   Plain JSON files on disk
        |
        v
   Night PM renders the views
```

### Example: Capturing a new contact

1. Press Shift+Cmd+Y. Type: *"Today I met Luis Romero-Sevilla. He's the VP of AI at Orbis."*
2. The AI recognizes this is a new contact and calls `contact_add`.
3. You see Luis in the contacts view.
4. Later, type: *"Luis is also a music producer."*
5. The AI calls `contact_update` and appends the info.

### Example: Creating a task

1. Type: *"I need to talk to Luis about the visualization feature."*
2. The AI calls `todo_add_task`.
3. Later, type: *"I talked to Luis about it."*
4. The AI calls `todo_update_task` to mark it done.

### Example: Standup generation

1. Type: *"Give me a standup update."*
2. The AI calls `standup_generate` which gathers recent tasks and today's events.
3. You get a formatted standup summary.

## AI Providers

Night PM supports four AI providers. Each one has its own configuration section in Settings.

| Provider | MCP Support | Session Resume | Multi-turn |
|----------|-------------|----------------|------------|
| Claude | Native (in-process SDK server) | Yes | Yes |
| Gemini | Via CLI config (`~/.gemini/settings.json`) | Yes (`--resume`) | Yes |
| Codex | Via config | Yes (`resumeThread`) | Yes |
| OpenCode | Via config | Yes (session API) | Yes |

Switch providers from **Settings > Provider**.

## MCP Tools

Night PM exposes 28+ MCP tools for AI engines to manage project data:

### Calendar
| Tool | Description |
|------|-------------|
| `calendar_list_events` | List all events |
| `calendar_add_event` | Add an event (title, description, start, end, allDay, recurrence) |
| `calendar_update_event` | Update an event by ID (including recurrence) |
| `calendar_delete_event` | Delete an event by ID |

### Todos
| Tool | Description |
|------|-------------|
| `todo_list_tasks` | List tasks, filter by status and/or date range (startDate, endDate) |
| `todo_add_task` | Add a task (title, description, dueDate, status) |
| `todo_update_task` | Update a task by ID |
| `todo_delete_task` | Delete a task by ID |

### Contacts
| Tool | Description |
|------|-------------|
| `contact_list` | List all contacts |
| `contact_search` | Search by name (partial, case-insensitive) |
| `contact_add` | Add a contact (checks for duplicates) |
| `contact_update` | Update a contact by ID |
| `contact_delete` | Delete a contact by ID |

### Thoughts
| Tool | Description |
|------|-------------|
| `thought_list` | List all recorded thoughts |
| `thought_add` | Record a new thought |

### Project
| Tool | Description |
|------|-------------|
| `project_info` | Read project info from project.nipm and info.md |
| `project_info_update` | Update project identity (name, description, whoAmI, tags) |
| `project_list` | List all available projects (recursive tree with nested projects) |
| `project_set_active` | Set the active project by path |

### Ideas
| Tool | Description |
|------|-------------|
| `idea_list` | List all ideas |
| `idea_add` | Add a half-baked idea (title, description, tags) |
| `idea_update` | Update an idea by ID |
| `idea_delete` | Delete an idea by ID |

### Secrets
| Tool | Description |
|------|-------------|
| `secret_list` | List all secrets |
| `secret_add` | Add a private secret (never used for document generation) |

### Standups
| Tool | Description |
|------|-------------|
| `standup_generate` | Generate a standup summary from recent tasks and calendar events |

### MCP Server (HTTP/SSE)

Night PM automatically starts an MCP server on `http://127.0.0.1:7777/sse` when the app launches. Any MCP-compatible app can connect to it over SSE — no separate install or build step.

Go to **Settings > MCP Server** to see the status, port, and copy-pastable configs for Claude Desktop, Cursor, Windsurf, and others.

Example config for Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "night-pm": {
      "url": "http://127.0.0.1:7777/sse"
    }
  }
}
```

If port 7777 is in use, the server picks the next available port. Check Settings for the actual URL.

## Project Identity (`project.nipm`)

Each project has a `project.nipm` file (JSON with custom extension) that identifies it:

```json
{
  "name": "Product A",
  "description": "Mobile app for retail",
  "whoAmI": "Senior PM leading the mobile team",
  "created": "2026-03-07T...",
  "tags": ["product", "mobile"]
}
```

The `whoAmI` field tells the AI who you are in the context of this project, so it can tailor its responses. This context is automatically injected into every AI conversation (thoughts, console, document chat).

## Project Instructions

Each project can include instructions that get prepended to the AI's system prompt:

```
my-project/.nightpm/
  AGENT.md       # Shared instructions (all providers)
  CLAUDE.md      # Claude-specific override
  GEMINI.md      # Gemini-specific override
  CODEX.md       # Codex-specific override
  OPENCODE.md    # OpenCode-specific override
```

The shared `AGENT.md` is loaded first, then the provider-specific file (if it exists) is appended. Edit these from **Settings > Project Instructions**.

## Testing

Night PM includes integration tests for every AI provider using [Vitest](https://vitest.dev/).

```bash
npm test              # Run all tests
npm run test:gemini   # Gemini only
npm run test:codex    # Codex only
npm run test:claude   # Claude only
npm run test:opencode # OpenCode only
npm run test:watch    # Watch mode
```

Create a `.env` file at the project root with your API keys:

```
GEMINI_API_KEY=your-key
OPENAI_API_KEY=your-key
# For Claude with Vertex AI:
export CLAUDE_CODE_USE_VERTEX=1
export CLOUD_ML_REGION=global
export ANTHROPIC_VERTEX_PROJECT_ID=your-project
# Or for Claude with API key:
# ANTHROPIC_API_KEY=your-key
```

## Project Structure

```
night-pm/
  src/
    main.ts                           # Electron main process
    main/
      engine.ts                       # Provider orchestrator + project context loader
      detect-providers.ts             # CLI availability detection
      settings.ts                     # Persistent settings (non-secret)
      keychain.ts                     # OS keychain for API keys
      mcp-tools.ts                    # In-process MCP tools (28+ tools, Claude SDK)
      mcp-http.ts                     # HTTP/SSE MCP server (localhost)
      file-io.ts                      # JSON/text file helpers
      providers/
        types.ts                      # AIProvider interface
        claude.ts                     # Claude Code adapter
        gemini.ts                     # Gemini CLI adapter
        codex.ts                      # Codex adapter
        opencode.ts                   # OpenCode adapter
      windows.ts                      # Window management
      shortcuts.ts                    # Global hotkeys
      ipc-handlers.ts                 # Filesystem + dir watcher IPC
    preload.ts                        # Context bridge
    renderer/
      App.tsx                         # Root component
      store.ts                        # Zustand state
      types.ts                        # Shared types
      hooks/
        useTheme.ts                   # Theme persistence
        useFileWatcher.ts             # File change watcher
      components/
        Layout/                       # App shell, title bar
        Sidebar/                      # File tree, project browser
        TabBar/                       # Open file tabs
        ContentArea/                  # File type routing
        Editor/                       # TipTap markdown editor + DocChatPanel
        Calendar/                     # Calendar views (month/week/day) + AllCalendarsView
        Todos/                        # Todo list view
        Contacts/                     # Contacts view
        Thoughts/                     # Thought overlay + list
        Ideas/                        # Ideas board view
        Secrets/                      # Secrets vault view
        ProjectInfo/                  # Project identity editor
        AIConsole/                    # Direct AI console
        Settings/                     # Settings panel (autosave)
        ProviderSetup/                # First-run provider picker
        ui/                           # shadcn/ui primitives
    test/
      setup.ts                        # Env loader
      harness.ts                      # Message capture utilities
      __mocks__/electron.ts           # Electron stubs
      claude.test.ts                  # Claude provider tests
      gemini.test.ts                  # Gemini provider tests
      codex.test.ts                   # Codex provider tests
      opencode.test.ts                # OpenCode provider tests
```

## Tech Stack

- **Runtime**: Electron + Vite + Electron Forge
- **UI**: React 19, Tailwind CSS 4, shadcn/ui, Allotment (split panes), TipTap (rich text)
- **State**: Zustand
- **AI SDKs**: `@anthropic-ai/claude-agent-sdk`, `@openai/codex-sdk`, `@opencode-ai/sdk`
- **MCP**: `@modelcontextprotocol/sdk` (HTTP/SSE server), Claude SDK's `createSdkMcpServer` (in-process)
- **Security**: `keytar` (OS keychain for API keys)
- **Testing**: Vitest (provider integration tests)
- **Icons**: Phosphor Icons

## Contributing

We welcome contributions. Please read [CONTRIBUTING.md](docs/CONTRIBUTING.md) before submitting a PR.

## License

[MIT](LICENSE)
