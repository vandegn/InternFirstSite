// The single source of truth for how intern-first.com treats AI crawlers.
//
// Generative engines (ChatGPT, Perplexity, Claude, Gemini, Copilot) decide what
// to cite from what their crawlers are allowed to read. robots.ts turns this
// list into robots.txt rules, docs/geo-seo.md explains the policy to humans,
// and ai-crawlers.test.ts pins the decisions so a copied-in robots snippet or
// a CDN default can't quietly cut the site out of AI answers.
//
// Each bot is classified by what the vendor says it does, because that is what
// the allow/deny decision actually hinges on:
//
//   search    — builds the index behind the vendor's answer engine. Being here
//               is how InternFirst gets *cited* in an AI answer. Always allow.
//   user      — fetches a page live because a person asked the assistant about
//               it. Blocking it breaks "what does intern-first.com say about X".
//               Always allow.
//   training  — collects text to train future models. Allowing it does not
//               earn citations today; it is a brand-awareness bet on the next
//               model generation knowing InternFirst. Allowed by policy, and
//               the one class that is a business decision rather than a
//               technical one — flip `ALLOW_TRAINING_CRAWLERS` to revisit it.

export type CrawlerPurpose = 'search' | 'user' | 'training';

export type AiCrawler = {
  /** Exact `User-agent:` token the vendor documents. */
  userAgent: string;
  vendor: string;
  purpose: CrawlerPurpose;
  /** Where the vendor documents the bot, for the next person who audits this. */
  docs: string;
};

export const ALLOW_TRAINING_CRAWLERS = true;

export const AI_CRAWLERS: readonly AiCrawler[] = [
  // OpenAI — https://platform.openai.com/docs/bots
  { userAgent: 'OAI-SearchBot', vendor: 'OpenAI', purpose: 'search', docs: 'https://platform.openai.com/docs/bots' },
  { userAgent: 'ChatGPT-User', vendor: 'OpenAI', purpose: 'user', docs: 'https://platform.openai.com/docs/bots' },
  { userAgent: 'GPTBot', vendor: 'OpenAI', purpose: 'training', docs: 'https://platform.openai.com/docs/bots' },
  // Anthropic — https://support.anthropic.com/en/articles/8896518
  { userAgent: 'Claude-SearchBot', vendor: 'Anthropic', purpose: 'search', docs: 'https://support.anthropic.com/en/articles/8896518' },
  { userAgent: 'Claude-User', vendor: 'Anthropic', purpose: 'user', docs: 'https://support.anthropic.com/en/articles/8896518' },
  { userAgent: 'ClaudeBot', vendor: 'Anthropic', purpose: 'training', docs: 'https://support.anthropic.com/en/articles/8896518' },
  // Perplexity — https://docs.perplexity.ai/guides/bots
  { userAgent: 'PerplexityBot', vendor: 'Perplexity', purpose: 'search', docs: 'https://docs.perplexity.ai/guides/bots' },
  { userAgent: 'Perplexity-User', vendor: 'Perplexity', purpose: 'user', docs: 'https://docs.perplexity.ai/guides/bots' },
  // Google — Google-Extended is the opt-in for Gemini grounding and training.
  // Googlebot itself is governed by the `*` rule; AI Overviews use its index.
  { userAgent: 'Google-Extended', vendor: 'Google', purpose: 'training', docs: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers' },
  // Microsoft — Bingbot's index is also what Copilot answers from, so it is
  // covered by `*`. No separate AI token to list.
  // Apple — Applebot-Extended is the Apple Intelligence training opt-in.
  { userAgent: 'Applebot-Extended', vendor: 'Apple', purpose: 'training', docs: 'https://support.apple.com/en-us/119829' },
  // Meta
  { userAgent: 'meta-externalagent', vendor: 'Meta', purpose: 'training', docs: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers' },
  // Amazon (Alexa / Rufus answers)
  { userAgent: 'Amazonbot', vendor: 'Amazon', purpose: 'search', docs: 'https://developer.amazon.com/amazonbot' },
  // Common Crawl feeds most open training sets.
  { userAgent: 'CCBot', vendor: 'Common Crawl', purpose: 'training', docs: 'https://commoncrawl.org/ccbot' },
] as const;

export function isCrawlerAllowed(crawler: AiCrawler): boolean {
  return crawler.purpose === 'training' ? ALLOW_TRAINING_CRAWLERS : true;
}

export function allowedAiCrawlers(): AiCrawler[] {
  return AI_CRAWLERS.filter(isCrawlerAllowed);
}

export function blockedAiCrawlers(): AiCrawler[] {
  return AI_CRAWLERS.filter((c) => !isCrawlerAllowed(c));
}

// robots.txt rules, in the shape Next's MetadataRoute.Robots expects. The
// allowed bots repeat the `*` rule verbatim so the intent is explicit; blocked
// bots get `Disallow: /`.
export function aiCrawlerRobotsRules(disallow: readonly string[]) {
  return AI_CRAWLERS.map((crawler) =>
    isCrawlerAllowed(crawler)
      ? { userAgent: crawler.userAgent, allow: '/', disallow: [...disallow] }
      : { userAgent: crawler.userAgent, disallow: '/' },
  );
}
