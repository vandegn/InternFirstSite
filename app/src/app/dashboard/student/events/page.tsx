'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase, getStudentByUserId } from '@/lib/supabase';
import Calendar, { type CalendarEvent } from '@/components/Calendar';
import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABELS,
  EVENT_SCOPE_LABELS,
  formatEventWhen,
  localDateKey,
  localTimeKey,
  relevantEventsForStudent,
  type CareerEvent,
  type EventCategory,
  type EventPreferences,
  type EventScope,
  type ScopedEvent,
} from '@/lib/career-events';
import {
  getEventFavoriteIds,
  getEventPreferences,
  getUpcomingCareerEvents,
  saveEventPreferences,
  setEventFavorite,
} from '@/lib/career-events-client';

type View = 'list' | 'calendar' | 'favorites';
type ScopeFilter = 'all' | EventScope;

const SCOPE_CHIP: Record<EventScope, { bg: string; color: string }> = {
  campus: { bg: 'var(--chip-indigo-bg)', color: 'var(--chip-indigo-ink)' },
  local: { bg: 'var(--chip-blue-bg)', color: 'var(--chip-blue-ink)' },
  online: { bg: 'var(--chip-neutral-bg)', color: 'var(--chip-neutral-ink)' },
};

// Calendar.tsx colors a handful of known types; everything else is "event".
const CALENDAR_TYPE: Partial<Record<EventCategory, string>> = {
  career_fair: 'career_fair',
  info_session: 'info_session',
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 14px', borderRadius: 999, fontSize: '0.8rem',
    fontWeight: active ? 600 : 500, cursor: 'pointer',
    border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    background: active ? 'var(--primary-light)' : 'var(--surface)',
    color: active ? 'var(--primary)' : 'var(--text-secondary)',
  };
}

const chip: React.CSSProperties = { padding: '2px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600 };

function dateBadge(event: CareerEvent) {
  const tz = event.all_day ? event.timezone ?? undefined : undefined;
  const d = new Date(event.starts_at);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: tz }).toUpperCase(),
    day: d.toLocaleDateString('en-US', { day: 'numeric', timeZone: tz }),
  };
}

function whenLabel(event: CareerEvent): string {
  // Timed events in the student's own zone; all-day events on their own calendar date.
  if (event.all_day) return formatEventWhen(event);
  return formatEventWhen(event, Intl.DateTimeFormat().resolvedOptions().timeZone);
}

