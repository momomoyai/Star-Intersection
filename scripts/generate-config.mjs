import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');
const configPath = resolve(root, 'config.js');

function readLocalEnv() {
  if (!existsSync(envPath)) return {};
  const values = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

const local = readLocalEnv();
const apiKey = process.env.STAR_FIREBASE_API_KEY ?? local.STAR_FIREBASE_API_KEY ?? '';
const projectId = process.env.STAR_FIREBASE_PROJECT_ID ?? local.STAR_FIREBASE_PROJECT_ID ?? '';

if (Boolean(apiKey) !== Boolean(projectId)) {
  throw new Error('Set both STAR_FIREBASE_API_KEY and STAR_FIREBASE_PROJECT_ID, or leave both blank.');
}

const config = apiKey ? { apiKey, projectId } : null;
const output = `// Generated from .env.local by scripts/generate-config.mjs. Do not edit directly.\nwindow.STAR_FIREBASE = ${JSON.stringify(config, null, 2)};\n`;
writeFileSync(configPath, output, { mode: 0o600 });
console.log(config ? 'Firebase browser config generated.' : 'Local-only browser config generated.');
