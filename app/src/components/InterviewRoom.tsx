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

type TokenResponse = {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  userName: string;
  isHost: boolean;
};

type WindowStatus = 'loading' | 'too_early' | 'open' | 'ended' | 'error';

type InterviewRow = {
  scheduled_at: string;
  duration_minutes: number;
  status: string;
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
  const initStarted = useRef(false);
  const [status, setStatus] = useState<WindowStatus>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [interview, setInterview] = useState<InterviewRow | null>(null);
  const [creds, setCreds] = useState<TokenResponse | null>(null);
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const selectFields =
        role === 'student'
          ? `scheduled_at, duration_minutes, status,
             listing:internship_listings(title),
             employer:employers(company_name)`
          : `scheduled_at, duration_minutes, status,
             listing:internship_listings(title),
             student:students(profile:profiles!inner(full_name))`;

      const { data: row } = await supabase
        .from('interview_schedules')
        .select(selectFields)
        .eq('id', id)
        .single();

      if (!row) { setStatus('error'); setErrorMsg('Interview not found.'); return; }
      const typed = row as unknown as InterviewRow;
      if (typed.status !== 'accepted') { setStatus('error'); setErrorMsg('This interview is not confirmed.'); return; }

      setInterview(typed);

      const ws = getWindowStatus(typed.scheduled_at, typed.duration_minutes);
      if (ws !== 'open') { setStatus(ws); return; }

      const res = await fetch(`/api/livekit/token?interviewId=${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === 'outside_window') { setStatus('too_early'); return; }
        setStatus('error');
        setErrorMsg(err.message ?? err.error ?? 'Failed to join meeting.');
        return;
      }

      const data: TokenResponse = await res.json();
      setCreds(data);
      setStatus('open');
    }

    init();
  }, [id, role, router]);

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

  function renderMessage(icon: string, heading: string, body: string) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: '3rem' }}>{icon}</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{heading}</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 420 }}>{body}</p>
        <Link href={leaveUrl} style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (status === 'loading') return renderMessage('⏳', 'Setting up the interview…', 'This will only take a moment.');

  if (status === 'too_early') {
    const earliest = interview ? new Date(new Date(interview.scheduled_at).getTime() - 10 * 60 * 1000) : null;
    const timeStr = earliest ? earliest.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
    return renderMessage('🕐', 'Almost time!', `The meeting room opens 10 minutes before the interview. Come back${timeStr ? ` at ${timeStr}` : ' soon'}.`);
  }

  if (status === 'ended') return renderMessage('✅', 'Interview ended', 'The join window for this interview has closed.');

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
