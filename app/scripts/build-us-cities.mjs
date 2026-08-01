// Regenerates app/src/data/us-cities.json, the dataset behind the location
// autocomplete in src/app/api/locations/route.ts.
//
// Run from app/:  node scripts/build-us-cities.mjs src/data/us-cities.json
//
// Sources (both public, US government-derived data):
//   - kelvins/US-Cities-Database  -> full coverage (~30k places) + lat/lng
//   - plotly/datasets top-1k      -> population for the ~900 largest cities,
//                                    used ONLY to rank autocomplete results
//
// Output rows: [city, stateCode, lat, lng, population] sorted by population
// desc, so route.ts can stop scanning once it has enough prefix matches.
// Cities absent from the top-1k list get population 0 and rank alphabetically
// behind the major ones.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = process.argv[2];

async function text(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// Minimal CSV splitter: handles the "quoted,field" case these files use.
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const STATE_ABBR = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', 'District of Columbia': 'DC',
  Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL',
  Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA',
  Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK',
  Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI',
  Wyoming: 'WY', 'Puerto Rico': 'PR',
};

const [citiesCsv, topCsv] = await Promise.all([
  text('https://raw.githubusercontent.com/kelvins/US-Cities-Database/main/csv/us_cities.csv'),
  text('https://raw.githubusercontent.com/plotly/datasets/master/us-cities-top-1k.csv'),
]);

// population lookup, keyed "city|ST"
const pop = new Map();
for (const line of topCsv.trim().split('\n').slice(1)) {
  const [city, stateName, population] = splitCsvLine(line.trim());
  const st = STATE_ABBR[stateName?.trim()];
  if (!st) continue;
  pop.set(`${city.trim().toLowerCase()}|${st}`, Number(population) || 0);
}

const seen = new Set();
const rows = [];
for (const line of citiesCsv.trim().split('\n').slice(1)) {
  const parts = splitCsvLine(line.trim());
  if (parts.length < 7) continue;
  const [, stateCode, , city, , lat, lng] = parts;
  const c = city?.trim();
  const st = stateCode?.trim();
  if (!c || !st) continue;

  const key = `${c.toLowerCase()}|${st}`;
  if (seen.has(key)) continue; // dedupe: some places repeat per county
  seen.add(key);

  rows.push([
    c,
    st,
    Math.round(Number(lat) * 10000) / 10000,
    Math.round(Number(lng) * 10000) / 10000,
    pop.get(key) ?? 0,
  ]);
}

// Sort by population desc so the API can short-circuit on the common case.
rows.sort((a, b) => b[4] - a[4] || a[0].localeCompare(b[0]));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(rows));

const withPop = rows.filter((r) => r[4] > 0).length;
console.log(`rows=${rows.length} withPopulation=${withPop} bytes=${JSON.stringify(rows).length}`);
console.log('samples:', rows.slice(0, 3), rows.find((r) => r[0] === 'Chapel Hill'));
