import { NextRequest, NextResponse } from 'next/server';
import { resend, FROM_EMAIL, CONTACT_INBOX } from '@/lib/resend';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  employer: 'Employer',
  other: 'Other',
};

export async function POST(request: NextRequest) {
  if (!resend) {
    return NextResponse.json(
      { error: 'Email service not configured.' },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { fullName, email, role } = body;

  if (!fullName || !email) {
    return NextResponse.json(
      { error: 'Name and email are required.' },
      { status: 400 }
    );
  }

  const safeName = escapeHtml(String(fullName));
  const safeEmail = escapeHtml(String(email));
  const safeRole = escapeHtml(ROLE_LABELS[String(role)] || String(role));

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: CONTACT_INBOX,
    replyTo: email,
    subject: `New waitlist signup: ${fullName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="margin-bottom: 4px;">New waitlist signup</h2>
        <p style="color: #6b7280; margin-top: 0;">${safeEmail}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Role:</strong> ${safeRole}</p>
      </div>
    `,
  });

  if (error) {
    console.error('Resend error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification.' },
      { status: 500 }
    );
  }

  console.log('Waitlist email sent', { id: data?.id, to: CONTACT_INBOX });
  return NextResponse.json({ success: true });
}
