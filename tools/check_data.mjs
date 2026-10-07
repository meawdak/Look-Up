// Quick sanity check of the datasets: run `npm run check-data`.
import { readFileSync } from 'node:fs';
const read = (f) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url)));
const stars = read('stars.json');
const cons = read('constellations.json');
const { targets } = read('targets.json');
const ids = new Set(stars.map((s) => s.id));
let bad = 0;
for (const t of targets) for (const id of t.stars || []) if (!ids.has(id)) { console.log(`Missing star ${id} in target ${t.id}`); bad++; }
console.log(`${stars.length} stars, ${cons.length} constellations, ${targets.length} targets, ${bad} problems`);
process.exit(bad ? 1 : 0);
