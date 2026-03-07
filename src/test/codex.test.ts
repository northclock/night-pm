import { describe, it, expect, beforeAll } from 'vitest';
import { createCodexProvider } from '../main/providers/codex';
import { createCapture, printCapture, TEST_PROMPT, TEST_PROJECT_PATH } from './harness';

const API_KEY = process.env.OPENAI_API_KEY ?? '';

describe('Codex Provider', () => {
  beforeAll(() => {
    if (!API_KEY) console.warn('⚠️  OPENAI_API_KEY not set — tests will fail');
  });

  it('should have API key configured', () => {
    expect(API_KEY).toBeTruthy();
    console.log(`OPENAI_API_KEY: ${API_KEY.slice(0, 12)}...`);
  });

  it('Codex SDK: can construct instance without error', async () => {
    const { Codex } = await import('@openai/codex-sdk');
    const codex = new Codex({
      env: { ...process.env, OPENAI_API_KEY: API_KEY, CODEX_API_KEY: API_KEY },
    });
    expect(codex).toBeDefined();
    console.log('Codex instance created successfully');
    console.log('Codex type:', typeof codex);
    console.log('Codex keys:', Object.keys(codex));
    console.log('startThread type:', typeof codex.startThread);
    console.log('resumeThread type:', typeof codex.resumeThread);
  });

  it('Codex SDK: raw thread test — log all events', async () => {
    const { Codex } = await import('@openai/codex-sdk');
    const codex = new Codex({
      env: { ...process.env, OPENAI_API_KEY: API_KEY, CODEX_API_KEY: API_KEY },
    });

    const thread = codex.startThread({
      workingDirectory: TEST_PROJECT_PATH,
      skipGitRepoCheck: true,
    });

    console.log('Thread created:', typeof thread);
    console.log('Thread keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(thread)));

    const events: unknown[] = [];

    try {
      const { events: eventStream } = await thread.runStreamed(TEST_PROMPT);
      console.log('runStreamed returned, iterating events...');

      for await (const event of eventStream) {
        events.push(event);
        console.log(`  event[${events.length - 1}]:`, JSON.stringify(event).slice(0, 500));
      }
    } catch (err) {
      console.error('Thread error:', err);
    }

    console.log(`\nTotal events: ${events.length}`);

    // Categorize events
    const types = events.map((e) => (e as { type?: string }).type ?? 'unknown');
    const typeCounts: Record<string, number> = {};
    for (const t of types) typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    console.log('Event type counts:', typeCounts);

    expect(events.length).toBeGreaterThan(0);
  }, 90_000);

  it('provider.startSession: captures messages through callback', async () => {
    const provider = createCodexProvider(() => ({
      apiKey: API_KEY,
      model: '',
    }));

    const { capture, send } = createCapture();

    await provider.startSession({
      key: 'test-codex-1',
      projectPath: TEST_PROJECT_PATH,
      initialPrompt: TEST_PROMPT,
      send,
      messageChannel: 'test:message',
      progressChannel: 'test:progress',
      doneChannel: 'test:done',
      isThought: false,
    });

    printCapture('Codex provider.startSession', capture);

    expect(capture.done.length).toBeGreaterThanOrEqual(1);

    const hasTextOrError = capture.messages.some(
      (m) => m.type === 'text' || m.type === 'error'
    );
    expect(hasTextOrError).toBe(true);
  }, 90_000);

  it('provider.sendFollowup: multi-turn works', async () => {
    const provider = createCodexProvider(() => ({
      apiKey: API_KEY,
      model: '',
    }));

    const { capture: cap1, send: send1 } = createCapture();

    await provider.startSession({
      key: 'test-codex-multi',
      projectPath: TEST_PROJECT_PATH,
      initialPrompt: 'Remember the number 42. Just say "Got it".',
      send: send1,
      messageChannel: 'test:message',
      progressChannel: 'test:progress',
      doneChannel: 'test:done',
      isThought: false,
    });

    printCapture('Codex multi-turn: first message', cap1);

    const { capture: cap2, send: send2 } = createCapture();

    await provider.sendFollowup(
      'test-codex-multi',
      'What number did I tell you?',
      send2,
      'test:message',
      'test:progress',
      'test:done',
    );

    printCapture('Codex multi-turn: follow-up', cap2);

    const hasResponse = cap2.messages.some(
      (m) => m.type === 'text' || m.type === 'error'
    );
    expect(hasResponse).toBe(true);

    provider.stopSession('test-codex-multi');
  }, 120_000);
});
