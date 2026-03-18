'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase, getProfile, getStudentByUserId, updateProfile, updateStudent, getStudentResumes, uploadResume, deleteResume } from '@/lib/supabase';
import { MAJORS } from '@/lib/constants';

interface Resume {
  id: string;
  name: string;
  file_url: string;
  uploaded_at: string;
}

export default function StudentSettings() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [studentId, setStudentId] = useState('');

  // Personal info
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalSuccess, setPersonalSuccess] = useState(false);
  const [personalError, setPersonalError] = useState('');

  // Academic info
  const [major, setMajor] = useState('');
  const [majorSearch, setMajorSearch] = useState('');
  const [showMajorDropdown, setShowMajorDropdown] = useState(false);
  const [graduationYear, setGraduationYear] = useState<number | ''>('');
  const [bio, setBio] = useState('');
  const [savingAcademic, setSavingAcademic] = useState(false);
  const [academicSuccess, setAcademicSuccess] = useState(false);
  const [academicError, setAcademicError] = useState('');

  // Resumes
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [resumeName, setResumeName] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeSuccess, setResumeSuccess] = useState('');
  const [resumeError, setResumeError] = useState('');

  const majorDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const profile = await getProfile(user.id);
      if (profile) {
        setFullName(profile.full_name || '');
        setPhone(profile.phone || '');
        setAvatarUrl(profile.avatar_url || '');
      }

      const student = await getStudentByUserId(user.id);
      if (student) {
        setStudentId(student.id);
        setMajor(student.major || '');
        setMajorSearch(student.major || '');
        setGraduationYear(student.graduation_year || '');
        setBio(student.bio || '');

        const studentResumes = await getStudentResumes(student.id);
        setResumes(studentResumes);
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  // Close major dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (majorDropdownRef.current && !majorDropdownRef.current.contains(e.target as Node)) {
        setShowMajorDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMajors = MAJORS.filter((m) =>
    m.toLowerCase().includes(majorSearch.toLowerCase())
  );

  async function handleSavePersonal(e: React.FormEvent) {
    e.preventDefault();
    setPersonalError('');
    setPersonalSuccess(false);
    setSavingPersonal(true);
    try {
      await updateProfile(userId, {
        full_name: fullName,
        phone: phone || undefined,
        avatar_url: avatarUrl || undefined,
      });
      setPersonalSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save. Please try again.';
      setPersonalError(message);
    } finally {
      setSavingPersonal(false);
    }
  }

  async function handleSaveAcademic(e: React.FormEvent) {
    e.preventDefault();
    setAcademicError('');
    setAcademicSuccess(false);
    setSavingAcademic(true);
    try {
      await updateStudent(studentId, {
        major: major || undefined,
        graduation_year: graduationYear ? Number(graduationYear) : undefined,
        bio: bio || undefined,
      });
      setAcademicSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save. Please try again.';
      setAcademicError(message);
    } finally {
      setSavingAcademic(false);
    }
  }

  async function handleUploadResume(e: React.FormEvent) {
    e.preventDefault();
    if (!resumeFile || !resumeName.trim()) return;
    setResumeError('');
    setResumeSuccess('');
    setUploadingResume(true);
    try {
      const newResume = await uploadResume(studentId, resumeFile, resumeName.trim());
      setResumes((prev) => [newResume, ...prev]);
      setResumeName('');
      setResumeFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setResumeSuccess('Resume uploaded successfully.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload resume. Please try again.';
      setResumeError(message);
    } finally {
      setUploadingResume(false);
    }
  }

  async function handleDeleteResume(resumeId: string) {
    try {
      await deleteResume(resumeId);
      setResumes((prev) => prev.filter((r) => r.id !== resumeId));
      setResumeSuccess('Resume deleted.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete resume.';
      setResumeError(message);
    }
  }

  if (loading) {
    return (
      <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <Link href="/dashboard/student" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Dashboard
      </Link>

      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Student Settings</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Manage your personal info, academic details, and resumes.</p>

      {/* Personal Information */}
      <div className="profile-card" style={{ padding: '32px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '20px' }}>Personal Information</h3>

        {personalError && <div className="auth-error" style={{ display: 'block', marginBottom: '16px' }}>{personalError}</div>}
        {personalSuccess && (
          <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#166534', fontSize: '0.9rem', marginBottom: '16px' }}>
            Personal info updated successfully.
          </div>
        )}

        <form onSubmit={handleSavePersonal}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label htmlFor="fullName">Full Name</label>
            <input
              type="text"
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label htmlFor="phone">Phone</label>
            <input
              type="text"
              id="phone"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label htmlFor="avatarUrl">Avatar URL</label>
            <input
              type="text"
              id="avatarUrl"
              placeholder="https://example.com/avatar.jpg"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
            {avatarUrl && (
              <div style={{ marginTop: '12px' }}>
                <img src={avatarUrl} alt="Avatar preview" style={{ maxWidth: 80, maxHeight: 80, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={savingPersonal} style={{ padding: '12px 32px', fontSize: '1rem' }}>
            {savingPersonal ? 'Saving...' : 'Save Personal Info'}
          </button>
        </form>
      </div>

      {/* Academic Information */}
      <div className="profile-card" style={{ padding: '32px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '20px' }}>Academic Information</h3>

        {academicError && <div className="auth-error" style={{ display: 'block', marginBottom: '16px' }}>{academicError}</div>}
        {academicSuccess && (
          <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#166534', fontSize: '0.9rem', marginBottom: '16px' }}>
            Academic info updated successfully.
          </div>
        )}

        <form onSubmit={handleSaveAcademic}>
          <div className="form-group" style={{ marginBottom: '20px', position: 'relative' }} ref={majorDropdownRef}>
            <label htmlFor="major">Major</label>
            <input
              type="text"
              id="major"
              placeholder="Search for your major..."
              value={majorSearch}
              onChange={(e) => {
                setMajorSearch(e.target.value);
                setShowMajorDropdown(true);
              }}
              onFocus={() => setShowMajorDropdown(true)}
              autoComplete="off"
            />
            {showMajorDropdown && filteredMajors.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: '200px',
                overflowY: 'auto',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                zIndex: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}>
                {filteredMajors.map((m) => (
                  <div
                    key={m}
                    onClick={() => {
                      setMajor(m);
                      setMajorSearch(m);
                      setShowMajorDropdown(false);
                    }}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      background: m === major ? 'var(--primary)' : 'transparent',
                      color: m === major ? '#fff' : 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      if (m !== major) {
                        e.currentTarget.style.background = 'var(--border)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = m === major ? 'var(--primary)' : 'transparent';
                    }}
                  >
                    {m}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label htmlFor="graduationYear">Graduation Year</label>
            <input
              type="number"
              id="graduationYear"
              placeholder="2027"
              min={2020}
              max={2035}
              value={graduationYear}
              onChange={(e) => setGraduationYear(e.target.value ? parseInt(e.target.value) : '')}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              placeholder="Tell employers about yourself..."
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={savingAcademic} style={{ padding: '12px 32px', fontSize: '1rem' }}>
            {savingAcademic ? 'Saving...' : 'Save Academic Info'}
          </button>
        </form>
      </div>

      {/* Resumes */}
      <div className="profile-card" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '20px' }}>My Resumes</h3>

        {resumeError && <div className="auth-error" style={{ display: 'block', marginBottom: '16px' }}>{resumeError}</div>}
        {resumeSuccess && (
          <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#166534', fontSize: '0.9rem', marginBottom: '16px' }}>
            {resumeSuccess}
          </div>
        )}

        {resumes.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>No resumes uploaded yet.</p>
        )}

        {resumes.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            {resumes.map((r) => (
              <div key={r.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '8px',
              }}>
                <div>
                  <a href={r.file_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem' }}>
                    {r.name}
                  </a>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '4px 0 0' }}>
                    Uploaded {new Date(r.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteResume(r.id)}
                  style={{
                    background: 'none',
                    border: '1px solid #fca5a5',
                    borderRadius: 'var(--radius-sm)',
                    color: '#dc2626',
                    padding: '6px 14px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleUploadResume}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label htmlFor="resumeName">Display Name</label>
            <input
              type="text"
              id="resumeName"
              placeholder="e.g. Fall 2026 Resume"
              required
              value={resumeName}
              onChange={(e) => setResumeName(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label htmlFor="resumeFile">File</label>
            <input
              type="file"
              id="resumeFile"
              accept=".pdf,.doc,.docx"
              ref={fileInputRef}
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
              style={{ fontSize: '0.9rem' }}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={uploadingResume || !resumeFile || !resumeName.trim()} style={{ padding: '12px 32px', fontSize: '1rem' }}>
            {uploadingResume ? 'Uploading...' : 'Upload Resume'}
          </button>
        </form>
      </div>
    </div>
  );
}
