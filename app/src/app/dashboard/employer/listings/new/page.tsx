'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, getEmployerByUserId, createListing } from '@/lib/supabase';

export default function NewListingPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [isRemote, setIsRemote] = useState(false);
  const [compensation, setCompensation] = useState('');
  const [requirements, setRequirements] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in.');

      const employer = await getEmployerByUserId(user.id);
      if (!employer) throw new Error('Employer profile not found.');

      await createListing({
        employer_id: employer.id,
        title,
        description,
        location: location || undefined,
        is_remote: isRemote,
        compensation: compensation || undefined,
        requirements: requirements || undefined,
      });

      router.push('/dashboard/employer');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: 680 }}>
        <div className="auth-logo">
          <Link href="/dashboard/employer">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
          </Link>
        </div>
        <h1>Post New Listing</h1>
        <p className="auth-subtitle">Create an internship listing to find great candidates.</p>

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
              <input
                type="text"
                id="compensation"
                placeholder="e.g. $16-20/hr"
                value={compensation}
                onChange={(e) => setCompensation(e.target.value)}
              />
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
            {loading ? 'Posting...' : 'Post Listing'}
          </button>
        </form>

        <p className="auth-footer">
          <Link href="/dashboard/employer">&larr; Back to Dashboard</Link>
        </p>
      </div>
    </div>
  );
}
