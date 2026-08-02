'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  supabase,
  getEmployerByUserId,
  getListingById,
  updateListing,
  getListingSections,
  getListingQuestions,
  replaceListingSections,
  replaceListingQuestions,
  type ListingSectionInput,
  type ListingQuestionInput,
} from '@/lib/supabase';
import { INDUSTRIES, DURATIONS, QUESTION_TYPES } from '@/lib/constants';
import CompensationFields, { compFromListing, compToCents, compDisplayString, EMPTY_COMPENSATION, type CompensationValue } from '@/components/CompensationFields';
import ListingSectionsEditor from '@/components/ListingSectionsEditor';
import ListingCoreSections, {
  ListingCoreSectionsView,
  normalizeSectionOrder,
  DEFAULT_SECTION_ORDER,
  type CoreSectionKey,
} from '@/components/ListingCoreSections';
import PreferredSkillsPicker from '@/components/PreferredSkillsPicker';
import ListingQuestionsEditor from '@/components/ListingQuestionsEditor';
import ListingBrandingFields from '@/components/ListingBrandingFields';
import ListingCustomBlocks, { ListingBanner, RoleTagPills } from '@/components/ListingCustomBlocks';
import LocationPicker, { EMPTY_LOCATION, locationFromListing, type LocationValue } from '@/components/LocationPicker';

