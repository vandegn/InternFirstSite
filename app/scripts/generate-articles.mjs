#!/usr/bin/env node
// Runs the GEO content agent against a deployed (or local) InternFirst by
// calling POST /api/content/generate with the cron secret. Drafts land in
// content_articles for an admin to review on /dashboard/admin/content.
//
//   CRON_SECRET=... node scripts/generate-articles.mjs            # next queued topic
//   CRON_SECRET=... node scripts/generate-articles.mjs --limit 3  # up to three
//   CRON_SECRET=... SITE_URL=http://localhost:3000 node scripts/generate-articles.mjs --topic <uuid>
//
// This is the same call a scheduler makes (see docs/geo-seo.md), kept as a
// script so a run can be kicked off by hand and its summary read in a terminal.

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error('CRON_SECRET is required (the same value the app is deployed with).');
  process.exit(1);
}
const base = (process.env.SITE_URL || 'https://www.intern-first.com').replace(/\/$/, '');
const limit = Number(flag('--limit') ?? 1);
const topicId = flag('--topic');

const res = await fetch(`${base}/api/content/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
  body: JSON.stringify({ limit, ...(topicId ? { topicId } : {}) }),
});
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Generation failed (${res.status}):`, body.error ?? body);
  process.exit(1);
}
console.log(`Claimed ${body.claimed} topic(s).`);
for (const d of body.drafted ?? []) {
  console.log(`  drafted /blog/${d.slug}${d.warnings?.length ? `  (notes: ${d.warnings.join('; ')})` : ''}`);
}
for (const f of body.failed ?? []) console.log(`  failed ${f.topicId}: ${f.error}`);
if ((body.drafted ?? []).length > 0) console.log('Review and publish at /dashboard/admin/content.');
