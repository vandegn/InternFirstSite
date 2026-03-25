'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, getEmployerByUserId, getProfile, updateEmployer, updateProfile, uploadImage } from '@/lib/supabase';

export default function EmployerAccountPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Profile / recruiter info
  const [userId, setUserId] = useState('');
  const [employerId, setEmployerId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Company info
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [businessId, setBusinessId] = useState('');
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [profile, employer] = await Promise.all([
        getProfile(user.id),
        getEmployerByUserId(user.id),
      ]);

      if (profile) {
        setFullName(profile.full_name || '');
        setEmail(profile.email || '');
        setPhone(profile.phone || '');
        setAvatarUrl(profile.avatar_url || '');
      }
      if (employer) {
        setEmployerId(employer.id);
        setCompanyName(employer.company_name || '');
        setWebsite(employer.website || '');
        setDescription(employer.description || '');
        setLogoUrl(employer.logo_url || '');
        setBusinessId(employer.business_id || '');
        setVerified(employer.verified || false);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setAvatarFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setAvatarPreview(null);
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setLogoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setLogoPreview(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);

    try {
      let finalAvatarUrl = avatarUrl;
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() || 'jpg';
        const path = `avatars/${userId}.${ext}`;
        finalAvatarUrl = await uploadImage('images', path, avatarFile);
        setAvatarUrl(finalAvatarUrl);
        setAvatarFile(null);
        setAvatarPreview(null);
        if (avatarInputRef.current) avatarInputRef.current.value = '';
      }

      let finalLogoUrl = logoUrl;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop() || 'png';
        const path = `logos/${employerId}.${ext}`;
        finalLogoUrl = await uploadImage('images', path, logoFile);
        setLogoUrl(finalLogoUrl);
        setLogoFile(null);
        setLogoPreview(null);
        if (logoInputRef.current) logoInputRef.current.value = '';
      }

      await Promise.all([
        updateProfile(userId, {
          full_name: fullName,
          phone: phone || undefined,
          avatar_url: finalAvatarUrl || undefined,
        }),
        updateEmployer(employerId, {
          company_name: companyName,
          website: website || undefined,
          description: description || undefined,
          logo_url: finalLogoUrl || undefined,
        }),
      ]);

      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="dash-main" style={{ padding: '32px', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Account</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>
        Manage your recruiter profile and company information.
      </p>

      {error && <div className="auth-error" style={{ display: 'block', marginBottom: '16px' }}>{error}</div>}
      {success && (
        <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#166534', fontSize: '0.9rem', marginBottom: '16px' }}>
          Account updated successfully.
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Recruiter Profile */}
        <div className="profile-card" style={{ padding: '28px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>Recruiter Profile</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            This is your personal profile visible to students when they view your messages and listings.
          </p>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
              border: '2px solid var(--border)', background: 'var(--bg)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {(avatarPreview || avatarUrl) ? (
                <img src={avatarPreview || avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              )}
            </div>
            <div>
              <input type="file" accept="image/*" ref={avatarInputRef} onChange={handleAvatarChange} style={{ display: 'none' }} />
              <button type="button" onClick={() => avatarInputRef.current?.click()} style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: '#fff',
              }}>
                {avatarUrl || avatarPreview ? 'Change Photo' : 'Upload Photo'}
              </button>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input type="text" id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" value={email} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <input type="text" id="phone" placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Company Profile */}
        <div className="profile-card" style={{ padding: '28px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Company Profile</h3>
            <span style={{
              fontSize: '0.75rem', fontWeight: 600, padding: '4px 12px', borderRadius: '12px',
              background: verified ? '#d1fae5' : '#fef3c7',
              color: verified ? '#065f46' : '#92400e',
            }}>
              {verified ? 'Verified' : 'Pending Verification'}
            </span>
          </div>

          {/* Company logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
            <div style={{
              width: 72, height: 72, borderRadius: 'var(--radius-sm)', overflow: 'hidden',
              border: '2px solid var(--border)', background: '#fff', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {(logoPreview || logoUrl) ? (
                <img src={logoPreview || logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {companyName.charAt(0) || '?'}
                </span>
              )}
            </div>
            <div>
              <input type="file" accept="image/*" ref={logoInputRef} onChange={handleLogoChange} style={{ display: 'none' }} />
              <button type="button" onClick={() => logoInputRef.current?.click()} style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: '#fff',
              }}>
                {logoUrl || logoPreview ? 'Change Logo' : 'Upload Logo'}
              </button>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="companyName">Company Name</label>
              <input type="text" id="companyName" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="website">Website</label>
              <input type="text" id="website" placeholder="example.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="businessId">Federal EIN</label>
              <input type="text" id="businessId" placeholder="XX-XXXXXXX" value={businessId} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>
                Contact support to update your EIN
              </span>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label htmlFor="description">Company Description</label>
            <textarea
              id="description"
              placeholder="Tell students about your company, culture, and what makes you a great place to intern..."
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '12px 32px', fontSize: '1rem' }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
