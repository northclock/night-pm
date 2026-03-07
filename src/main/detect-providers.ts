import { execFile } from 'node:child_process';
import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProviderAvailability } from './providers/types';

function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const shell = process.platform === 'win32' ? 'where' : 'which';
    execFile(shell, [cmd], (err) => resolve(!err));
  });
}

function claudeCliExists(): boolean {
  const candidates = [
    path.join(app.getAppPath(), 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js'),
    path.join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js'),
  ];
  return candidates.some((p) => fs.existsSync(p));
}

export async function detectProviders(): Promise<ProviderAvailability[]> {
  const [geminiAvailable, codexAvailable, opencodeAvailable] = await Promise.all([
    commandExists('gemini'),
    commandExists('codex'),
    commandExists('opencode'),
  ]);

  return [
    {
      id: 'claude',
      displayName: 'Claude',
      available: claudeCliExists(),
      installUrl: 'https://docs.anthropic.com/en/docs/claude-code/overview',
      description: 'Anthropic Claude Code with full MCP support, tool use, and multi-turn conversations.',
    },
    {
      id: 'gemini',
      displayName: 'Gemini',
      available: geminiAvailable,
      installUrl: 'https://github.com/google-gemini/gemini-cli',
      description: 'Google Gemini CLI with streaming responses and tool support.',
    },
    {
      id: 'codex',
      displayName: 'Codex',
      available: codexAvailable,
      installUrl: 'https://github.com/openai/codex',
      description: 'OpenAI Codex with multi-turn threads, MCP, and streaming.',
    },
    {
      id: 'opencode',
      displayName: 'OpenCode',
      available: opencodeAvailable,
      installUrl: 'https://opencode.ai',
      description: 'OpenCode with multi-provider support, MCP, and session management.',
    },
  ];
}
