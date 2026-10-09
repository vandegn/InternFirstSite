'use client';

import { useEffect, useMemo, useState } from 'react';
import SchoolPicker, { EMPTY_SCHOOL, type SchoolValue } from '@/components/SchoolPicker';
import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABELS,
  US_STATE_NAMES,
  US_TIME_ZONES,
  formatEventWhen,
  isoToZonedInput,
  normalizeFeedUrl,
  zonedInputToIso,
  type CareerEvent,
  type EventCategory,
  type EventSource,
} from '@/lib/career-events';
import {
  createCareerEvent,
  createEventSource,
  deleteCareerEvent,
  deleteEventSource,
  listAdminEvents,
  listEventSources,
  setEventSourceActive,
  triggerCareerEventsSync,
  updateCareerEvent,
  type EventInput,
  type SyncResponse,
} from '@/lib/career-events-client';

type Tag = 'school' | 'region' | 'online';

const browserTz = (() => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return US_TIME_ZONES.some((z) => z.value === tz) ? tz : 'America/New_York';
  } catch {
    return 'America/New_York';
  }
})();

const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', background: 'var(--surface)' };
const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' };
const chip: React.CSSProperties = { padding: '2px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600 };
const smallBtn: React.CSSProperties = { fontSize: '0.78rem', padding: '6px 12px' };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 };

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

function locationLabel(x: { school_name: string | null; city: string | null; state: string | null }): string {
  if (x.school_name) return x.school_name;
  if (x.city && x.state) return `${x.city}, ${x.state}`;
  return x.state ?? 'Online / everyone';
}

function TagPicker({
  tag, setTag, school, setSchool, city, setCity, state, setState, allowOnline,
}: {
  tag: Tag; setTag: (t: Tag) => void;
  school: SchoolValue; setSchool: (s: SchoolValue) => void;
  city: string; setCity: (v: string) => void;
  state: string; setState: (v: string) => void;
  allowOnline: boolean;
}) {
  const options: [Tag, string][] = [['school', 'A school (campus events)'], ['region', 'A city / state (local events)']];
  if (allowOnline) options.push(['online', 'Online (everyone)']);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div role="radiogroup" aria-label="Who sees these events" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.85rem' }}>
        {options.map(([value, label]) => (
          <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text)' }}>
            <input type="radio" checked={tag === value} onChange={() => setTag(value)} style={{ accentColor: 'var(--primary)' }} />
            {label}
          </label>
        ))}
      </div>
      {tag === 'school' && (
        <div style={labelStyle}>
          School
          <SchoolPicker value={school} onChange={setSchool} placeholder="Search schools…" inputStyle={input} />
        </div>
      )}
      {tag === 'region' && (
        <div style={grid}>
          <label style={labelStyle}>
            State
            <select value={state} onChange={(e) => setState(e.target.value)} style={input}>
              <option value="">Choose a state…</option>
              {US_STATE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            City (optional)
            <input value={city} onChange={(e) => setCity(e.target.value)} style={input} placeholder="e.g. Raleigh" />
          </label>
        </div>
      )}
    </div>
  );
}

// ----- Source form -----

