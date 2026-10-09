'use client';

import Link from 'next/link';
import {
  formatMeetingWhen,
  formatSlotRange,
  isMeetingType,
  localTimeZone,
  MEETING_TYPE_LABELS,
} from '@/lib/interview-availability';
import { interviewFormatOf } from '@/lib/interview-format';

export type UpcomingInterview = {
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
  interviews: UpcomingInterview[];
  /** Employer only: open the candidate's expanded application. */
  onOpenApplication?: (applicationId: string) => void;
  emptyText: string;
};

// The Upcoming Interviews list both sides read. Confirmed meetings only,
// soonest first, each with its type, date, time, time zone, duration and
// where it happens — the same details the confirmation message carries.
export default function UpcomingInterviewsList({ role, interviews, onOpenApplication, emptyText }: Props) {
  const tz = localTimeZone();

  if (interviews.length === 0) {
    return (
      <div className="card-base" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p style={{ margin: 0, fontSize: '0.95rem' }}>{emptyText}</p>
      </div>
    );
  }

  const roomBase = role === 'employer' ? '/dashboard/employer/interviews' : '/dashboard/student/interviews';

  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {interviews.map(iv => {
        const type = isMeetingType(iv.meetingType) ? iv.meetingType : 'interview';
        const format = interviewFormatOf({ format: iv.format });
        const start = new Date(iv.scheduledAt);
        const end = new Date(start.getTime() + iv.durationMinutes * 60_000).toISOString();
        return (
          <li key={iv.id} className="card-base" style={{ padding: '16px 18px', display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div aria-hidden="true" style={{
              width: 56, flexShrink: 0, textAlign: 'center', borderRadius: 10,
              background: 'var(--primary-light)', color: 'var(--primary)', padding: '6px 0',
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
                  <>Link: <a href={iv.meetingUrl} target="_blank" rel="noopener noreferrer">{iv.meetingUrl}</a></>
                ) : format === 'phone' ? (
                  <>Location: Phone call{role === 'student' ? ' — they’ll call the number you sent in Messages' : ' — the candidate’s number is in Messages'}</>
                ) : (
                  <>Location: <Link href={`${roomBase}/${iv.id}`}>InternFirst video room</Link> (opens 10 minutes before)</>
                )}
              </p>
              {iv.notes && (
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-light)' }}>Notes: {iv.notes}</p>
              )}
            </div>

            {role === 'employer' && onOpenApplication && (
              <button
                type="button"
                onClick={() => onOpenApplication(iv.applicationId)}
                aria-haspopup="dialog"
                className="btn-secondary"
                style={{ fontSize: '0.82rem', padding: '7px 14px', alignSelf: 'center' }}
              >
                Open application
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
