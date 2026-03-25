'use client';

import { useState, useEffect } from 'react';
import { supabase, getEmployerByUserId } from '@/lib/supabase';

export default function EmployerSettings() {
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [businessId, setBusinessId] = useState('');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Notification preferences (local state — no backend yet)
  const [emailNewApplicant, setEmailNewApplicant] = useState(true);
  const [emailStatusUpdate, setEmailStatusUpdate] = useState(true);
  const [emailMessages, setEmailMessages] = useState(true);
  const [emailWeeklyDigest, setEmailWeeklyDigest] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const employer = await getEmployerByUserId(user.id);
      if (employer) {
        setVerified(employer.verified || false);
        setBusinessId(employer.business_id || '');
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update password.';
      setPasswordError(message);
    } finally {
      setPasswordSaving(false);
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
    <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Settings</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>
        Manage your account security, notifications, and verification.
      </p>

      {/* Verification Status */}
      <div className="profile-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Verification Status</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: verified ? '#d1fae5' : '#fef3c7',
          }}>
            {verified ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#065f46" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            )}
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              {verified ? 'Company Verified' : 'Pending Verification'}
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {verified
                ? 'Your company has been verified. You have full access to all features.'
                : 'Your company verification is being processed. You can still post listings while waiting.'}
            </p>
          </div>
        </div>
        {businessId && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '8px' }}>
            EIN on file: {businessId}
          </p>
        )}
      </div>

      {/* Password & Security */}
      <div className="profile-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Password & Security</h3>

        {passwordError && <div className="auth-error" style={{ display: 'block', marginBottom: '16px' }}>{passwordError}</div>}
        {passwordSuccess && (
          <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#166534', fontSize: '0.9rem', marginBottom: '16px' }}>
            Password updated successfully.
          </div>
        )}

        <form onSubmit={handlePasswordChange}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label htmlFor="currentPassword">Current Password</label>
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={passwordSaving} style={{ marginTop: '16px', padding: '10px 24px' }}>
            {passwordSaving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Notification Preferences */}
      <div className="profile-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>Notification Preferences</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Choose which email notifications you receive.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            { label: 'New applicant notifications', desc: 'Get notified when a student applies to one of your listings.', checked: emailNewApplicant, onChange: setEmailNewApplicant },
            { label: 'Application status updates', desc: 'Get confirmations when you update a candidate\'s status.', checked: emailStatusUpdate, onChange: setEmailStatusUpdate },
            { label: 'New messages', desc: 'Get notified when you receive a new message.', checked: emailMessages, onChange: setEmailMessages },
            { label: 'Weekly digest', desc: 'Receive a weekly summary of your listing performance and new applicants.', checked: emailWeeklyDigest, onChange: setEmailWeeklyDigest },
          ].map((pref, i) => (
            <label
              key={i}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', cursor: 'pointer',
                background: pref.checked ? 'var(--primary-light)' : '#fff',
                transition: 'background 0.15s',
              }}
            >
              <input
                type="checkbox"
                checked={pref.checked}
                onChange={(e) => pref.onChange(e.target.checked)}
                style={{ width: 'auto', marginTop: '2px' }}
              />
              <div>
                <p style={{ fontWeight: 500, fontSize: '0.9rem' }}>{pref.label}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{pref.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '16px' }}>
          Notification preferences will be synced when email integration is enabled.
        </p>
      </div>
    </div>
  );
}
