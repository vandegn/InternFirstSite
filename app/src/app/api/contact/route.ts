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

export async function POST(request: NextRequest) {
  if (!resend) {
    return NextResponse.json(
      { error: 'Email service not configured.' },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { name, email, subject, message } = body;

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: 'Name, email, and message are required.' },
      { status: 400 }
    );
  }

  const safeName = escapeHtml(String(name));
  const safeEmail = escapeHtml(String(email));
  const safeSubject = subject ? escapeHtml(String(subject)) : '';
  const safeMessage = escapeHtml(String(message));

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: CONTACT_INBOX,
    replyTo: email,
    subject: subject ? `Contact: ${subject}` : `Contact form from ${name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="margin-bottom: 4px;">New message from ${safeName}</h2>
        <p style="color: #6b7280; margin-top: 0;">${safeEmail}</p>
        ${safeSubject ? `<p><strong>Subject:</strong> ${safeSubject}</p>` : ''}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="white-space: pre-wrap; line-height: 1.6;">${safeMessage}</p>
      </div>
    `,
  });

  if (error) {
    console.error('Resend error:', error);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again.' },
      { status: 500 }
    );
  }

  console.log('Contact email sent', { id: data?.id, to: CONTACT_INBOX });
  return NextResponse.json({ success: true });
}
