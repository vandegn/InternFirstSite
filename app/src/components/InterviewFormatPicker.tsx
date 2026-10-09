'use client';

import {
  INTERVIEW_FORMATS,
  INTERVIEW_FORMAT_LABELS,
  INTERVIEW_FORMAT_DESCRIPTIONS,
  type InterviewFormat,
} from '@/lib/interview-format';

type Props = {
  format: InterviewFormat;
  meetingUrl: string;
  onFormatChange: (format: InterviewFormat) => void;
  onMeetingUrlChange: (url: string) => void;
  disabled?: boolean;
};

// Used by ConfirmMeetingModal (the confirm step of scheduling): how the
// interview happens, plus the link field when the employer brings their own.
export default function InterviewFormatPicker({
  format,
  meetingUrl,
  onFormatChange,
  onMeetingUrlChange,
  disabled,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span id="interview-format-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>
        Interview format
      </span>
      <div role="radiogroup" aria-labelledby="interview-format-label" style={{ display: 'flex', gap: 6 }}>
        {INTERVIEW_FORMATS.map(f => {
          const active = format === f;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onFormatChange(f)}
              style={{
                flex: 1, padding: '8px 6px', borderRadius: 8,
                border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                background: active ? 'var(--primary)' : 'var(--surface)',
                color: active ? 'var(--on-primary)' : 'var(--text)',
                fontSize: '0.78rem', fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {INTERVIEW_FORMAT_LABELS[f]}
            </button>
          );
        })}
      </div>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
        {INTERVIEW_FORMAT_DESCRIPTIONS[format]}
      </span>
      {format === 'external_link' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>Meeting link</span>
          <input
            type="url"
            inputMode="url"
            value={meetingUrl}
            onChange={e => onMeetingUrlChange(e.target.value)}
            placeholder="https://zoom.us/j/…"
            disabled={disabled}
            style={{
              padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
              fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--text)',
            }}
          />
        </label>
      )}
    </div>
  );
}
