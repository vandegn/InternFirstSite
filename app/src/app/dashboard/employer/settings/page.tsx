'use client';

import { useState, useEffect } from 'react';
import { supabase, getEmployerByUserId } from '@/lib/supabase';

export default function EmployerSettings() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [verified, setVerified] = useState(false);
  const [businessId, setBusinessId] = useState('');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Notification preferences (local state only — no backend integration yet)
  const [notifyNewApplicant, setNotifyNewApplicant] = useState(true);
  const [notifyStatusChanges, setNotifyStatusChanges] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(false);

  // Appearance
  const [darkMode, setDarkMode] = useState(false);

  // Privacy
  const [showProfileToEmployers, setShowProfileToEmployers] = useState(true);
  const [showEmailOnProfile, setShowEmailOnProfile] = useState(false);

  // Delete account dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || '');

      const employer = await getEmployerByUserId(user.id);
      if (employer) {
        setVerified(employer.verified || false);
        setBusinessId(employer.business_id || '');
      }

      // Load dark mode preference from localStorage
      const savedDarkMode = localStorage.getItem('internfirst-dark-mode');
      if (savedDarkMode === 'true') setDarkMode(true);

      setLoading(false);
    }
    fetchData();
  }, []);

  useEffect(() => {
    localStorage.setItem('internfirst-dark-mode', darkMode.toString());
  }, [darkMode]);

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

  const toggleStyle = (checked: boolean): React.CSSProperties => ({
    position: 'relative',
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    background: checked ? 'var(--primary)' : '#d1d5db',
    cursor: 'pointer',
    transition: 'background 0.2s',
    flexShrink: 0,
    border: 'none',
    padding: 0,
  });

  const toggleKnobStyle = (checked: boolean): React.CSSProperties => ({
    position: 'absolute',
    top: '2px',
    left: checked ? '22px' : '2px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    transition: 'left 0.2s',
  });

  function Toggle({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) {
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={toggleStyle(checked)}
        aria-checked={checked}
        role="switch"
      >
        <span style={toggleKnobStyle(checked)} />
      </button>
    );
  }

  function SettingRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (val: boolean) => void }) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '14px 0',
        borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <p style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text)' }}>{label}</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{description}</p>
        </div>
        <Toggle checked={checked} onChange={onChange} />
      </div>
    );
  }

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Settings</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>
        Manage your account, notifications, and preferences.
      </p>

      {/* Account */}
      <div className="profile-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>Account</h3>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            disabled
            style={{ background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
          />
        </div>

        {/* Verification Status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '14px 16px', borderRadius: 'var(--radius-sm)',
          background: verified ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${verified ? '#bbf7d0' : '#fde68a'}`,
          marginBottom: '16px',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: verified ? '#d1fae5' : '#fef3c7',
          }}>
            {verified ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#065f46" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            )}
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {verified ? 'Company Verified' : 'Pending Verification'}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
              {verified
                ? 'Your company has been verified. Full access enabled.'
                : 'Verification in progress. You can still post listings.'}
            </p>
          </div>
        </div>
        {businessId && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '16px' }}>
            EIN on file: {businessId}
          </p>
        )}

        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px', marginTop: '24px' }}>Change Password</h4>

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

      {/* Notifications */}
      {/* Local state only — notification preferences will be synced when email integration is enabled */}
      <div className="profile-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>Notifications</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Choose which email notifications you receive.
        </p>

        <SettingRow
          label="New applicant notifications"
          description="Get notified when a student applies to one of your listings."
          checked={notifyNewApplicant}
          onChange={setNotifyNewApplicant}
        />
        <SettingRow
          label="Application status changes"
          description="Get confirmations when you update a candidate's status."
          checked={notifyStatusChanges}
          onChange={setNotifyStatusChanges}
        />
        <SettingRow
          label="New messages"
          description="Get notified when you receive a new message."
          checked={notifyMessages}
          onChange={setNotifyMessages}
        />
        <SettingRow
          label="Weekly digest"
          description="Receive a weekly summary of listing performance and new applicants."
          checked={notifyWeeklyDigest}
          onChange={setNotifyWeeklyDigest}
        />
      </div>

      {/* Appearance */}
      <div className="profile-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px' }}>Appearance</h3>

        <SettingRow
          label="Dark mode"
          description="Switch to a darker color scheme."
          checked={darkMode}
          onChange={setDarkMode}
        />
      </div>

      {/* Privacy */}
      <div className="profile-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px' }}>Privacy</h3>

        <SettingRow
          label="Show company profile publicly"
          description="Allow your company profile to appear in public search results."
          checked={showProfileToEmployers}
          onChange={setShowProfileToEmployers}
        />
        <SettingRow
          label="Show contact email on listings"
          description="Display your email address on job listings."
          checked={showEmailOnProfile}
          onChange={setShowEmailOnProfile}
        />
      </div>

      {/* Danger Zone */}
      <div className="profile-card" style={{ padding: '28px', marginBottom: '24px', border: '1px solid #fca5a5' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: '#dc2626' }}>Danger Zone</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Permanently delete your account and all associated data.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          style={{
            padding: '10px 24px',
            background: '#fff',
            color: '#dc2626',
            border: '1px solid #fca5a5',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
        >
          Delete Account
        </button>
      </div>

      {/* Delete Account Dialog */}
      {showDeleteDialog && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 'var(--radius)', padding: '32px',
            maxWidth: '440px', width: '90%', boxShadow: 'var(--shadow-lg)',
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>Delete Account</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
              To delete your account, please contact support at{' '}
              <a href="mailto:support@internfirst.com" style={{ color: 'var(--primary)', fontWeight: 500 }}>
                support@internfirst.com
              </a>.
              Our team will process your request and ensure all your data is removed.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                className="btn-secondary"
                style={{ padding: '10px 24px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
