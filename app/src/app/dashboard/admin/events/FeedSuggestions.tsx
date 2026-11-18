'use client';

import { useEffect, useState } from 'react';
import SchoolPicker, { EMPTY_SCHOOL, type SchoolValue } from '@/components/SchoolPicker';
import type { EventSource } from '@/lib/career-events';
import { FEED_PLATFORM_LABELS, normalizeDomainInput, suggestCareerOnly, type FeedPlatform } from '@/lib/feed-discovery';
import {
  addSkippedFeed,
  listDiscoveryChecks,
  listFeedCandidates,
  triggerFeedDiscovery,
  type DiscoveryCheckRow,
  type DiscoveryResponse,
  type FeedCandidate,
} from '@/lib/feed-discovery-client';

// "Feed finder" on /dashboard/admin/events. The finder
// (/api/career-events/discover) adds useful feeds at our students' schools as
// sources on its own; this panel runs it on demand, shows what it added and
// skipped (with an "Add anyway"), and lists schools where it found nothing.
// Added feeds are managed like any other source (pause / remove) below.

const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface)' };
const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' };
const chip: React.CSSProperties = { padding: '2px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600 };
const smallBtn: React.CSSProperties = { fontSize: '0.78rem', padding: '6px 12px' };

function platformLabel(p: string): string {
  return FEED_PLATFORM_LABELS[p as FeedPlatform] ?? FEED_PLATFORM_LABELS.other;
}

function summaryText(s: DiscoveryResponse): string {
  if (s.schools.length === 0) return 'Every school with students was checked in the last 30 days, so there was nothing to do.';
  const found = s.schools.reduce((n, x) => n + x.found, 0);
  const failed = s.schools.filter((x) => x.error).length;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return [
    `Checked ${plural(s.schools.length, 'school')}`,
    `${plural(found, 'feed')} found`,
    `${s.added} added`,
    s.eventsImported != null ? `${plural(s.eventsImported, 'event')} imported` : null,
    failed ? `${failed} unreachable` : null,
  ].filter(Boolean).join(' · ');
}

function FeedRow({ c, busy, onAdd }: { c: FeedCandidate; busy: boolean; onAdd: (careerOnly: boolean) => void }) {
  const added = c.status === 'approved';
  return (
    <div style={{ ...card, opacity: added ? 1 : 0.85 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{c.calendar_name || platformLabel(c.platform)}</span>
        <span style={{ ...chip, background: 'var(--chip-indigo-bg)', color: 'var(--chip-indigo-ink)' }}>{platformLabel(c.platform)}</span>
        {added
          ? <span style={{ ...chip, background: 'var(--chip-green-bg)', color: 'var(--chip-green-ink)' }}>Added</span>
          : <span style={{ ...chip, background: 'var(--chip-neutral-bg)', color: 'var(--chip-neutral-ink)' }}>Skipped</span>}
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontFamily: 'monospace', overflowWrap: 'anywhere', marginBottom: 4 }}>{c.ical_url}</p>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        {c.upcoming_count} upcoming · {c.career_count} career-related{c.note ? <> · {c.note}</> : null}
      </p>
      {!added && (
        <button type="button" className="btn-secondary" style={{ ...smallBtn, marginTop: 8 }} disabled={busy}
          onClick={() => onAdd(suggestCareerOnly(c) && c.career_count > 0)}>
          {busy ? 'Adding…' : 'Add anyway'}
        </button>
      )}
    </div>
  );
}

export default function FeedSuggestions({ onAdded }: { onAdded: (source: EventSource | null) => void }) {
  const [feeds, setFeeds] = useState<FeedCandidate[]>([]);
  const [checks, setChecks] = useState<DiscoveryCheckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState<'all' | 'one' | null>(null);
  const [lastRun, setLastRun] = useState<DiscoveryResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [school, setSchool] = useState<SchoolValue>(EMPTY_SCHOOL);
  const [domain, setDomain] = useState('');

  async function reload() {
    try {
      const [f, k] = await Promise.all([listFeedCandidates(), listDiscoveryChecks()]);
      setFeeds(f);
      setChecks(k);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? `${err.message} (have the 20261117_feed_discovery migrations been applied?)` : 'Could not load the feed finder.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function run(target?: { schoolId: number; domain: string }) {
    setRunning(target ? 'one' : 'all');
    setError('');
    try {
      const result = await triggerFeedDiscovery(target);
      setLastRun(result);
      await reload();
      if (result.added > 0) onAdded(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feed search failed.');
    } finally {
      setRunning(null);
    }
  }

  function checkSchool(e: React.FormEvent) {
    e.preventDefault();
    if (!school.id) return setError('Pick the school to check.');
    const d = normalizeDomainInput(domain);
    if (!d.ok) return setError(d.error);
    run({ schoolId: school.id, domain: d.domain });
  }

  async function addAnyway(c: FeedCandidate, careerOnly: boolean) {
    setBusyId(c.id);
    setError('');
    try {
      const source = await addSkippedFeed(c, { careerOnly });
      setFeeds((p) => p.map((x) => x.id === c.id ? { ...x, status: 'approved', source_id: source.id, note: 'Added by an admin.' } : x));
      onAdded(source);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the feed.');
    } finally {
      setBusyId(null);
    }
  }

  const empty = checks.filter((k) => k.feeds_found === 0);

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '8px 0 6px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Feed finder</h3>
        <button type="button" className="btn-secondary" onClick={() => run()} disabled={!!running} style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
          {running === 'all' ? 'Searching…' : 'Find feeds now'}
        </button>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12, lineHeight: 1.55 }}>
        Every day, the finder looks for calendar feeds at the schools our students attend and adds the useful ones as sources.
        Each school is checked again every 30 days. Only that school&apos;s students see its events.
        Whole-campus calendars import career-related events only. Remove or pause an added feed under Sources and it won&apos;t be added again.
      </p>

      {error && (
        <div role="alert" style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: 'var(--danger-bg)', color: 'var(--danger-fg)', border: '1px solid var(--danger-border)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}
      {lastRun && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: 'var(--info-bg)', color: 'var(--info-fg)', border: '1px solid var(--info-border)', fontSize: '0.85rem' }}>
          {summaryText(lastRun)}
        </div>
      )}

      <form onSubmit={checkSchool} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        <p style={{ fontWeight: 600, color: 'var(--text)' }}>Check a school</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={labelStyle}>
            School
            <SchoolPicker value={school} onChange={setSchool} placeholder="Search schools…" inputStyle={input} />
          </div>
          <label style={labelStyle}>
            Web domain
            <input value={domain} onChange={(e) => setDomain(e.target.value)} style={input} placeholder="unc.edu" inputMode="url" />
          </label>
        </div>
        <div>
          <button type="submit" className="btn-secondary" disabled={!!running} style={{ fontSize: '0.85rem', padding: '8px 18px' }}>
            {running === 'one' ? 'Checking…' : 'Check school'}
          </button>
        </div>
      </form>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : feeds.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Feeds found: {feeds.filter((f) => f.status === 'approved').length} added, {feeds.filter((f) => f.status !== 'approved').length} skipped
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {feeds.map((c) => (
              <div key={c.id}>
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{c.school_name}</p>
                <FeedRow c={c} busy={busyId === c.id} onAdd={(careerOnly) => addAnyway(c, careerOnly)} />
              </div>
            ))}
          </div>
        </details>
      )}

      {empty.length > 0 && (
        <details style={{ marginTop: 10, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <summary style={{ cursor: 'pointer' }}>{empty.length} school{empty.length === 1 ? '' : 's'} checked with no feed found. Add these by hand.</summary>
          <ul style={{ margin: '8px 0 0 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {empty.map((k) => (
              <li key={k.school_id}>
                {k.school_name} · {k.domain} · checked {new Date(k.checked_at).toLocaleDateString()}{k.error ? ` · ${k.error}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
