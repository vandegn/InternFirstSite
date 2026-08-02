import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

// In-product feedback from the student and employer dashboards. Rows land in
// feedback_submissions and are reviewed on the admin-only Feedback tab
// (/dashboard/admin/feedback).
//
// This used to insert a message addressed to an admin account, which meant
// resolving a recipient by email at request time and burying feedback among
// real conversations. Writing a dedicated record removes both problems: there
// is no recipient to look up, and every submission carries a status.
const MAX_BODY = 4000;

const CATEGORIES = new Set(['bug', 'idea', 'other']);

export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { category, message, pagePath }: { category?: string; message?: string; pagePath?: string } =
    await req.json().catch(() => ({}));

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Please write your feedback before sending.' }, { status: 400 });
  }

  // Snapshotted onto the row so the submission stays meaningful even if the
  // account is later deleted.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from('feedback_submissions')
    .insert({
      user_id: user.id,
      submitter_email: profile?.email ?? user.email ?? null,
      submitter_name: profile?.full_name ?? null,
      submitter_role: profile?.role ?? null,
      category: category && CATEGORIES.has(category) ? category : 'other',
      message: message.trim().slice(0, MAX_BODY),
      page_path: typeof pagePath === 'string' && pagePath.startsWith('/') ? pagePath : null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[feedback] insert failed', error.message);
    return NextResponse.json({ error: 'Could not send your feedback.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
