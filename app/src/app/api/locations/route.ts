import { NextRequest, NextResponse } from 'next/server';
import citiesData from '@/data/us-cities.json';

// US city autocomplete, served from a bundled dataset rather than a paid
// geocoding API. The file is ~1.1MB, so it stays on the server and the client
// only ever receives the handful of matches it asked for.
//
// Row shape: [city, stateCode, lat, lng, population]
type CityRow = [string, string, number, number, number];

const CITIES = citiesData as CityRow[];

// Two-letter codes, used to detect a trailing state in queries like "raleigh nc".
const STATE_CODES = new Set(CITIES.map((c) => c[1]));

const LIMIT = 12;

export type LocationSuggestion = {
  id: string;
  city: string;
  state: string;
  label: string;
  lat: number;
  lng: number;
};

function toSuggestion(row: CityRow): LocationSuggestion {
  return {
    id: `${row[0]}|${row[1]}`,
    city: row[0],
    state: row[1],
    label: `${row[0]}, ${row[1]}`,
    lat: row[2],
    lng: row[3],
  };
}

// Splits "raleigh, nc" / "raleigh nc" / "raleigh" into a city fragment and an
// optional state filter.
function parseQuery(raw: string): { city: string; state: string | null } {
  const q = raw.trim().toLowerCase();

  const commaAt = q.lastIndexOf(',');
  if (commaAt !== -1) {
    const state = q.slice(commaAt + 1).trim().toUpperCase();
    return {
      city: q.slice(0, commaAt).trim(),
      state: STATE_CODES.has(state) ? state : null,
    };
  }

  // No comma: a trailing 2-letter token that is a real state code acts as a
  // state filter, e.g. "raleigh nc".
  const parts = q.split(/\s+/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1].toUpperCase();
    if (last.length === 2 && STATE_CODES.has(last)) {
      return { city: parts.slice(0, -1).join(' '), state: last };
    }
  }

  return { city: q, state: null };
}

// Largest cities in a state, used when the query is just a state code.
function citiesInState(state: string, exclude: Set<string>): CityRow[] {
  const out: CityRow[] = [];
  for (const row of CITIES) {
    if (row[1] !== state || exclude.has(`${row[0]}|${row[1]}`)) continue;
    out.push(row);
    if (out.length >= LIMIT) break;
  }
  return out;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('q') ?? '';
  if (raw.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const { city, state } = parseQuery(raw);
  if (!city) {
    // State-only query, e.g. ", NC" — show that state's largest cities.
    const results = CITIES.filter((c) => c[1] === state).slice(0, LIMIT).map(toSuggestion);
    return NextResponse.json({ results });
  }

  // CITIES is pre-sorted by population desc, so within each tier the first
  // matches found are already the most likely ones.
  //
  // Substring matching is skipped for 1-2 character queries: "nc" would
  // otherwise match "San Fra(nc)isco" ahead of anything useful.
  const allowContains = city.length >= 3;
  const prefix: CityRow[] = [];
  const contains: CityRow[] = [];

  for (const row of CITIES) {
    if (state && row[1] !== state) continue;
    const name = row[0].toLowerCase();
    if (name.startsWith(city)) {
      prefix.push(row);
      if (prefix.length >= LIMIT) break; // enough exact-prefix hits, stop scanning
    } else if (allowContains && contains.length < LIMIT && name.includes(city)) {
      contains.push(row);
    }
  }

  const matches = [...prefix, ...contains];

  // A bare state code ("nc") has few or no city-name matches — fall back to
  // that state's largest cities, which is what the employer almost certainly
  // meant. Real city-name matches still come first.
  const bareState = city.toUpperCase();
  if (!state && bareState.length === 2 && STATE_CODES.has(bareState) && matches.length < LIMIT) {
    const already = new Set(matches.map((r) => `${r[0]}|${r[1]}`));
    matches.push(...citiesInState(bareState, already));
  }

  const results = matches.slice(0, LIMIT).map(toSuggestion);

  return NextResponse.json(
    { results },
    // The dataset is static, so suggestions are safe to cache hard.
    { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } }
  );
}
