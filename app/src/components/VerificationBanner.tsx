'use client';

import { VERIFICATION_LABELS, type VerificationStatus } from '@/lib/supabase';

// Single source of truth for how verification state is explained to employers.
// Used on the account, settings, and applications pages so the three can't
// drift into telling someone three different things about the same account.

const ICONS: Record<VerificationStatus, React.ReactNode> = {
  approved: <polyline points="20 6 9 17 4 12" />,
  pending: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  needs_info: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
  rejected: <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>,
};

const TONE: Record<VerificationStatus, { bg: string; border: string; chip: string; ink: string }> = {
  approved: { bg: '#f0fdf4', border: '#bbf7d0', chip: '#d1fae5', ink: '#065f46' },
  pending: { bg: '#fffbeb', border: '#fde68a', chip: '#fef3c7', ink: '#92400e' },
  needs_info: { bg: '#eef2ff', border: '#c7d2fe', chip: '#e0e7ff', ink: '#3730a3' },
  rejected: { bg: '#fef2f2', border: '#fecaca', chip: '#fee2e2', ink: '#991b1b' },
};

// Pill colours for the compact status chip, shared with the admin review queue.
export const VERIFICATION_CHIP: Record<VerificationStatus, { bg: string; color: string }> =
  Object.fromEntries(
    (Object.keys(TONE) as VerificationStatus[]).map((k) => [k, { bg: TONE[k].chip, color: TONE[k].ink }]),
  ) as Record<VerificationStatus, { bg: string; color: string }>;

function describe(status: VerificationStatus, pendingCount?: number): string {
  const waiting = pendingCount && pendingCount > 0
    ? ` ${pendingCount} application${pendingCount === 1 ? '' : 's'} ${pendingCount === 1 ? 'is' : 'are'} already waiting.`
    : '';

  switch (status) {
    case 'approved':
      return 'Your company is verified. Your listings are live and you have full access to applicants.';
    case 'pending':
      return `We review every employer before their listings go live, usually within one business day. You can create and edit listings now — students will see them, and you'll be able to see applicants, once you're approved.${waiting}`;
    case 'needs_info':
      return `We need a bit more information before approving your account. Once you've sorted it, reply to our email and we'll take another look.${waiting}`;
    case 'rejected':
      return 'We were not able to verify this company. If you think that is a mistake, reply to our email and we will review it again.';
  }
}

export default function VerificationBanner({
  status,
  note,
  pendingCount,
  style,
}: {
  status: VerificationStatus;
  note?: string | null;
  pendingCount?: number;
  style?: React.CSSProperties;
}) {
  const tone = TONE[status];

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      padding: '14px 16px', borderRadius: 'var(--radius-sm)',
      background: tone.bg, border: `1px solid ${tone.border}`,
      ...style,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: tone.chip,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tone.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {ICONS[status]}
        </svg>
      </div>
      <div>
        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{VERIFICATION_LABELS[status]}</p>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.5 }}>
          {describe(status, pendingCount)}
        </p>
        {note && status !== 'approved' && (
          <p style={{ fontSize: '0.82rem', color: tone.ink, marginTop: '8px', lineHeight: 1.5, fontWeight: 500 }}>
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
