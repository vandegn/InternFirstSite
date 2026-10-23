'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  formatMeetingWhen,
  formatSlotRange,
  isMeetingType,
  localTimeZone,
  MEETING_TYPE_LABELS,
} from '@/lib/interview-availability';
import { interviewFormatOf } from '@/lib/interview-format';
import { joinAction } from '@/lib/interview-join';

export type InterviewListItem = {
  id: string;
  applicationId: string;
  /** The other party: the candidate for employers, the company for students. */
  counterpart: string;
  jobTitle: string;
  meetingType?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  format?: string | null;
  meetingUrl?: string | null;
  notes?: string | null;
};

type Props = {
  role: 'employer' | 'student';
  interviews: InterviewListItem[];
  /** Upcoming cards carry the Join button; past cards are the record. */
  variant: 'upcoming' | 'past';
  /** Employer only: open the candidate's expanded application. */
  onOpenApplication?: (applicationId: string) => void;
  emptyText: string;
};

const CameraIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14" />
    <rect x="3" y="6" width="12" height="12" rx="2" />
  </svg>
);

const ExternalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// The Interviews list both sides read: confirmed meetings, each with its type,
// date, time, time zone, duration and where it happens — the same details the
// confirmation message carries — and, for upcoming ones, the one obvious way
// in: a Join button. Which button (room, the employer's link, or none for a
// phone screen) and its state come from lib/interview-join.
export default function InterviewsList({ role, interviews, variant, onOpenApplication, emptyText }: Props) {
  const tz = localTimeZone();
  // Re-rendered every half minute so a "Join" button turns into "Join now"
  // while the page is open, without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (variant !== 'upcoming') return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [variant]);

  if (interviews.length === 0) {
    return (
      <div className="card-base" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p style={{ margin: 0, fontSize: '0.95rem' }}>{emptyText}</p>
      </div>
    );
  }

  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {interviews.map(iv => {
        const type = isMeetingType(iv.meetingType) ? iv.meetingType : 'interview';
        const format = interviewFormatOf({ format: iv.format });
        const start = new Date(iv.scheduledAt);
        const end = new Date(start.getTime() + iv.durationMinutes * 60_000).toISOString();
        const join = variant === 'upcoming' ? joinAction({ ...iv, format }, role, now) : null;
        return (
          <li key={iv.id} className="card-base" style={{ padding: '16px 18px', display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div aria-hidden="true" style={{
              width: 56, flexShrink: 0, textAlign: 'center', borderRadius: 10,
              background: variant === 'past' ? 'var(--surface-muted)' : 'var(--primary-light)',
              color: variant === 'past' ? 'var(--text-secondary)' : 'var(--primary)', padding: '6px 0',
            }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>
                {start.toLocaleDateString('en-US', { month: 'short' })}
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.1 }}>{start.getDate()}</div>
            </div>

            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  background: type === 'screening' ? 'var(--chip-blue-bg)' : 'var(--chip-violet-bg)',
                  color: type === 'screening' ? 'var(--chip-blue-ink)' : 'var(--chip-violet-ink)',
                }}>
                  {MEETING_TYPE_LABELS[type]}
                </span>
                {variant === 'past' && (
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: 'var(--chip-neutral-bg)', color: 'var(--chip-neutral-ink)',
                  }}>
                    Completed
                  </span>
                )}
                {join?.status === 'open' && (
                  <span className="interview-live-chip">
                    <span className="interview-live-dot" aria-hidden="true" />
                    Happening now
                  </span>
                )}
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{iv.counterpart}</span>
              </div>
              <p style={{ margin: '2px 0 6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{iv.jobTitle}</p>
              <p style={{ margin: 0, fontSize: '0.86rem', fontWeight: 600 }}>
                {formatMeetingWhen(iv.scheduledAt, tz)}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {formatSlotRange({ starts_at: iv.scheduledAt, ends_at: end }, tz)} · {iv.durationMinutes} min · {tz}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>
                {format === 'external_link' && iv.meetingUrl ? (
                  <>Where: the employer’s own meeting link</>
                ) : format === 'phone' ? (
                  <>Where: Phone call{role === 'student' ? ' — they’ll call the number you sent in Messages' : ' — the candidate’s number is in Messages'}</>
                ) : (
                  <>Where: InternFirst video room{variant === 'upcoming' ? ' (opens 10 minutes before the start)' : ''}</>
                )}
              </p>
              {iv.notes && (
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-light)' }}>Notes: {iv.notes}</p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, alignSelf: 'center', minWidth: 170 }}>
              {join && (
                join.external ? (
                  <a
                    href={join.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-join"
                    data-live={join.status === 'open' ? 'true' : undefined}
                  >
                    <ExternalIcon />
                    {join.label}
                  </a>
                ) : (
                  <Link
                    href={join.href}
                    className="btn-join"
                    data-live={join.status === 'open' ? 'true' : undefined}
                  >
                    <CameraIcon />
                    {join.label}
                  </Link>
                )
              )}
              {join?.hint && (
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{join.hint}</span>
              )}
              {role === 'employer' && onOpenApplication && (
                <button
                  type="button"
                  onClick={() => onOpenApplication(iv.applicationId)}
                  aria-haspopup="dialog"
                  className="btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '7px 14px' }}
                >
                  Open application
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
