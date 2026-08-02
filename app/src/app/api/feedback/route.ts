import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getAdminSupabase } from '@/lib/supabase-server';

// Feedback from the student and employer dashboards lands in the InternFirst
// admin's inbox as a normal message, so it shows up in the same place the team
// already reads and can be replied to in-platform (closed ecosystem — no
// separate ticketing tool, no email hand-off).
//
// The admin mailbox is resolved server-side rather than trusted from the
// client: a receiverId in the request body would let anyone address anyone.
const ADMIN_EMAIL = process.env.ADMIN_FEEDBACK_EMAIL || 'admin@chud-team.com';

const MAX_BODY = 4000;

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug report',
  idea: 'Feature idea',
  other: 'General feedback',
};

async function resolveAdminUserId(): Promise<string | null> {
  const admin = getAdminSupabase();

  // Preferred: the configured admin mailbox.
  const { data: byEmail } = await admin
    .from('profiles')
    .select('user_id')
    .eq('email', ADMIN_EMAIL)
    .eq('role', 'intern_first_admin')
    .maybeSingle();
  if (byEmail?.user_id) return byEmail.user_id;

  // Fallback: any admin, so feedback is never silently dropped because the
  // configured address changed.
  const { data: anyAdmin } = await admin
    .from('profiles')
    .select('user_id')
    .eq('role', 'intern_first_admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return anyAdmin?.user_id ?? null;
}

export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { category, message, pagePath }: { category?: string; message?: string; pagePath?: string } =
    await req.json().catch(() => ({}));

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Please write your feedback before sending.' }, { status: 400 });
  }

  const adminUserId = await resolveAdminUserId();
  if (!adminUserId) {
    console.error('[feedback] no intern_first_admin profile found');
    return NextResponse.json(
      { error: 'Feedback is unavailable right now. Please try again later.' },
      { status: 503 },
    );
  }
  if (adminUserId === user.id) {
    return NextResponse.json({ error: 'Admins cannot send feedback to themselves.' }, { status: 400 });
  }

  const label = (category && CATEGORY_LABELS[category]) || CATEGORY_LABELS.other;
  const from = typeof pagePath === 'string' && pagePath.startsWith('/') ? pagePath : null;
  const body = [
    `[${label}]${from ? ` from ${from}` : ''}`,
    message.trim().slice(0, MAX_BODY),
  ].join('\n\n');

  // Sent as the user (not the service role) so it threads into the normal
  // conversation view on both sides and RLS still governs who can read it.
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: user.id, receiver_id: adminUserId, body })
    .select('id')
    .single();

  if (error) {
    console.error('[feedback] insert failed', error.message);
    return NextResponse.json({ error: 'Could not send your feedback.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
