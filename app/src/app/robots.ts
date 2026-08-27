import type { MetadataRoute } from 'next';
import { SITE_URL, DISALLOWED_PATHS } from '@/lib/site';

// Served at /robots.txt.
export const revalidate = 3600;

// Crawlers that ground AI answers. They're already covered by the `*` rule, but
// naming them is the GEO equivalent of a sitemap: it states the intent
// explicitly so a future blanket block, a CDN default, or a copied-in robots
// snippet can't quietly cut InternFirst out of AI-generated answers.
//
// Note this is a business decision, not just a technical one — allowing these
// means InternFirst content can be used to ground (and, for some of them,
// train) AI answers. That's the point of GEO, but it is a choice.
const AI_CRAWLERS = [
  'OAI-SearchBot',    // ChatGPT search index
  'ChatGPT-User',     // ChatGPT browsing on a user's behalf
  'GPTBot',           // OpenAI crawler
  'PerplexityBot',
  'Perplexity-User',
  'ClaudeBot',
  'Claude-User',
  'Google-Extended',  // Gemini / AI Overviews grounding
  'Applebot-Extended',
  'meta-externalagent',
];

export default function robots(): MetadataRoute.Robots {
  const disallow = [...DISALLOWED_PATHS];

  // Preview and branch deploys must never be indexed — they'd compete with the
  // real domain for the same content. Vercel sets VERCEL_ENV to
  // 'production' | 'preview' | 'development'.
  //
  // This blocks only when we can positively identify a non-production Vercel
  // deploy. An *absent* VERCEL_ENV (local dev, self-hosting, another host) is
  // treated as production on purpose: silently serving `Disallow: /` from the
  // real domain would be far more damaging than a preview URL getting indexed,
  // and localhost isn't crawlable anyway.
  const vercelEnv = process.env.VERCEL_ENV;
  const isNonProdDeploy = Boolean(vercelEnv) && vercelEnv !== 'production';

  if (isNonProdDeploy) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/', disallow })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    // No `host`. It's a Yandex-only directive Google ignores, and it wants a
    // bare hostname anyway — `host: https://www.intern-first.com` was invalid
    // on both counts. Apex-to-www canonicalisation is a 301, not a robots line.
  };
}
