import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClaudeProvider } from '../main/providers/claude';
import { createCapture, printCapture, TEST_PROMPT, TEST_PROJECT_PATH } from './harness';

const isVertex = process.env.CLAUDE_CODE_USE_VERTEX === '1';
const anthropicKey = process.env.ANTHROPIC_API_KEY ?? '';

function claudeSdkExists(): boolean {
  const candidates = [
    path.join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'cli.js'),
  ];
  return candidates.some((p) => fs.existsSync(p));
}

describe('Claude Provider', () => {
  let sdkAvailable = false;

  beforeAll(() => {
    sdkAvailable = claudeSdkExists();
    if (!sdkAvailable) console.warn('⚠️  Claude Agent SDK cli.js not found');
    if (!isVertex && !anthropicKey) console.warn('⚠️  No Claude auth configured (set CLAUDE_CODE_USE_VERTEX=1 or ANTHROPIC_API_KEY)');
    console.log(`Auth mode: ${isVertex ? 'Vertex AI' : 'API Key'}`);
    console.log(`SDK available: ${sdkAvailable}`);
  });

  it('should have SDK cli.js installed', () => {
    expect(sdkAvailable).toBe(true);
  });

  it('SDK: can import query and listSessions', async () => {
    const sdk = await import('@anthropic-ai/claude-agent-sdk');
    expect(typeof sdk.query).toBe('function');
    expect(typeof sdk.listSessions).toBe('function');
    console.log('SDK exports:', Object.keys(sdk));
  });

  it('provider.startSession: captures messages through callback', async () => {
    const provider = createClaudeProvider(() => ({
      authMode: isVertex ? 'vertex' : 'api-key',
      anthropicApiKey: anthropicKey,
      vertexProjectId: process.env.ANTHROPIC_VERTEX_PROJECT_ID ?? '',
      vertexRegion: process.env.CLOUD_ML_REGION ?? 'global',
      model: '',
      permissionMode: 'bypassPermissions',
      effort: 'low',
      maxTurns: 3,
      skills: [],
    }));

    const { capture, send } = createCapture();

    await provider.startSession({
      key: 'test-claude-1',
      projectPath: TEST_PROJECT_PATH,
      initialPrompt: TEST_PROMPT,
      send,
      messageChannel: 'test:message',
      progressChannel: 'test:progress',
      doneChannel: 'test:done',
      isThought: false,
    });

    printCapture('Claude provider.startSession', capture);

    expect(capture.done.length).toBeGreaterThanOrEqual(1);

    const hasText = capture.messages.some(
      (m) => m.type === 'text' || m.type === 'error'
    );
    expect(hasText).toBe(true);

    provider.stopSession('test-claude-1');
  }, 90_000);

  it('provider.sendFollowup: multi-turn works', async () => {
    const provider = createClaudeProvider(() => ({
      authMode: isVertex ? 'vertex' : 'api-key',
      anthropicApiKey: anthropicKey,
      vertexProjectId: process.env.ANTHROPIC_VERTEX_PROJECT_ID ?? '',
      vertexRegion: process.env.CLOUD_ML_REGION ?? 'global',
      model: '',
      permissionMode: 'bypassPermissions',
      effort: 'low',
      maxTurns: 3,
      skills: [],
    }));

    const { capture: cap1, send: send1 } = createCapture();

    await provider.startSession({
      key: 'test-claude-multi',
      projectPath: TEST_PROJECT_PATH,
      initialPrompt: 'Remember the number 42. Just say "Got it".',
      send: send1,
      messageChannel: 'test:message',
      progressChannel: 'test:progress',
      doneChannel: 'test:done',
      isThought: false,
    });

    printCapture('Claude multi-turn: first message', cap1);

    const { capture: cap2, send: send2 } = createCapture();

    await provider.sendFollowup(
      'test-claude-multi',
      'What number did I tell you?',
      send2,
      'test:message',
      'test:progress',
      'test:done',
    );

    printCapture('Claude multi-turn: follow-up', cap2);

    const hasResponse = cap2.messages.some(
      (m) => m.type === 'text' || m.type === 'error'
    );
    expect(hasResponse).toBe(true);

    provider.stopSession('test-claude-multi');
  }, 120_000);
});
