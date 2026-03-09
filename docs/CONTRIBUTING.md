# Contributing to Night PM

Thank you for your interest in contributing to Night PM. This document explains how to get involved, what we expect from contributions, and the design philosophy that guides every decision in this project.

## Design Philosophy

Night PM is built on three principles. Every feature, PR, and design decision must align with them.

### 1. Ready

When someone opens Night PM, it should be ready to use. No multi-step wizards. No "create an account" flows. No "configure your workspace" dialogs that stand between the user and doing their work.

The first-run experience is one question: "Which AI provider do you want to use?" After that, the app is ready.

If your feature requires a setup flow, reconsider the feature. If setup is truly unavoidable, make it a single step with sensible defaults.

### 2. Simplicity

We can't do everything and that's okay. Features must be simple, concise, and self-explanatory. If a feature needs a tutorial, it's too complex.

- One screen per concept. Todos are a list. Calendar is a grid. Contacts are cards. Ideas are cards. Secrets are a list.
- No settings that users need to understand to use the app. Settings are for power users and provider configuration. Settings autosave -- no manual save button.
- No nested menus, modal chains, or multi-step processes.
- If you're adding a button, ask: "Would the user know what this does without a label?" If not, simplify.

### 3. Opinionated

Night PM is opinionated and sticks to its core principles:

**Night PM is a Brainless App.**

- We do NOT run any inference. Zero. The app is a thin UI layer on top of an AI engine (Claude, Gemini, Codex, OpenCode). Users bring their own AI CLI and their own API keys. They don't pay us for LLM usage.
- **All features are MCP tools.** Every capability (add contact, create todo, schedule event, add idea, generate standup, discover projects) is exposed as a Model Context Protocol tool. The AI engine calls these tools. The app visualizes the results.
- **All elements are files.** Projects are folders identified by `project.nipm`. Todos, calendar events, contacts, thoughts, ideas, and secrets are JSON files. Documents are Markdown. There are no proprietary databases. This is intentional: AI engines can read and write files directly without needing a custom tool for every possible file operation. AI CLIs are already good at that.
- **The user or the AI engine makes the decisions.** Night PM does not decide what to do with a thought. It sends the thought to the AI engine, the AI engine decides whether it's a contact, a task, an idea, a secret, or a note, and Night PM renders the result.

When evaluating a feature request or PR, ask:

