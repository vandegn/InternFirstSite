'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, getEmployerByUserId, updateEmployer } from '@/lib/supabase';

export default function EmployerSettings() {
  const router = useRouter();
  const [employerId, setEmployerId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchEmployer() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const employer = await getEmployerByUserId(user.id);
      if (!employer) return;

      setEmployerId(employer.id);
      setCompanyName(employer.company_name || '');
      setWebsite(employer.website || '');
      setDescription(employer.description || '');
      setLogoUrl(employer.logo_url || '');
      setLoading(false);
    }
    fetchEmployer();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);

    try {
      await updateEmployer(employerId, {
        company_name: companyName,
        website: website || undefined,
        description: description || undefined,
        logo_url: logoUrl || undefined,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save. Please try again.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="dash-main" style={{ padding: '32px', maxWidth: '700px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '700px', margin: '0 auto' }}>
      <Link href="/dashboard/employer" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Dashboard
      </Link>

      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Company Settings</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Update your company information. This is visible to students browsing your listings.</p>

      {error && <div className="auth-error" style={{ display: 'block', marginBottom: '16px' }}>{error}</div>}
      {success && (
        <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#166534', fontSize: '0.9rem', marginBottom: '16px' }}>
          Company info updated successfully.
        </div>
      )}

      <div className="profile-card" style={{ padding: '32px' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label htmlFor="companyName">Company Name</label>
            <input
              type="text"
              id="companyName"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label htmlFor="website">Company Website</label>
            <input
              type="text"
              id="website"
              placeholder="example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label htmlFor="logoUrl">Logo URL</label>
            <input
              type="text"
              id="logoUrl"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
            {logoUrl && (
              <div style={{ marginTop: '12px' }}>
                <img src={logoUrl} alt="Logo preview" style={{ maxWidth: 80, maxHeight: 80, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label htmlFor="description">Company Description</label>
            <textarea
              id="description"
              placeholder="Tell students about your company..."
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '12px 32px', fontSize: '1rem' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
