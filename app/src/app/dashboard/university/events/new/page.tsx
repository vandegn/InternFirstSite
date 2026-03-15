'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function NewEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [isVirtual, setIsVirtual] = useState(false);
  const [virtualLink, setVirtualLink] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in.');

      const { data: admin } = await supabase
        .from('university_admins')
        .select('id, university_id')
        .eq('user_id', user.id)
        .single();
      if (!admin) throw new Error('University admin profile not found.');

      const { error: insertError } = await supabase
        .from('university_events')
        .insert({
          university_id: admin.university_id,
          created_by: admin.id,
          title,
          description: description || null,
          event_type: eventType,
          event_date: eventDate,
          start_time: startTime,
          end_time: endTime || null,
          location: location || null,
          is_virtual: isVirtual,
          virtual_link: virtualLink || null,
          max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
        });

      if (insertError) throw insertError;

      router.push('/dashboard/university/events');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: 680 }}>
        <div className="auth-logo">
          <Link href="/dashboard/university/events">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
          </Link>
        </div>
        <h1>Create New Event</h1>
        <p className="auth-subtitle">Set up an event for your students — career fairs, workshops, info sessions, and more.</p>

        {error && <div className="auth-error" style={{ display: 'block' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="title">Event Title</label>
              <input
                type="text"
                id="title"
                placeholder="e.g. Spring Career Fair"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="eventType">Event Type</label>
              <select
                id="eventType"
                required
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Select type...</option>
                <option value="career_fair">Career Fair</option>
                <option value="info_session">Info Session</option>
                <option value="workshop">Workshop</option>
                <option value="networking">Networking</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="eventDate">Date</label>
              <input
                type="date"
                id="eventDate"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="startTime">Start Time</label>
              <input
                type="time"
                id="startTime"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="endTime">End Time (optional)</label>
              <input
                type="time"
                id="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="maxAttendees">Max Attendees (optional)</label>
              <input
                type="number"
                id="maxAttendees"
                placeholder="e.g. 200"
                min="1"
                value={maxAttendees}
                onChange={(e) => setMaxAttendees(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="location">Location</label>
              <input
                type="text"
                id="location"
                placeholder="e.g. Student Center, Room 204"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 28 }}>
              <input
                type="checkbox"
                id="isVirtual"
                checked={isVirtual}
                onChange={(e) => setIsVirtual(e.target.checked)}
                style={{ width: 'auto' }}
              />
              <label htmlFor="isVirtual" style={{ margin: 0 }}>Virtual event</label>
            </div>
          </div>

          {isVirtual && (
            <div className="form-group">
              <label htmlFor="virtualLink">Virtual Meeting Link</label>
              <input
                type="text"
                id="virtualLink"
                placeholder="e.g. zoom.us/j/123456789"
                value={virtualLink}
                onChange={(e) => setVirtualLink(e.target.value)}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                This link will be shared with registered students.
              </p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              placeholder="Tell students what to expect — topics covered, who's attending, what to bring..."
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? 'Creating...' : 'Create Event'}
          </button>
        </form>

        <p className="auth-footer">
          <Link href="/dashboard/university/events">&larr; Back to Events</Link>
        </p>
      </div>
    </div>
  );
}
