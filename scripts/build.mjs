import './generate-config.mjs';
import { copyFileSync, lstatSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const files = [
  'index.html',
  'app.js',
  'styles.css',
  'icon.svg',
  'manifest.webmanifest',
  'sw.js',
  'config.js'
];

mkdirSync(output, { recursive: true });
const unexpected = readdirSync(output).filter(name => !files.includes(name));
if (unexpected.length) {
  throw new Error(`Unexpected files in dist/: ${unexpected.join(', ')}. Remove them before building.`);
}

for (const file of files) {
  const source = resolve(root, file);
  if (!lstatSync(source).isFile()) throw new Error(`Expected a regular file: ${file}`);
  copyFileSync(source, resolve(output, file));
}

console.log(`Built dist/ with ${files.length} allowlisted files.`);
