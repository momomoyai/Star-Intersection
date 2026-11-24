import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const language = resolve(root, '.tooling/ocr/eng.traineddata.gz');
const expectedHash = 'ed350f3752f81ee8f38769edc14d92d997dababe23b565c59879372cc46a2468';

if (!existsSync(language)) {
  const url = 'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz';
  const response = await fetch(url);
  if (!response.ok) throw Error(`Could not download OCR language data: HTTP ${response.status}`);
  mkdirSync(dirname(language), { recursive: true });
  writeFileSync(language, Buffer.from(await response.arrayBuffer()));
}
const digest = createHash('sha256').update(readFileSync(language)).digest('hex');
if (digest !== expectedHash) throw Error('OCR language data checksum mismatch');

execFileSync(process.execPath, [resolve(root, 'scripts/build.mjs')], { cwd: root, stdio: 'inherit' });
const target = resolve(root, 'dist/ocr');
mkdirSync(target);
const assets = [
  ['tesseract.js/dist/tesseract.min.js', 'tesseract.min.js'],
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js/dist/tesseract.min.js.LICENSE.txt', 'tesseract.min.js.LICENSE.txt'],
  ['tesseract.js/dist/worker.min.js.LICENSE.txt', 'worker.min.js.LICENSE.txt'],
  ['tesseract.js/LICENSE.md', 'tesseract.LICENSE.md'],
  ['tesseract.js-core/LICENSE', 'tesseract-core.LICENSE']
];
for (const flavor of ['', '-simd', '-lstm', '-simd-lstm']) {
  for (const suffix of ['.wasm.js', '.wasm']) {
    assets.push([`tesseract.js-core/tesseract-core${flavor}${suffix}`, `tesseract-core${flavor}${suffix}`]);
  }
}
for (const [source, name] of assets) {
  copyFileSync(resolve(root, 'node_modules', source), resolve(target, name));
}
copyFileSync(language, resolve(target, 'eng.traineddata.gz'));
console.log(`Bundled ${assets.length + 1} local OCR files for native screenshot import.`);
