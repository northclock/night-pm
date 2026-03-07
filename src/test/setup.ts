import * as fs from 'node:fs';
import * as path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Strip optional 'export ' prefix
    const clean = trimmed.replace(/^export\s+/, '');
    const eqIdx = clean.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = clean.slice(0, eqIdx).trim();
    const value = clean.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
