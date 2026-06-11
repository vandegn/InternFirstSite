// Temporary pre-launch marker shown on every internship listing to make clear
// the postings are test data, not real opportunities. Remove this component
// (and its usages) at launch.

export default function TestPostingBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      title="This is a test posting for demonstration purposes — not a real job."
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: 'transparent',
        color: 'var(--text-light, #9ca3af)',
        borderRadius: '999px',
        padding: 0,
        fontSize: compact ? '0.62rem' : '0.68rem',
        fontWeight: 500,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        opacity: 0.75,
      }}
    >
      <svg width={compact ? 9 : 10} height={compact ? 9 : 10} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
      </svg>
      {compact ? 'Test posting' : 'Test posting · not a real job'}
    </span>
  );
}
