import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const FROM_EMAIL = 'InternFirst <noreply@intern-first.com>';
export const CONTACT_INBOX = process.env.CONTACT_INBOX_EMAIL || 'jonahkeshguerian@intern-first.com';
