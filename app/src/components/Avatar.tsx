'use client';

/**
 * Profile picture with an initial-based fallback.
 *
 * New signups used to get a shared stock photo hosted off-platform, which made
 * every unfamiliar account look like the same person. The fallback is now the
 * account's own first initial on a colour derived from their name, so two
 * people in a list are always visually distinct without anyone uploading
 * anything.
 *
 * The colour is a hash of the name rather than random, so a given person keeps
 * the same swatch everywhere they appear — pipeline card, inbox, applicant row.
 */

// Picked to stay legible against white text in both themes.
const INITIAL_COLORS = [
  '#7B61FF', // primary violet
  '#2563eb',
  '#0891b2',
  '#059669',
  '#65a30d',
  '#d97706',
  '#dc2626',
  '#db2777',
  '#7c3aed',
  '#475569',
];

function hashToIndex(seed: string, buckets: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % buckets;
}

/** First character of the first word that starts with a letter or digit. */
export function initialFor(name?: string | null): string {
  if (!name) return '?';
  for (const word of name.trim().split(/\s+/)) {
    const ch = word[0];
    if (ch && /[\p{L}\p{N}]/u.test(ch)) return ch.toUpperCase();
  }
  return '?';
}

export function avatarColorFor(name?: string | null): string {
  return INITIAL_COLORS[hashToIndex((name || '?').trim().toLowerCase(), INITIAL_COLORS.length)];
}

export default function Avatar({
  src,
  name,
  size = 40,
  className,
  style,
  rounded = '50%',
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Square-ish avatars (company logos) pass a radius instead of a circle. */
  rounded?: string;
}) {
  const shared: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: rounded,
    flexShrink: 0,
    ...style,
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Profile'}
        className={className}
        style={{ ...shared, objectFit: 'cover' }}
      />
    );
  }

  return (
    <div
      className={className}
      // Treated as an image with the name as its label, so screen readers
      // announce "Jane Doe" rather than the bare letter "J".
      role="img"
      aria-label={name || 'Profile'}
      style={{
        ...shared,
        background: avatarColorFor(name),
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Tracks the circle so the letter stays optically centred at any size.
        fontSize: Math.max(11, Math.round(size * 0.42)),
        fontWeight: 600,
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      {initialFor(name)}
    </div>
  );
}
