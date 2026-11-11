# SEO & GEO (Generative Engine Optimization)

How intern-first.com gets found — by Google, and by the AI assistants (ChatGPT,
Perplexity, Claude, Gemini, Copilot) that increasingly answer "how do I get an
internship" questions directly. GEO is the priority: those answers cite a
handful of sources, and the goal is for InternFirst to be one of them.

Three pieces of infrastructure, all in this repo:

1. **Crawler policy** — which AI bots may read the site (`lib/ai-crawlers.ts`).
2. **Machine-readable site summary** — `/llms.txt` plus structured data.
3. **Content engine** — an agent that drafts guides from a topic queue, and an
   admin desk where a human publishes them (`/dashboard/admin/content`).

## 1. Crawler policy (`robots.txt`)

`src/lib/ai-crawlers.ts` is the one place the policy lives. Every bot is
listed with its vendor, its documentation link and its *purpose*:

| Purpose | What it does | Policy |
|---|---|---|
| `search` | Builds the index behind the vendor's answer engine (OAI-SearchBot, PerplexityBot, Claude-SearchBot, Amazonbot). Being crawled here is how we get **cited**. | Always allowed |
| `user` | Fetches a page live because a person asked the assistant about it (ChatGPT-User, Perplexity-User, Claude-User). | Always allowed |
| `training` | Collects text to train future models (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, meta-externalagent, CCBot). Earns no citations today; it's a bet that the next model generation knows InternFirst. | Allowed via `ALLOW_TRAINING_CRAWLERS` — a business decision, flip it to revisit |

`app/robots.ts` emits one rule per bot from that list (same disallow list as
`*`: dashboards, `/api/`, auth, invites), and `ai-crawlers.test.ts` pins the
decisions. Preview deploys still get `Disallow: /`.

Why list bots we already allow with `*`? Because the intent is explicit. A CDN
"block AI bots" toggle, a copied-in robots snippet, or a WAF rule can quietly
cut the site out of AI answers; a named allow rule is a visible statement to
audit against. **Check the host/CDN too** — Vercel's firewall and Cloudflare
both ship AI-bot blocking that overrides anything in robots.txt.

## 2. What the machines read

- **`/llms.txt`** (`app/llms.txt/route.ts`) — the [llmstxt.org](https://llmstxt.org)
  convention: a Markdown summary with the brand facts we want quoted correctly,
  the key pages, every published guide, and the FAQ. Rendered from
  `lib/brand-facts.ts`, `home-faq-data.ts` and the published articles, so it
  can't drift from the HTML.
- **`lib/brand-facts.ts`** — `SITE_SUMMARY`, `BRAND_FACTS`, `KEY_PAGES`. The
  content agent may only make claims about InternFirst that appear here. When
  pricing, eligibility or features change, change this file first.
- **Structured data** (`lib/structured-data.ts`, `lib/listing-seo.ts`,
  `lib/content-articles.ts`): `Organization` + `WebSite` on the homepage,
  `JobPosting` + `BreadcrumbList` on every listing, `Article` + `FAQPage` +
  `BreadcrumbList` on every guide, `FAQPage` on `/faq`.
- **`/faq`** — the homepage FAQ got dropped with the "Every Campus" redesign;
  it's the most quotable text on the site, so it lives on its own page now.
- **Sitemap** — `/blog`, `/faq` and each published guide are listed; drafts
  can't be (the sitemap reads through the anon client and RLS only exposes
  published rows).

## 3. Content engine

```
admin queues a topic ──► agent drafts it ──► admin reads / edits / publishes
 (content_topics)      (content_articles,       (/dashboard/admin/content)
                          status = draft)
```

**Nothing generated is published automatically.** The agent writes drafts; a
person publishes. That is the line between "InternFirst publishes guides" and
"InternFirst publishes whatever a model said".

### Tables (`migrations/20261111_content_articles.sql`)

- `content_topics` — the queue. `topic`, `target_query` (the question people
  type; the strongest steer), `audience`, `notes`, `status`
  (`queued → generating → generated | failed`, plus `skipped`), `last_error`.