- Does this add inference? **Reject.**
- Does this store data in a non-file format? **Reject.**
- Does this add a capability that isn't exposed as an MCP tool? **Reconsider.** Maybe it should be a tool. Maybe the AI CLI can already do it with file access.
- Does this add a step between the user and their work? **Reconsider.**

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- At least one AI CLI installed (see [README](../README.md#prerequisites))

### Development Setup

```bash
git clone https://github.com/lurose5/night-pm.git
cd night-pm
npm install
npm start
```

The app starts with hot reload via Electron Forge + Vite. Changes to renderer code update instantly. Changes to main process code require typing `rs` in the terminal or restarting.

### Running Tests

```bash
npm run lint          # Linter
npm test              # All provider integration tests (Vitest)
npm run test:gemini   # Gemini provider only
npm run test:codex    # Codex provider only
npm run test:claude   # Claude provider only
npm run test:opencode # OpenCode provider only
npm run test:watch    # Watch mode
```

### Resetting Settings

```bash
npm run reset         # Clears settings file and keychain entries
```

## How to Contribute

### Reporting Bugs

Open an issue with:

1. What you expected to happen
2. What actually happened
3. Steps to reproduce
4. Your OS, Node version, and AI provider

### Suggesting Features

Open an issue with the `feature` label. Before writing, check that your idea aligns with the design philosophy above. Include:

1. The problem you're solving
2. How it would work from the user's perspective (not implementation details)
3. Why it belongs in Night PM (vs. being handled by the AI engine)

### Submitting Code

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Run `npm run lint` and `npm test` and fix any failures.
4. Write a clear commit message explaining *why*, not *what*.
5. Open a PR with a description of the change and which issue it addresses.

### PR Guidelines

- **One concern per PR.** Don't bundle a bug fix with a new feature.
- **No unnecessary dependencies.** Night PM is lightweight. Every dependency is a maintenance burden.
- **Match existing patterns.** Look at how existing components are structured before creating new ones. We use shadcn/ui primitives, Phosphor icons, and Tailwind CSS.
- **Don't add comments that narrate code.** Comments should explain *why*, not *what*. The code should be self-explanatory.

## Architecture Overview

Night PM is an Electron app with three layers:

```
Renderer (React)  <-->  Main Process (Node.js)  <-->  AI Engine (external CLI)
       |                       |                            |
   UI views              IPC handlers                  MCP tools
   shadcn/ui             Provider adapters            File I/O
   Zustand store         Engine orchestrator
                         Keychain (API keys)
```

### Key Concepts

- **Provider**: An AI engine adapter (Claude, Gemini, Codex, OpenCode). Each implements the `AIProvider` interface in `src/main/providers/`.
- **Engine**: The orchestrator (`src/main/engine.ts`) that delegates to the active provider based on settings. Loads project context from `project.nipm` and injects it into every conversation.
- **MCP Tools**: The 28+ tools exposed via `src/main/mcp-tools.ts` (in-process for Claude) and `src/main/mcp-http.ts` (HTTP/SSE for external apps).
- **Project**: A filesystem folder identified by a `project.nipm` file. Projects can be nested.
- **Thought**: A user input that gets sent to the AI engine with the Night PM system prompt. The AI decides what to do with it.
- **Doc Chat**: An AI chat panel within the markdown editor that provides the current document as context.

### Adding a New Provider

1. Create `src/main/providers/your-provider.ts` implementing the `AIProvider` interface from `src/main/providers/types.ts`.
2. Register it in `src/main/engine.ts`.
3. Add detection logic in `src/main/detect-providers.ts`.
4. Add settings fields in `src/main/settings.ts` and `src/renderer/types.ts`.
5. Add the config UI section in `src/renderer/components/Settings/SettingsPanel.tsx`.

### Adding a New MCP Tool

1. Add the tool in `src/main/mcp-tools.ts` using the `tool()` helper from the Claude Agent SDK (for in-process use by Claude).
2. Add the same tool in `src/main/mcp-http.ts` using `server.tool()` from `@modelcontextprotocol/sdk` (for the HTTP/SSE server).
3. Both implementations should read/write the same JSON file format using the helpers in `src/main/file-io.ts`.

### Adding a New Project File Type

1. Add the type interface to `src/renderer/types.ts` (e.g., `Idea`, `Secret`).
2. Add an empty array to the scaffold in `src/main/ipc-handlers.ts`.
3. Create a view component in `src/renderer/components/YourType/`.
4. Route the file to the view in `src/renderer/components/ContentArea/ContentArea.tsx`.
5. Add MCP tools in `src/main/mcp-tools.ts`.
6. Add an icon for the file in `src/renderer/components/Sidebar/FileTree.tsx`.

### Project Structure

```
night-pm/
  src/
    main.ts                           # Electron main process
    main/
      engine.ts                       # Provider orchestrator + project context
      mcp-tools.ts                    # 28+ MCP tools (in-process)
      settings.ts                     # Persistent settings
      keychain.ts                     # OS keychain for API keys
      ipc-handlers.ts                 # Filesystem + dir watcher IPC
      providers/                      # AI provider adapters
    preload.ts                        # Context bridge
    renderer/
      components/
        Calendar/                     # CalendarView (month/week/day) + AllCalendarsView
        Ideas/                        # IdeasView (card-based)
        Secrets/                      # SecretsView (private notes)
        ProjectInfo/                  # ProjectInfoView (project.nipm editor)
        Editor/                       # MarkdownEditor + DocChatPanel
        Settings/                     # SettingsPanel (autosave)
        ...
```

## Code Style

- TypeScript, strict mode
- Tailwind CSS for styling (no inline styles except in `index.html` splash)
- shadcn/ui for all UI primitives
- Phosphor Icons (not Lucide, not Heroicons)
- `cn()` utility from `src/renderer/lib/utils.ts` for conditional classes
- Zustand for global state, local `useState` for component state
- IPC channels namespaced with `ai:`, `fs:`, `settings:`, `app:`, `window:`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
