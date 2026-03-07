import type { AIMessage, AIResult, MessageCallback } from '../main/providers/types';

export interface CapturedMessages {
  messages: AIMessage[];
  progress: AIMessage[];
  done: (AIResult | unknown)[];
  raw: Array<{ channel: string; data: unknown }>;
}

export function createCapture(): { capture: CapturedMessages; send: MessageCallback } {
  const capture: CapturedMessages = {
    messages: [],
    progress: [],
    done: [],
    raw: [],
  };

  const send: MessageCallback = (channel: string, ...args: unknown[]) => {
    const data = args[0];
    capture.raw.push({ channel, data });

    if (channel.includes('message')) {
      capture.messages.push(data as AIMessage);
    } else if (channel.includes('progress')) {
      capture.progress.push(data as AIMessage);
    } else if (channel.includes('done')) {
      capture.done.push(data as AIResult);
    }
  };

  return { capture, send };
}

export function printCapture(label: string, capture: CapturedMessages) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label}`);
  console.log('='.repeat(60));

  console.log(`\n--- Messages (${capture.messages.length}) ---`);
  for (const msg of capture.messages) {
    const m = msg as Record<string, unknown>;
    if (m.type === 'text') {
      console.log(`  [text] ${String(m.text).slice(0, 200)}`);
    } else if (m.type === 'tool_use') {
      console.log(`  [tool_use] ${m.tool} id=${m.id}`);
    } else if (m.type === 'tool_result') {
      console.log(`  [tool_result] tool=${m.tool ?? ''} error=${m.isError ?? false}`);
      console.log(`    output: ${String(m.output).slice(0, 200)}`);
    } else if (m.type === 'thinking') {
      console.log(`  [thinking] ${String(m.text).slice(0, 100)}`);
    } else if (m.type === 'error') {
      console.log(`  [error] ${m.message}`);
    } else if (m.type === 'system') {
      console.log(`  [system] model=${m.model ?? ''}`);
    } else {
      console.log(`  [${m.type}] ${JSON.stringify(m).slice(0, 200)}`);
    }
  }

  console.log(`\n--- Progress (${capture.progress.length}) ---`);
  for (const p of capture.progress) {
    console.log(`  ${JSON.stringify(p).slice(0, 200)}`);
  }

  console.log(`\n--- Done (${capture.done.length}) ---`);
  for (const d of capture.done) {
    console.log(`  ${JSON.stringify(d).slice(0, 300)}`);
  }

  if (capture.raw.length === 0) {
    console.log('\n  ⚠️  NO MESSAGES CAPTURED AT ALL');
  }

  console.log(`\n--- Raw dump (${capture.raw.length} total) ---`);
  for (const r of capture.raw) {
    console.log(`  [${r.channel}] ${JSON.stringify(r.data).slice(0, 300)}`);
  }

  console.log('');
}

export const TEST_PROMPT = 'Say exactly: "Hello from Night PM test". Nothing else.';
export const TEST_PROJECT_PATH = process.cwd();
