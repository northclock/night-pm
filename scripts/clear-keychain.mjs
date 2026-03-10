#!/usr/bin/env node
// Removes Night PM encrypted secrets file.
// Run via: npm run reset

import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const appData = process.platform === 'darwin'
  ? join(homedir(), 'Library', 'Application Support', 'Night PM')
  : process.platform === 'win32'
    ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Night PM')
    : join(homedir(), '.config', 'Night PM');

const secretsFile = join(appData, 'night-pm-secrets.enc');

if (existsSync(secretsFile)) {
  unlinkSync(secretsFile);
  console.log('  Removed encrypted secrets file.');
} else {
  console.log('  No secrets file found.');
}
