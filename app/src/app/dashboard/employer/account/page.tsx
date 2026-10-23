'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase, getEmployerByUserId, getProfile, updateEmployer, updateProfile, uploadImage, VERIFICATION_LABELS, type VerificationStatus } from '@/lib/supabase';
import VerificationBanner, { VERIFICATION_CHIP } from '@/components/VerificationBanner';
import CompanyMark from '@/components/CompanyMark';

// Accepted icon formats. Checked here, not just via the input's accept
// attribute, so a drag-and-dropped SVG or GIF can't slip through.
const ICON_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ICON_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const ICON_MAX_BYTES = 2 * 1024 * 1024;

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
  // Company icon: the small square mark beside the company name on job cards.
  // Kept apart from the full-size logo above. iconRemoved marks a pending
  // "Remove" so Save can clear the column; a newly picked file cancels it.
  const [iconUrl, setIconUrl] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconRemoved, setIconRemoved] = useState(false);
  const [iconError, setIconError] = useState('');
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('pending');
  const [verificationNote, setVerificationNote] = useState<string | null>(null);

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
        setIconUrl(employer.icon_url || '');
        setVerificationStatus((employer.verification_status as VerificationStatus) || 'pending');
        setVerificationNote(employer.verification_note ?? null);
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

  function handleIconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setIconError('');
    if (!file) return;
    if (!ICON_TYPES.has(file.type)) {
      setIconError('Please choose a PNG, JPG, or WebP image.');
      e.target.value = '';
      return;
    }
    if (file.size > ICON_MAX_BYTES) {
      setIconError('Please choose an image under 2 MB.');
      e.target.value = '';
      return;
    }
    setIconFile(file);
    setIconRemoved(false);
    const reader = new FileReader();
    reader.onloadend = () => setIconPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleIconRemove() {
    setIconFile(null);
    setIconPreview(null);
    setIconError('');
    setIconRemoved(true);
    if (iconInputRef.current) iconInputRef.current.value = '';
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

      // undefined = leave icon_url alone; null = clear it; string = new upload.
      let finalIconUrl: string | null | undefined = undefined;
      if (iconFile) {
        const ext = ICON_EXT[iconFile.type] ?? 'png';
        // A fresh path per upload so browsers and the CDN can't keep serving
        // the previous icon from cache after a replace.
        const path = `icons/${employerId}-${Date.now()}.${ext}`;
        finalIconUrl = await uploadImage('images', path, iconFile);
        setIconUrl(finalIconUrl);
        setIconFile(null);
        setIconPreview(null);
        if (iconInputRef.current) iconInputRef.current.value = '';
      } else if (iconRemoved) {
        finalIconUrl = null;
        setIconUrl('');
      }
      setIconRemoved(false);

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
          icon_url: finalIconUrl,
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
        <div style={{ padding: '12px 16px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: '10px', color: 'var(--success-fg)', fontSize: '0.9rem', marginBottom: '16px' }}>
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
                fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: 'var(--surface)',
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
              background: VERIFICATION_CHIP[verificationStatus].bg,
              color: VERIFICATION_CHIP[verificationStatus].color,
            }}>
              {VERIFICATION_LABELS[verificationStatus]}
            </span>
          </div>

          {verificationStatus !== 'approved' && (
            <VerificationBanner
              status={verificationStatus}
              note={verificationNote}
              style={{ marginBottom: '20px' }}
            />
          )}

          {/* Company logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
            <div style={{
              width: 72, height: 72, borderRadius: 'var(--radius-sm)', overflow: 'hidden',
              border: '2px solid var(--border)', background: 'var(--surface)', flexShrink: 0,
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
                fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: 'var(--surface)',
              }}>
                {logoUrl || logoPreview ? 'Change Logo' : 'Upload Logo'}
              </button>
            </div>
          </div>

          {/* Company icon */}
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="companyIcon" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Company icon
            </label>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
              Upload a square version of your company logo to appear beside your company name on job postings.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <CompanyMark
                name={companyName}
                iconUrl={iconRemoved ? null : (iconPreview || iconUrl || null)}
                size={72}
                radius="var(--radius-sm)"
                fontSize="1.5rem"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    id="companyIcon"
                    accept="image/png,image/jpeg,image/webp"
                    ref={iconInputRef}
                    onChange={handleIconChange}
                    style={{ display: 'none' }}
                  />
                  <button type="button" onClick={() => iconInputRef.current?.click()} style={{
                    padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                    fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: 'var(--surface)',
                  }}>
                    {(iconUrl && !iconRemoved) || iconPreview ? 'Replace icon' : 'Upload icon'}
                  </button>
                  {((iconUrl && !iconRemoved) || iconPreview) && (
                    <button type="button" onClick={handleIconRemove} style={{
                      padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: 'var(--surface)',
                      color: 'var(--danger-fg)',
                    }}>
                      Remove
                    </button>
                  )}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: 0 }}>
                  PNG, JPG, or WebP (transparent PNGs work). Square, at least 200 × 200 pixels recommended.
                  {iconRemoved && ' The icon will be removed when you save; cards will show your initial.'}
                </p>
                {iconError && (
                  <p role="alert" style={{ fontSize: '0.78rem', color: 'var(--danger-fg)', margin: 0 }}>{iconError}</p>
                )}
              </div>
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