function EventCard({
  event, favorite, onToggleFavorite, busy, highlighted, cardRef,
}: {
  event: ScopedEvent<CareerEvent>;
  favorite: boolean;
  onToggleFavorite: () => void;
  busy: boolean;
  highlighted: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const badge = dateBadge(event);
  const desc = event.description ?? '';
  const long = desc.length > 240;
  const scopeChip = SCOPE_CHIP[event.scope];

  return (
    <div
      ref={cardRef}
      id={`event-${event.id}`}
      style={{
        display: 'flex', gap: 16, padding: '16px 18px', borderRadius: 12,
        border: `1px solid ${highlighted ? 'var(--primary)' : 'var(--border)'}`,
        boxShadow: highlighted ? 'var(--shadow-md)' : undefined,
        background: 'var(--surface)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          flex: '0 0 56px', height: 60, borderRadius: 10, background: 'var(--primary-light)',
          color: 'var(--primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>{badge.month}</span>
        <span style={{ fontSize: '1.35rem', fontWeight: 700, lineHeight: 1.1 }}>{badge.day}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <h3 style={{ flex: 1, fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text)', overflowWrap: 'anywhere' }}>
            {event.title}
          </h3>
          <button
            type="button"
            onClick={onToggleFavorite}
            disabled={busy}
            aria-pressed={favorite}
            aria-label={favorite ? `Remove ${event.title} from favorites` : `Add ${event.title} to favorites`}
            title={favorite ? 'Remove from favorites' : 'Favorite — get a reminder 24 hours before'}
            style={{
              flex: '0 0 auto', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
              padding: 6, cursor: busy ? 'wait' : 'pointer', lineHeight: 0,
              color: favorite ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0 8px' }}>
          {event.is_major && (
            <span style={{ ...chip, background: 'var(--chip-amber-bg)', color: 'var(--chip-amber-ink)' }}>Major event</span>
          )}
          <span style={{ ...chip, background: scopeChip.bg, color: scopeChip.color }}>{EVENT_SCOPE_LABELS[event.scope]}</span>
          <span style={{ ...chip, background: 'var(--chip-green-bg)', color: 'var(--chip-green-ink)' }}>{EVENT_CATEGORY_LABELS[event.category]}</span>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>{whenLabel(event)}</p>
        {(event.location || event.city) && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 4px', overflowWrap: 'anywhere' }}>
            {event.location ?? `${event.city}, ${event.state}`}
          </p>
        )}
        {event.organizer && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', margin: '0 0 4px' }}>Hosted by {event.organizer}</p>
        )}

        {desc && (
          <p style={{ fontSize: '0.85rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', margin: '8px 0 0', color: 'var(--text)', overflowWrap: 'anywhere' }}>
            {long && !expanded ? `${desc.slice(0, 240).trimEnd()}…` : desc}
            {long && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  {expanded ? 'Less' : 'More'}
                </button>
              </>
            )}
          </p>
        )}

        {(event.url || event.virtual_url) && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
            {event.virtual_url && (
              <a href={event.virtual_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)' }}>
                Join online
              </a>
            )}
            {event.url && (
              <a href={event.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)' }}>
                Event details
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: 12 }}>
      <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{title}</p>
      <p style={{ fontSize: '0.88rem', marginTop: 6, maxWidth: 520, marginInline: 'auto', lineHeight: 1.55 }}>{body}</p>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: 'var(--text)', cursor: disabled ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
      {label}
    </label>
  );
}

function CareerEventsPage() {
  const params = useSearchParams();
  const focusId = params.get('event');

  const [userId, setUserId] = useState<string | null>(null);
  const [school, setSchool] = useState<{ id: number | null; name: string | null; state: string | null }>({ id: null, name: null, state: null });
  const [events, setEvents] = useState<CareerEvent[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [prefs, setPrefs] = useState<EventPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [category, setCategory] = useState<'all' | EventCategory>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setUserId(user.id);
      try {
        const [student, rows, favIds, p] = await Promise.all([
          getStudentByUserId(user.id),
          getUpcomingCareerEvents(),
          getEventFavoriteIds(user.id),
          getEventPreferences(user.id),
        ]);
        if (cancelled) return;
        setSchool({ id: student?.school_id ?? null, name: student?.school_name ?? null, state: student?.school_state ?? null });
        setEvents(rows);
        setFavorites(new Set(favIds));
        setPrefs(p);
      } catch {
        if (!cancelled) setLoadError('Career events are not available yet. Please check back soon.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const relevant = useMemo(
    () => relevantEventsForStudent(events, { schoolId: school.id, state: school.state }, new Date()),
    [events, school.id, school.state],
  );

  const filtered = useMemo(() => relevant.filter((e) =>
    (scope === 'all' || e.scope === scope) &&
    (category === 'all' || e.category === category) &&
    (view !== 'favorites' || favorites.has(e.id)),
  ), [relevant, scope, category, view, favorites]);

  // Deep link from a notification: scroll the event into view once it's rendered.
  useEffect(() => {
    if (!focusId || loading) return;
    const el = cardRefs.current[focusId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusId, loading]);

  const calendarEvents = useMemo<CalendarEvent[]>(() => filtered.map((e) => ({
    id: e.id,
    title: e.title,
    date: localDateKey(e.starts_at, e.all_day ? e.timezone ?? undefined : undefined),
    time: e.all_day ? undefined : localTimeKey(e.starts_at),
    type: CALENDAR_TYPE[e.category] ?? 'event',
    location: e.location ?? undefined,
  })), [filtered]);

  async function toggleFavorite(eventId: string) {
    if (!userId) return;
    const next = !favorites.has(eventId);
    setBusyId(eventId);
    setError('');
    setFavorites((prev) => { const s = new Set(prev); if (next) s.add(eventId); else s.delete(eventId); return s; });
    try {
      await setEventFavorite(userId, eventId, next);
    } catch (err) {
      setFavorites((prev) => { const s = new Set(prev); if (next) s.delete(eventId); else s.add(eventId); return s; });
      setError(err instanceof Error ? err.message : 'Could not update favorites.');
    } finally {
      setBusyId(null);
    }
  }

  async function updatePrefs(patch: Partial<EventPreferences>) {
    if (!prefs) return;
    const prev = prefs;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      await saveEventPreferences(next);
    } catch (err) {
      setPrefs(prev);
      setError(err instanceof Error ? err.message : 'Could not save notification settings.');
    }
  }

  const renderCard = (e: ScopedEvent<CareerEvent>) => (
    <EventCard
      key={e.id}
      event={e}
      favorite={favorites.has(e.id)}
      busy={busyId === e.id}
      highlighted={selectedId === e.id}
      onToggleFavorite={() => toggleFavorite(e.id)}
      cardRef={(el) => { cardRefs.current[e.id] = el; }}
    />
  );

  const noSchool = !school.id && !school.state;
  const where = [school.name, school.state].filter(Boolean).join(' · ');

  let body: React.ReactNode;
  if (loading) {
    body = <p style={{ color: 'var(--text-secondary)' }}>Loading events…</p>;
  } else if (loadError) {
    body = <EmptyState title="Events are on the way" body={loadError} />;
  } else if (relevant.length === 0) {
    body = (
      <EmptyState
        title="No career events yet"
        body={noSchool
          ? 'Add your school to your profile and this calendar will fill with campus career events and events across your state as we connect their calendars.'
          : `Events appear here automatically as InternFirst connects campus and local event calendars${school.name ? ` for ${school.name}` : ''}${school.state ? ` and ${school.state}` : ''}. Check back soon.`}
      >
        {noSchool && (
          <Link href="/dashboard/student/profile" className="btn-primary" style={{ display: 'inline-block', marginTop: 16, fontSize: '0.85rem', padding: '8px 18px' }}>
            Add your school
          </Link>
        )}
      </EmptyState>
    );
  } else if (filtered.length === 0) {
    body = view === 'favorites' && favorites.size === 0
      ? <EmptyState title="No favorites yet" body="Star an event to save it here. We’ll send you a reminder 24 hours before it starts." />
      : <EmptyState title="Nothing matches these filters" body="Try a different filter to see more events." />;
  } else if (view === 'calendar') {
    const dayEvents = selectedDate ? filtered.filter((e) => localDateKey(e.starts_at, e.all_day ? e.timezone ?? undefined : undefined) === selectedDate) : [];
    const picked = filtered.find((e) => e.id === selectedId);
    const shown = picked && !dayEvents.some((e) => e.id === picked.id) ? [picked, ...dayEvents] : dayEvents;
    body = (
      <>
        <Calendar
          events={calendarEvents}
          onDateSelect={(d) => { setSelectedDate(d); setSelectedId(null); }}
          onEventClick={(ce) => setSelectedId(ce.id)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          {shown.length > 0
            ? shown.map(renderCard)
            : <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Pick a day or an event on the calendar to see the details here.</p>}
        </div>
      </>
    );
  } else {
    body = <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{filtered.map(renderCard)}</div>;
  }

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Career Events</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
        {where
          ? <>Career fairs, info sessions and workshops at your campus and around {school.state ?? 'your area'}. Updated automatically. <span style={{ color: 'var(--text-light)' }}>({where})</span></>
          : 'Career fairs, info sessions and workshops at your campus and around your area. Updated automatically.'}
      </p>

      <div role="tablist" aria-label="Event views" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {([['list', 'Upcoming'], ['calendar', 'Calendar'], ['favorites', `Favorites${favorites.size ? ` (${favorites.size})` : ''}`]] as [View, string][]).map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} style={pillStyle(view === v)}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <div role="group" aria-label="Where" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'campus', 'local', 'online'] as ScopeFilter[]).map((s) => (
            <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} style={pillStyle(scope === s)}>
              {s === 'all' ? 'All' : EVENT_SCOPE_LABELS[s]}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Type
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as 'all' | EventCategory)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.82rem' }}
          >
            <option value="all">All types</option>
            {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{EVENT_CATEGORY_LABELS[c]}</option>)}
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'var(--danger-bg)', color: 'var(--danger-fg)', border: '1px solid var(--danger-border)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {body}

      {prefs && !loadError && (
        <div style={{ marginTop: 28, padding: '16px 18px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 10, color: 'var(--text)' }}>Event notifications</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Toggle checked={prefs.notify_favorites} onChange={(v) => updatePrefs({ notify_favorites: v })} label="Remind me 24 hours before events I’ve favorited" />
            <Toggle checked={prefs.notify_major} onChange={(v) => updatePrefs({ notify_major: v })} label="Tell me when a major event is added for my campus or area" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function CareerEventsPageWrapper() {
  return (
    <Suspense fallback={<div className="dash-main" style={{ padding: 32 }}>Loading…</div>}>
      <CareerEventsPage />
    </Suspense>
  );
}
