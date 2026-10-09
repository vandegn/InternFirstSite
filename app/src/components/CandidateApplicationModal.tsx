'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DialogShell, { primaryButton, secondaryButton } from '@/components/DialogShell';
import Avatar from '@/components/Avatar';
import RequestTimesModal, { type RequestTimesFormData } from '@/components/RequestTimesModal';
import ConfirmMeetingModal, { type ConfirmMeetingData } from '@/components/ConfirmMeetingModal';
import {
  getApplicationForReview,
  getApplicationScheduling,
  requestInterviewTimes,
  confirmInterviewTime,
  withdrawInterviewRequest,
  type ApplicationForReview,
} from '@/lib/supabase';
import {
  employerSchedulingView,
  primarySchedulingAction,
  formatMeetingWhen,
  formatSlotRange,
  formatWindowLabel,
  localTimeZone,
  MEETING_TYPE_LABELS,
  type AvailabilityRequest,
  type InterviewSummary,
  type SchedulingView,
} from '@/lib/interview-availability';
import { interviewFormatOf, INTERVIEW_FORMAT_LABELS } from '@/lib/interview-format';
import { stageColor } from '@/lib/stage-colors';

type Props = {
  /** The application to show; null keeps the modal closed. */
  applicationId: string | null;
  onClose: () => void;
  /** Called after any scheduling change so the host can refresh its chips. */
  onChanged?: () => void;
  /** Host-specific actions (e.g. the board's "Move to" control). */
  extraActions?: (app: ApplicationForReview) => React.ReactNode;
};

const EXPERIENCE_LABELS: Record<string, string> = {
  internship: 'Internship',
  work: 'Work experience',
  project: 'Project',
};

const ORGANIZATION_LABELS: Record<string, string> = {
  greek_life: 'Greek life',
  club: 'Club',
  campus_involvement: 'Campus involvement',
  other: 'Other',
};

function formatMonth(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function dateRange(start?: string | null, end?: string | null, isCurrent?: boolean | null): string {
  const from = formatMonth(start);
  const to = isCurrent ? 'Present' : formatMonth(end);
  if (!from && !to) return '';
  if (!from) return to;
  if (!to) return from;
  return `${from} – ${to}`;
}

function matchTone(score: number) {
  if (score >= 70) return { bg: 'var(--chip-green-bg)', color: 'var(--chip-green-ink)', label: 'Strong match' };
  if (score >= 40) return { bg: 'var(--chip-amber-bg)', color: 'var(--chip-amber-ink)', label: 'Fair match' };
  return { bg: 'var(--chip-neutral-bg, #f3f4f6)', color: 'var(--chip-neutral-ink)', label: 'Weak match' };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: '16px 0', borderTop: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 10px' }}>{title}</h3>
      {children}
    </section>
  );
}

const muted: React.CSSProperties = { fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 };
const chip: React.CSSProperties = {
  display: 'inline-block', fontSize: '0.72rem', fontWeight: 600, padding: '3px 9px', borderRadius: 999,
};