function SourceForm({ onCreated }: { onCreated: (s: EventSource) => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [tag, setTag] = useState<Tag>('school');
  const [school, setSchool] = useState<SchoolValue>(EMPTY_SCHOOL);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [category, setCategory] = useState<EventCategory>('other');
  const [tz, setTz] = useState(browserTz);
  const [keywords, setKeywords] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const checked = normalizeFeedUrl(url);
    if (!name.trim()) return setError('Give the source a name.');
    if (!checked.ok) return setError(checked.error);
    if (tag === 'school' && !school.id) return setError('Pick the school this feed belongs to.');
    if (tag === 'region' && !state) return setError('Pick a state for this feed.');
    setSaving(true);
    try {
      const created = await createEventSource({
        name: name.trim(),
        ical_url: checked.url,
        school_id: tag === 'school' ? school.id : null,
        school_name: tag === 'school' ? school.name : null,
        city: tag === 'region' ? city.trim() || null : null,
        state: tag === 'school' ? school.state : state,
        default_category: category,
        default_timezone: tz,
        include_keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean).length
          ? keywords.split(',').map((k) => k.trim()).filter(Boolean)
          : null,
      });
      onCreated(created);
      setName(''); setUrl(''); setSchool(EMPTY_SCHOOL); setCity(''); setState(''); setKeywords('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the source.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontWeight: 600, color: 'var(--text)' }}>Add an iCal feed</p>
      <div style={grid}>
        <label style={labelStyle}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} style={input} placeholder="UNC Career Services" />
        </label>
        <label style={labelStyle}>
          Feed URL (.ics or webcal://)
          <input value={url} onChange={(e) => setUrl(e.target.value)} style={input} placeholder="https://calendar.example.edu/career.ics" inputMode="url" />
        </label>
      </div>
      <TagPicker tag={tag} setTag={setTag} school={school} setSchool={setSchool} city={city} setCity={setCity} state={state} setState={setState} allowOnline={false} />
      <div style={grid}>
        <label style={labelStyle}>
          Default category
          <select value={category} onChange={(e) => setCategory(e.target.value as EventCategory)} style={input}>
            {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{EVENT_CATEGORY_LABELS[c]}</option>)}
          </select>
        </label>
        <label style={labelStyle}>
          Time zone for untimed entries
          <select value={tz} onChange={(e) => setTz(e.target.value)} style={input}>
            {US_TIME_ZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
          </select>
        </label>
        <label style={labelStyle}>
          Only import events mentioning (optional, comma-separated)
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} style={input} placeholder="career, internship, employer" />
        </label>
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
        Category is guessed from each event&apos;s title (career fair, info session, workshop…) and falls back to the default. Synced career fairs start flagged as major.
      </p>
      {error && <p role="alert" style={{ color: 'var(--danger-fg)', fontSize: '0.82rem' }}>{error}</p>}
      <div>
        <button type="submit" className="btn-primary" disabled={saving} style={{ fontSize: '0.85rem', padding: '8px 18px' }}>
          {saving ? 'Adding…' : 'Add source'}
        </button>
      </div>
    </form>
  );
}

// ----- Event form (create + edit) -----

