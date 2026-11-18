'use client';

import { useEffect, useMemo, useState } from 'react';
import SchoolPicker, { EMPTY_SCHOOL, type SchoolValue } from '@/components/SchoolPicker';
import type { EventSource } from '@/lib/career-events';
import { FEED_PLATFORM_LABELS, normalizeDomainInput, suggestCareerOnly, type FeedPlatform } from '@/lib/feed-discovery';
import type { DiscoverySummary } from '@/lib/feed-discovery-service';
import {
  approveFeedCandidate,
  dismissFeedCandidate,
  listDiscoveryChecks,
  listFeedCandidates,
  triggerFeedDiscovery,
  type DiscoveryCheckRow,
  type FeedCandidate,
} from '@/lib/feed-discovery-client';

// "Suggested feeds" on /dashboard/admin/events: iCal feeds the finder
// (/api/career-events/discover) turned up at our students' schools. Approving
// one creates the event source; nothing is synced before that.

const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', background: 'var(--surface)' };
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

function summaryText(s: DiscoverySummary): string {
  if (s.schools.length === 0) return 'Every school with students was checked in the last 30 days — nothing to do.';
  const found = s.schools.reduce((n, x) => n + x.found, 0);
  const failed = s.schools.filter((x) => x.error).length;
  return `Checked ${s.schools.length} school${s.schools.length === 1 ? '' : 's'} · ${found} feed${found === 1 ? '' : 's'} found · ${s.added} new suggestion${s.added === 1 ? '' : 's'}${failed ? ` · ${failed} unreachable` : ''}`;
}

function CandidateCard({ c, busy, onApprove, onDismiss }: {
  c: FeedCandidate; busy: boolean;
  onApprove: (careerOnly: boolean) => void; onDismiss: () => void;
}) {
  const [careerOnly, setCareerOnly] = useState(() => suggestCareerOnly(c));
  return (
    <div style={card}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{c.calendar_name || platformLabel(c.platform)}</span>
        <span style={{ ...chip, background: 'var(--chip-indigo-bg)', color: 'var(--chip-indigo-ink)' }}>{platformLabel(c.platform)}</span>
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontFamily: 'monospace', overflowWrap: 'anywhere', marginBottom: 6 }}>{c.ical_url}</p>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        {c.upcoming_count} upcoming events · {c.career_count} career-related · {c.found_on ? <>linked from <span style={{ overflowWrap: 'anywhere' }}>{c.found_on}</span></> : 'found at a standard platform address'}
      </p>
      {c.sample_titles.length > 0 && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4, overflowWrap: 'anywhere' }}>
          e.g. {c.sample_titles.slice(0, 3).join(' · ')}
        </p>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text)', marginTop: 10 }}>
        <input type="checkbox" checked={careerOnly} onChange={(e) => setCareerOnly(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
        Only import career-related events ({c.career_count} of {c.upcoming_count})
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <button type="button" className="btn-primary" style={smallBtn} disabled={busy} onClick={() => onApprove(careerOnly)}>
          {busy ? 'Working…' : 'Approve & sync'}
        </button>
        <button type="button" className="btn-secondary" style={smallBtn} disabled={busy} onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}

export default function FeedSuggestions({ onApproved }: { onApproved: (source: EventSource) => void }) {
  const [candidates, setCandidates] = useState<FeedCandidate[]>([]);
  const [checks, setChecks] = useState<DiscoveryCheckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState<'all' | 'one' | null>(null);
  const [lastRun, setLastRun] = useState<DiscoverySummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [school, setSchool] = useState<SchoolValue>(EMPTY_SCHOOL);
  const [domain, setDomain] = useState('');

  async function reload() {
    try {
      const [c, k] = await Promise.all([listFeedCandidates(), listDiscoveryChecks()]);
      setCandidates(c);
      setChecks(k);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? `${err.message} — has migrations/20261117_feed_discovery.sql been applied?` : 'Could not load suggested feeds.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function run(target?: { schoolId: number; domain: string }) {
    setRunning(target ? 'one' : 'all');
    setError('');
    try {
      setLastRun(await triggerFeedDiscovery(target));
      await reload();
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

  async function act(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setError('');
    try { await fn(); } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); } finally { setBusyId(null); }
  }

  const bySchool = useMemo(() => {
    const groups = new Map<number, { name: string; items: FeedCandidate[] }>();
    for (const c of candidates) {
      const g = groups.get(c.school_id) ?? { name: c.school_name, items: [] };
      g.items.push(c);
      groups.set(c.school_id, g);
    }
    return [...groups.values()];
  }, [candidates]);
  const empty = checks.filter((k) => k.feeds_found === 0);

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '8px 0 6px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Suggested feeds</h3>
        <button type="button" className="btn-secondary" onClick={() => run()} disabled={!!running} style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
          {running === 'all' ? 'Searching…' : 'Find feeds now'}
        </button>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12, lineHeight: 1.55 }}>
        Found automatically at the schools our students attend (checked daily; each school again every 30 days).
        Nothing syncs until you approve it. Whole-campus calendars default to importing only career-related events.
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 14 }}>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : bySchool.length === 0 ? (
          <div style={{ padding: '22px 20px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: 12, fontSize: '0.88rem' }}>
            No suggestions waiting. Press &ldquo;Find feeds now&rdquo; or check a specific school below.
          </div>
        ) : bySchool.map((g) => (
          <div key={g.name} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text)' }}>{g.name}</p>
            {g.items.map((c) => (
              <CandidateCard key={c.id} c={c} busy={busyId === c.id}
                onApprove={(careerOnly) => act(c.id, async () => {
                  const source = await approveFeedCandidate(c, { careerOnly });
                  setCandidates((p) => p.filter((x) => x.id !== c.id));
                  onApproved(source);
                })}
                onDismiss={() => act(c.id, async () => {
                  await dismissFeedCandidate(c.id);
                  setCandidates((p) => p.filter((x) => x.id !== c.id));
                })} />
            ))}
          </div>
        ))}
      </div>

      <form onSubmit={checkSchool} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
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

      {empty.length > 0 && (
        <details style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <summary style={{ cursor: 'pointer' }}>{empty.length} school{empty.length === 1 ? '' : 's'} checked with no feed found — add these by hand</summary>
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
