'use client';

import { useSyncExternalStore } from 'react';
import { Theme, getStoredTheme, setTheme } from '@/lib/theme';

/** Subscribes to theme changes from this tab (custom event) and other tabs (storage). */
function subscribe(onChange: () => void) {
  window.addEventListener('internfirst-theme-change', onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener('internfirst-theme-change', onChange);
    window.removeEventListener('storage', onChange);
  };
}

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

/** Miniature dashboard mock so each option previews what it actually looks like. */
function Preview({ mode }: { mode: Theme }) {
  const c =
    mode === 'dark'
      ? { bg: '#0A121F', card: '#141F33', line: '#26385A', accent: '#9FC63C', text: '#7BA7E8' }
      : { bg: '#F8F9FC', card: '#ffffff', line: '#e5e7eb', accent: '#9FC63C', text: '#1A2D49' };

  return (
    <div
      aria-hidden
      style={{
        display: 'flex',
        gap: 4,
        height: 46,
        padding: 5,
        borderRadius: 8,
        background: c.bg,
        border: `1px solid ${c.line}`,
        overflow: 'hidden',
      }}
    >
      <div style={{ width: 12, borderRadius: 3, background: c.card, border: `1px solid ${c.line}` }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ height: 7, borderRadius: 2, background: c.accent, width: '55%' }} />
        <div style={{ flex: 1, borderRadius: 3, background: c.card, border: `1px solid ${c.line}` }} />
        <div style={{ height: 5, borderRadius: 2, background: c.text, width: '70%', opacity: 0.75 }} />
      </div>
    </div>
  );
}

export default function ThemePicker() {
  // Server renders 'light'; the inline head script has already painted the real
  // theme, so the only thing that reconciles here is which card reads selected.
  const theme = useSyncExternalStore<Theme>(subscribe, getStoredTheme, () => 'light');

  const options: { value: Theme; label: string; hint: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', hint: 'Clean and bright', icon: <SunIcon /> },
    { value: 'dark', label: 'Dark', hint: 'Easy on the eyes', icon: <MoonIcon /> },
  ];

  return (
    <div role="radiogroup" aria-label="Color theme" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {options.map(opt => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(opt.value)}
            style={{
              textAlign: 'left',
              padding: 12,
              borderRadius: 14,
              cursor: 'pointer',
              background: active ? 'var(--accent-light)' : 'var(--surface)',
              border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              boxShadow: active ? '0 6px 18px -8px rgba(159, 198, 60, 0.7)' : 'none',
              transition: 'border-color 0.18s, background 0.18s, box-shadow 0.18s, transform 0.18s',
              transform: active ? 'translateY(-1px)' : 'none',
              font: 'inherit',
              color: 'var(--text)',
            }}
          >
            <Preview mode={opt.value} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <span style={{ display: 'flex', color: active ? 'var(--accent)' : 'var(--text-secondary)' }}>{opt.icon}</span>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{opt.label}</span>
              <span
                aria-hidden
                style={{
                  marginLeft: 'auto',
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: active ? 'var(--accent)' : 'transparent',
                  border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  transition: 'background 0.18s, border-color 0.18s',
                }}
              >
                {active && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2 }}>{opt.hint}</p>
          </button>
        );
      })}
    </div>
  );
}
