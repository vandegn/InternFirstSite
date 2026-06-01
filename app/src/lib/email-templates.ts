const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://intern-first.com';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell(title: string, bodyHtml: string, ctaUrl: string, ctaLabel: string): string {
  return `
    <div style="font-family: 'DM Sans', system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111827;">
      <h2 style="margin: 0 0 12px; font-size: 20px;">${title}</h2>
      <div style="font-size: 15px; line-height: 1.6;">${bodyHtml}</div>
      <p style="margin: 24px 0;">
        <a href="${ctaUrl}" style="display: inline-block; background: #7B61FF; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">${ctaLabel}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="font-size: 12px; color: #6b7280; margin: 0;">InternFirst — the closed-ecosystem internship platform.</p>
    </div>
  `;
}

function formatWhen(scheduledAt: string, durationMinutes: number): string {
  const d = new Date(scheduledAt);
  const date = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  return `${date} at ${time} (${durationMinutes} min)`;
}

export function newMessageEmail(opts: {
  recipientRole: 'student' | 'employer';
  senderName: string;
  preview: string;
}) {
  const inboxPath = opts.recipientRole === 'student' ? '/dashboard/student/inbox' : '/dashboard/employer/inbox';
  const ctaUrl = `${APP_URL}${inboxPath}`;
  const subject = `${opts.senderName} sent you a message on InternFirst`;
  const html = shell(
    `${escapeHtml(opts.senderName)} sent you a message`,
    `<p>You have a new message waiting in your InternFirst inbox:</p>
     <blockquote style="border-left: 3px solid #7B61FF; padding: 8px 12px; margin: 12px 0; color: #374151; background: #f9fafb;">${escapeHtml(opts.preview)}</blockquote>
     <p>Open your inbox to read the full conversation and reply.</p>`,
    ctaUrl,
    'Open Inbox',
  );
  return { subject, html };
}

export function interviewScheduledStudentEmail(opts: {
  employerName: string;
  companyName: string;
  listingTitle: string;
  scheduledAt: string;
  durationMinutes: number;
  interviewId: string;
}) {
  const ctaUrl = `${APP_URL}/dashboard/student/interviews/${opts.interviewId}`;
  const subject = `${opts.companyName} scheduled an interview with you`;
  const html = shell(
    `Interview scheduled with ${escapeHtml(opts.companyName)}`,
    `<p><strong>${escapeHtml(opts.employerName)}</strong> at <strong>${escapeHtml(opts.companyName)}</strong> scheduled an interview with you for the <strong>${escapeHtml(opts.listingTitle)}</strong> position.</p>
     <p><strong>When:</strong> ${escapeHtml(formatWhen(opts.scheduledAt, opts.durationMinutes))}</p>
     <p>Confirm or request a reschedule from your interview page.</p>`,
    ctaUrl,
    'View Interview',
  );
  return { subject, html };
}

export function interviewScheduledEmployerEmail(opts: {
  studentName: string;
  listingTitle: string;
  scheduledAt: string;
  durationMinutes: number;
  interviewId: string;
}) {
  const ctaUrl = `${APP_URL}/dashboard/employer/interviews/${opts.interviewId}`;
  const subject = `Interview scheduled with ${opts.studentName}`;
  const html = shell(
    `You scheduled an interview with ${escapeHtml(opts.studentName)}`,
    `<p>Your interview with <strong>${escapeHtml(opts.studentName)}</strong> for the <strong>${escapeHtml(opts.listingTitle)}</strong> position is on the calendar.</p>
     <p><strong>When:</strong> ${escapeHtml(formatWhen(opts.scheduledAt, opts.durationMinutes))}</p>`,
    ctaUrl,
    'View Interview',
  );
  return { subject, html };
}

export function interviewReminderEmail(opts: {
  recipientRole: 'student' | 'employer';
  otherPartyName: string;
  listingTitle: string;
  scheduledAt: string;
  durationMinutes: number;
  interviewId: string;
}) {
  const path = opts.recipientRole === 'student'
    ? `/dashboard/student/interviews/${opts.interviewId}`
    : `/dashboard/employer/interviews/${opts.interviewId}`;
  const ctaUrl = `${APP_URL}${path}`;
  const subject = `Reminder: interview with ${opts.otherPartyName} in 30 minutes`;
  const html = shell(
    `Your interview starts in 30 minutes`,
    `<p>This is a reminder that your interview with <strong>${escapeHtml(opts.otherPartyName)}</strong> for the <strong>${escapeHtml(opts.listingTitle)}</strong> position starts in about 30 minutes.</p>
     <p><strong>When:</strong> ${escapeHtml(formatWhen(opts.scheduledAt, opts.durationMinutes))}</p>
     <p>Join the interview room from your dashboard.</p>`,
    ctaUrl,
    'Open Interview Room',
  );
  return { subject, html };
}
