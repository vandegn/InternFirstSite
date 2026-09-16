'use client';
import { useEffect, useState } from 'react';
import { conversionRate, type AnalyticsReport } from '@/lib/product-analytics';

const LABELS: Record<string, string> = {
  listing_viewed: 'Listing views (per session)', cta_clicked: 'CTA clicks',
  registration_started: 'Registration starts', registration_completed: 'Registration completions',
  application_started: 'Application starts', application_completed: 'Applications submitted',
  job_posting_started: 'Job posting starts', job_published: 'Jobs first published',
};
const FUNNELS = [ ['registration_started', 'student', 'Student registration'], ['registration_started', 'employer', 'Employer registration'], ['application_started', 'student', 'Applications'], ['job_posting_started', 'employer', 'Job publication'] ];
const box = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 };
const cell = { padding: '12px 16px', textAlign: 'left' as const, borderBottom: '1px solid var(--border)' };
function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
export default function AdminAnalyticsPage() {
  const [start, setStart] = useState(() => isoDate(new Date(Date.now() - 29 * 86400000)));
  const [end, setEnd] = useState(() => isoDate(new Date()));
  const [role, setRole] = useState('all');
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/analytics?${new URLSearchParams({ start, end, role })}`, { signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load analytics.'); return data; })
      .then(data => { if (!controller.signal.aborted) setReport(data); }).catch(e => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [start, end, role, revision]);
  function beginLoad() { setLoading(true); setError(''); }
  const total = (name: string) => report?.events.filter(e => e.name === name).reduce((sum, e) => sum + e.count, 0) ?? 0;
  const days = [...new Set(report?.daily.map(d => d.day) ?? [])].sort().reverse();
  return <div className="dash-main" style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
    <h1 style={{ fontSize: '1.8rem', marginBottom: 8 }}>Analytics</h1>
    <p style={{ color: 'var(--text-secondary)' }}>Follow interest, registration, applications, and employer posting activity.</p>
    <div style={{ ...box, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'end', margin: '24px 0' }}>
      <label>From (UTC)<input className="form-input" type="date" value={start} max={end} onChange={e => { beginLoad(); setStart(e.target.value); }} /></label>
      <label>Through (UTC)<input className="form-input" type="date" value={end} min={start} onChange={e => { beginLoad(); setEnd(e.target.value); }} /></label>
      <label>Role<select className="form-input" value={role} onChange={e => { beginLoad(); setRole(e.target.value); }}><option value="all">All roles</option><option value="student">Student</option><option value="employer">Employer</option><option value="anonymous">Anonymous visitor</option></select></label>
      <button className="btn-secondary" onClick={() => { beginLoad(); setRevision(v => v + 1); }} disabled={loading}>Refresh</button>
    </div>
    {error ? <p role="alert" style={{ ...box, color: 'var(--danger, #b42318)' }}>{error}</p> : loading ? <p role="status">Loading analytics…</p> : report && <>
      <h2>Tracked activity</h2>
      <p style={{ color: 'var(--text-secondary)' }}>Events are available from the date tracking was enabled. Listing views count once per browser session per listing, across public and student pages.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, margin: '16px 0 32px' }}>
        {Object.entries(LABELS).map(([key, label]) => <div key={key} style={box}><div style={{ color: 'var(--text-secondary)' }}>{label}</div><strong style={{ fontSize: '2rem', display: 'block', marginTop: 8 }}>{total(key).toLocaleString()}</strong></div>)}
      </div>
      <h2>Conversion funnels</h2>
      <p style={{ color: 'var(--text-secondary)' }}>Starts within the selected dates that completed by the end date. Returning attempts are counted once. Registration starts on the first form change; applications start when the application form opens; job postings start on the first form change. A draft counts as complete only when first published.</p>
      <div style={{ overflowX: 'auto', ...box, padding: 0, margin: '16px 0 32px' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Flow', 'Started', 'Completed from these starts', 'Conversion'].map(h => <th key={h} scope="col" style={cell}>{h}</th>)}</tr></thead><tbody>
        {FUNNELS.filter(([, r]) => role === 'all' || role === r).map(([name, r, label]) => {
          const f = report.funnels.find(f => f.name === name && f.role === r);
          return <tr key={label}><th scope="row" style={cell}>{label}</th><td style={cell}>{f?.started ?? 0}</td><td style={cell}>{f?.completed ?? 0}</td><td style={cell}>{conversionRate(f?.started ?? 0, f?.completed ?? 0)}</td></tr>;
        })}
        {role === 'anonymous' && <tr><td colSpan={4} style={cell}>Select Student or Employer to see conversion funnels.</td></tr>}
      </tbody></table></div>
      <h2>CTA performance</h2>
      <div style={{ overflowX: 'auto', ...box, padding: 0, margin: '16px 0 32px' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Action', 'Page', 'Clicks'].map(h => <th key={h} scope="col" style={cell}>{h}</th>)}</tr></thead><tbody>
        {report.ctas.map(c => <tr key={`${c.cta}:${c.path}`}><td style={cell}>{({ register: 'Sign up', apply: 'Apply', post_job: 'Post a job', browse_internships: 'Browse internships', waitlist: 'Join waitlist' })[c.cta] ?? c.cta}</td><td style={cell}>{c.path}</td><td style={cell}>{c.count}</td></tr>)}
        {!report.ctas.length && <tr><td colSpan={3} style={cell}>No CTA clicks in this period.</td></tr>}
      </tbody></table></div>
      <h2>Daily activity</h2>
      <div style={{ overflowX: 'auto', ...box, padding: 0, margin: '16px 0 32px' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}><thead><tr><th scope="col" style={cell}>Date (UTC)</th>{Object.values(LABELS).map(label => <th key={label} scope="col" style={cell}>{label}</th>)}</tr></thead><tbody>
        {days.map(day => <tr key={day}><th scope="row" style={cell}>{day}</th>{Object.keys(LABELS).map(name => <td key={name} style={cell}>{report.daily.find(d => d.day === day && d.name === name)?.count ?? 0}</td>)}</tr>)}
        {!days.length && <tr><td colSpan={9} style={cell}>No tracked activity in this period.</td></tr>}
      </tbody></table></div>
      <h2>Existing records in this date range</h2>
      <p style={{ color: 'var(--text-secondary)' }}>Includes records created before event tracking began. Deleted records are excluded. Listings include drafts and scheduled posts; these totals are separate from funnel conversions.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginTop: 16 }}>
        {Object.entries({ registrations: 'Registered accounts', applications: 'Submitted applications', listings: 'Listings created', uniqueListingViews: 'Unique signed-in listing views', waitlist: 'Waitlist signups' }).map(([key, label]) => <div key={key} style={box}><div>{label}</div><strong style={{ fontSize: '1.6rem' }}>{report.totals[key as keyof AnalyticsReport['totals']].toLocaleString()}</strong></div>)}
      </div>
    </>}
  </div>;
}
