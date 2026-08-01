'use client';

import ReactMarkdown from 'react-markdown';

export type RenderableSection = { heading: string; body: string };

// The employer's accent color is used for decoration only — banner tint, the
// rule under a section heading — never as a text or button color. Employers can
// pick any hex, and we can't guarantee contrast for arbitrary values.
const DEFAULT_ACCENT = 'var(--primary)';

export function ListingBanner({ bannerUrl, accentColor }: {
  bannerUrl?: string | null;
  accentColor?: string | null;
}) {
  if (!bannerUrl && !accentColor) return null;

  if (!bannerUrl) {
    // Accent set but no image: a slim color strip still brands the posting.
    return (
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: accentColor || DEFAULT_ACCENT,
          marginBottom: '20px',
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 1',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: '20px',
        background: accentColor || 'var(--bg-light)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bannerUrl}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {accentColor && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: accentColor }} />
      )}
    </div>
  );
}

export function RoleTagPills({ tags }: { tags?: string[] | null }) {
  if (!tags || tags.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            padding: '4px 12px',
            borderRadius: 999,
            fontSize: '0.78rem',
            fontWeight: 600,
            background: 'var(--primary-light)',
            color: 'var(--primary)',
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

// Extra employer-authored sections, rendered after the core three.
export default function ListingCustomBlocks({ sections, accentColor }: {
  sections: RenderableSection[];
  accentColor?: string | null;
}) {
  const visible = sections.filter((s) => s.heading.trim() && s.body.trim());
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((section, i) => (
        <div key={`${section.heading}-${i}`} style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '8px' }}>{section.heading}</h3>
          <div
            style={{
              width: 32,
              height: 3,
              borderRadius: 999,
              background: accentColor || DEFAULT_ACCENT,
              marginBottom: '12px',
            }}
          />
          <div className="markdown-content"><ReactMarkdown>{section.body}</ReactMarkdown></div>
        </div>
      ))}
    </>
  );
}
