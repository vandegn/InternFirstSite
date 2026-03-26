'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, getStudentByUserId, getEventById, getEventRegistrationCount, registerForEvent, unregisterFromEvent, isRegisteredForEvent } from '@/lib/supabase';

const EVENT_TYPE_LABELS: Record<string, string> = {
  career_fair: 'Career Fair',
  info_session: 'Info Session',
  workshop: 'Workshop',
  networking: 'Networking',
  other: 'Event',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  career_fair: '#7c3aed',
  info_session: '#2563eb',
  workshop: '#059669',
  networking: '#d97706',
  other: '#6b7280',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export default function EventDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [eventData, student] = await Promise.all([
        getEventById(id),
        getStudentByUserId(user.id),
      ]);

      if (eventData) setEvent(eventData);
      if (student) {
        setStudentId(student.id);
        const [registered, count] = await Promise.all([
          isRegisteredForEvent(id, student.id),
          getEventRegistrationCount(id),
        ]);
        setIsRegistered(registered);
        setRegistrationCount(count);
      }

      setLoading(false);
    }
    fetchData();
  }, [id]);

  async function handleRSVP() {
    if (!studentId) return;
    setRegistering(true);
    setError('');
    try {
      if (isRegistered) {
        await unregisterFromEvent(id, studentId);
        setIsRegistered(false);
        setRegistrationCount((prev) => prev - 1);
      } else {
        await registerForEvent(id, studentId);
        setIsRegistered(true);
        setRegistrationCount((prev) => prev + 1);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setRegistering(false);
    }
  }

  if (loading) {
    return (
      <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/dashboard/student/events" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back to Events
        </Link>
        <p style={{ color: 'var(--text-secondary)' }}>Event not found.</p>
      </div>
    );
  }

  const typeColor = EVENT_TYPE_COLORS[event.event_type] || EVENT_TYPE_COLORS.other;
  const typeLabel = EVENT_TYPE_LABELS[event.event_type] || 'Event';
  const isFull = event.max_attendees && registrationCount >= event.max_attendees;
  const university = Array.isArray(event.university) ? event.university[0] : event.university;

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <Link href="/dashboard/student/events" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Back to Events
      </Link>

      <div className="profile-card" style={{ padding: '36px' }}>
        {/* Type badge */}
        <span style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: '999px',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#fff',
          background: typeColor,
          marginBottom: '16px',
        }}>
          {typeLabel}
        </span>

        {/* Title */}
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>{event.title}</h2>
        {university?.name && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '24px' }}>
            Hosted by {university.name}
          </p>
        )}

        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {/* Date */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Date</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{formatDate(event.event_date)}</div>
            </div>
          </div>

          {/* Time */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Time</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {formatTime(event.start_time)}{event.end_time ? ` — ${formatTime(event.end_time)}` : ''}
              </div>
            </div>
          </div>

          {/* Location */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Location</div>
              {event.is_virtual ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Virtual
                  {event.virtual_link && isRegistered && (
                    <> — <a href={event.virtual_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Join Link</a></>
                  )}
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{event.location || 'TBD'}</div>
              )}
            </div>
          </div>

          {/* Attendees */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Attendees</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {registrationCount} registered{event.max_attendees ? ` of ${event.max_attendees} spots` : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <>
            <div style={{ borderTop: '1px solid var(--border)', margin: '0 0 24px' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' }}>About This Event</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '28px' }}>
              {event.description}
            </p>
          </>
        )}

        {/* RSVP Section */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
          {error && (
            <div className="auth-error" style={{ display: 'block', marginBottom: '16px' }}>{error}</div>
          )}

          {isRegistered ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600,
                background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                You&apos;re Registered
              </span>
              <button
                onClick={handleRSVP}
                disabled={registering}
                style={{
                  padding: '8px 20px', fontSize: '0.9rem', borderRadius: 'var(--radius-sm)',
                  border: '1px solid #fca5a5', background: '#fff', color: '#dc2626',
                  cursor: registering ? 'default' : 'pointer', fontWeight: 500,
                }}
              >
                {registering ? 'Cancelling...' : 'Cancel Registration'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleRSVP}
              disabled={registering || !!isFull}
              className="btn-primary"
              style={{
                padding: '12px 32px', fontSize: '1rem',
                opacity: isFull ? 0.6 : 1,
                cursor: isFull || registering ? 'default' : 'pointer',
              }}
            >
              {isFull ? 'Event Full' : registering ? 'Registering...' : 'Register for Event'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
