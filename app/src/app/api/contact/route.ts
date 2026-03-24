import { NextRequest, NextResponse } from 'next/server';
import { resend, FROM_EMAIL } from '@/lib/resend';

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

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: 'info@intern-first.com',
    replyTo: email,
    subject: subject ? `Contact: ${subject}` : `Contact form from ${name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="margin-bottom: 4px;">New message from ${name}</h2>
        <p style="color: #6b7280; margin-top: 0;">${email}</p>
        ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
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

  return NextResponse.json({ success: true });
}