function EventForm({ initial, onSaved, onCancel }: { initial: CareerEvent | null; onSaved: (e: CareerEvent) => void; onCancel?: () => void }) {
  const initialTz = initial?.timezone && US_TIME_ZONES.some((z) => z.value === initial.timezone) ? initial.timezone : browserTz;
  const initialTag: Tag = initial ? (initial.school_id ? 'school' : initial.state ? 'region' : 'online') : 'school';
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [tz, setTz] = useState(initialTz);
  const [allDay, setAllDay] = useState(initial?.all_day ?? false);
  const [start, setStart] = useState(initial ? isoToZonedInput(initial.starts_at, initialTz) : '');
  const [end, setEnd] = useState(initial?.ends_at ? isoToZonedInput(initial.ends_at, initialTz) : '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [virtualUrl, setVirtualUrl] = useState(initial?.virtual_url ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [organizer, setOrganizer] = useState(initial?.organizer ?? '');
  const [category, setCategory] = useState<EventCategory>(initial?.category ?? 'career_fair');
  const [isMajor, setIsMajor] = useState(initial?.is_major ?? false);
  const [tag, setTag] = useState<Tag>(initialTag);
  const [school, setSchool] = useState<SchoolValue>(initial?.school_id ? { id: initial.school_id, name: initial.school_name ?? '', state: initial.state } : EMPTY_SCHOOL);
  const [city, setCity] = useState(initial && !initial.school_id ? initial.city ?? '' : '');
  const [state, setState] = useState(initial && !initial.school_id ? initial.state ?? '' : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function link(value: string): string | null | false {
    if (!value.trim()) return null;
    try {
      const u = new URL(value.trim());
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : false;
    } catch {
      return false;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim()) return setError('Add a title.');
    const startsAt = zonedInputToIso(allDay ? start.slice(0, 10) : start, tz);
    if (!startsAt) return setError('Add a start date and time.');
    const endsAt = end ? zonedInputToIso(allDay ? end.slice(0, 10) : end, tz) : null;
    if (end && (!endsAt || endsAt < startsAt)) return setError('End must be after the start.');
    const v = link(virtualUrl), u = link(url);
    if (v === false || u === false) return setError('Links must be full http(s) URLs.');
    if (tag === 'school' && !school.id) return setError('Pick the school.');
    if (tag === 'region' && !state) return setError('Pick a state.');

    const payload: EventInput = {
      title: title.trim(),
      description: description.trim() || null,
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: allDay,
      timezone: tz,
      location: location.trim() || null,
      virtual_url: v,
      url: u,
      organizer: organizer.trim() || null,
      category,
      school_id: tag === 'school' ? school.id : null,
      school_name: tag === 'school' ? school.name : null,
      city: tag === 'region' ? city.trim() || null : null,
      state: tag === 'school' ? school.state : tag === 'region' ? state : null,
      is_major: isMajor,
      status: initial?.status ?? 'active',
    };
    setSaving(true);
    try {
      onSaved(initial ? await updateCareerEvent(initial.id, payload) : await createCareerEvent(payload));
      if (!initial) {
        setTitle(''); setDescription(''); setStart(''); setEnd(''); setLocation(''); setVirtualUrl(''); setUrl(''); setOrganizer(''); setIsMajor(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the event.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontWeight: 600, color: 'var(--text)' }}>{initial ? 'Edit event' : 'Add an event manually'}</p>
      {initial?.origin === 'ical' && (
        <p style={{ fontSize: '0.78rem', color: 'var(--warning-fg)', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8, padding: '8px 10px' }}>
          This event comes from a feed. The next sync overwrites edits to its details; the major flag is kept.
        </p>
      )}
      <div style={grid}>
        <label style={labelStyle}>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={input} />
        </label>
        <label style={labelStyle}>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as EventCategory)} style={input}>
            {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{EVENT_CATEGORY_LABELS[c]}</option>)}
          </select>
        </label>
        <label style={labelStyle}>
          Organizer
          <input value={organizer} onChange={(e) => setOrganizer(e.target.value)} style={input} />
        </label>
      </div>
      <div style={grid}>
        <label style={labelStyle}>
          Starts
          <input type={allDay ? 'date' : 'datetime-local'} value={allDay ? start.slice(0, 10) : start} onChange={(e) => setStart(e.target.value)} style={input} />
        </label>
        <label style={labelStyle}>
          Ends (optional)
          <input type={allDay ? 'date' : 'datetime-local'} value={allDay ? end.slice(0, 10) : end} onChange={(e) => setEnd(e.target.value)} style={input} />
        </label>
        <label style={labelStyle}>
          Time zone
          <select value={tz} onChange={(e) => setTz(e.target.value)} style={input}>
            {US_TIME_ZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
          </select>
        </label>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text)' }}>
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
        All-day event
      </label>
      <div style={grid}>
        <label style={labelStyle}>
          Location
          <input value={location} onChange={(e) => setLocation(e.target.value)} style={input} placeholder="Student Union Ballroom" />
        </label>
        <label style={labelStyle}>
          Virtual link (optional)
          <input value={virtualUrl} onChange={(e) => setVirtualUrl(e.target.value)} style={input} placeholder="https://zoom.us/j/…" />
        </label>
        <label style={labelStyle}>
          Event page (optional)
          <input value={url} onChange={(e) => setUrl(e.target.value)} style={input} placeholder="https://…" />
        </label>
      </div>
      <label style={labelStyle}>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
      </label>
      <TagPicker tag={tag} setTag={setTag} school={school} setSchool={setSchool} city={city} setCity={setCity} state={state} setState={setState} allowOnline />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text)' }}>
        <input type="checkbox" checked={isMajor} onChange={(e) => setIsMajor(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
        Major event — notify every student it&apos;s relevant to
      </label>
      {error && <p role="alert" style={{ color: 'var(--danger-fg)', fontSize: '0.82rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn-primary" disabled={saving} style={{ fontSize: '0.85rem', padding: '8px 18px' }}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add event'}
        </button>
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel} style={{ fontSize: '0.85rem', padding: '8px 18px' }}>Cancel</button>}
      </div>
    </form>
  );
}

// ----- Page -----

export default function AdminCareerEventsPage() {
  const [sources, setSources] = useState<EventSource[]>([]);
  const [events, setEvents] = useState<CareerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<SyncResponse | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<'all' | 'manual' | 'ical' | 'major'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    try {
      const [s, e] = await Promise.all([listEventSources(), listAdminEvents()]);
      setSources(s);
      setEvents(e);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? `${err.message} — has migrations/20261009_career_events.sql been applied?` : 'Could not load career events.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function sync(sourceId?: string) {
    setSyncing(sourceId ?? 'all');
    setError('');
    try {
      setLastSync(await triggerCareerEventsSync(sourceId));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncing(null);
    }
  }

  async function act(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setError('');
    try { await fn(); } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); } finally { setBusyId(null); }
  }

  const visibleEvents = useMemo(() => events.filter((e) =>
    eventFilter === 'all' || (eventFilter === 'major' ? e.is_major : e.origin === eventFilter)), [events, eventFilter]);
  const sourceName = useMemo(() => new Map(sources.map((s) => [s.id, s.name])), [sources]);

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Career Events</h2>
        <button type="button" className="btn-secondary" onClick={() => sync()} disabled={!!syncing || sources.length === 0} style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
          {syncing === 'all' ? 'Syncing…' : 'Sync all now'}
        </button>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20, lineHeight: 1.55 }}>
        Students see events from their own campus, events tagged to their school&apos;s state, and online events.
        Feeds sync hourly when the cron is scheduled; favorites get a reminder ~24 hours out and major events notify every student in scope.
      </p>

      {error && (
        <div role="alert" style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'var(--danger-bg)', color: 'var(--danger-fg)', border: '1px solid var(--danger-border)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}
      {lastSync && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'var(--info-bg)', color: 'var(--info-fg)', border: '1px solid var(--info-border)', fontSize: '0.85rem' }}>
          Synced {lastSync.sources.filter((s) => s.ok).length}/{lastSync.sources.length} feeds ·{' '}
          {lastSync.sources.reduce((n, s) => n + s.count, 0)} events · {lastSync.reminders} reminders · {lastSync.majorNotifications} major-event notifications
          {lastSync.notificationError && <> · notifications failed: {lastSync.notificationError}</>}
        </div>
      )}

      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '8px 0 12px' }}>Sources</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : sources.length === 0 ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: 12, fontSize: '0.88rem', lineHeight: 1.55 }}>
            No feeds yet. Most campus calendars (Localist, Presence, CampusGroups, Engage) publish an iCal link —
            look for &ldquo;Subscribe&rdquo;, &ldquo;iCal&rdquo; or &ldquo;Export&rdquo; on the career center&apos;s events page.
          </div>
        ) : sources.map((s) => (
          <div key={s.id} style={{ ...card, opacity: s.is_active ? 1 : 0.65 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{s.name}</span>
              <span style={{ ...chip, background: s.school_id ? 'var(--chip-indigo-bg)' : 'var(--chip-blue-bg)', color: s.school_id ? 'var(--chip-indigo-ink)' : 'var(--chip-blue-ink)' }}>
                {s.school_id ? 'Campus' : 'Local'} · {locationLabel(s)}
              </span>
              {!s.is_active && <span style={{ ...chip, background: 'var(--chip-neutral-bg)', color: 'var(--chip-neutral-ink)' }}>Paused</span>}
              {s.last_error
                ? <span style={{ ...chip, background: 'var(--danger-bg)', color: 'var(--danger-fg)' }}>Error</span>
                : s.last_synced_at && <span style={{ ...chip, background: 'var(--chip-green-bg)', color: 'var(--chip-green-ink)' }}>OK</span>}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontFamily: 'monospace', overflowWrap: 'anywhere', marginBottom: 6 }}>{s.ical_url}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Last synced {relativeTime(s.last_synced_at)}
              {s.last_event_count != null && <> · {s.last_event_count} events in window</>}
              {s.include_keywords?.length ? <> · keywords: {s.include_keywords.join(', ')}</> : null}
            </p>
            {s.last_error && <p style={{ fontSize: '0.8rem', color: 'var(--danger-fg)', marginTop: 4, overflowWrap: 'anywhere' }}>{s.last_error}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <button type="button" className="btn-secondary" style={smallBtn} disabled={!!syncing || !s.is_active} onClick={() => sync(s.id)}>
                {syncing === s.id ? 'Syncing…' : 'Sync now'}
              </button>
              <button type="button" className="btn-secondary" style={smallBtn} disabled={busyId === s.id}
                onClick={() => act(s.id, async () => { await setEventSourceActive(s.id, !s.is_active); setSources((p) => p.map((x) => x.id === s.id ? { ...x, is_active: !s.is_active } : x)); })}>
                {s.is_active ? 'Pause' : 'Resume'}
              </button>
              <button type="button" className="btn-secondary" style={{ ...smallBtn, color: 'var(--danger-fg)' }} disabled={busyId === s.id}
                onClick={() => {
                  if (!window.confirm(`Remove "${s.name}"? Its imported events are deleted too.`)) return;
                  act(s.id, async () => { await deleteEventSource(s.id); setSources((p) => p.filter((x) => x.id !== s.id)); setEvents((p) => p.filter((x) => x.source_id !== s.id)); });
                }}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <SourceForm onCreated={(s) => setSources((p) => [s, ...p])} />

      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '32px 0 12px' }}>Upcoming events</h3>
      <div style={{ marginBottom: 16 }}>
        <EventForm initial={null} onSaved={(e) => setEvents((p) => [...p, e].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {(['all', 'major', 'manual', 'ical'] as const).map((f) => (
          <button key={f} type="button" aria-pressed={eventFilter === f} onClick={() => setEventFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 999, fontSize: '0.8rem', cursor: 'pointer',
              fontWeight: eventFilter === f ? 600 : 500,
              border: `1.5px solid ${eventFilter === f ? 'var(--primary)' : 'var(--border)'}`,
              background: eventFilter === f ? 'var(--primary-light)' : 'var(--surface)',
              color: eventFilter === f ? 'var(--primary)' : 'var(--text-secondary)',
            }}>
            {{ all: 'All', major: 'Major', manual: 'Manual', ical: 'From feeds' }[f]}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!loading && visibleEvents.length === 0 && (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: 12, fontSize: '0.88rem' }}>
            No upcoming events{eventFilter !== 'all' ? ' in this view' : ''}. Add a feed above and sync, or add one manually.
          </div>
        )}
        {visibleEvents.map((e) => editingId === e.id ? (
          <EventForm key={e.id} initial={e} onCancel={() => setEditingId(null)}
            onSaved={(saved) => { setEvents((p) => p.map((x) => x.id === saved.id ? saved : x)); setEditingId(null); }} />
        ) : (
          <div key={e.id} style={{ ...card, padding: '14px 16px', opacity: e.status === 'cancelled' ? 0.6 : 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)', overflowWrap: 'anywhere' }}>{e.title}</span>
              {e.is_major && <span style={{ ...chip, background: 'var(--chip-amber-bg)', color: 'var(--chip-amber-ink)' }}>Major</span>}
              {e.status === 'cancelled' && <span style={{ ...chip, background: 'var(--danger-bg)', color: 'var(--danger-fg)' }}>Cancelled</span>}
              <span style={{ ...chip, background: 'var(--chip-green-bg)', color: 'var(--chip-green-ink)' }}>{EVENT_CATEGORY_LABELS[e.category]}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
              {formatEventWhen(e)} · {locationLabel(e)} · {e.origin === 'ical' ? `feed: ${sourceName.get(e.source_id ?? '') ?? 'removed'}` : 'manual'}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <button type="button" className="btn-secondary" style={smallBtn} disabled={busyId === e.id}
                onClick={() => act(e.id, async () => { const saved = await updateCareerEvent(e.id, { is_major: !e.is_major }); setEvents((p) => p.map((x) => x.id === e.id ? saved : x)); })}>
                {e.is_major ? 'Unmark major' : 'Mark major'}
              </button>
              <button type="button" className="btn-secondary" style={smallBtn} onClick={() => setEditingId(e.id)}>Edit</button>
              {e.origin === 'manual' && (
                <button type="button" className="btn-secondary" style={smallBtn} disabled={busyId === e.id}
                  onClick={() => act(e.id, async () => { const saved = await updateCareerEvent(e.id, { status: e.status === 'active' ? 'cancelled' : 'active' }); setEvents((p) => p.map((x) => x.id === e.id ? saved : x)); })}>
                  {e.status === 'active' ? 'Cancel event' : 'Restore'}
                </button>
              )}
              <button type="button" className="btn-secondary" style={{ ...smallBtn, color: 'var(--danger-fg)' }} disabled={busyId === e.id}
                onClick={() => {
                  if (!window.confirm(e.origin === 'ical' ? `Delete "${e.title}"? It will come back on the next sync if it's still in the feed.` : `Delete "${e.title}"?`)) return;
                  act(e.id, async () => { await deleteCareerEvent(e.id); setEvents((p) => p.filter((x) => x.id !== e.id)); });
                }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
