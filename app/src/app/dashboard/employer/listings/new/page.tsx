'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  supabase,
  getEmployerByUserId,
  createListing,
  replaceListingSections,
  replaceListingQuestions,
  type ListingSectionInput,
  type ListingQuestionInput,
  type VerificationStatus,
} from '@/lib/supabase';
import VerificationBanner from '@/components/VerificationBanner';
import {
  INDUSTRIES,
  DURATIONS,
  POSTING_DURATIONS,
  QUESTION_TYPES,
} from '@/lib/constants';
import ListingCoreSections, {
  ListingCoreSectionsView,
  DEFAULT_SECTION_ORDER,
  type CoreSectionKey,
} from '@/components/ListingCoreSections';
import PreferredSkillsPicker from '@/components/PreferredSkillsPicker';
import CompensationFields, { EMPTY_COMPENSATION, compToCents, compDisplayString, type CompensationValue } from '@/components/CompensationFields';
import ListingSectionsEditor from '@/components/ListingSectionsEditor';
import ListingQuestionsEditor from '@/components/ListingQuestionsEditor';
import ListingBrandingFields from '@/components/ListingBrandingFields';
import ListingCustomBlocks, { ListingBanner, RoleTagPills } from '@/components/ListingCustomBlocks';
import LocationPicker, { EMPTY_LOCATION, type LocationValue } from '@/components/LocationPicker';

