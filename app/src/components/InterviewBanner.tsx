'use client';

type Props = {
  count: number;
  companyName: string;
  scheduledAt: string;
  onRespond: () => void;
};

function formatBannerTime(iso: string) {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} at ${timeStr}`;
}

export default function InterviewBanner({ count, companyName, scheduledAt, onRespond }: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 20px', marginBottom: 24,
      background: 'var(--info-bg-alt)',
      border: '1px solid rgba(99, 102, 241, 0.25)',
      borderRadius: 10,
      borderLeft: '4px solid #6366f1',
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--chip-indigo-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
          {count > 1
            ? `You have ${count} pending interview invitations`
            : `${companyName} would like to interview you`}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {count > 1 ? 'Review and respond to each' : `Proposed for ${formatBannerTime(scheduledAt)}`}
        </div>
      </div>
      <button
        onClick={onRespond}
        style={{
          padding: '7px 16px', background: '#6366f1', color: '#fff',
          borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
          border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        Respond
      </button>
    </div>
  );
}
