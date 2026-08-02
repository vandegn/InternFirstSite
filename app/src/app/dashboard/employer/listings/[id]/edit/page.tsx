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
import { INDUSTRIES, DURATIONS, formatCents } from '@/lib/constants';
import CompensationFields, { compFromListing, compToCents, compDisplayString, EMPTY_COMPENSATION, type CompensationValue } from '@/components/CompensationFields';
import ListingSectionsEditor from '@/components/ListingSectionsEditor';
import ListingCoreSections, {
  normalizeSectionOrder,
  DEFAULT_SECTION_ORDER,
  type CoreSectionKey,
} from '@/components/ListingCoreSections';
import PreferredSkillsPicker from '@/components/PreferredSkillsPicker';
import ListingQuestionsEditor from '@/components/ListingQuestionsEditor';
import ListingBrandingFields from '@/components/ListingBrandingFields';
import LocationPicker, { EMPTY_LOCATION, locationFromListing, type LocationValue } from '@/components/LocationPicker';

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
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [roleTags, setRoleTags] = useState<string[]>([]);
  // Billing (read-only)
  const [pricingModel, setPricingModel] = useState<'ppj' | 'ppa' | null>(null);
  const [applicantCount, setApplicantCount] = useState(0);
  const [cpaCents, setCpaCents] = useState<number | null>(null);

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
        setPricingModel(listing.pricing_model ?? null);
        setApplicantCount(listing.applicant_count ?? 0);
        setCpaCents(listing.cpa_cents ?? null);
        setBannerUrl(listing.banner_url ?? null);
        setAccentColor(listing.accent_color ?? null);
        setRoleTags(listing.role_tags ?? []);

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

  if (fetching) {
    return (
      <div className="auth-page">
        <div className="auth-container" style={{ maxWidth: 680 }}>
          <p style={{ textAlign: 'center', padding: '2rem 0' }}>Loading listing...</p>
        </div>
      </div>
    );
  }

  if (error && fetching === false && !title) {
    return (
      <div className="auth-page">
        <div className="auth-container" style={{ maxWidth: 680 }}>
          <div className="auth-error" style={{ display: 'block' }}>{error}</div>
          <p className="auth-footer">
            <Link href="/dashboard/employer">&larr; Back to Dashboard</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: 680 }}>
        <div className="auth-logo">
          <Link href="/dashboard/employer">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
          </Link>
        </div>
        <h1>Edit Listing</h1>
        <p className="auth-subtitle">Update your internship listing details.</p>

        {pricingModel && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-light)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: '16px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {pricingModel === 'ppj' ? 'Pay Per Job' : 'Pay Per Applicant'}
            </span>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {pricingModel === 'ppa' && cpaCents != null
                ? `${applicantCount} applications · ${formatCents(cpaCents)}/qualifying`
                : `${applicantCount} applications`}
            </span>
          </div>
        )}

        {error && <div className="auth-error" style={{ display: 'block' }}>{error}</div>}

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

          <ListingQuestionsEditor questions={questions} onChange={setQuestions} />

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

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <div style={{ marginTop: 16, display: 'flex', gap: '12px' }}>
          {status === 'active' && (
            <>
              <button
                onClick={() => { setTogglingStatus(true); updateListing(id, { status: 'paused' }).then(() => setStatus('paused')).finally(() => setTogglingStatus(false)); }}
                disabled={togglingStatus}
                style={{
                  flex: 1, padding: '12px 24px', borderRadius: 8,
                  border: '2px solid var(--chip-amber-ink)', background: 'transparent', color: 'var(--chip-amber-ink)',
                  fontWeight: 600, fontSize: '1rem', cursor: togglingStatus ? 'not-allowed' : 'pointer',
                  opacity: togglingStatus ? 0.6 : 1,
                }}
              >
                {togglingStatus ? 'Pausing...' : 'Pause Listing'}
              </button>
              <button
                onClick={handleToggleStatus}
                disabled={togglingStatus}
                style={{
                  flex: 1, padding: '12px 24px', borderRadius: 8,
                  border: '2px solid #e53e3e', background: 'transparent', color: '#e53e3e',
                  fontWeight: 600, fontSize: '1rem', cursor: togglingStatus ? 'not-allowed' : 'pointer',
                  opacity: togglingStatus ? 0.6 : 1,
                }}
              >
                {togglingStatus ? 'Closing...' : 'Close Listing'}
              </button>
            </>
          )}
          {status === 'paused' && (
            <>
              <button
                onClick={() => { setTogglingStatus(true); updateListing(id, { status: 'active' }).then(() => setStatus('active')).finally(() => setTogglingStatus(false)); }}
                disabled={togglingStatus}
                style={{
                  flex: 1, padding: '12px 24px', borderRadius: 8,
                  border: 'none', background: '#38a169', color: '#fff',
                  fontWeight: 600, fontSize: '1rem', cursor: togglingStatus ? 'not-allowed' : 'pointer',
                  opacity: togglingStatus ? 0.6 : 1,
                }}
              >
                {togglingStatus ? 'Resuming...' : 'Resume Listing'}
              </button>
              <button
                onClick={handleToggleStatus}
                disabled={togglingStatus}
                style={{
                  flex: 1, padding: '12px 24px', borderRadius: 8,
                  border: '2px solid #e53e3e', background: 'transparent', color: '#e53e3e',
                  fontWeight: 600, fontSize: '1rem', cursor: togglingStatus ? 'not-allowed' : 'pointer',
                  opacity: togglingStatus ? 0.6 : 1,
                }}
              >
                {togglingStatus ? 'Closing...' : 'Close Listing'}
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
              {togglingStatus ? 'Reopening...' : 'Reopen Listing'}
            </button>
          )}
        </div>

        <p className="auth-footer">
          <Link href="/dashboard/employer">&larr; Back to Dashboard</Link>
        </p>
      </div>
    </div>
  );
}
