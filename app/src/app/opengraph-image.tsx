import { ImageResponse } from 'next/og';

// Next's file convention: this generates the site-wide social card and injects
// og:image into every page's metadata, plus twitter:image (which falls back to
// the OG image when there's no twitter-image file). Because it lives at the app
// root it covers every route, so no page can ship a link preview with no image.
//
// This is a generated placeholder in the brand palette, not a designed asset.
// To replace it with real artwork, delete this file and drop a 1200x630
// `opengraph-image.png` in its place — the convention picks the file up and
// nothing else needs to change.

export const alt =
  'InternFirst — internships for verified students, from reviewed employers.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Brand palette, mirroring globals.css. Hardcoded rather than read from CSS
// because this renders in an isolated Satori context with no stylesheet.
const NAVY = '#1A2D49';
const GREEN = '#9FC63C';
const MUTED = '#C7D0DC';

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: NAVY,
          padding: '80px 90px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 34,
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: -0.5,
          }}
        >
          Intern
          <span style={{ color: GREEN }}>First</span>
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 40,
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.1,
            color: '#FFFFFF',
            letterSpacing: -2,
            maxWidth: 900,
          }}
        >
          The easiest way to find an internship
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 32,
            color: MUTED,
            maxWidth: 860,
            lineHeight: 1.4,
          }}
        >
          Browse opportunities from reviewed employers. No account needed to look.
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 56,
            width: 180,
            height: 8,
            background: GREEN,
            borderRadius: 4,
          }}
        />
      </div>
    ),
    size,
  );
}
