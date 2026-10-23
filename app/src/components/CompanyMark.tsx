import type { CSSProperties } from 'react';

type Props = {
  /** Company name; its first letter is the fallback when there is no icon. */
  name?: string | null;
  /** employers.icon_url — the square mark uploaded for job cards. */
  iconUrl?: string | null;
  /** employers.logo_url — the full-size logo, kept as the legacy fallback. */
  logoUrl?: string | null;
  /** Box edge in px. The box keeps this size whatever is inside it. */
  size: number;
  radius?: number | string;
  /** Initial-box overrides, e.g. the selected card in the browse list. */
  background?: string;
  color?: string;
  fontSize?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * The small box beside a company name on every job posting card.
 *
 * Shows, in order: the employer's uploaded company icon (centred, padded,
 * proportions preserved — never stretched or cropped), else the full-size logo
 * exactly as cards rendered it before the icon existed, else the company's
 * first initial. Every card reads the same employers.icon_url, so replacing
 * or removing the icon on the Account page changes all of them at once.
 */
export default function CompanyMark({
  name, iconUrl, logoUrl, size, radius, background, color, fontSize, className, style,
}: Props) {
  const box: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius ?? Math.round(size * 0.2),
    flexShrink: 0,
    boxSizing: 'border-box',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  };

  if (iconUrl) {
    // Enough breathing room that a square icon never touches the edges.
    const pad = Math.max(3, Math.round(size * 0.12));
    return (
      <div
        className={className}
        style={{ ...box, padding: pad, background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl}
          alt={name ? `${name} icon` : ''}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>
    );
  }

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={className}
        src={logoUrl}
        alt={name ?? ''}
        style={{ ...box, objectFit: 'cover', display: 'block' }}
      />
    );
  }

  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        ...box,
        background: background ?? 'var(--primary-light)',
        color: color ?? 'var(--primary)',
        fontWeight: 700,
        fontSize: fontSize ?? `${Math.round(size * 0.45)}px`,
        lineHeight: 1,
      }}
    >
      {name?.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}
