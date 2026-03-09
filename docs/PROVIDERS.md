# AI Provider Configuration

Night PM supports four AI providers. This document covers how to set up and configure each one.

## Choosing a Provider

On first launch, Night PM detects which AI CLIs are installed and shows a provider selection dialog. You can change your provider at any time in **Settings > Provider**.

Each provider has its own configuration section with independent API keys, models, and options. Switching providers doesn't lose your configuration -- it's all saved per-provider.

## Authentication Modes

All providers support an "auto" mode where Night PM uses whatever authentication your CLI already has configured. You only need to set API keys in Night PM settings if you want to override the CLI's default authentication.

## Claude (Anthropic)

**Best for**: Full MCP integration, tool use, multi-turn conversations with project context.

### Prerequisites

Claude Code CLI must be accessible. The Claude Agent SDK is bundled with Night PM, but it spawns the Claude Code executable internally.

Install Claude Code: [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/overview)

### Authentication

Three modes:

**Auto** (default):
Uses whatever authentication your Claude CLI already has configured. No additional setup needed if your CLI is authenticated.

**API Key**:
1. Go to Settings > Provider > Claude
2. Set Auth Mode to "API Key"
3. Enter your Anthropic API key

**Vertex AI**:
1. Set Auth Mode to "Vertex AI"
2. Enter your GCP Project ID
3. Set Region (default: `global`)
4. Ensure you have ADC configured (`gcloud auth application-default login`)

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Model | Claude model to use | CLI default |
| Permission Mode | How tool calls are approved | Bypass (auto-approve) |
| Effort | How much reasoning effort | High |

### Available Models

- Claude Opus 4.6 / 4.5 / 4
- Claude Sonnet 4.6 / 4.5 / 4
- Claude Haiku 4.5

### MCP Integration

Claude uses an in-process MCP server via the SDK's `createSdkMcpServer()`. All 28+ Night PM tools are available automatically. No external configuration needed.

The MCP server receives the active project path and root path, enabling tools like `project_list` and `project_set_active` to work.

Additional project-specific MCP servers can be defined in `.nightpm/mcp.json`.

## Gemini (Google)

**Best for**: Users on Google Cloud or who prefer Gemini models.

### Prerequisites

Install the Gemini CLI:

```bash
npm install -g @google/gemini-cli
```

Verify: `gemini --version`

### Authentication

1. Go to Settings > Provider > Gemini
2. Enter your Gemini API key (optional if CLI is already authenticated)

The key is passed as `GEMINI_API_KEY` environment variable when spawning the CLI.

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Model | Gemini model to use | gemini-2.5-pro |

### Available Models

- Gemini 3.1 Pro (Preview)
- Gemini 3 Flash (Preview)
- Gemini 3.1 Flash Lite (Preview)
- Gemini 2.5 Pro
- Gemini 2.5 Flash

### MCP Integration

Gemini CLI supports MCP via SSE. Night PM runs an MCP server on `http://127.0.0.1:7777/sse` automatically. Add it to `~/.gemini/settings.json` — see [MCP Tools > Gemini CLI](MCP_TOOLS.md#gemini-cli) for the config.

## Codex (OpenAI)

**Best for**: Users who prefer OpenAI models or need Codex's code-focused capabilities.

### Prerequisites

Install Codex:

```bash
npm install -g @openai/codex
```

Verify: `codex --version`

### Authentication

1. Go to Settings > Provider > Codex
2. Enter your OpenAI API key (optional if CLI is already authenticated)

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Model | Model to use | CLI default |

### Available Models

- GPT-5.4 / GPT-5.3 Codex
- o3-pro / o3 / o4-mini (reasoning)

### MCP Integration

Codex supports MCP via SSE. Night PM runs an MCP server on `http://127.0.0.1:7777/sse` automatically. See [MCP Tools](MCP_TOOLS.md#using-with-external-apps) for config examples.

## OpenCode

**Best for**: Users who want multi-provider flexibility within a single CLI.

### Prerequisites

Install OpenCode from [opencode.ai](https://opencode.ai).

Verify: `opencode --version`

### Authentication

1. Go to Settings > Provider > OpenCode
2. Select the underlying provider (Anthropic, OpenAI, Google)
3. Enter the corresponding API key (optional if CLI is already authenticated)

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Provider | Which LLM provider OpenCode uses | Anthropic |
| Model | Model identifier (text input) | Provider default |

### MCP Integration

OpenCode supports MCP via SSE. Night PM runs an MCP server on `http://127.0.0.1:7777/sse` automatically. See [MCP Tools](MCP_TOOLS.md#using-with-external-apps) for config examples.

## Provider Detection

On startup, Night PM checks for each CLI:

| Provider | Detection Method |
|----------|-----------------|
| Claude | Checks for `cli.js` in `node_modules/@anthropic-ai/claude-agent-sdk/` |
| Gemini | Runs `which gemini` |
| Codex | Runs `which codex` |
| OpenCode | Runs `which opencode` |

If the selected provider is not available, Night PM shows the provider selection dialog again.

## MCP Tools Reference

Night PM exposes 28+ MCP tools across these categories:

### Calendar Tools
- `calendar_list_events` -- List all events
- `calendar_add_event` -- Add event (with optional recurrence: frequency, interval, endDate)
- `calendar_update_event` -- Update event by ID (including recurrence)
- `calendar_delete_event` -- Delete event by ID

### Todo Tools
- `todo_list_tasks` -- List tasks (optional filters: status, startDate, endDate)
- `todo_add_task` -- Add task
- `todo_update_task` -- Update task by ID
- `todo_delete_task` -- Delete task by ID

### Contact Tools
- `contact_list` -- List all contacts
- `contact_search` -- Search by name
- `contact_add` -- Add contact (duplicate check)
- `contact_update` -- Update contact by ID
- `contact_delete` -- Delete contact by ID

### Thought Tools
- `thought_list` -- List all thoughts
- `thought_add` -- Record a thought

### Project Tools
- `project_info` -- Read project.nipm and info.md
- `project_info_update` -- Update project.nipm (name, description, whoAmI, tags)
- `project_list` -- Recursive project tree discovery
- `project_set_active` -- Switch active project

### Idea Tools
- `idea_list` -- List all ideas
- `idea_add` -- Add idea (title, description, tags)
- `idea_update` -- Update idea by ID
- `idea_delete` -- Delete idea by ID

### Secret Tools
- `secret_list` -- List secrets
- `secret_add` -- Add secret (private, excluded from doc generation)

### Standup Tools
- `standup_generate` -- Generate standup from recent tasks and events
