'use client';

// Early-days notice shown across every student and employer dashboard page.
// Sits above the header so it reads as a platform-level message rather than
// something belonging to whichever page is underneath it.
export default function CommunityBanner() {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '9px 20px',
        background: 'var(--primary, #1A2D49)',
        color: '#fff',
        fontSize: '0.82rem',
        lineHeight: 1.45,
        textAlign: 'center',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent, #9FC63C)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
        aria-hidden="true"
      >
        <path d="M12 2v4" />
        <path d="M12 18v4" />
        <path d="M4.93 4.93l2.83 2.83" />
        <path d="M16.24 16.24l2.83 2.83" />
        <path d="M2 12h4" />
        <path d="M18 12h4" />
        <path d="M4.93 19.07l2.83-2.83" />
        <path d="M16.24 7.76l2.83-2.83" />
      </svg>
      <span>
        We&rsquo;re just getting started! New students and employers are joining as
        time goes on. Thanks for growing with us as the InternFirst community
        takes shape.
      </span>
    </div>
  );
}
