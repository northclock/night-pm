#!/usr/bin/env node
// Removes Night PM keychain entries created by keytar.
// Run via: npm run reset

const SERVICE = 'Night PM';
const KEYS = [
  'claude.anthropicApiKey',
  'gemini.apiKey',
  'codex.apiKey',
  'opencode.apiKey',
];

async function main() {
  let keytar;
  try {
    keytar = (await import('keytar')).default;
  } catch {
    console.log('keytar not available — no keychain entries to clear.');
    return;
  }

  let cleared = 0;
  for (const key of KEYS) {
    try {
      const deleted = await keytar.deletePassword(SERVICE, key);
      if (deleted) {
        console.log(`  Removed keychain entry: ${key}`);
        cleared++;
      }
    } catch {
      // Entry didn't exist — fine
    }
  }

  if (cleared === 0) {
    console.log('  No keychain entries found.');
  } else {
    console.log(`  ${cleared} keychain ${cleared === 1 ? 'entry' : 'entries'} cleared.`);
  }
}

main().catch(console.error);
