'use client';

import { useState, useEffect } from 'react';
import { supabase, getEmployerByUserId, type VerificationStatus } from '@/lib/supabase';
import VerificationBanner from '@/components/VerificationBanner';
import DeleteAccountDialog from '@/components/DeleteAccountDialog';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import ThemePicker from '@/components/ThemePicker';
import { validatePassword, MIN_PASSWORD_LENGTH } from '@/lib/password';

const SECTIONS: { id: string; label: string; danger?: boolean; icon: React.ReactNode }[] = [
  { id: 'account', label: 'Account', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { id: 'notifications', label: 'Notifications', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
  { id: 'appearance', label: 'Appearance', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> },
  { id: 'privacy', label: 'Privacy', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
  { id: 'danger', label: 'Delete Account', danger: true, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> },
];

export default function EmployerSettings() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('pending');
  const [verificationNote, setVerificationNote] = useState<string | null>(null);

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

  // Privacy
  const [showProfileToEmployers, setShowProfileToEmployers] = useState(true);
  const [showEmailOnProfile, setShowEmailOnProfile] = useState(false);

  // Delete account dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Active settings section
  const [activeSection, setActiveSection] = useState('account');

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || '');

      const employer = await getEmployerByUserId(user.id);
      if (employer) {
        setVerificationStatus((employer.verification_status as VerificationStatus) || 'pending');
        setVerificationNote(employer.verification_note ?? null);
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
    const strengthError = validatePassword(newPassword);
    if (strengthError) {
      setPasswordError(strengthError);
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
    background: checked ? 'var(--primary)' : 'var(--grey-light)',
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
    background: 'var(--surface)',
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
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1040px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Settings</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>
        Manage your account, notifications, and preferences.
      </p>

      <div className="settings-layout">
        <nav className="settings-nav">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={`settings-nav-item${activeSection === s.id ? ' active' : ''}${s.danger ? ' danger' : ''}`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>

        <div className="settings-panel">
      {/* Account */}
      {activeSection === 'account' && (
      <div className="profile-card" style={{ padding: '28px' }}>
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
        <VerificationBanner
          status={verificationStatus}
          note={verificationNote}
          style={{ marginBottom: '16px' }}
        />

        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px', marginTop: '24px' }}>Change Password</h4>

        {passwordError && <div className="auth-error" style={{ display: 'block', marginBottom: '16px' }}>{passwordError}</div>}
        {passwordSuccess && (
          <div style={{ padding: '12px 16px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: '10px', color: 'var(--success-fg)', fontSize: '0.9rem', marginBottom: '16px' }}>
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
                minLength={MIN_PASSWORD_LENGTH}
              />
              <PasswordStrengthMeter password={newPassword} />
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

      )}

      {/* Notifications */}
      {/* Local state only — notification preferences will be synced when email integration is enabled */}
      {activeSection === 'notifications' && (
      <div className="profile-card" style={{ padding: '28px' }}>
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

      )}

      {/* Appearance */}
      {activeSection === 'appearance' && (
      <div className="profile-card" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>Appearance</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
          Choose how InternFirst looks to you. Applies instantly across the whole platform.
        </p>

        <ThemePicker />
      </div>

      )}

      {/* Privacy */}
      {activeSection === 'privacy' && (
      <div className="profile-card" style={{ padding: '28px' }}>
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

      )}

      {/* Danger Zone */}
      {activeSection === 'danger' && (
      <div className="profile-card" style={{ padding: '28px', border: '1px solid var(--danger-border)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: 'var(--danger-accent)' }}>Danger Zone</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Close your account and take down your listings. Your data is retained for
          6 months in case you need it restored, then permanently deleted.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          style={{
            padding: '10px 24px',
            background: 'var(--surface)',
            color: 'var(--danger-accent)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
        >
          Delete Account
        </button>
      </div>
      )}
        </div>
      </div>

      <DeleteAccountDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        role="employer"
      />
    </div>
  );
}
