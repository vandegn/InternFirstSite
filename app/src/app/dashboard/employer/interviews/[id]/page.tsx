'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type ZoomCredentials = {
  signature: string;
  meetingNumber: string;
  password: string;
  sdkKey: string;
  userName: string;
  role: 0 | 1;
};

type WindowStatus = 'loading' | 'too_early' | 'open' | 'ended' | 'not_configured' | 'error';

function getWindowStatus(scheduledAt: string, durationMinutes: number): 'too_early' | 'open' | 'ended' {
  const now = Date.now();
  const start = new Date(scheduledAt).getTime();
  const end = start + (durationMinutes + 30) * 60 * 1000;
  if (now < start - 10 * 60 * 1000) return 'too_early';
  if (now > end) return 'ended';
  return 'open';
}

export default function EmployerMeetingRoom() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<WindowStatus>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [interview, setInterview] = useState<{
    scheduled_at: string;
    duration_minutes: number;
    listing?: { title?: string };
    student?: { profile?: { full_name?: string } };
  } | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: row } = await supabase
        .from('interview_schedules')
        .select(`
          scheduled_at, duration_minutes, status, zoom_meeting_id,
          listing:internship_listings(title),
          student:students(profile:profiles!inner(full_name))
        `)
        .eq('id', id)
        .single();

      if (!row) { setStatus('error'); setErrorMsg('Interview not found.'); return; }
      if (row.status !== 'accepted') { setStatus('error'); setErrorMsg('This interview is not confirmed.'); return; }
      if (!row.zoom_meeting_id) { setStatus('not_configured'); return; }

      const ws = getWindowStatus(row.scheduled_at, row.duration_minutes);
      setInterview(row as typeof interview);

      if (ws !== 'open') { setStatus(ws); return; }

      const sigRes = await fetch(`/api/zoom/signature?interviewId=${id}`);
      if (!sigRes.ok) {
        const err = await sigRes.json();
        if (err.error === 'outside_window') { setStatus('too_early'); return; }
        if (err.error?.includes('not configured')) { setStatus('not_configured'); return; }
        setStatus('error'); setErrorMsg(err.message ?? 'Failed to join meeting.'); return;
      }

      const creds: ZoomCredentials = await sigRes.json();

      try {
        await import('@/lib/zoom-shim');
        const { ZoomMtg } = await import('@zoom/meetingsdk');

        ZoomMtg.setZoomJSLib('/zoom-lib', '/av');
        ZoomMtg.preLoadWasm();
        ZoomMtg.prepareWebSDK();

        const zmmtgRoot = document.getElementById('zmmtg-root');
        if (zmmtgRoot) zmmtgRoot.style.display = 'block';

        ZoomMtg.init({
          leaveUrl: '/dashboard/employer',
          patchJsMedia: true,
          success: () => {
            ZoomMtg.join({
              signature: creds.signature,
              sdkKey: creds.sdkKey,
              meetingNumber: creds.meetingNumber,
              passWord: creds.password,
              userName: creds.userName,
              success: () => setStatus('open'),
              error: (err: unknown) => {
                console.error('[Zoom] join error:', err);
                setStatus('error');
                setErrorMsg('Failed to join the meeting. Please try again.');
              },
            });
          },
          error: (err: unknown) => {
            console.error('[Zoom] init error:', err);
            setStatus('error');
            setErrorMsg('Failed to initialize the meeting client.');
          },
        });
      } catch (err) {
        console.error('[Zoom] error:', err);
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load the meeting client. Please refresh.');
      }
    }

    init();

    return () => {
      // Client view cleans up on leaveUrl redirect
    };
  }, [id, router]);

  const listingTitle = Array.isArray(interview?.listing) ? interview?.listing[0]?.title : (interview?.listing as { title?: string } | undefined)?.title;
  const studentArr = Array.isArray(interview?.student) ? interview?.student[0] : interview?.student;
  const studentProfile = Array.isArray(studentArr?.profile) ? studentArr?.profile[0] : studentArr?.profile;
  const studentName = studentProfile?.full_name;

  function renderMessage(icon: string, heading: string, body: string) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: '3rem' }}>{icon}</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{heading}</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 420 }}>{body}</p>
        <Link href="/dashboard/employer" style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>
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

  if (status === 'not_configured') return renderMessage('🎥', 'Video not available yet', 'Zoom integration is being set up. The interview is confirmed — check back closer to the scheduled time.');

  if (status === 'error') return renderMessage('⚠️', 'Something went wrong', errorMsg || 'Please try refreshing the page.');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', borderBottom: '1px solid var(--border)', background: '#fff', flexShrink: 0 }}>
        <Link href="/dashboard/employer" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.82rem', gap: 4 }}>
          ← Dashboard
        </Link>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
          {studentName ?? 'Candidate'}{listingTitle ? ` — ${listingTitle}` : ''}
        </span>
      </div>

      <div style={{ flex: 1 }} />
    </div>
  );
}
