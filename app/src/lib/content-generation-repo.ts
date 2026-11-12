import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContentRepo, DraftInsert } from '@/lib/content-generation';
import type { ContentTopic, TopicStatus } from '@/lib/content-articles';

// Service-role implementation of ContentRepo. The caller (the generate route)
// has already authorised the request; this just needs to write drafts and
// flip topic status, which the anon/authenticated policies don't allow.

export function createContentRepo(db: SupabaseClient): ContentRepo {
  return {
    async claimTopics({ limit, topicId }) {
      let query = db
        .from('content_topics')
        .select('id, topic, target_query, audience, notes, status, last_error, created_at, updated_at')
        .order('created_at', { ascending: true })
        .limit(limit);
      // A specific topic can be re-run from any state (an admin pressing
      // "Generate" on a failed one); the scheduled run only takes the queue.
      query = topicId ? query.eq('id', topicId) : query.eq('status', 'queued');
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const topics = (data ?? []) as ContentTopic[];
      if (topics.length === 0) return [];
      const { error: claimError } = await db
        .from('content_topics')
        .update({ status: 'generating', last_error: null })
        .in('id', topics.map((t) => t.id));
      if (claimError) throw new Error(claimError.message);
      return topics;
    },

    async listExistingArticles() {
      const { data, error } = await db
        .from('content_articles')
        .select('title, slug')
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as { title: string; slug: string }[];
    },

    async slugExists(slug) {
      const { data, error } = await db.from('content_articles').select('id').eq('slug', slug).maybeSingle();
      if (error) throw new Error(error.message);
      return Boolean(data);
    },

    async insertDraft(row: DraftInsert) {
      const { data, error } = await db
        .from('content_articles')
        .insert({ ...row, status: 'draft' })
        .select('id, slug')
        .single();
      if (error) throw new Error(error.message);
      return data as { id: string; slug: string };
    },

    async markTopic(id: string, status: TopicStatus, lastError: string | null) {
      const { error } = await db.from('content_topics').update({ status, last_error: lastError }).eq('id', id);
      if (error) throw new Error(error.message);
    },
  };
}
