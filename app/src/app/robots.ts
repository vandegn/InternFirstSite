import type { MetadataRoute } from 'next';
import { SITE_URL, DISALLOWED_PATHS } from '@/lib/site';
import { aiCrawlerRobotsRules } from '@/lib/ai-crawlers';

// AI crawlers (OAI-SearchBot, GPTBot, PerplexityBot, ClaudeBot, ...) each get
// their own rule from lib/ai-crawlers.ts — the one place the allow/deny policy
// is written down and tested. Naming them is the GEO equivalent of a sitemap:
// it states the intent explicitly so a future blanket block, a CDN default, or
// a copied-in robots snippet can't quietly cut InternFirst out of AI answers.

// Served at /robots.txt.
export const revalidate = 3600;

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
      ...aiCrawlerRobotsRules(disallow),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    // No `host`. It's a Yandex-only directive Google ignores, and it wants a
    // bare hostname anyway — `host: https://www.intern-first.com` was invalid
    // on both counts. Apex-to-www canonicalisation is a 301, not a robots line.
  };
}