- `content_articles` — `slug`, `title`, `description` (the direct answer; also
  the meta description), `body_markdown`, `key_takeaways[]`, `faq` (JSON Q&A
  → FAQPage), `tags[]`, `audience`, `status` (`draft | published | archived`),
  `generated_by` (model id), `generation_meta` (usage, prompt version,
  validator warnings), `published_at`, `reviewed_by`.
- RLS: admins manage both; anon/authenticated can `select` published articles
  only. The migration is also mirrored into `supabase/schema.sql`.

### The agent (`lib/content-generation.ts`)

One Claude request per article (`lib/content-generation-claude.ts`, model
`claude-opus-5-5` by default, override with `CONTENT_MODEL`), streamed, with
the response constrained to the article JSON schema in
`lib/content-articles.ts`. The system prompt carries the brand facts and the
GEO writing rules: answer in the first paragraph, question-shaped `##`
headings, concrete steps, no invented statistics or features, no external
links, 600–2,200 words, 3–6 takeaways, 3–8 FAQ pairs.

Every draft goes through `validateArticleDraft`: hard failures (no body, no
title, no usable slug) mark the topic `failed` with the reason; soft misses
(too short, an H1, few FAQs) are stored as warnings the admin sees on the
draft. Slugs are de-duplicated against existing articles.

The service is written against two seams — `ArticleWriter` (the model call)
and `ContentRepo` (the database) — so `content-generation-flow.test.ts` runs
the whole pipeline in memory: happy path, refusal, bad JSON, thrown errors,
slug collisions, re-running a failed topic.

### Running it

- **From the admin page**: "Draft now" on a topic, or "Draft next N queued".
  The page polls while a run is in flight.
- **From a terminal / scheduler**: `POST /api/content/generate` with
  `x-cron-secret: $CRON_SECRET` (or `Authorization: Bearer`), body
  `{ "limit": 1-10, "topicId"?: uuid }`. `scripts/generate-articles.mjs` wraps
  it:

  ```bash
  CRON_SECRET=… node scripts/generate-articles.mjs --limit 3
  ```

  A weekly Vercel cron or pg_cron job hitting the same route keeps the draft
  pile topped up; the admin desk is where it's drained.

Environment: `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`
(all server-side; the route returns 503 naming the missing one).

### Publishing

`PATCH /api/content/articles/[id]` (admin session) saves edits and flips
status. Publishing stamps `published_at` once (re-publishing keeps it, so
`dateModified` moves and `datePublished` doesn't) and revalidates `/blog`,
the article, `/llms.txt` and the sitemap so the guide is live immediately.

### Where it renders

- `/blog` — index, split "For students" / "For employers".
- `/blog/[slug]` — key takeaways → body → FAQ (`<details>`) → CTA, with
  Article / FAQPage / BreadcrumbList JSON-LD and an `article` OG card.
- `/llms.txt` — every published guide with its one-line answer.

## Measuring it

- **Google Search Console** — impressions/clicks for `/blog/*` and `/faq`;
  "Enhancements" shows whether the JobPosting / Article markup validates.
- **Bing Webmaster Tools** — ChatGPT search and Copilot lean on Bing's index;
  submit the sitemap there too. IndexNow (a ping on publish) is a cheap next
  step and belongs in the PATCH route.
- **AI crawler hits** — Vercel request logs filtered by the user agents in
  `lib/ai-crawlers.ts` show whether OAI-SearchBot / PerplexityBot are actually
  reading the guides. A log drain to a dashboard is the follow-up.
- **Referrals** — `chatgpt.com`, `perplexity.ai`, `claude.ai`, `copilot.microsoft.com`
  as referrers in `/dashboard/admin/analytics` once `/api/analytics/events`
  records `document.referrer` (not yet; worth adding).
- **Manual** — ask ChatGPT / Perplexity the `target_query` of a published guide
  monthly and note whether intern-first.com is cited.

## Not done yet (deliberate)

- No automatic publishing, no scheduled run is configured — the route is
  ready, the cron isn't registered.
- No images on guides. OG card falls back to the site card.
- No IndexNow ping; no referrer capture in analytics.
- `/internships` has no `ItemList` markup yet; each listing already has
  `JobPosting`.
