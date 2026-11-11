import { SITE_NAME, SITE_URL } from '@/lib/site';
import { BRAND_FACTS, KEY_PAGES, SITE_SUMMARY } from '@/lib/brand-facts';
import { renderLlmsTxt } from '@/lib/content-articles';
import { getPublishedArticles } from '@/lib/content-public';
import { HOME_FAQ } from '@/app/(site)/home-faq-data';

// /llms.txt — the llmstxt.org convention: a Markdown summary of the site for
// language models and the agents built on them, listing the facts we want
// quoted correctly and the pages worth reading. Built from the same brand
// facts, FAQ and published guides the HTML pages use, so it can't drift.
//
// Regenerated at most hourly; publishing a guide revalidates it immediately
// (see /api/content/articles/[id]).

export const revalidate = 3600;

export async function GET() {
  const guides = await getPublishedArticles(100);
  const body = renderLlmsTxt({
    siteName: SITE_NAME,
    siteUrl: SITE_URL,
    summary: SITE_SUMMARY,
    facts: [...BRAND_FACTS],
    keyPages: [...KEY_PAGES],
    guides,
    faq: HOME_FAQ,
    generatedAt: new Date(),
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
