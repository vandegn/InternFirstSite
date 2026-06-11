// Generates supabase/seed_fake_jobs.sql: 30 fake employer accounts + 200
// randomized internship listings. Mirrors the pattern in seed_test_data.sql
// (direct inserts into auth.users/auth.identities/profiles/employers), so it
// must be run from the Supabase SQL Editor (superuser), not via the anon key.
//
// Run: node scripts/gen-fake-jobs.mjs
import { writeFileSync } from 'node:fs';

// ---- deterministic PRNG (mulberry32) so re-runs produce identical output ----
let seed = 0x1f2e3d4c;
function rnd() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const esc = (s) => (s == null ? null : String(s).replace(/'/g, "''"));
const q = (s) => (s == null ? 'null' : `'${esc(s)}'`);

// ---- fake companies: [name, industry, slug, contactName] ----
const COMPANIES = [
  ['Northwind Analytics', 'Technology', 'northwind', 'Dana Mills'],
  ['Vertex Robotics', 'Engineering', 'vertex', 'Sam Okafor'],
  ['Lumen Health Labs', 'Healthcare', 'lumenhealth', 'Priya Nair'],
  ['Cobalt Capital Group', 'Finance', 'cobaltcap', 'Greg Olsen'],
  ['Brightline Media', 'Media', 'brightline', 'Tara Voss'],
  ['Evergreen Policy Institute', 'Nonprofit', 'evergreenpolicy', 'Luis Romero'],
  ['Summit Retail Co', 'Retail', 'summitretail', 'Kim Park'],
  ['Pinnacle Legal Advisors', 'Legal', 'pinnaclelegal', 'Adrian Cole'],
  ['Quantum Edge Software', 'Technology', 'quantumedge', 'Maya Frost'],
  ['Harborview Biotech', 'Healthcare', 'harborview', 'Owen Reyes'],
  ['Ironclad Security', 'Technology', 'ironclad', 'Nia Brooks'],
  ['Meridian Consulting', 'Finance', 'meridiancg', 'Paul Tan'],
  ['Solstice Design Studio', 'Media', 'solstice', 'Elena Diaz'],
  ['Cedar & Co Marketing', 'Marketing', 'cedarco', 'Jordan Lee'],
  ['Atlas Logistics', 'Retail', 'atlaslogistics', 'Marcus Webb'],
  ['Beacon Education Network', 'Education', 'beaconed', 'Hana Sato'],
  ['Nimbus Cloud Systems', 'Technology', 'nimbuscloud', 'Devin Shah'],
  ['Granite Construction Group', 'Engineering', 'granitecg', 'Rosa Lin'],
  ['Orchid Wellness', 'Healthcare', 'orchidwell', 'Tom Becker'],
  ['Sterling Wealth Partners', 'Finance', 'sterlingwp', 'Ava Kent'],
  ['Pixel Forge Games', 'Media', 'pixelforge', 'Chris Yu'],
  ['Civic Solutions Agency', 'Government', 'civicsolutions', 'Renee Ford'],
  ['Verdant Energy', 'Engineering', 'verdant', 'Ian Moore'],
  ['Maple Leaf Foods Lab', 'Healthcare', 'mapleleaf', 'Sofia Ruiz'],
  ['Helix Data Co', 'Technology', 'helixdata', 'Ben Carter'],
  ['Crestwood Public Relations', 'Marketing', 'crestwoodpr', 'Lia Novak'],
  ['Aurora Talent Group', 'Nonprofit', 'auroratalent', 'Marco Bianchi'],
  ['BlueRiver Financial', 'Finance', 'blueriver', 'Grace Hall'],
  ['Trailhead Outdoor Retail', 'Retail', 'trailhead', 'Eli Stone'],
  ['Lighthouse Academy', 'Education', 'lighthouseacad', 'Naomi Klein'],
];

const TITLES = [
  'Software Engineering Intern', 'Data Analyst Intern', 'Marketing Intern',
  'Finance Intern', 'Operations Intern', 'Product Management Intern',
  'UX Design Intern', 'Research Intern', 'Business Development Intern',
  'Human Resources Intern', 'Sales Intern', 'Content Intern',
  'Accounting Intern', 'Customer Success Intern', 'QA Engineering Intern',
  'Project Coordinator Intern', 'Social Media Intern', 'Graphic Design Intern',
  'Data Science Intern', 'Communications Intern', 'Supply Chain Intern',
  'Public Relations Intern', 'IT Support Intern', 'Strategy Intern',
];
const LOCATIONS = [
  'New York, NY', 'San Francisco, CA', 'Austin, TX', 'Chicago, IL',
  'Boston, MA', 'Seattle, WA', 'Los Angeles, CA', 'Denver, CO',
  'Atlanta, GA', 'Remote', 'Raleigh, NC', 'Portland, OR',
];
const COMP = ['Unpaid', '$10-15/hr', '$15-20/hr', '$20-25/hr', '$25-30/hr',
  '$30-35/hr', '$35-40/hr', '$40+/hr', 'Stipend', null];
const DURATIONS = ['Summer', 'Fall Semester', 'Spring Semester', 'Year-round',
  '1-3 months', '3-6 months', '6+ months', null];

const DESCS = [
  'Join {co} as a {title} and work alongside an experienced team on meaningful projects. This is a hands-on role where you will contribute to real deliverables, learn industry tools, and grow your professional skills.',
  'As a {title} at {co}, you will support day-to-day operations and take ownership of a focused project over the course of the internship. We pride ourselves on mentorship and giving interns real responsibility.',
  '{co} is looking for a motivated {title} to help drive our goals forward. You will collaborate across teams, present your work, and gain exposure to how a modern organization operates.',
  'This {title} position offers a structured program of learning and doing. At {co}, interns are treated as full team members, attend planning sessions, and ship work that ships to real users.',
];
const REQS = [
  'Currently enrolled in a relevant degree program. Strong communication skills, attention to detail, and eagerness to learn. Prior project or coursework experience is a plus.',
  'Pursuing a bachelor’s degree. Comfortable working both independently and in a team. Familiarity with common productivity and collaboration tools.',
  'Rising junior or senior preferred. Demonstrated initiative through coursework, clubs, or past internships. Ability to manage multiple priorities.',
];
const RESPS = [
  'Support active projects and contribute deliverables. Participate in team meetings and standups. Document work and present findings to stakeholders.',
  'Assist team members with research and analysis. Help maintain trackers and reports. Collaborate on cross-functional initiatives.',
  'Own a focused project end-to-end. Provide regular status updates. Identify opportunities for improvement and propose solutions.',
];

function pad2(n) { return String(n).padStart(2, '0'); }
function pad3(n) { return String(n).padStart(3, '0'); }
function dateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function randomDeadline() {
  const r = rnd();
  if (r < 0.4) return null;                              // 40% no deadline
  if (r < 0.95) return dateStr(5 + Math.floor(rnd() * 86)); // 55% future
  return dateStr(-(3 + Math.floor(rnd() * 28)));         // 5% past (expired)
}

const PASSWORD = 'testpass1';
const lines = [];
const logins = [];
lines.push('-- =============================================================');
lines.push('-- InternFirst FAKE JOBS seed — 30 employer accounts + 200 listings');
lines.push('-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query).');
lines.push(`-- All fake employer accounts use password: ${PASSWORD}`);
lines.push('-- All IDs are prefixed fa.../fb.../fc... so they are easy to remove');
lines.push('-- (see seed_fake_jobs_cleanup.sql).');
lines.push('-- =============================================================');
lines.push('create extension if not exists pgcrypto;');
lines.push('');

const companyRows = COMPANIES.map((c, i) => {
  const nn = pad2(i + 1);
  return {
    name: c[0], industry: c[1], slug: c[2], contact: c[3],
    userId: `fa000000-0000-4000-a000-0000000000${nn}`,
    empId: `fb000000-0000-4000-b000-0000000000${nn}`,
    email: `${c[2]}@internfirst-test.com`,
    website: `https://${c[2]}.example.com`,
  };
});

// ---- auth.users ----
lines.push('-- ===== EMPLOYER AUTH USERS =====');
for (const c of companyRows) {
  const meta = `{"full_name": "${c.contact}", "role": "employer", "company_name": "${esc(c.name)}"}`;
  // GoTrue scans these token columns into non-nullable strings; they MUST be
  // '' (not NULL) or login fails with "Database error querying schema".
  lines.push(
    `INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, phone_change, phone_change_token, reauthentication_token) VALUES ` +
    `('${c.userId}', '00000000-0000-0000-0000-000000000000', ${q(c.email)}, crypt('${PASSWORD}', gen_salt('bf')), now(), '${meta}'::jsonb, 'authenticated', 'authenticated', now(), now(), '', '', '', '', '', '', '', '');`
  );
  logins.push({ company: c.name, email: c.email });
}
lines.push('');

// ---- auth.identities ----
lines.push('-- ===== EMPLOYER AUTH IDENTITIES =====');
for (const c of companyRows) {
  const idData = `{"sub": "${c.userId}", "email": "${c.email}"}`;
  lines.push(
    `INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at) VALUES ` +
    `('${c.userId}', '${c.userId}', '${idData}'::jsonb, 'email', '${c.userId}', now(), now(), now());`
  );
}
lines.push('');

// ---- profiles ----
lines.push('-- ===== EMPLOYER PROFILES =====');
lines.push('INSERT INTO profiles (user_id, role, full_name, email) VALUES');
lines.push(companyRows.map((c) => `  ('${c.userId}', 'employer', ${q(c.contact)}, ${q(c.email)})`).join(',\n') + ';');
lines.push('');

// ---- employers ----
lines.push('-- ===== EMPLOYER RECORDS =====');
lines.push('INSERT INTO employers (id, user_id, company_name, verified, description, website) VALUES');
lines.push(companyRows.map((c) =>
  `  ('${c.empId}', '${c.userId}', ${q(c.name)}, true, ${q(`${c.name} is a ${c.industry.toLowerCase()} organization. (Test account — not a real company.)`)}, ${q(c.website)})`
).join(',\n') + ';');
lines.push('');

// ---- listings: 200 distributed across companies ----
lines.push('-- ===== INTERNSHIP LISTINGS (200) =====');
const listingValues = [];
for (let i = 0; i < 200; i++) {
  const c = companyRows[i % companyRows.length];
  const title = pick(TITLES);
  const loc = pick(LOCATIONS);
  const isRemote = loc === 'Remote';
  const isHybrid = !isRemote && chance(0.2);
  const comp = pick(COMP);
  const dur = pick(DURATIONS);
  const deadline = randomDeadline();
  const desc = pick(DESCS).replace(/\{co\}/g, c.name).replace(/\{title\}/g, title);
  const req = pick(REQS);
  const resp = pick(RESPS);
  const id = `fc000000-0000-4000-c000-${pad3(i + 1).padStart(12, '0')}`;
  listingValues.push(
    `  ('${id}', '${c.empId}', ${q(title)}, ${q(desc)}, ${q(loc)}, ${isRemote}, ${isHybrid}, ${q(comp)}, ${q(req)}, ${q(resp)}, ${q(c.industry)}, 'active', ${dur ? q(dur) : 'null'}, ${deadline ? q(deadline) : 'null'})`
  );
}
lines.push('INSERT INTO internship_listings (id, employer_id, title, description, location, is_remote, is_hybrid, compensation, requirements, key_responsibilities, industry, status, duration, application_deadline) VALUES');
lines.push(listingValues.join(',\n') + ';');
lines.push('');
lines.push('-- ===== LOGINS (password: ' + PASSWORD + ') =====');
for (const l of logins) lines.push(`--   ${l.email}   (${l.company})`);

writeFileSync(new URL('../../supabase/seed_fake_jobs.sql', import.meta.url), lines.join('\n'));

// ---- cleanup script ----
const cleanup = [
  '-- Removes all fake-jobs seed data. Run in Supabase SQL Editor.',
  '-- Deleting the auth.users rows cascades to profiles, employers, and listings.',
  "delete from auth.users where id::text like 'fa000000-%';",
  '',
];
writeFileSync(new URL('../../supabase/seed_fake_jobs_cleanup.sql', import.meta.url), cleanup.join('\n'));

// ---- print logins for the user ----
console.log(`Wrote supabase/seed_fake_jobs.sql (${COMPANIES.length} companies, 200 listings)`);
console.log(`Wrote supabase/seed_fake_jobs_cleanup.sql`);
console.log(`\nLOGINS (password: ${PASSWORD}):`);
for (const l of logins) console.log(`  ${l.email.padEnd(40)} ${l.company}`);
