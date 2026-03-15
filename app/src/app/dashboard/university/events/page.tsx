'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Pagination from '@/components/Pagination';

type Event = {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  is_virtual: boolean;
  max_attendees: number | null;
  registration_count: number;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  career_fair: 'Career Fair',
  info_session: 'Info Session',
  workshop: 'Workshop',
  networking: 'Networking',
  other: 'Event',
};

const PAGE_SIZE = 10;

export default function UniversityEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: admin } = await supabase
        .from('university_admins')
        .select('university_id')
        .eq('user_id', user.id)
        .single();

      if (!admin?.university_id) {
        setLoading(false);
        return;
      }

      const { count } = await supabase
        .from('university_events')
        .select('*', { count: 'exact', head: true })
        .eq('university_id', admin.university_id);
      setTotalCount(count ?? 0);

      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data: eventsData } = await supabase
        .from('university_events')
        .select('id, title, event_type, event_date, start_time, end_time, location, is_virtual, max_attendees')
        .eq('university_id', admin.university_id)
        .order('event_date', { ascending: false })
        .range(from, to);

      if (eventsData && eventsData.length > 0) {
        const eventIds = eventsData.map(e => e.id);
        const { data: regCounts } = await supabase
          .from('event_registrations')
          .select('event_id')
          .in('event_id', eventIds);
        const countMap: Record<string, number> = {};
        regCounts?.forEach(r => { countMap[r.event_id] = (countMap[r.event_id] || 0) + 1; });
        setEvents(eventsData.map(e => ({ ...e, registration_count: countMap[e.id] || 0 })));
      } else {
        setEvents([]);
      }

      setLoading(false);
    }
    fetchEvents();
  }, [currentPage]);

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTime(time: string) {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${display}:${m} ${ampm}`;
  }

  const isPast = (dateStr: string) => new Date(dateStr + 'T23:59:59') < new Date();

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>My Events</h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link href="/dashboard/university" className="btn-secondary" style={{ fontSize: '0.85rem', padding: '8px 16px', textDecoration: 'none' }}>
            Back to Dashboard
          </Link>
          <Link href="/dashboard/university/events/new" className="btn-primary" style={{ fontSize: '0.85rem', padding: '8px 16px', textDecoration: 'none' }}>
            + Create Event
          </Link>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading events...</p>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.5 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No events yet</p>
          <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Create your first event to get started!</p>
          <Link href="/dashboard/university/events/new" className="btn-primary" style={{ display: 'inline-block', marginTop: '16px', fontSize: '0.9rem', padding: '10px 24px', textDecoration: 'none' }}>
            + Create Event
          </Link>
        </div>
      ) : (
        <>
          <div className="listing-grid">
            {events.map((event) => {
              const date = new Date(event.event_date + 'T00:00:00');
              const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
              const day = date.getDate();
              const past = isPast(event.event_date);
              return (
                <div
                  key={event.id}
                  className="listing-card"
                  style={{ transition: 'box-shadow 0.15s', opacity: past ? 0.6 : 1 }}
                >
                  <div className="listing-header">
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>{month}</span>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.1 }}>{day}</span>
                    </div>
                    {past && (
                      <span style={{ fontSize: '0.7rem', background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 4 }}>Past</span>
                    )}
                  </div>
                  <h4>{event.title}</h4>
                  <p className="listing-company">{formatDate(event.event_date)}</p>
                  <p className="listing-location">
                    {event.is_virtual ? 'Virtual' : event.location || 'Location TBD'}
                  </p>
                  <div className="listing-tags">
                    <span>{EVENT_TYPE_LABELS[event.event_type] || 'Event'}</span>
                    {event.is_virtual && <span>Virtual</span>}
                  </div>
                  <div className="listing-footer">
                    <span className="listing-salary">
                      {formatTime(event.start_time)}{event.end_time ? ` - ${formatTime(event.end_time)}` : ''}
                    </span>
                    <span className="listing-time" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      {event.registration_count}{event.max_attendees ? `/${event.max_attendees}` : ''} registered
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          )}
        </>
      )}
    </div>
  );
}
