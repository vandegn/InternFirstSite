import { NextRequest, NextResponse } from 'next/server';
import schoolsData from '@/data/us-schools.json';

// US higher-education institution autocomplete, served from the Department of
// Education's approved-institution list bundled at build time. Same shape as
// /api/locations: the dataset stays on the server and the client only ever
// receives the handful of matches it asked for.
//
// Row shape: [id, name, state, category] — id is the federal institution id,
// which is what students.school_id stores.
type SchoolRow = [number, string, string, string];

const SCHOOLS = schoolsData as SchoolRow[];

const LIMIT = 12;

const STATE_CODES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI',
  minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
  'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY',
};

// Two-letter code -> full state name, for queries like "duke nc".
const STATE_BY_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_CODES).map(([name, code]) => [code, name])
);

// Official names are punctuated inconsistently ("Texas A & M University",
// "Texas A&M University-San Antonio"), so both sides of every comparison get
// flattened to lowercase words: "texas a and m university san antonio".
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Words that carry no signal in an acronym: "University of North Carolina at
// Chapel Hill" should initialise to UNCCH, not UONCACH.
const STOPWORDS = new Set(['of', 'at', 'the', 'and', 'for', 'in', 'a']);

function acronym(words: string[]): string {
  return words.filter((w) => !STOPWORDS.has(w)).map((w) => w[0]).join('');
}

// Precomputed once per server process — 2k rows, cheap.
const INDEX = SCHOOLS.map((row) => {
  const name = normalize(row[1]);
  // A leading "The" is noise for prefix matching: someone typing "pennsylvania"
  // means "The Pennsylvania State University".
  const bare = name.startsWith('the ') ? name.slice(4) : name;
  const words = bare.split(' ');
  return { name, bare, words, acronym: acronym(words) };
});

export type SchoolSuggestion = {
  id: number;
  name: string;
  state: string;
  /** "Duke University · NC" — what the picker renders. */
  label: string;
};

function toSuggestion(row: SchoolRow): SchoolSuggestion {
  const code = STATE_CODES[row[2].toLowerCase()] ?? row[2];
  return { id: row[0], name: row[1], state: row[2], label: `${row[1]} · ${code}` };
}

// Every query token has to hit the start of a word, in order: "penn state"
// matches "the PENNsylvania STATE university", "texas austin" matches "the
// university of TEXAS at AUSTIN".
function matchesTokens(words: string[], tokens: string[]): boolean {
  let w = 0;
  for (const token of tokens) {
    while (w < words.length && !words[w].startsWith(token)) w++;
    if (w === words.length) return false;
    w++;
  }
  return true;
}

// Ranked best-first. Tiers, in order: exact name or acronym ("mit"), name
// prefix ("duke"), acronym prefix ("unc" -> UNCCH), every token hitting a word
// start ("penn state"), then the query appearing anywhere in the name.
function search(query: string, state: string | null): SchoolRow[] {
  const tokens = query.split(' ').filter(Boolean);
  const tiers: SchoolRow[][] = [[], [], [], [], []];

  for (let i = 0; i < SCHOOLS.length; i++) {
    const row = SCHOOLS[i];
    if (state && row[2].toLowerCase() !== state) continue;

    const entry = INDEX[i];
    if (entry.bare === query || entry.acronym === query) tiers[0].push(row);
    else if (entry.bare.startsWith(query) || entry.name.startsWith(query)) tiers[1].push(row);
    else if (entry.acronym.startsWith(query)) tiers[2].push(row);
    else if (matchesTokens(entry.words, tokens)) tiers[3].push(row);
    else if (entry.name.includes(query)) tiers[4].push(row);

    // No early break: SCHOOLS is sorted by name, so stopping early would bias
    // results toward the alphabet rather than toward the best-matching tier.
  }

  return tiers.flat().slice(0, LIMIT);
}

// Splits "duke, nc" / "duke nc" into a name fragment and a state filter. Only
// consulted when the query as typed finds nothing, so a real school name that
// ends in a state ("University of North Carolina") is never mangled into a
// filter.
function parseStateSuffix(query: string): { name: string; state: string } | null {
  const parts = query.split(' ');

  if (parts.length > 2) {
    const lastTwo = parts.slice(-2).join(' ');
    if (STATE_CODES[lastTwo]) return { name: parts.slice(0, -2).join(' '), state: lastTwo };
  }
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    const full = STATE_BY_CODE[last.toUpperCase()];
    if (full) return { name: parts.slice(0, -1).join(' '), state: full };
    if (STATE_CODES[last]) return { name: parts.slice(0, -1).join(' '), state: last };
  }
  // A bare state name or code lists that state's institutions.
  if (STATE_CODES[query]) return { name: '', state: query };
  const bare = STATE_BY_CODE[query.toUpperCase()];
  if (bare) return { name: '', state: bare };

  return null;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('q') ?? '';
  if (raw.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const query = normalize(raw);
  let matches = query ? search(query, null) : [];

  if (matches.length === 0) {
    const parsed = parseStateSuffix(query);
    if (parsed) {
      matches = parsed.name
        ? search(parsed.name, parsed.state)
        : SCHOOLS.filter((r) => r[2].toLowerCase() === parsed.state).slice(0, LIMIT);
    }
  }

  return NextResponse.json(
    { results: matches.map(toSuggestion) },
    // The dataset is static, so suggestions are safe to cache hard.
    { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } }
  );
}
