import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'node:child_process';
import { createGeminiProvider } from '../main/providers/gemini';
import { createCapture, printCapture, TEST_PROMPT, TEST_PROJECT_PATH } from './harness';

const API_KEY = process.env.GEMINI_API_KEY ?? '';

function geminiCliExists(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('which', ['gemini']);
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

describe('Gemini Provider', () => {
  let cliAvailable = false;

  beforeAll(async () => {
    cliAvailable = await geminiCliExists();
    if (!cliAvailable) console.warn('⚠️  Gemini CLI not found in PATH — skipping live tests');
    if (!API_KEY) console.warn('⚠️  GEMINI_API_KEY not set — tests may fail');
  });

  it('should have API key configured', () => {
    expect(API_KEY).toBeTruthy();
    console.log(`GEMINI_API_KEY: ${API_KEY.slice(0, 8)}...`);
  });

  it('should detect gemini CLI', () => {
    if (!cliAvailable) {
      console.log('SKIP: gemini CLI not available');
      return;
    }
    expect(cliAvailable).toBe(true);
  });

  it('raw CLI: capture stdout/stderr to see actual output format', async () => {
    if (!cliAvailable) return;

    const stdout: string[] = [];
    const stderr: string[] = [];

    await new Promise<void>((resolve) => {
      const proc = spawn('gemini', [
        '--output-format', 'json',
        '--yolo',
        '-p', TEST_PROMPT,
      ], {
        cwd: TEST_PROJECT_PATH,
        env: { ...process.env, GEMINI_API_KEY: API_KEY },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdout.push(text);
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderr.push(text);
      });

      proc.on('close', (code) => {
        console.log(`\n--- Gemini CLI exit code: ${code} ---`);
        console.log('\n--- RAW STDOUT ---');
        console.log(stdout.join(''));
        console.log('\n--- RAW STDERR ---');
        console.log(stderr.join(''));
        resolve();
      });

      proc.on('error', (err) => {
        console.error('spawn error:', err);
        resolve();
      });
    });

    expect(stdout.length + stderr.length).toBeGreaterThan(0);
  }, 90_000);

  it('raw CLI: try parsing stdout as JSON lines', async () => {
    if (!cliAvailable) return;

    const stdout: string[] = [];
    const parsed: unknown[] = [];

    await new Promise<void>((resolve) => {
      const proc = spawn('gemini', [
        '--output-format', 'json',
        '--yolo',
        '-p', TEST_PROMPT,
      ], {
        cwd: TEST_PROJECT_PATH,
        env: { ...process.env, GEMINI_API_KEY: API_KEY },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout.push(chunk.toString());
      });

      proc.on('close', () => {
        const full = stdout.join('');
        for (const line of full.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            parsed.push(JSON.parse(trimmed));
          } catch {
            console.log(`  [non-JSON line]: "${trimmed.slice(0, 200)}"`);
          }
        }
        console.log(`\n--- Parsed ${parsed.length} JSON objects ---`);
        for (let i = 0; i < parsed.length; i++) {
          console.log(`  [${i}]:`, JSON.stringify(parsed[i]).slice(0, 500));
        }
        resolve();
      });
    });
  }, 90_000);

  it('provider.startSession: captures messages through callback', async () => {
    if (!cliAvailable) return;

    const provider = createGeminiProvider(() => ({
      apiKey: API_KEY,
      model: '',
    }));

    const { capture, send } = createCapture();

    await provider.startSession({
      key: 'test-gemini-1',
      projectPath: TEST_PROJECT_PATH,
      initialPrompt: TEST_PROMPT,
      send,
      messageChannel: 'test:message',
      progressChannel: 'test:progress',
      doneChannel: 'test:done',
      isThought: false,
    });

    printCapture('Gemini provider.startSession', capture);

    expect(capture.done.length).toBeGreaterThanOrEqual(1);

    const hasTextOrError = capture.messages.some(
      (m) => m.type === 'text' || m.type === 'error'
    );
    expect(hasTextOrError).toBe(true);
  }, 90_000);

  it('mapGeminiOutput: test common output shapes', async () => {
    // Import the actual module to test mapping in isolation
    const mod = await import('../main/providers/gemini');
    const provider = mod.createGeminiProvider(() => ({ apiKey: '', model: '' }));
    expect(provider.id).toBe('gemini');

    // We can't easily test mapGeminiOutput directly since it's not exported,
    // but we confirmed the provider is constructable.
    // The raw CLI tests above reveal what format gemini actually sends.
  });
});
