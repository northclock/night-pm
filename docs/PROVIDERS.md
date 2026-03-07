# AI Provider Configuration

Night PM supports four AI providers. This document covers how to set up and configure each one.

## Choosing a Provider

On first launch, Night PM detects which AI CLIs are installed and shows a provider selection dialog. You can change your provider at any time in **Settings > Provider**.

Each provider has its own configuration section with independent API keys, models, and options. Switching providers doesn't lose your configuration -- it's all saved per-provider.

## Claude (Anthropic)

**Best for**: Full MCP integration, tool use, multi-turn conversations with project context.

### Prerequisites

Claude Code CLI must be accessible. The Claude Agent SDK is bundled with Night PM, but it spawns the Claude Code executable internally.

Install Claude Code: [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/overview)

### Authentication

Two modes:

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

- Claude Opus 4.6 / 4
- Claude Sonnet 4.6 / 4.5 / 4 / 3.7 / 3.5
- Claude Haiku 4 / 3.5

### MCP Integration

Claude uses an in-process MCP server via the SDK's `createSdkMcpServer()`. Night PM's 16 tools are available automatically. No external configuration needed.

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
2. Enter your Gemini API key

The key is passed as `GEMINI_API_KEY` environment variable when spawning the CLI.

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Model | Gemini model to use | CLI default |

### Available Models

- Gemini 2.5 Pro
- Gemini 2.5 Flash
- Gemini 2.0 Flash

### How It Works

Night PM spawns `gemini --output-format json --yolo -p <prompt>` as a subprocess. The CLI outputs a single pretty-printed JSON object on stdout with `{ session_id, response, stats }`. Night PM accumulates all stdout, parses it as one JSON blob on process exit, and extracts the `response` field as the text reply. Session IDs are captured for `--resume` on follow-ups.

### MCP Integration

Gemini CLI supports MCP via its config file (`~/.gemini/settings.json`). Night PM does not inject MCP automatically for Gemini -- you need to configure it manually. See [MCP Tools > Gemini CLI](MCP_TOOLS.md#gemini-cli) for setup instructions.

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
2. Enter your OpenAI API key

The key is passed as `OPENAI_API_KEY` / `CODEX_API_KEY` environment variable.

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Model | Model identifier (text input) | CLI default |

### How It Works

Night PM uses `@openai/codex-sdk` to start a thread and stream events via `thread.runStreamed(prompt)`. The SDK emits events like `thread.started`, `turn.started`, `item.completed`, and `turn.completed`. Text responses arrive as `item.completed` events with `item.type === 'agent_message'` and the reply in `item.text`. Tool calls arrive as `item.type === 'function_call'`. The `skipGitRepoCheck: true` option is set so Codex works in non-Git project folders.

### MCP Integration

Codex supports MCP via its config file. Night PM can inject the night-pm MCP server automatically for providers that support it. See [MCP Tools > Codex](MCP_TOOLS.md#codex) for manual setup.

## OpenCode

**Best for**: Users who want multi-provider flexibility within a single CLI, or prefer OpenCode's session management.

### Prerequisites

Install OpenCode from [opencode.ai](https://opencode.ai).

Verify: `opencode --version`

### Authentication

1. Go to Settings > Provider > OpenCode
2. Select the underlying provider (Anthropic, OpenAI, Google)
3. Enter the corresponding API key

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Provider | Which LLM provider OpenCode uses | Anthropic |
| Model | Model identifier (text input) | Provider default |

### MCP Integration

OpenCode supports MCP via its config file (`opencode.json`). See [MCP Tools > OpenCode](MCP_TOOLS.md#opencode) for setup instructions.

## Provider Detection

On startup, Night PM checks for each CLI:

| Provider | Detection Method |
|----------|-----------------|
| Claude | Checks for `cli.js` in `node_modules/@anthropic-ai/claude-agent-sdk/` |
| Gemini | Runs `which gemini` |
| Codex | Runs `which codex` |
| OpenCode | Runs `which opencode` |

If the selected provider is not available, Night PM shows the provider selection dialog again.
