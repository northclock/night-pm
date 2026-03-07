import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'node:child_process';
import { createOpenCodeProvider } from '../main/providers/opencode';
import { createCapture, printCapture, TEST_PROMPT, TEST_PROJECT_PATH } from './harness';

function opencodeCLIExists(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('which', ['opencode']);
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

describe('OpenCode Provider', () => {
  let cliAvailable = false;

  beforeAll(async () => {
    cliAvailable = await opencodeCLIExists();
    if (!cliAvailable) console.warn('⚠️  OpenCode CLI not found — SDK server may not start');
  });

  it('should detect opencode CLI', () => {
    console.log(`OpenCode CLI available: ${cliAvailable}`);
  });

  it('SDK: can import createOpencode', async () => {
    const mod = await import('@opencode-ai/sdk');
    expect(typeof mod.createOpencode).toBe('function');
    console.log('SDK exports:', Object.keys(mod));
  });

  it('provider.startSession: captures messages through callback', async () => {
    if (!cliAvailable) {
      console.log('SKIP: opencode CLI not available');
      return;
    }

    const provider = createOpenCodeProvider(() => ({
      provider: 'anthropic',
      apiKey: '',
      model: 'anthropic/claude-3-5-sonnet',
    }));

    const { capture, send } = createCapture();

    await provider.startSession({
      key: 'test-oc-1',
      projectPath: TEST_PROJECT_PATH,
      initialPrompt: TEST_PROMPT,
      send,
      messageChannel: 'test:message',
      progressChannel: 'test:progress',
      doneChannel: 'test:done',
      isThought: false,
    });

    printCapture('OpenCode provider.startSession', capture);

    expect(capture.done.length).toBeGreaterThanOrEqual(1);

    provider.stopSession('test-oc-1');
  }, 90_000);
});
