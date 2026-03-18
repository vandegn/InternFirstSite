'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase, getEmployerByUserId, getListingById, updateListing } from '@/lib/supabase';
import { INDUSTRIES } from '@/lib/constants';

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [isRemote, setIsRemote] = useState(false);
  const [compensation, setCompensation] = useState('');
  const [requirements, setRequirements] = useState('');
  const [industry, setIndustry] = useState('');
  const [status, setStatus] = useState('active');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);

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

        setTitle(listing.title || '');
        setDescription(listing.description || '');
        setLocation(listing.location || '');
        setIsRemote(listing.is_remote || false);
        setCompensation(listing.compensation || '');
        setRequirements(listing.requirements || '');
        setIndustry(listing.industry || '');
        setStatus(listing.status || 'active');
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
      await updateListing(id, {
        title,
        description,
        location: location || undefined,
        is_remote: isRemote,
        compensation: compensation || undefined,
        requirements: requirements || undefined,
        industry,
      });

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
            <div className="form-group">
              <label htmlFor="compensation">Compensation</label>
              <select
                id="compensation"
                value={compensation}
                onChange={(e) => setCompensation(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Select compensation...</option>
                <option value="Unpaid">Unpaid</option>
                <option value="$10-15/hr">$10-15/hr</option>
                <option value="$15-20/hr">$15-20/hr</option>
                <option value="$20-25/hr">$20-25/hr</option>
                <option value="$25-30/hr">$25-30/hr</option>
                <option value="$30-35/hr">$30-35/hr</option>
                <option value="$35-40/hr">$35-40/hr</option>
                <option value="$40+/hr">$40+/hr</option>
                <option value="Stipend">Stipend (flat rate)</option>
              </select>
            </div>
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
            <div className="form-group">
              <label htmlFor="location">Location</label>
              <input
                type="text"
                id="location"
                placeholder="e.g. Raleigh, NC"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 28 }}>
              <input
                type="checkbox"
                id="isRemote"
                checked={isRemote}
                onChange={(e) => setIsRemote(e.target.checked)}
                style={{ width: 'auto' }}
              />
              <label htmlFor="isRemote" style={{ margin: 0 }}>Remote position</label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              placeholder="Describe the role, responsibilities, and what the intern will learn..."
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="requirements">Requirements</label>
            <textarea
              id="requirements"
              placeholder="List skills, qualifications, or experience needed..."
              rows={4}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <div style={{ marginTop: 16 }}>
          {status === 'active' ? (
            <button
              onClick={handleToggleStatus}
              disabled={togglingStatus}
              style={{
                width: '100%',
                padding: '12px 24px',
                borderRadius: 8,
                border: '2px solid #e53e3e',
                background: 'transparent',
                color: '#e53e3e',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: togglingStatus ? 'not-allowed' : 'pointer',
                opacity: togglingStatus ? 0.6 : 1,
              }}
            >
              {togglingStatus ? 'Closing...' : 'Close Listing'}
            </button>
          ) : (
            <button
              onClick={handleToggleStatus}
              disabled={togglingStatus}
              style={{
                width: '100%',
                padding: '12px 24px',
                borderRadius: 8,
                border: 'none',
                background: '#38a169',
                color: '#fff',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: togglingStatus ? 'not-allowed' : 'pointer',
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
