// One-time setup for the private applicant-docs rollout
// (docs/private-applicant-docs-plan.md):
//   1. Creates the private `applicant-docs` bucket.
//   2. COPIES every object under images/resumes/ and images/application-files/
//      into applicant-docs at the same path. Originals are left in `images`
//      on purpose — they are only deleted after end-to-end verification.
//
// Non-destructive and idempotent (re-copying overwrites with the same bytes).
// Run: node scripts/private-docs-setup.mjs  (from app/, needs
// SUPABASE_SERVICE_ROLE_KEY in .env.local)
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in app/.env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

// storage.list() is one folder level at a time, so walk the tree.
async function listRecursive(bucket, prefix) {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
  const files = [];
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      files.push(...(await listRecursive(bucket, path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

const { error: bucketError } = await supabase.storage.createBucket('applicant-docs', { public: false });
if (bucketError && !/already exists/i.test(bucketError.message)) {
  throw new Error(`createBucket: ${bucketError.message}`);
}
console.log(bucketError ? 'Bucket applicant-docs already exists.' : 'Created private bucket applicant-docs.');

let copied = 0;
for (const prefix of ['resumes', 'application-files']) {
  const paths = await listRecursive('images', prefix);
  console.log(`images/${prefix}: ${paths.length} object(s)`);
  for (const path of paths) {
    const { data: blob, error: dlError } = await supabase.storage.from('images').download(path);
    if (dlError) throw new Error(`download images/${path}: ${dlError.message}`);
    const { error: upError } = await supabase.storage
      .from('applicant-docs')
      .upload(path, blob, { upsert: true });
    if (upError) throw new Error(`upload applicant-docs/${path}: ${upError.message}`);
    copied++;
    console.log(`  copied ${path}`);
  }
}
console.log(`Done. ${copied} object(s) copied into applicant-docs; originals kept in images.`);
