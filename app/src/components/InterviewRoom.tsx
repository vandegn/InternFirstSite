'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LiveKitRoom,
  VideoConference,
  PreJoin,
  RoomAudioRenderer,
  type LocalUserChoices,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { supabase } from '@/lib/supabase';
import { interviewFormatOf } from '@/lib/interview-format';

type TokenResponse = {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  userName: string;
  isHost: boolean;
};

type WindowStatus = 'loading' | 'too_early' | 'open' | 'ended' | 'error' | 'off_platform';

type InterviewRow = {
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  format?: string | null;
  meeting_url?: string | null;
  listing?: { title?: string } | { title?: string }[];
  employer?: { company_name?: string } | { company_name?: string }[];
  student?: { profile?: { full_name?: string } | { full_name?: string }[] } | { profile?: { full_name?: string } | { full_name?: string }[] }[];
};

function getWindowStatus(scheduledAt: string, durationMinutes: number): 'too_early' | 'open' | 'ended' {
  const now = Date.now();
  const start = new Date(scheduledAt).getTime();
  const end = start + (durationMinutes + 30) * 60 * 1000;
  if (now < start - 10 * 60 * 1000) return 'too_early';
  if (now > end) return 'ended';
  return 'open';
}

function pick<T>(v: T | T[] | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function InterviewRoom({
  role,
  leaveUrl,
}: {
  role: 'student' | 'employer';
  leaveUrl: string;
}) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<WindowStatus>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [interview, setInterview] = useState<InterviewRow | null>(null);
  const [creds, setCreds] = useState<TokenResponse | null>(null);
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  // Bumped to re-run the window check. Someone who opens this page early sits
  // on "Almost time" — the page re-checks on its own and joins when the window
  // opens, instead of waiting for a reload.
  const [attempt, setAttempt] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Only one join attempt at a time; the room's own state is kept.
    if (creds) return;

    function retryAt(when: number) {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      // Never sooner than a second, never later than a minute — if clocks
      // disagree a little, polling once a minute still gets in.
      const delay = Math.min(60_000, Math.max(1_000, when - Date.now() + 500));
      retryTimer.current = setTimeout(() => { if (!cancelled) setAttempt(a => a + 1); }, delay);
    }

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) { router.push('/login'); return; }

      // Foreign keys are named explicitly: students -> profiles is the only
      // path PostgREST can resolve without a hint, but naming it keeps this
      // query immune to the ambiguity that broke the token route.
      const selectFields =
        role === 'student'
          ? `*,
             listing:internship_listings(title),
             employer:employers(company_name)`
          : `*,
             listing:internship_listings(title),
             student:students(profile:profiles!students_user_id_fkey(full_name))`;

      const { data: row, error: rowError } = await supabase
        .from('interview_schedules')
        .select(selectFields)
        .eq('id', id)
        .maybeSingle();

      if (cancelled) return;
      if (rowError) { setStatus('error'); setErrorMsg(rowError.message); return; }
      if (!row) { setStatus('error'); setErrorMsg('Interview not found.'); return; }
      const typed = row as unknown as InterviewRow;
      if (typed.status !== 'accepted') { setStatus('error'); setErrorMsg('This interview is not confirmed.'); return; }

      setInterview(typed);

      // Own-link and phone interviews don't use the InternFirst room.
      if (interviewFormatOf(typed) !== 'internfirst') { setStatus('off_platform'); return; }

      const opensAt = new Date(typed.scheduled_at).getTime() - 10 * 60 * 1000;
      const ws = getWindowStatus(typed.scheduled_at, typed.duration_minutes);
      if (ws === 'too_early') { setStatus('too_early'); retryAt(opensAt); return; }
      if (ws === 'ended') { setStatus('ended'); return; }

      const res = await fetch(`/api/livekit/token?interviewId=${id}`);
      if (cancelled) return;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === 'outside_window') {
          if (getWindowStatus(typed.scheduled_at, typed.duration_minutes) === 'ended') { setStatus('ended'); return; }
          // The server's clock says not yet; ask again shortly.
          setStatus('too_early');
          retryAt(Date.now() + 15_000);
          return;
        }
        setStatus('error');
        setErrorMsg(err.message ?? err.error ?? 'Failed to join meeting.');
        return;
      }

      const data: TokenResponse = await res.json();
      if (cancelled) return;
      setCreds(data);
      setStatus('open');
    }

    init();
    return () => {
      cancelled = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
    // creds is read only to skip re-running once the room is live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, role, router, attempt]);

  const listing = pick(interview?.listing);
  const listingTitle = listing?.title;

  const counterpartName = (() => {
    if (role === 'student') {
      return pick(interview?.employer)?.company_name ?? 'Interview';
    }
    const student = pick(interview?.student);
    const profile = pick(student?.profile);
    return profile?.full_name ?? 'Candidate';
  })();

  function renderMessage(icon: string, heading: string, body: string, extra?: React.ReactNode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: '3rem' }}>{icon}</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{heading}</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 420 }}>{body}</p>
        {extra}
        <Link href={leaveUrl} style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (status === 'loading') return renderMessage('⏳', 'Setting up the interview…', 'This will only take a moment.');

  if (status === 'too_early') {
    const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    const start = interview ? new Date(interview.scheduled_at) : null;
    const earliest = start ? new Date(start.getTime() - 10 * 60 * 1000) : null;
    return renderMessage(
      '🕐',
      'Almost time!',
      `The meeting room opens 10 minutes before the interview${earliest ? `, at ${fmt(earliest)}` : ''}. Keep this page open — it will let you in automatically.`,
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {/* The three times that decide the window, so a device whose clock or
            zone disagrees with the schedule shows it here instead of looking
            like a page that is stuck. */}
        {start && (
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>
            Scheduled for {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {fmt(start)} · It is now {fmt(new Date())} on this device
          </p>
        )}
        <button type="button" className="btn-secondary" onClick={() => setAttempt(a => a + 1)} style={{ fontSize: '0.85rem', padding: '7px 16px' }}>
          Check again
        </button>
      </div>,
    );
  }

  if (status === 'ended') return renderMessage('✅', 'Interview ended', 'The join window for this interview has closed.');

  if (status === 'off_platform' && interview) {
    const when = new Date(interview.scheduled_at).toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    if (interviewFormatOf(interview) === 'phone') {
      return renderMessage(
        '📞',
        'Phone screening',
        role === 'student'
          ? `${counterpartName} will call you on ${when}. Make sure you've replied in your inbox with the best number to reach you.`
          : `Call ${counterpartName} on ${when}. Their phone number will arrive as a reply in your inbox.`,
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: '3rem' }}>🔗</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>This interview uses an external meeting link</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 420 }}>Scheduled for {when}.</p>
        {interview.meeting_url && (
          <a href={interview.meeting_url} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>
            Open meeting link
          </a>
        )}
        <Link href={leaveUrl} style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (status === 'error') return renderMessage('⚠️', 'Something went wrong', errorMsg || 'Please try refreshing the page.');

  if (!creds) return renderMessage('⏳', 'Setting up the interview…', 'This will only take a moment.');

  return (
    <div className="interview-room" data-lk-theme="default">
      <div className="interview-room__header">
        <Link href={leaveUrl} className="interview-room__back">
          ← Dashboard
        </Link>
        <div className="interview-room__divider" />
        <span className="interview-room__title">
          {counterpartName}{listingTitle ? ` — ${listingTitle}` : ''}
        </span>
      </div>

      <div className="interview-room__stage">
        {!choices ? (
          <PreJoin
            defaults={{
              username: creds.userName,
              videoEnabled: true,
              audioEnabled: true,
            }}
            onSubmit={(values) => setChoices(values)}
          />
        ) : (
          <LiveKitRoom
            serverUrl={creds.url}
            token={creds.token}
            connect={true}
            video={choices.videoEnabled}
            audio={choices.audioEnabled}
            onDisconnected={() => router.push(leaveUrl)}
            onError={(err) => {
              console.error('[LiveKit] error:', err);
              setStatus('error');
              setErrorMsg(err.message || 'Failed to connect to the meeting.');
            }}
            style={{ height: '100%' }}
          >
            <VideoConference />
            <RoomAudioRenderer />
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
}
