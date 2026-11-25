// Descarga todos los países de REST Countries v5 a data/raw/restcountries-v5.json
// Uso: REST_COUNTRIES_API_KEY=... node tools/fetch-countries.mjs
// Gasta 3 peticiones de la cuota mensual (límite 100 por página en el plan gratuito).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.REST_COUNTRIES_API_KEY;
if (!KEY) { console.error('Falta la variable de entorno REST_COUNTRIES_API_KEY'); process.exit(1); }
const BASE = 'https://api.restcountries.com/countries/v5';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'raw', 'restcountries-v5.json');

const all = [];
for (let offset = 0; ; offset += 100) {
  const res = await fetch(`${BASE}?limit=100&offset=${offset}&response_fields_omit=leaders`, { headers: { Authorization: `Bearer ${KEY}` } });
  const text = await res.text();
  if (!res.ok) { console.error(`HTTP ${res.status}: ${text.slice(0, 300)}`); process.exit(1); }
  const { data } = JSON.parse(text);
  all.push(...data.objects);
  console.log(`offset ${offset}: ${data.objects.length} (total ${data.meta.total})`);
  if (!data.meta.more) break;
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ source: BASE, fetched_at: new Date().toISOString(), count: all.length, countries: all }, null, 1));
console.log(`Guardado ${all.length} países en ${OUT}`);
