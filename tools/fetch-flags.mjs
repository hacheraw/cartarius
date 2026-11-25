// Descarga las banderas SVG del CDN de REST Countries (gratuito, sin clave) a data/flags/xx.svg
// Uso: node tools/fetch-flags.mjs   (requiere antes data/raw/restcountries-v5.json)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(readFileSync(join(ROOT, 'data', 'raw', 'restcountries-v5.json'), 'utf8'));
const dir = join(ROOT, 'data', 'flags'); mkdirSync(dir, { recursive: true });
let ok = 0, skip = 0, fail = [];
for (const c of raw.countries) {
  const url = c.flag && c.flag.url_svg; if (!url) { fail.push(c.codes.alpha_2 + ' (sin url)'); continue; }
  const file = join(dir, c.codes.alpha_2.toLowerCase() + '.svg');
  if (existsSync(file)) { skip++; continue; }
  const res = await fetch(url);
  if (!res.ok) { fail.push(c.codes.alpha_2 + ' HTTP ' + res.status); continue; }
  writeFileSync(file, await res.text()); ok++;
}
console.log(`descargadas ${ok}, ya existían ${skip}, fallos ${fail.length}`, fail);