const LISTING_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active: { bg: 'var(--chip-green-bg)', color: 'var(--chip-green-ink)' },
  paused: { bg: 'var(--chip-amber-bg)', color: 'var(--chip-amber-ink)' },
  closed: { bg: 'var(--danger-bg-strong)', color: 'var(--danger-fg)' },
  expired: { bg: 'var(--chip-orange-bg)', color: 'var(--chip-orange-ink)' },
  draft: { bg: 'var(--chip-neutral-bg)', color: 'var(--chip-neutral-ink)' },
  scheduled: { bg: 'var(--chip-blue-bg)', color: 'var(--chip-blue-ink)' },
};

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<LocationValue>(EMPTY_LOCATION);
  const [workMode, setWorkMode] = useState<'in-person' | 'hybrid' | 'remote'>('in-person');
  const [comp, setComp] = useState<CompensationValue>(EMPTY_COMPENSATION);
  const [requirements, setRequirements] = useState('');
  const [keyResponsibilities, setKeyResponsibilities] = useState('');
  const [sectionOrder, setSectionOrder] = useState<CoreSectionKey[]>(DEFAULT_SECTION_ORDER);
  const [preferredSkills, setPreferredSkills] = useState<string[]>([]);
  const [showSectionErrors, setShowSectionErrors] = useState(false);
  const [industry, setIndustry] = useState('');
  const [duration, setDuration] = useState('');
  const [status, setStatus] = useState('active');
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);
  // Customization
  const [employerId, setEmployerId] = useState<string | null>(null);
  const [sections, setSections] = useState<ListingSectionInput[]>([]);
  const [questions, setQuestions] = useState<ListingQuestionInput[]>([]);

  // One set of listing_questions rows, split by the is_eeo flag for editing.
  const screeningQuestions = questions.filter((q) => !q.is_eeo);
  const eeoQuestions = questions.filter((q) => q.is_eeo);
  const setScreeningQuestions = (next: ListingQuestionInput[]) => setQuestions([...next, ...eeoQuestions]);
  const setEeoQuestions = (next: ListingQuestionInput[]) => setQuestions([...screeningQuestions, ...next]);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [roleTags, setRoleTags] = useState<string[]>([]);
  const [applicantCount, setApplicantCount] = useState(0);

  // Company identity for the student preview — the listing belongs to the
  // signed-in employer, so their own row is the right source.
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyWebsite, setCompanyWebsite] = useState<string | null>(null);
  const [postedAt, setPostedAt] = useState<string | null>(null);

  useEffect(() => {
    async function fetchListing() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('You must be logged in.');

        const employer = await getEmployerByUserId(user.id);
        if (!employer) throw new Error('Employer profile not found.');

        const listing = await getListingById(id);
        if (!listing) throw new Error('Listing not found.');

        if (listing.employer_id !== employer.id) {
          throw new Error('You do not have permission to edit this listing.');
        }

        setEmployerId(employer.id);
        setCompanyName(employer.company_name || '');
        setCompanyLogo(employer.logo_url || null);
        setCompanyWebsite(employer.website || null);
        setTitle(listing.title || '');
        setDescription(listing.description || '');
        setLocation(locationFromListing(listing));
        setWorkMode(listing.is_remote ? 'remote' : listing.is_hybrid ? 'hybrid' : 'in-person');
        setComp(compFromListing(listing));
        setRequirements(listing.requirements || '');
        setKeyResponsibilities(listing.key_responsibilities || '');
        // Listings created before section_order existed fall back to the
        // default; normalizeSectionOrder also repairs partial arrays.
        setSectionOrder(normalizeSectionOrder(listing.section_order));
        setPreferredSkills(listing.preferred_skills ?? []);
        setIndustry(listing.industry || '');
        setDuration(listing.duration || '');
        setStatus(listing.status || 'active');
        setApplicationDeadline(listing.application_deadline || '');
        setApplicantCount(listing.applicant_count ?? 0);
        setBannerUrl(listing.banner_url ?? null);
        setAccentColor(listing.accent_color ?? null);
        setRoleTags(listing.role_tags ?? []);
        setPostedAt(listing.created_at ?? null);

        const [loadedSections, loadedQuestions] = await Promise.all([
          getListingSections(id),
          getListingQuestions(id),
        ]);
        setSections(loadedSections.map((s) => ({ heading: s.heading, body: s.body })));
        setQuestions(loadedQuestions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          help_text: q.help_text,
          question_type: q.question_type,
          options: q.options ?? [],
          required: q.required,
          knockout_answer: q.knockout_answer,
          is_eeo: q.is_eeo ?? false,
        })));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setFetching(false);
      }
    }

    fetchListing();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!description.trim() || !requirements.trim() || !keyResponsibilities.trim()) {
        setShowSectionErrors(true);
        setLoading(false);
        setError('Job Overview, Qualifications, and Key Responsibilities are all required.');
        return;
      }

      await updateListing(id, {
        title,
        description,
        location: location.label || null,
        city: location.city,
        state: location.state,
        lat: location.lat,
        lng: location.lng,
        is_remote: workMode === 'remote',
        is_hybrid: workMode === 'hybrid',
        // Display string + structured columns, written together (see the
        // paid/unpaid filter in getActiveListings).
        compensation: compDisplayString(comp) || undefined,
        ...compToCents(comp),
        requirements,
        key_responsibilities: keyResponsibilities,
        section_order: sectionOrder,
        preferred_skills: preferredSkills,
        industry,
        duration: duration || null,
        application_deadline: applicationDeadline || null,
        role_tags: roleTags,
        banner_url: bannerUrl,
        accent_color: accentColor,
      });

      await replaceListingSections(id, sections);
      await replaceListingQuestions(id, questions.filter((q) => q.prompt.trim()));

      router.push('/dashboard/employer');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleToggleStatus() {
    setTogglingStatus(true);
    setError('');

    try {
      const newStatus = status === 'active' ? 'closed' : 'active';
      await updateListing(id, { status: newStatus });
      setStatus(newStatus);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTogglingStatus(false);
    }
  }

  async function changeStatus(next: string) {
    setTogglingStatus(true);
    setError('');
    try {
      await updateListing(id, { status: next });
      setStatus(next);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTogglingStatus(false);
    }
  }

  if (fetching) {
    return (
      <div className="dash-main" style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading listing...</p>
      </div>
    );
  }

  if (error && !title) {
    return (
      <div className="dash-main" style={{ padding: '32px', maxWidth: '720px', margin: '0 auto' }}>
        <div className="auth-error" style={{ display: 'block', marginBottom: '16px' }}>{error}</div>
        <Link href="/dashboard/employer" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
          &larr; Back to Dashboard
        </Link>
      </div>
    );
  }

  const statusColors = LISTING_STATUS_COLORS[status] || LISTING_STATUS_COLORS.active;

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      <Link href="/dashboard/employer" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Dashboard
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Edit Listing</h1>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: statusColors.bg, color: statusColors.color, textTransform: 'capitalize' }}>
          {status}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-light)', padding: '4px 10px', borderRadius: '999px', border: '1px solid var(--border)' }}>
          {applicantCount} {applicantCount === 1 ? 'application' : 'applications'}
        </span>
      </div>

      {error && <div className="auth-error" style={{ display: 'block', marginBottom: '16px' }}>{error}</div>}

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
                    style={{ flex: 1, minWidth: 0 }}
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
                        minWidth: 0,
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

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '1rem',
                marginTop: '20px',
                opacity: loading ? 0.55 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </form>

          {/* ── Listing status ── */}
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Listing status</span>
            <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', display: 'block', marginBottom: '12px' }}>
              Pausing hides the listing from students but keeps it and its applications intact.
            </small>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {status === 'active' && (
                <>
                  <button
                    onClick={() => changeStatus('paused')}
                    disabled={togglingStatus}
                    style={{
                      flex: '1 1 160px', padding: '12px 24px', borderRadius: 8,
                      border: '2px solid var(--chip-amber-ink)', background: 'transparent', color: 'var(--chip-amber-ink)',
                      fontWeight: 600, fontSize: '1rem', cursor: togglingStatus ? 'not-allowed' : 'pointer',
                      opacity: togglingStatus ? 0.6 : 1,
                    }}
                  >
                    {togglingStatus ? 'Working…' : 'Pause Listing'}
                  </button>
                  <button
                    onClick={handleToggleStatus}
                    disabled={togglingStatus}
                    style={{
                      flex: '1 1 160px', padding: '12px 24px', borderRadius: 8,
                      border: '2px solid #e53e3e', background: 'transparent', color: '#e53e3e',
                      fontWeight: 600, fontSize: '1rem', cursor: togglingStatus ? 'not-allowed' : 'pointer',
                      opacity: togglingStatus ? 0.6 : 1,
                    }}
                  >
                    {togglingStatus ? 'Working…' : 'Close Listing'}
                  </button>
                </>
              )}
              {status === 'paused' && (
                <>
                  <button
                    onClick={() => changeStatus('active')}
                    disabled={togglingStatus}
                    style={{
                      flex: '1 1 160px', padding: '12px 24px', borderRadius: 8,
                      border: 'none', background: '#38a169', color: '#fff',
                      fontWeight: 600, fontSize: '1rem', cursor: togglingStatus ? 'not-allowed' : 'pointer',
                      opacity: togglingStatus ? 0.6 : 1,
                    }}
                  >
                    {togglingStatus ? 'Working…' : 'Resume Listing'}
                  </button>
                  <button
                    onClick={handleToggleStatus}
                    disabled={togglingStatus}
                    style={{
                      flex: '1 1 160px', padding: '12px 24px', borderRadius: 8,
                      border: '2px solid #e53e3e', background: 'transparent', color: '#e53e3e',
                      fontWeight: 600, fontSize: '1rem', cursor: togglingStatus ? 'not-allowed' : 'pointer',
                      opacity: togglingStatus ? 0.6 : 1,
                    }}
                  >
                    {togglingStatus ? 'Working…' : 'Close Listing'}
                  </button>
                </>
              )}
              {status === 'closed' && (
                <button
                  onClick={handleToggleStatus}
                  disabled={togglingStatus}
                  style={{
                    width: '100%', padding: '12px 24px', borderRadius: 8,
                    border: 'none', background: '#38a169', color: '#fff',
                    fontWeight: 600, fontSize: '1rem', cursor: togglingStatus ? 'not-allowed' : 'pointer',
                    opacity: togglingStatus ? 0.6 : 1,
                  }}
                >
                  {togglingStatus ? 'Working…' : 'Reopen Listing'}
                </button>
              )}
            </div>
          </div>
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
                // eslint-disable-next-line @next/next/no-img-element
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
                Posted {new Date(postedAt ?? Date.now()).toLocaleDateString()}
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
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
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
