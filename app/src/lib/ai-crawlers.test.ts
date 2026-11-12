import { describe, expect, it } from 'vitest';
import {
  AI_CRAWLERS,
  aiCrawlerRobotsRules,
  allowedAiCrawlers,
  blockedAiCrawlers,
} from './ai-crawlers';

describe('AI crawler policy', () => {
  it('always allows the crawlers that cite pages in AI answers', () => {
    const allowed = new Set(allowedAiCrawlers().map((c) => c.userAgent));
    for (const ua of ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User']) {
      expect(allowed.has(ua), ua).toBe(true);
    }
  });

  it('never blocks a search or user-triggered crawler regardless of the training switch', () => {
    for (const crawler of blockedAiCrawlers()) {
      expect(crawler.purpose).toBe('training');
    }
  });

  it('documents every bot with a vendor and a docs link', () => {
    for (const crawler of AI_CRAWLERS) {
      expect(crawler.vendor).toBeTruthy();
      expect(crawler.docs).toMatch(/^https:\/\//);
      expect(crawler.userAgent).not.toMatch(/\s/);
    }
  });

  it('lists each user agent once', () => {
    const tokens = AI_CRAWLERS.map((c) => c.userAgent.toLowerCase());
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('emits one robots rule per bot that mirrors the site-wide disallow list', () => {
    const rules = aiCrawlerRobotsRules(['/dashboard', '/api/']);
    expect(rules).toHaveLength(AI_CRAWLERS.length);
    const search = rules.find((r) => r.userAgent === 'OAI-SearchBot');
    expect(search).toEqual({ userAgent: 'OAI-SearchBot', allow: '/', disallow: ['/dashboard', '/api/'] });
    for (const rule of rules) {
      if (rule.allow === '/') expect(rule.disallow).not.toContain('/');
      else expect(rule.disallow).toBe('/');
    }
  });
});
