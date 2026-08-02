'use client';

import { PASSWORD_REQUIREMENTS, scorePassword } from '@/lib/password';

const BAR_COLORS = [
  'var(--danger-accent)',
  'var(--danger-accent)',
  'var(--chip-amber-ink)',
  'var(--chip-blue-ink)',
  'var(--accent, #9FC63C)',
];

// Segmented strength bar plus the checklist of hard requirements. Renders
// nothing until the user types, so an untouched form isn't shouting at them.
export default function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const { score, label, met, hint } = scorePassword(password);
  const color = BAR_COLORS[score];

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i < score ? color : 'var(--border)',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>{label}</span>
        {hint && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
            {hint}
          </span>
        )}
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 3 }}>
        {PASSWORD_REQUIREMENTS.map((req) => {
          const ok = met[req.id];
          return (
            <li
              key={req.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.72rem',
                color: ok ? 'var(--text-secondary)' : 'var(--text-light)',
              }}
            >
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke={ok ? 'var(--accent, #9FC63C)' : 'var(--text-light)'}
                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0 }}
                aria-hidden="true"
              >
                {ok ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="8" />}
              </svg>
              <span style={{ textDecoration: ok ? 'line-through' : 'none' }}>{req.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
