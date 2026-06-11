import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { resend, FROM_EMAIL } from '@/lib/resend';
import { newMessageEmail } from '@/lib/email-templates';

const NOTIFY_WINDOW_MINUTES = 10;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { receiverId, body, applicationId } = await req.json();
  if (!receiverId || !body || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'receiverId and body are required' }, { status: 400 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('messages')
    .insert({
      sender_id: user.id,
      receiver_id: receiverId,
      body: body.trim(),
      application_id: applicationId ?? null,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed to send' }, { status: 500 });
  }

  void sendNotificationEmail({
    messageId: inserted.id,
    senderId: user.id,
    receiverId,
    bodyPreview: body.trim().slice(0, 200),
  });

  return NextResponse.json(inserted);
}

async function sendNotificationEmail(opts: {
  messageId: string;
  senderId: string;
  receiverId: string;
  bodyPreview: string;
}) {
  if (!resend) return;

  const admin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );

  const windowStart = new Date(Date.now() - NOTIFY_WINDOW_MINUTES * 60_000).toISOString();
  const { data: recent } = await admin
    .from('messages')
    .select('id')
    .eq('sender_id', opts.senderId)
    .eq('receiver_id', opts.receiverId)
    .gte('email_notified_at', windowStart)
    .limit(1);

  if (recent && recent.length > 0) return;

  const { data: senderProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('user_id', opts.senderId)
    .single();

  const { data: receiverProfile } = await admin
    .from('profiles')
    .select('full_name, email, role')
    .eq('user_id', opts.receiverId)
    .single();

  if (!receiverProfile?.email || !senderProfile?.full_name) return;
  if (receiverProfile.role !== 'student' && receiverProfile.role !== 'employer') return;

  const { subject, html } = newMessageEmail({
    recipientRole: receiverProfile.role,
    senderName: senderProfile.full_name,
    preview: opts.bodyPreview,
  });

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: receiverProfile.email,
    subject,
    html,
  });

  if (error) {
    console.error('Resend (message notification) error:', error);
    return;
  }

  await admin
    .from('messages')
    .update({ email_notified_at: new Date().toISOString() })
    .eq('id', opts.messageId);
}