export default function NewListingPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<LocationValue>(EMPTY_LOCATION);
  const [workMode, setWorkMode] = useState<'in-person' | 'hybrid' | 'remote'>('in-person');
  const [comp, setComp] = useState<CompensationValue>(EMPTY_COMPENSATION);
  const [requirements, setRequirements] = useState('');
  const [keyResponsibilities, setKeyResponsibilities] = useState('');
  const [industry, setIndustry] = useState('');
  const [duration, setDuration] = useState('');
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyWebsite, setCompanyWebsite] = useState<string | null>(null);
  const [employerId, setEmployerId] = useState<string | null>(null);

  // Posting is gated on human review of the company. The DB policy
  // "Approved employers can create listings" is the real enforcement; this is
  // here so an unapproved employer is told up front instead of filling in the
  // whole form and hitting an opaque RLS rejection on submit.
  const [verification, setVerification] = useState<VerificationStatus | null>(null);
  const [verificationNote, setVerificationNote] = useState<string | null>(null);
  const [employerLoaded, setEmployerLoaded] = useState(false);
  const canPost = verification === 'approved';

  // Core section order + explicit skills. Qualifications leads by default.
  const [sectionOrder, setSectionOrder] = useState<CoreSectionKey[]>(DEFAULT_SECTION_ORDER);
  const [preferredSkills, setPreferredSkills] = useState<string[]>([]);
  const [showSectionErrors, setShowSectionErrors] = useState(false);

  // ── Customization ──
  const [sections, setSections] = useState<ListingSectionInput[]>([]);
  const [questions, setQuestions] = useState<ListingQuestionInput[]>([]);

  // Screening and EEO questions are the same listing_questions rows split by
  // the is_eeo flag, so they persist in one call. Screening comes first, which
  // is the order replaceListingQuestions writes into `position`.
  const screeningQuestions = questions.filter((q) => !q.is_eeo);
  const eeoQuestions = questions.filter((q) => q.is_eeo);
  const setScreeningQuestions = (next: ListingQuestionInput[]) => setQuestions([...next, ...eeoQuestions]);
  const setEeoQuestions = (next: ListingQuestionInput[]) => setQuestions([...screeningQuestions, ...next]);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [roleTags, setRoleTags] = useState<string[]>([]);

  // How long the listing stays live. Drives expires_at — not a billing input.
  const [postingDays, setPostingDays] = useState<number>(POSTING_DURATIONS[0].days);

  // Publish immediately, save without publishing, or go live at a set time.
  // A draft is deliberately not visible to students — the DB select policy
  // enforces that, not just this form.
  const [publishMode, setPublishMode] = useState<'now' | 'draft' | 'schedule'>('now');
  const [publishAt, setPublishAt] = useState('');

  useEffect(() => {
    async function fetchEmployer() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const employer = await getEmployerByUserId(user.id);
      if (employer) {
        setCompanyName(employer.company_name || '');
        setCompanyLogo(employer.logo_url || null);
        setCompanyWebsite(employer.website || null);
        setEmployerId(employer.id);
        setVerification((employer.verification_status as VerificationStatus) ?? 'pending');
        setVerificationNote(employer.verification_note ?? null);
      }
      setEmployerLoaded(true);
    }
    fetchEmployer();
  }, []);

  // Sections and questions are child rows, so they can only be written once the
  // listing has an id.
  async function saveCustomization(listingId: string) {
    await replaceListingSections(listingId, sections);
    await replaceListingQuestions(listingId, questions.filter((q) => q.prompt.trim()));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!employerId) throw new Error('Employer profile not found.');

      if (!canPost) {
        setLoading(false);
        setError('Your company needs to be verified before you can publish a listing.');
        return;
      }

      if (publishMode === 'schedule') {
        const when = new Date(publishAt);
        if (!publishAt || Number.isNaN(when.getTime())) {
          setLoading(false);
          setError('Pick a date and time for the listing to go live.');
          return;
        }
        if (when.getTime() <= Date.now()) {
          setLoading(false);
          setError('Scheduled publish time must be in the future.');
          return;
        }
      }

      // All three core sections are required — a listing missing any of them
      // reads as half-written to students.
      if (!description.trim() || !requirements.trim() || !keyResponsibilities.trim()) {
        setShowSectionErrors(true);
        setLoading(false);
        setError('Job Overview, Qualifications, and Key Responsibilities are all required.');
        return;
      }

      const base = {
        employer_id: employerId,
        title,
        description,
        location: location.label || undefined,
        city: location.city,
        state: location.state,
        lat: location.lat,
        lng: location.lng,
        is_remote: workMode === 'remote',
        is_hybrid: workMode === 'hybrid',
        // Display string + structured columns. The string is what listing cards
        // and the paid/unpaid filter read, so both must be written together.
        compensation: compDisplayString(comp) || undefined,
        ...compToCents(comp),
        requirements,
        key_responsibilities: keyResponsibilities,
        section_order: sectionOrder,
        preferred_skills: preferredSkills,
        industry,
        duration: duration || undefined,
        application_deadline: applicationDeadline || undefined,
        role_tags: roleTags,
        banner_url: bannerUrl,
        accent_color: accentColor,
      };

      // Pilot phase: every posting is free. Leaving pricing_model null is the
      // existing "organic" free tier, so nothing here needs a schema change
      // when paid plans come back.
      //
      // expires_at is only set once the listing is actually live. A scheduled
      // listing gets its window when publish_due_listings flips it to active,
      // so scheduling three weeks out doesn't burn three weeks of run time; a
      // draft has no window at all until it's published.
      const listing = await createListing({
        ...base,
        ...(publishMode === 'now'
          ? { status: 'active', expires_at: new Date(Date.now() + postingDays * 86400_000).toISOString() }
          : publishMode === 'schedule'
            ? { status: 'scheduled', publish_at: new Date(publishAt).toISOString() }
            : { status: 'draft' }),
      });

      await saveCustomization(listing.id);

      router.push('/dashboard/employer/posted-jobs');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      <Link href="/dashboard/employer" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Dashboard
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Post New Listing</h1>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-light)', padding: '4px 10px', borderRadius: '999px', border: '1px solid var(--border)' }}>Live Preview</span>
      </div>

      {error && <div className="auth-error" style={{ display: 'block', marginBottom: '16px' }}>{error}</div>}

      {employerLoaded && verification && !canPost && (
        <VerificationBanner
          status={verification}
          note={verificationNote}
          style={{ marginBottom: '20px' }}
        />
      )}

      <div className="listing-composer">
        {/* ── Left: Form ── */}
        <div className="profile-card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>Listing Details</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="title">Job Title</label>
                <input
                  type="text"
                  id="title"
                  placeholder="e.g. Software Engineer Intern"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <CompensationFields value={comp} onChange={setComp} />
              <div className="form-group">
                <label htmlFor="industry">Industry</label>
                <select
                  id="industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
              <LocationPicker value={location} onChange={setLocation} />
              <div className="form-group">
                <label htmlFor="applicationDeadline">
                  Application Deadline <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(optional)</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="date"
                    id="applicationDeadline"
                    value={applicationDeadline}
                    onChange={(e) => setApplicationDeadline(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  {applicationDeadline && (
                    <button
                      type="button"
                      onClick={() => setApplicationDeadline('')}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                  Leave blank for no deadline — the listing stays open until you close it.
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="duration">Internship Length</label>
                <select
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Select length...</option>
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Work Arrangement</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['in-person', 'hybrid', 'remote'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setWorkMode(mode)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: workMode === mode ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                        background: workMode === mode ? 'var(--primary-light)' : 'var(--bg)',
                        color: workMode === mode ? 'var(--primary)' : 'var(--text-primary)',
                        fontWeight: workMode === mode ? 600 : 500,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        transition: 'all 0.15s',
                      }}
                    >
                      {mode === 'in-person' ? 'In-Person' : mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ListingCoreSections
              order={sectionOrder}
              values={{ description, requirements, key_responsibilities: keyResponsibilities }}
              showErrors={showSectionErrors}
              onChange={(key, val) => {
                if (key === 'description') setDescription(val);
                else if (key === 'requirements') setRequirements(val);
                else setKeyResponsibilities(val);
              }}
              onReorder={setSectionOrder}
            />

            <PreferredSkillsPicker value={preferredSkills} onChange={setPreferredSkills} />

            <ListingSectionsEditor sections={sections} onChange={setSections} />

            <ListingQuestionsEditor questions={screeningQuestions} onChange={setScreeningQuestions} />
            <ListingQuestionsEditor questions={eeoQuestions} onChange={setEeoQuestions} mode="eeo" />

            <ListingBrandingFields
              employerId={employerId}
              bannerUrl={bannerUrl}
              accentColor={accentColor}
              roleTags={roleTags}
              onChange={(patch) => {
                if (patch.bannerUrl !== undefined) setBannerUrl(patch.bannerUrl);
                if (patch.accentColor !== undefined) setAccentColor(patch.accentColor);
                if (patch.roleTags !== undefined) setRoleTags(patch.roleTags);
              }}
            />

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="postingDays">Posting Duration</label>
                <select
                  id="postingDays"
                  value={postingDays}
                  onChange={(e) => setPostingDays(Number(e.target.value))}
                  style={{ width: '100%' }}
                >
                  {POSTING_DURATIONS.map((d) => (
                    <option key={d.days} value={d.days}>{d.label}</option>
                  ))}
                </select>
                <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                  How long the listing stays live{publishMode !== 'now' ? ', counted from when it publishes' : ''}.
                </small>
              </div>
            </div>

            {/* ── When to publish ── */}
            <div className="form-group" style={{ marginTop: '8px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <label style={{ fontSize: '1.05rem', fontWeight: 600 }}>Publishing</label>
              <div style={{ display: 'flex', gap: 10, marginTop: '10px', flexWrap: 'wrap' }}>
                {([
                  { key: 'now', title: 'Publish now', sub: 'Goes live immediately.' },
                  { key: 'schedule', title: 'Schedule', sub: 'Goes live at a time you pick.' },
                  { key: 'draft', title: 'Save as draft', sub: 'Only you can see it.' },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPublishMode(opt.key)}
                    style={{
                      flex: '1 1 160px',
                      textAlign: 'left',
                      padding: '14px',
                      borderRadius: 10,
                      border: publishMode === opt.key ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                      background: publishMode === opt.key ? 'var(--primary-light)' : 'var(--bg)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: publishMode === opt.key ? 'var(--primary)' : 'var(--text-primary)' }}>{opt.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{opt.sub}</div>
                  </button>
                ))}
              </div>

              {publishMode === 'schedule' && (
                <div style={{ marginTop: '12px' }}>
                  <label htmlFor="publishAt">Go live on</label>
                  <input
                    type="datetime-local"
                    id="publishAt"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.target.value)}
                    style={{ width: '100%' }}
                  />
                  <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                    Publishes within 15 minutes of this time. Students can&apos;t see the
                    listing until then.
                  </small>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !canPost}
              title={canPost ? undefined : 'Your company must be verified before you can post'}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '1rem',
                opacity: loading || !canPost ? 0.55 : 1,
                cursor: loading || !canPost ? 'not-allowed' : 'pointer',
              }}
            >
              {loading
                ? 'Saving…'
                : !canPost
                  ? 'Verification required to post'
                  : publishMode === 'draft'
                    ? 'Save Draft'
                    : publishMode === 'schedule'
                      ? 'Schedule Listing'
                      : 'Post Listing'}
            </button>
          </form>
        </div>

        {/* ── Right: Live Preview (mirrors student detail page) ── */}
        <div className="listing-composer-preview">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Student Preview
          </div>
          <div className="profile-card" style={{ padding: '32px' }}>
            <ListingBanner bannerUrl={bannerUrl} accentColor={accentColor} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              {companyLogo ? (
                <img src={companyLogo} alt={companyName} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '1.4rem' }}>
                  {companyName.charAt(0) || '?'}
                </div>
              )}
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: title ? 'var(--text)' : 'var(--text-light)' }}>
                  {title || 'Job Title'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>{companyName || 'Your Company'}</p>
              </div>
            </div>

            {/* Meta info */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
              {location.label && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {location.label}
                </div>
              )}
              {workMode !== 'in-person' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  {workMode === 'remote' ? 'Remote' : 'Hybrid'}
                </div>
              )}
              {compDisplayString(comp) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  {compDisplayString(comp)}
                </div>
              )}
              {industry && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  {industry}
                </div>
              )}
              {duration && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {duration}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Posted {new Date().toLocaleDateString()}
              </div>
              {applicationDeadline && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  Apply by {new Date(applicationDeadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
            </div>

            <RoleTagPills tags={roleTags} />

            <div className="sidebar-divider" style={{ margin: '24px 0' }}></div>

            {/* Core sections, in the employer's chosen order */}
            <ListingCoreSectionsView
              listing={{
                description,
                requirements,
                key_responsibilities: keyResponsibilities,
                section_order: sectionOrder,
              }}
              emptyPlaceholder
            />

            {preferredSkills.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' }}>Preferred Skills</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {preferredSkills.map((skill) => (
                    <span key={skill} style={{
                      padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem',
                      background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 500,
                    }}>{skill}</span>
                  ))}
                </div>
              </div>
            )}

            <ListingCustomBlocks sections={sections} accentColor={accentColor} />

            {/* Screening questions summary */}
            {questions.filter((q) => q.prompt.trim()).length > 0 && (
              <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-light)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '10px' }}>Application Questions</h3>
                <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {questions.filter((q) => q.prompt.trim()).map((q, i) => (
                    <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {q.prompt}
                      {q.required && <span style={{ color: 'var(--danger-fg)', marginLeft: 4 }}>*</span>}
                      <span style={{ color: 'var(--text-light)', marginLeft: 6, fontSize: '0.78rem' }}>
                        ({QUESTION_TYPES.find((t) => t.value === q.question_type)?.label})
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Company Website */}
            {companyWebsite && (
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' }}>Company Website</h3>
                <span style={{ color: 'var(--primary)' }}>{companyWebsite}</span>
              </div>
            )}

            <div className="sidebar-divider" style={{ margin: '24px 0' }}></div>

            {/* Apply button (disabled in preview) */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                disabled
                className="btn-primary"
                style={{ padding: '12px 32px', fontSize: '1rem', opacity: 0.6, cursor: 'default' }}
              >
                Apply Now
              </button>
              <button
                disabled
                style={{ padding: '12px 24px', fontSize: '0.9rem', borderRadius: '10px', border: '1.5px solid var(--primary)', background: 'transparent', color: 'var(--primary)', cursor: 'default', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: 0.6 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Message Employer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
