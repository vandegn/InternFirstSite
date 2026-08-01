#!/usr/bin/env node
// Regenerates the valid_skills seed SQL from public/skills.json.
// Run after changing skills.json:  node scripts/generate-skills-seed.mjs
// Then apply supabase/seed_valid_skills.sql (Supabase SQL editor or psql) to sync the allowlist.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const skills = JSON.parse(readFileSync(join(here, '..', 'public', 'skills.json'), 'utf8'));

const esc = (s) => s.replace(/'/g, "''");
const values = skills.map((s) => `  ('${esc(s)}')`).join(',\n');

const sql = `-- AUTO-GENERATED from app/public/skills.json by scripts/generate-skills-seed.mjs. Do not edit by hand.
-- Idempotent: adds new catalog skills and removes catalog skills no longer in the list
-- (unless a student still references one, which the FK will block — resolve those first).
begin;

insert into valid_skills (name) values
${values}
on conflict (name) do nothing;

delete from valid_skills
  where name not in (
${skills.map((s) => `    '${esc(s)}'`).join(',\n')}
  );

commit;
`;

const out = join(here, '..', '..', 'supabase', 'seed_valid_skills.sql');
writeFileSync(out, sql);
console.log(`Wrote ${out} with ${skills.length} skills.`);
