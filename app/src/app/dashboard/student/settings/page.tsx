'use client';

import { useState, useEffect } from 'react';
import { supabase, getStudentByUserId, getCareerSurvey, upsertCareerSurvey } from '@/lib/supabase';
import type { CareerSurveyData } from '@/lib/supabase';
import CareerSurveyModal from '@/components/CareerSurveyModal';
import type { CareerSurveyFormData } from '@/components/CareerSurveyModal';

export default function StudentSettings() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Notification preferences (local state only — no backend integration yet)
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyApplicationStatus, setNotifyApplicationStatus] = useState(true);
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(false);

  // Appearance
  const [darkMode, setDarkMode] = useState(false);

  // Privacy
  const [showProfileToEmployers, setShowProfileToEmployers] = useState(true);
  const [showEmailOnProfile, setShowEmailOnProfile] = useState(false);

  // Delete account dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Career Preferences
  const [careerSurvey, setCareerSurvey] = useState<(CareerSurveyData & { completed_at: string; updated_at: string }) | null>(null);
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || '');

      // Load dark mode preference from localStorage
      const savedDarkMode = localStorage.getItem('internfirst-dark-mode');
      if (savedDarkMode === 'true') setDarkMode(true);

      const student = await getStudentByUserId(user.id);
      if (student) {
        setStudentId(student.id);
        const surveyData = await getCareerSurvey(student.id);
        setCareerSurvey(surveyData);
      }

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

        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            disabled
            style={{ background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
          />
        </div>

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

      {/* Career Preferences */}
      <div className="profile-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Career Preferences</h3>
        {careerSurvey ? (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Industries</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                  {careerSurvey.industries.map(ind => (
                    <span key={ind} style={{ padding: '4px 12px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 500, background: 'var(--accent-light, #eef5da)', color: 'var(--accent-dark, #8ab32e)', border: '1px solid rgba(159, 198, 60, 0.25)' }}>{ind}</span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Work Environment</div>
                <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 500, background: 'var(--primary-light)', color: 'var(--primary)' }}>
                  {careerSurvey.work_environment === 'in_person' ? 'In-person' : careerSurvey.work_environment === 'remote' ? 'Remote' : careerSurvey.work_environment === 'hybrid' ? 'Hybrid' : 'No preference'}
                </span>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Preferred Duration</div>
                <span style={{ fontSize: '0.88rem', color: 'var(--text)' }}>
                  {careerSurvey.preferred_duration === '1_month' ? '1 month' : careerSurvey.preferred_duration === '3_months' ? '3 months' : careerSurvey.preferred_duration === '6_months' ? '6 months' : '12 months'}
                </span>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Skills to Develop</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                  {careerSurvey.skills.map(skill => (
                    <span key={skill} style={{ padding: '4px 12px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 500, background: '#e0f2fe', color: '#0369a1', border: '1px solid rgba(3, 105, 161, 0.15)' }}>{skill}</span>
                  ))}
                </div>
              </div>
              {careerSurvey.career_goals && (
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Career Goals</div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{careerSurvey.career_goals}</p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSurveyModalOpen(true)}
              style={{
                marginTop: '20px',
                padding: '9px 20px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: '#fff',
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              Update preferences
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 14px' }}>No career preferences set yet</p>
            <button
              type="button"
              onClick={() => setSurveyModalOpen(true)}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: 'none',
                background: 'var(--accent, #9FC63C)',
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              Take career goals survey
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {/* Local state only — notification preferences will be synced when email integration is enabled */}
      <div className="profile-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>Notifications</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Choose which email notifications you receive.
        </p>

        <SettingRow
          label="New messages"
          description="Get notified when you receive a message from an employer."
          checked={notifyMessages}
          onChange={setNotifyMessages}
        />
        <SettingRow
          label="Application status updates"
          description="Get notified when your application status changes."
          checked={notifyApplicationStatus}
          onChange={setNotifyApplicationStatus}
        />
        <SettingRow
          label="Weekly digest"
          description="Receive a weekly summary of new internship opportunities."
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
          label="Show profile to employers"
          description="Allow employers to view your profile when browsing candidates."
          checked={showProfileToEmployers}
          onChange={setShowProfileToEmployers}
        />
        <SettingRow
          label="Show email on profile"
          description="Display your email address on your public profile."
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

      {/* Career Survey Modal */}
      <CareerSurveyModal
        open={surveyModalOpen}
        onClose={() => setSurveyModalOpen(false)}
        initialData={careerSurvey ? {
          industries: careerSurvey.industries,
          work_environment: careerSurvey.work_environment,
          preferred_duration: careerSurvey.preferred_duration,
          skills: careerSurvey.skills,
          career_goals: careerSurvey.career_goals,
        } : null}
        onSubmit={async (data: CareerSurveyFormData) => {
          if (!studentId) return;
          try {
            await upsertCareerSurvey(studentId, data);
            const updated = await getCareerSurvey(studentId);
            setCareerSurvey(updated);
            setSurveyModalOpen(false);
          } catch (err) {
            console.error('Failed to save survey:', err);
          }
        }}
      />
    </div>
  );
}