// The expanded view of one candidate's application: everything an employer
// reads to decide, plus the scheduling controls. Used by the pipeline board,
// the applications list, Posted Jobs and Upcoming Interviews, so every surface
// applies the same scheduling rules (employerSchedulingView): actions only for
// Screening / Interview categories, and never more than one primary action.
export default function CandidateApplicationModal({ applicationId, onClose, onChanged, extraActions }: Props) {
  const [app, setApp] = useState<ApplicationForReview | null>(null);
  const [request, setRequest] = useState<AvailabilityRequest | null>(null);
  const [interview, setInterview] = useState<InterviewSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadScheduling = useCallback(async (id: string) => {
    const s = await getApplicationScheduling(id);
    setRequest(s.request);
    setInterview(s.interview as InterviewSummary | null);
  }, []);

  useEffect(() => {
    if (!applicationId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setActionError('');
    setApp(null);
    Promise.all([getApplicationForReview(applicationId), getApplicationScheduling(applicationId)])
      .then(([a, s]) => {
        if (cancelled) return;
        if (!a) setLoadError('This application could not be loaded. It may have been removed.');
        setApp(a);
        setRequest(s.request);
        setInterview(s.interview as InterviewSummary | null);
      })
      .catch(() => { if (!cancelled) setLoadError('This application could not be loaded.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [applicationId]);

  const view: SchedulingView = app
    ? employerSchedulingView({ stage: app.stage, request, interview })
    : { kind: 'hidden' };
  const primary = primarySchedulingAction(view);
  const tz = localTimeZone();
  const name = app?.profile?.profile?.full_name ?? 'Candidate';

  async function afterChange() {
    if (applicationId) await loadScheduling(applicationId);
    onChanged?.();
  }

  async function handleRequest(data: RequestTimesFormData) {
    if (!app) return;
    await requestInterviewTimes({ applicationId: app.id, ...data });
    setRequestOpen(false);
    await afterChange();
  }

  async function handleConfirm(data: ConfirmMeetingData) {
    if (!request) return;
    await confirmInterviewTime(request.id, data);
    setConfirmOpen(false);
    await afterChange();
  }

  async function handleWithdraw(thenRequestAgain: boolean) {
    if (!request) return;
    await withdrawInterviewRequest(request.id);
    setConfirmOpen(false);
    await afterChange();
    if (thenRequestAgain) setRequestOpen(true);
  }

  async function withdrawFromPanel() {
    setActionError('');
    setBusy(true);
    try {
      await handleWithdraw(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not withdraw the request');
    } finally {
      setBusy(false);
    }
  }

  const profile = app?.profile;
  const studentSkills = ((profile?.skills ?? []) as { name: string }[]).map(s => s.name);
  const wanted = app?.listing.preferred_skills ?? [];
  const matchedSkills = wanted.filter(w => studentSkills.some(s => s.toLowerCase() === w.toLowerCase()));

  return (
    <>
      <DialogShell
        open={Boolean(applicationId)}
        onClose={onClose}
        width={900}
        zIndex={9000}
        ariaLabel={`${name}'s application`}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {app && <Avatar src={profile?.profile?.avatar_url ?? null} name={name} size={40} />}
            <span>{app ? name : 'Application'}</span>
          </span>
        }
        subtitle={app ? `Applied to ${app.listing.title} · ${new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : undefined}
        footer={app ? (
          <>
            {extraActions?.(app)}
            <Link
              href={`/dashboard/employer/inbox?to=${app.student?.user_id ?? ''}&name=${encodeURIComponent(name)}`}
              style={{ ...secondaryButton(), textDecoration: 'none' }}
            >
              Message candidate
            </Link>
            {app.student && (
              <Link href={`/dashboard/employer/students/${app.student.id}`} style={{ ...secondaryButton(), textDecoration: 'none' }}>
                Full profile
              </Link>
            )}
            <button type="button" onClick={onClose} style={primaryButton()}>Close</button>
          </>
        ) : (
          <button type="button" onClick={onClose} style={primaryButton()}>Close</button>
        )}
      >
        {loading && <p style={muted}>Loading application…</p>}
        {!loading && loadError && <p role="alert" style={{ ...muted, color: 'var(--danger-fg)' }}>{loadError}</p>}

        {app && (
          <div>
            {/* ---- Scheduling: the most time-sensitive thing, so it leads ---- */}
            <SchedulingBanner
              view={view}
              primary={primary}
              tz={tz}
              busy={busy}
              onRequest={() => { setActionError(''); setRequestOpen(true); }}
              onConfirm={() => { setActionError(''); setConfirmOpen(true); }}
              onWithdraw={withdrawFromPanel}
            />
            {actionError && (
              <p role="alert" style={{ ...muted, color: 'var(--danger-fg)', margin: '8px 0 0' }}>{actionError}</p>
            )}

            {/* ---- Category, status, match ---- */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '14px 0 4px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Category</span>
              <span style={{ ...chip, background: stageColor(app.stage?.color_bg) ?? 'var(--chip-indigo-bg)', color: stageColor(app.stage?.color_text) ?? 'var(--chip-indigo-ink)' }}>
                {app.stage?.label ?? app.status ?? 'Applied'}
              </span>
              {view.kind !== 'hidden' && (
                <>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginLeft: 6 }}>Scheduling</span>
                  <span data-testid="scheduling-status" style={{ ...chip, background: 'var(--bg-light)', color: 'var(--text)' }}>
                    {schedulingChipText(view)}
                  </span>
                </>
              )}
              {app.flagged_knockout && (
                <span style={{ ...chip, background: 'var(--danger-bg)', color: 'var(--danger-fg)' }}>
                  Knockout answer
                </span>
              )}
            </div>

            <Section title="Match">
              {app.match_score != null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ ...chip, fontSize: '0.9rem', padding: '4px 12px', background: matchTone(app.match_score).bg, color: matchTone(app.match_score).color }}>
                      {app.match_score}%
                    </span>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>{matchTone(app.match_score).label}</span>
                  </div>
                  <p style={muted}>
                    Scored on skills (40%), industry fit (25%), relevant experience (20%), and
                    work-environment and duration preferences (7.5% each).
                  </p>
                  {wanted.length > 0 && (
                    <p style={muted}>
                      <strong style={{ color: 'var(--text)' }}>Preferred skills matched:</strong>{' '}
                      {matchedSkills.length} of {wanted.length}
                      {matchedSkills.length > 0 ? ` — ${matchedSkills.join(', ')}` : ''}
                    </p>
                  )}
                  {app.listing.industry && profile?.major && (
                    <p style={muted}>
                      <strong style={{ color: 'var(--text)' }}>Industry:</strong> {app.listing.industry} ·{' '}
                      <strong style={{ color: 'var(--text)' }}>Major:</strong> {profile.major}
                    </p>
                  )}
                </div>
              ) : (
                <p style={muted}>No match score was recorded for this application.</p>
              )}
            </Section>

            <Section title="Profile & education">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px 20px' }}>
                <Field label="School" value={profile?.school_name ? `${profile.school_name}${profile.school_state ? `, ${profile.school_state}` : ''}` : null} />
                <Field label="Major" value={profile?.major} />
                <Field label="Minor" value={profile?.minor} />
                <Field label="Graduation" value={profile?.graduation_year ? `Class of ${profile.graduation_year}` : null} />
                <Field label="GPA" value={profile?.gpa != null ? String(profile.gpa) : null} />
                <Field label="Email" value={profile?.profile?.email} />
              </div>
              {profile?.bio && <p style={{ ...muted, marginTop: 10 }}>{profile.bio}</p>}
              {(profile?.linkedin_url || profile?.portfolio_url) && (
                <p style={{ ...muted, marginTop: 8, display: 'flex', gap: 14 }}>
                  {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">LinkedIn</a>}
                  {profile.portfolio_url && <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer">Portfolio</a>}
                </p>
              )}
            </Section>

            <Section title="Experience">
              {(profile?.experiences ?? []).length === 0 ? (
                <p style={muted}>No experience listed.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(profile?.experiences ?? []).map((e: Record<string, string | boolean | null>) => (
                    <div key={e.id as string}>
                      <p style={{ margin: 0, fontSize: '0.86rem', fontWeight: 600 }}>
                        {e.title as string}{e.organization ? ` · ${e.organization}` : ''}
                      </p>
                      <p style={{ margin: '1px 0 4px', fontSize: '0.74rem', color: 'var(--text-light)' }}>
                        {[EXPERIENCE_LABELS[e.type as string] ?? e.type, dateRange(e.start_date as string, e.end_date as string, e.is_current as boolean), e.location].filter(Boolean).join(' · ')}
                      </p>
                      {e.description && <p style={muted}>{e.description as string}</p>}
                      {e.technologies && <p style={{ ...muted, fontSize: '0.76rem' }}>Tools: {e.technologies as string}</p>}
                    </div>
                  ))}
                </div>
              )}
              {(profile?.organizations ?? []).length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-light)' }}>Campus involvement</p>
                  {(profile?.organizations ?? []).map((o: Record<string, string | boolean | null>) => (
                    <p key={o.id as string} style={muted}>
                      <strong style={{ color: 'var(--text)' }}>{o.name as string}</strong>
                      {o.role ? ` — ${o.role}` : ''}
                      {' · '}{ORGANIZATION_LABELS[o.type as string] ?? o.type}
                      {dateRange(o.join_date as string, o.end_date as string, o.is_current as boolean) ? ` · ${dateRange(o.join_date as string, o.end_date as string, o.is_current as boolean)}` : ''}
                    </p>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Skills">
              {studentSkills.length === 0 ? (
                <p style={muted}>No skills listed.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {studentSkills.map(s => {
                    const isWanted = wanted.some(w => w.toLowerCase() === s.toLowerCase());
                    return (
                      <span key={s} style={{
                        ...chip,
                        background: isWanted ? 'var(--chip-green-bg)' : 'var(--primary-light)',
                        color: isWanted ? 'var(--chip-green-ink)' : 'var(--primary)',
                      }}>
                        {s}{isWanted ? ' ✓' : ''}
                      </span>
                    );
                  })}
                </div>
              )}
            </Section>

            <Section title="Resume & documents">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {app.resume ? (
                  <a href={`/api/files/resume/${app.resume.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                    Resume — {app.resume.name}
                  </a>
                ) : (
                  <p style={muted}>No resume attached to this application.</p>
                )}
                {app.answers.filter(a => a.storage_path).map(a => (
                  <a key={a.id} href={`/api/files/application-answer/${a.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.84rem' }}>
                    {a.question?.prompt ?? 'Uploaded file'}
                  </a>
                ))}
                {(profile?.certifications ?? []).map((c: { id: string; name: string; certification_number: string | null }) => (
                  <a key={c.id} href={`/api/files/certification/${c.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.84rem' }}>
                    Certification — {c.name}{c.certification_number ? ` (#${c.certification_number})` : ''}
                  </a>
                ))}
              </div>
            </Section>

            <Section title="Screening & application questions">
              {app.answers.length === 0 ? (
                <p style={muted}>This listing didn’t ask any questions.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {app.answers.map(a => (
                    <div key={a.id}>
                      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)' }}>
                        {a.question?.prompt ?? 'Question'}
                      </p>
                      <p style={{ ...muted, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                        {a.answer_options?.length ? a.answer_options.join(', ')
                          : a.answer_text ? a.answer_text
                          : a.storage_path ? 'File attached (see documents above)'
                          : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}
      </DialogShell>

      {app && (
        <>
          <RequestTimesModal
            open={requestOpen}
            onClose={() => setRequestOpen(false)}
            onSubmit={handleRequest}
            candidateName={name}
            listingTitle={app.listing.title}
            meetingType={view.kind === 'request' || view.kind === 'confirmed' ? view.meetingType : 'interview'}
          />
          <ConfirmMeetingModal
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            request={view.kind === 'selected' ? view.request : null}
            slot={view.kind === 'selected' ? view.slot : null}
            meetingType={view.kind === 'selected' ? view.meetingType : 'interview'}
            candidateName={name}
            listingTitle={app.listing.title}
            onConfirm={handleConfirm}
            onWithdraw={() => handleWithdraw(true)}
          />
        </>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-light)' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '0.86rem', wordBreak: 'break-word' }}>{value}</p>
    </div>
  );
}

function schedulingChipText(view: SchedulingView): string {
  switch (view.kind) {
    case 'hidden': return '';
    case 'request': return view.lastOutcome === 'no_availability' ? 'No offered time worked' : 'Not scheduled';
    case 'awaiting_student': return 'Awaiting Student Selection';
    case 'selected': return 'Time selected — needs confirmation';
    case 'confirmed': return view.interview.status === 'accepted' ? 'Confirmed' : 'Invite sent';
  }
}

// The block at the top of the application. One primary action at most —
// Request Time before asking, Confirm Screening/Interview once the student
// picked — and never both.
function SchedulingBanner({
  view, primary, tz, busy, onRequest, onConfirm, onWithdraw,
}: {
  view: SchedulingView;
  primary: string | null;
  tz: string;
  busy: boolean;
  onRequest: () => void;
  onConfirm: () => void;
  onWithdraw: () => void;
}) {
  if (view.kind === 'hidden') {
    return (
      <p style={{ ...muted, fontSize: '0.78rem', color: 'var(--text-light)' }}>
        Scheduling becomes available when this candidate is in a Screening or Interview stage.
      </p>
    );
  }

  const box = (bg: string, color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    padding: '14px 16px', borderRadius: 12, background: bg, color,
  });
  const typeLabel = MEETING_TYPE_LABELS[view.meetingType];

  if (view.kind === 'request') {
    return (
      <div style={box('var(--bg-light)', 'var(--text)')}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem' }}>{typeLabel} not scheduled yet</p>
          <p style={{ ...muted, fontSize: '0.78rem' }}>
            {view.lastOutcome === 'no_availability'
              ? 'None of the last times you offered worked for the candidate. Offer different ones.'
              : `Offer specific times; the candidate picks one and you confirm it.`}
          </p>
        </div>
        <button type="button" onClick={onRequest} style={primaryButton()}>{primary}</button>
      </div>
    );
  }

  if (view.kind === 'awaiting_student') {
    const count = view.request.slots?.length ?? 0;
    return (
      <div style={box('var(--chip-blue-bg)', 'var(--chip-blue-ink)')}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem' }}>Awaiting Student Selection</p>
          <p style={{ margin: '2px 0 0', fontSize: '0.78rem' }}>
            {count} {typeLabel.toLowerCase()} time{count === 1 ? '' : 's'} offered ({view.request.duration_minutes} min) between{' '}
            {formatWindowLabel(view.request.window_start, view.request.window_end)}.
          </p>
        </div>
        {view.canAct && (
          <button type="button" onClick={onWithdraw} disabled={busy} style={secondaryButton(!busy)}>
            {busy ? 'Withdrawing…' : 'Withdraw request'}
          </button>
        )}
      </div>
    );
  }

  if (view.kind === 'selected') {
    return (
      <div style={box('var(--chip-amber-bg)', 'var(--chip-amber-ink)')} data-testid="selected-banner">
        <div>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '1.02rem' }}>
            Selected {formatMeetingWhen(view.slot.starts_at, tz)}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '0.78rem' }}>
            {formatSlotRange(view.slot, tz)} · {view.request.duration_minutes} min {typeLabel.toLowerCase()} · tentative until you confirm
          </p>
        </div>
        {primary ? (
          <button type="button" onClick={onConfirm} style={primaryButton()}>{primary}</button>
        ) : (
          <span style={{ fontSize: '0.76rem' }}>Move the candidate back to a Screening or Interview stage to confirm.</span>
        )}
      </div>
    );
  }

  // Confirmed.
  const iv = view.interview;
  const format = interviewFormatOf(iv);
  return (
    <div style={box('var(--chip-green-bg)', 'var(--chip-green-ink)')} data-testid="confirmed-banner">
      <div>
        <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem' }}>
          {typeLabel} {iv.status === 'accepted' ? 'confirmed' : 'invite sent'} — {formatMeetingWhen(iv.scheduled_at, tz)}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '0.78rem' }}>
          {iv.duration_minutes} min · {INTERVIEW_FORMAT_LABELS[format]}
          {format === 'external_link' && iv.meeting_url ? <> · <a href={iv.meeting_url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{iv.meeting_url}</a></> : null}
          {format === 'internfirst' ? <> · <Link href={`/dashboard/employer/interviews/${iv.id}`} style={{ color: 'inherit' }}>Interview room</Link></> : null}
        </p>
      </div>
      {view.canAct && (
        <button type="button" onClick={onRequest} style={secondaryButton()}>Request new time</button>
      )}
    </div>
  );
}
