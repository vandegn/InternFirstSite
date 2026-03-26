'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  supabase, getProfile, getStudentByUserId, updateProfile, updateStudent,
  getStudentResumes, uploadResume, deleteResume, uploadImage,
  getStudentSkills, addStudentSkill, removeStudentSkill,
  getStudentExperiences, addStudentExperience, updateStudentExperience, deleteStudentExperience,
  getStudentOrganizations, addStudentOrganization, updateStudentOrganization, deleteStudentOrganization,
} from '@/lib/supabase';
import { MAJORS, SKILLS } from '@/lib/constants';

interface Resume {
  id: string;
  name: string;
  file_url: string;
  uploaded_at: string;
}

interface StudentSkill {
  id: string;
  name: string;
  is_custom: boolean;
}

interface Experience {
  id: string;
  type: string;
  title: string;
  organization?: string;
  location?: string;
  description?: string;
  technologies?: string;
  link?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
}

interface Organization {
  id: string;
  type: string;
  name: string;
  chapter?: string;
  role?: string;
  join_date?: string;
  end_date?: string;
}

export default function StudentSettings() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [studentId, setStudentId] = useState('');

  // Personal info
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Academic info
  const [major, setMajor] = useState('');
  const [majorSearch, setMajorSearch] = useState('');
  const [showMajorDropdown, setShowMajorDropdown] = useState(false);
  const [graduationYear, setGraduationYear] = useState<number | ''>('');
  const [bio, setBio] = useState('');

  // Unified save state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Resumes
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [resumeName, setResumeName] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeSuccess, setResumeSuccess] = useState('');
  const [resumeError, setResumeError] = useState('');

  // Skills
  const [skills, setSkills] = useState<StudentSkill[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const skillDropdownRef = useRef<HTMLDivElement>(null);

  // Experiences
  const [internships, setInternships] = useState<Experience[]>([]);
  const [projects, setProjects] = useState<Experience[]>([]);
  const [campusInvolvements, setCampusInvolvements] = useState<Experience[]>([]);
  const [showExpForm, setShowExpForm] = useState<{ internship: boolean; project: boolean; campus_involvement: boolean }>({ internship: false, project: false, campus_involvement: false });
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [expForm, setExpForm] = useState<Partial<Experience>>({});

  // Organizations
  const [greekLife, setGreekLife] = useState<Organization[]>([]);
  const [clubs, setClubs] = useState<Organization[]>([]);
  const [showOrgForm, setShowOrgForm] = useState<{ greek_life: boolean; club: boolean }>({ greek_life: false, club: false });
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState<Partial<Organization>>({});

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

        const [studentSkills, allExperiences, allOrganizations] = await Promise.all([
          getStudentSkills(student.id),
          getStudentExperiences(student.id),
          getStudentOrganizations(student.id),
        ]);
        setSkills(studentSkills);
        setInternships(allExperiences.filter((e: Experience) => e.type === 'internship'));
        setProjects(allExperiences.filter((e: Experience) => e.type === 'project'));
        setCampusInvolvements(allExperiences.filter((e: Experience) => e.type === 'campus_involvement'));
        setGreekLife(allOrganizations.filter((o: Organization) => o.type === 'greek_life'));
        setClubs(allOrganizations.filter((o: Organization) => o.type === 'club'));
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

  // Close skill dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (skillDropdownRef.current && !skillDropdownRef.current.contains(e.target as Node)) {
        setShowSkillDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMajors = MAJORS.filter((m) =>
    m.toLowerCase().includes(majorSearch.toLowerCase())
  );

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
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

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess(false);
    setSaving(true);
    try {
      // Upload avatar file if one was selected
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

      // Save profile (personal info)
      await updateProfile(userId, {
        full_name: fullName,
        phone: phone || undefined,
        avatar_url: finalAvatarUrl || undefined,
      });

      // Save student (academic info)
      await updateStudent(studentId, {
        major: major || undefined,
        graduation_year: graduationYear ? Number(graduationYear) : undefined,
        bio: bio || undefined,
      });

      setSaveSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save. Please try again.';
      setSaveError(message);
    } finally {
      setSaving(false);
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

  // ---- Skills handlers ----
  const existingSkillNames = skills.map((s) => s.name.toLowerCase());
  const filteredSkills = SKILLS.filter(
    (s) => s.toLowerCase().includes(skillSearch.toLowerCase()) && !existingSkillNames.includes(s.toLowerCase())
  );

  async function handleAddSkill(name: string, isCustom: boolean) {
    try {
      const newSkill = await addStudentSkill(studentId, name, isCustom);
      setSkills((prev) => [...prev, newSkill].sort((a, b) => a.name.localeCompare(b.name)));
      setSkillSearch('');
      setCustomSkillInput('');
      setShowSkillDropdown(false);
    } catch { /* duplicate or error — ignore */ }
  }

  async function handleRemoveSkill(skillId: string) {
    try {
      await removeStudentSkill(skillId);
      setSkills((prev) => prev.filter((s) => s.id !== skillId));
    } catch { /* ignore */ }
  }

  // ---- Experience handlers ----
  function getExpListAndSetter(type: string): [Experience[], React.Dispatch<React.SetStateAction<Experience[]>>] {
    if (type === 'internship') return [internships, setInternships];
    if (type === 'project') return [projects, setProjects];
    return [campusInvolvements, setCampusInvolvements];
  }

  function openExpForm(type: string, existing?: Experience) {
    if (existing) {
      setEditingExpId(existing.id);
      setExpForm({ ...existing });
    } else {
      setEditingExpId(null);
      setExpForm({ type });
    }
    setShowExpForm((prev) => ({ ...prev, [type]: true }));
  }

  function closeExpForm(type: string) {
    setShowExpForm((prev) => ({ ...prev, [type]: false }));
    setEditingExpId(null);
    setExpForm({});
  }

  async function handleSaveExperience(type: string) {
    const [, setter] = getExpListAndSetter(type);
    try {
      if (editingExpId) {
        const { id: _id, student_id: _sid, type: _t, created_at: _ca, updated_at: _ua, ...fields } = expForm as any;
        const updated = await updateStudentExperience(editingExpId, fields);
        setter((prev) => prev.map((e) => (e.id === editingExpId ? updated : e)));
      } else {
        const newExp = await addStudentExperience(studentId, {
          type,
          title: expForm.title || '',
          organization: expForm.organization,
          location: expForm.location,
          description: expForm.description,
          technologies: expForm.technologies,
          link: expForm.link,
          start_date: expForm.start_date,
          end_date: expForm.is_current ? undefined : expForm.end_date,
          is_current: expForm.is_current,
        });
        setter((prev) => [newExp, ...prev]);
      }
      closeExpForm(type);
    } catch (err: unknown) {
      console.error('Failed to save experience:', err);
    }
  }

  async function handleDeleteExperience(type: string, id: string) {
    const [, setter] = getExpListAndSetter(type);
    try {
      await deleteStudentExperience(id);
      setter((prev) => prev.filter((e) => e.id !== id));
    } catch { /* ignore */ }
  }

  // ---- Organization handlers ----
  function getOrgListAndSetter(type: string): [Organization[], React.Dispatch<React.SetStateAction<Organization[]>>] {
    if (type === 'greek_life') return [greekLife, setGreekLife];
    return [clubs, setClubs];
  }

  function openOrgForm(type: string, existing?: Organization) {
    if (existing) {
      setEditingOrgId(existing.id);
      setOrgForm({ ...existing });
    } else {
      setEditingOrgId(null);
      setOrgForm({ type });
    }
    setShowOrgForm((prev) => ({ ...prev, [type]: true }));
  }

  function closeOrgForm(type: string) {
    setShowOrgForm((prev) => ({ ...prev, [type]: false }));
    setEditingOrgId(null);
    setOrgForm({});
  }

  async function handleSaveOrganization(type: string) {
    const [, setter] = getOrgListAndSetter(type);
    try {
      if (editingOrgId) {
        const { id: _id, student_id: _sid, type: _t, created_at: _ca, updated_at: _ua, ...fields } = orgForm as any;
        const updated = await updateStudentOrganization(editingOrgId, fields);
        setter((prev) => prev.map((o) => (o.id === editingOrgId ? updated : o)));
      } else {
        const newOrg = await addStudentOrganization(studentId, {
          type,
          name: orgForm.name || '',
          chapter: orgForm.chapter,
          role: orgForm.role,
          join_date: orgForm.join_date,
          end_date: orgForm.end_date,
        });
        setter((prev) => [newOrg, ...prev]);
      }
      closeOrgForm(type);
    } catch (err: unknown) {
      console.error('Failed to save organization:', err);
    }
  }

  async function handleDeleteOrganization(type: string, id: string) {
    const [, setter] = getOrgListAndSetter(type);
    try {
      await deleteStudentOrganization(id);
      setter((prev) => prev.filter((o) => o.id !== id));
    } catch { /* ignore */ }
  }

  // ---- Shared inline styles ----
  const cardStyle: React.CSSProperties = { padding: '32px', marginBottom: '24px' };
  const sectionHeading: React.CSSProperties = { fontSize: '1.15rem', fontWeight: 600, marginBottom: '20px' };
  const subHeading: React.CSSProperties = { fontSize: '1rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
  const entryCard: React.CSSProperties = { padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: '10px' };
  const inlineFormStyle: React.CSSProperties = { padding: '20px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', background: 'var(--bg)' };
  const addBtnStyle: React.CSSProperties = { padding: '6px 14px', fontSize: '0.85rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: '#fff', cursor: 'pointer', color: 'var(--primary)', fontWeight: 500 };
  const smallBtnStyle: React.CSSProperties = { background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 12px', cursor: 'pointer', fontSize: '0.8rem' };
  const deleteBtnStyle: React.CSSProperties = { ...smallBtnStyle, border: '1px solid #fca5a5', color: '#dc2626' };

  function formatDate(dateStr?: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  if (loading) {
    return (
      <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  const displayAvatar = avatarPreview || avatarUrl;

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <Link href="/dashboard/student" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Dashboard
      </Link>

      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Student Settings</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Manage your personal info, academic details, and resumes.</p>

      {saveError && <div className="auth-error" style={{ display: 'block', marginBottom: '16px' }}>{saveError}</div>}
      {saveSuccess && (
        <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#166534', fontSize: '0.9rem', marginBottom: '16px' }}>
          Settings saved successfully.
        </div>
      )}

      <form onSubmit={handleSaveAll}>
        {/* Personal Information */}
        <div className="profile-card" style={{ padding: '32px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '20px' }}>Personal Information</h3>

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
            <label>Profile Photo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                border: '2px solid var(--border)',
                overflow: 'hidden',
                background: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {displayAvatar ? (
                  <img src={displayAvatar} alt="Avatar preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                )}
              </div>
              <div>
                <input
                  type="file"
                  ref={avatarInputRef}
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: '#fff',
                    cursor: 'pointer',
                    color: 'var(--text)',
                  }}
                >
                  {displayAvatar ? 'Change Photo' : 'Upload Photo'}
                </button>
                {displayAvatar && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                      setAvatarUrl('');
                      if (avatarInputRef.current) avatarInputRef.current.value = '';
                    }}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.85rem',
                      border: '1px solid #fca5a5',
                      borderRadius: 'var(--radius-sm)',
                      background: '#fff',
                      cursor: 'pointer',
                      color: '#dc2626',
                      marginLeft: '8px',
                    }}
                  >
                    Remove
                  </button>
                )}
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '6px' }}>
                  JPG, PNG or GIF. Max 5MB.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Academic Information */}
        <div className="profile-card" style={{ padding: '32px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '20px' }}>Academic Information</h3>

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

          <div className="form-group" style={{ marginBottom: '0' }}>
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
        </div>

        {/* Single Save Button */}
        <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '14px 40px', fontSize: '1rem', marginBottom: '24px' }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      {/* Resumes (separate section, not part of the main save form) */}
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

      {/* Skills */}
      <div className="profile-card" style={cardStyle}>
        <h3 style={sectionHeading}>Skills</h3>

        {/* Current skills as pills */}
        {skills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {skills.map((s) => (
              <span key={s.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem',
                background: 'var(--accent-light)', color: 'var(--primary)', fontWeight: 500,
                border: '1px solid var(--border)',
              }}>
                {s.name}
                <button onClick={() => handleRemoveSkill(s.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1, display: 'flex',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Searchable skill dropdown */}
        <div style={{ position: 'relative', marginBottom: '16px' }} ref={skillDropdownRef}>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px', display: 'block', color: 'var(--text-secondary)' }}>Add from preset skills</label>
          <input
            type="text"
            placeholder="Search skills..."
            value={skillSearch}
            onChange={(e) => { setSkillSearch(e.target.value); setShowSkillDropdown(true); }}
            onFocus={() => setShowSkillDropdown(true)}
            autoComplete="off"
          />
          {showSkillDropdown && filteredSkills.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              maxHeight: '200px', overflowY: 'auto', background: 'var(--bg)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}>
              {filteredSkills.slice(0, 30).map((s) => (
                <div key={s} onClick={() => handleAddSkill(s, false)} style={{
                  padding: '10px 14px', cursor: 'pointer', fontSize: '0.9rem',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Custom skill */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px', display: 'block', color: 'var(--text-secondary)' }}>Add custom skill</label>
            <input
              type="text"
              placeholder="Type a custom skill..."
              value={customSkillInput}
              onChange={(e) => setCustomSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customSkillInput.trim()) {
                  e.preventDefault();
                  handleAddSkill(customSkillInput.trim(), true);
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => customSkillInput.trim() && handleAddSkill(customSkillInput.trim(), true)}
            disabled={!customSkillInput.trim()}
            className="btn-primary"
            style={{ padding: '10px 20px', fontSize: '0.9rem', whiteSpace: 'nowrap' }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Experience */}
      <div className="profile-card" style={cardStyle}>
        <h3 style={sectionHeading}>Experience</h3>

        {/* Internships */}
        <div style={{ marginBottom: '28px' }}>
          <div style={subHeading}>
            <span>Internships</span>
            {!showExpForm.internship && (
              <button type="button" onClick={() => openExpForm('internship')} style={addBtnStyle}>+ Add</button>
            )}
          </div>

          {showExpForm.internship && (
            <div style={inlineFormStyle}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Title *</label>
                <input type="text" value={expForm.title || ''} onChange={(e) => setExpForm({ ...expForm, title: e.target.value })} placeholder="e.g. Software Engineering Intern" />
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Company</label>
                <input type="text" value={expForm.organization || ''} onChange={(e) => setExpForm({ ...expForm, organization: e.target.value })} placeholder="Company name" />
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Location</label>
                <input type="text" value={expForm.location || ''} onChange={(e) => setExpForm({ ...expForm, location: e.target.value })} placeholder="City, State" />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Start Date</label>
                  <input type="month" value={expForm.start_date?.slice(0, 7) || ''} onChange={(e) => setExpForm({ ...expForm, start_date: e.target.value ? e.target.value + '-01' : '' })} />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>End Date</label>
                  <input type="month" value={expForm.end_date?.slice(0, 7) || ''} onChange={(e) => setExpForm({ ...expForm, end_date: e.target.value ? e.target.value + '-01' : '' })} disabled={expForm.is_current} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', marginBottom: '14px', cursor: 'pointer' }}>
                <input type="checkbox" checked={expForm.is_current || false} onChange={(e) => setExpForm({ ...expForm, is_current: e.target.checked, end_date: e.target.checked ? undefined : expForm.end_date })} />
                I currently work here
              </label>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Description</label>
                <textarea rows={3} value={expForm.description || ''} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} placeholder="What did you work on?" style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-primary" onClick={() => handleSaveExperience('internship')} disabled={!expForm.title?.trim()} style={{ padding: '10px 24px', fontSize: '0.9rem' }}>
                  {editingExpId ? 'Update' : 'Save'}
                </button>
                <button type="button" onClick={() => closeExpForm('internship')} style={{ ...smallBtnStyle, padding: '10px 24px' }}>Cancel</button>
              </div>
            </div>
          )}

          {internships.map((exp) => (
            <div key={exp.id} style={entryCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{exp.title}</div>
                  {exp.organization && <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{exp.organization}</div>}
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {formatDate(exp.start_date)} — {exp.is_current ? 'Present' : formatDate(exp.end_date)}
                    {exp.location && ` · ${exp.location}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => openExpForm('internship', exp)} style={smallBtnStyle}>Edit</button>
                  <button type="button" onClick={() => handleDeleteExperience('internship', exp.id)} style={deleteBtnStyle}>Delete</button>
                </div>
              </div>
              {exp.description && <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{exp.description}</p>}
            </div>
          ))}
          {internships.length === 0 && !showExpForm.internship && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>No internships added yet.</p>
          )}
        </div>

        {/* Projects */}
        <div style={{ marginBottom: '28px' }}>
          <div style={subHeading}>
            <span>Projects</span>
            {!showExpForm.project && (
              <button type="button" onClick={() => openExpForm('project')} style={addBtnStyle}>+ Add</button>
            )}
          </div>

          {showExpForm.project && (
            <div style={inlineFormStyle}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Title *</label>
                <input type="text" value={expForm.title || ''} onChange={(e) => setExpForm({ ...expForm, title: e.target.value })} placeholder="Project name" />
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Description</label>
                <textarea rows={3} value={expForm.description || ''} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} placeholder="What does this project do?" style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Technologies</label>
                <input type="text" value={expForm.technologies || ''} onChange={(e) => setExpForm({ ...expForm, technologies: e.target.value })} placeholder="e.g. React, Node.js, PostgreSQL" />
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Link (optional)</label>
                <input type="url" value={expForm.link || ''} onChange={(e) => setExpForm({ ...expForm, link: e.target.value })} placeholder="https://github.com/..." />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-primary" onClick={() => handleSaveExperience('project')} disabled={!expForm.title?.trim()} style={{ padding: '10px 24px', fontSize: '0.9rem' }}>
                  {editingExpId ? 'Update' : 'Save'}
                </button>
                <button type="button" onClick={() => closeExpForm('project')} style={{ ...smallBtnStyle, padding: '10px 24px' }}>Cancel</button>
              </div>
            </div>
          )}

          {projects.map((exp) => (
            <div key={exp.id} style={entryCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{exp.title}</div>
                  {exp.technologies && <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{exp.technologies}</div>}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => openExpForm('project', exp)} style={smallBtnStyle}>Edit</button>
                  <button type="button" onClick={() => handleDeleteExperience('project', exp.id)} style={deleteBtnStyle}>Delete</button>
                </div>
              </div>
              {exp.description && <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{exp.description}</p>}
              {exp.link && <a href={exp.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '0.85rem', display: 'inline-block', marginTop: '6px' }}>{exp.link}</a>}
            </div>
          ))}
          {projects.length === 0 && !showExpForm.project && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>No projects added yet.</p>
          )}
        </div>

        {/* Campus Involvement */}
        <div>
          <div style={subHeading}>
            <span>Campus Involvement</span>
            {!showExpForm.campus_involvement && (
              <button type="button" onClick={() => openExpForm('campus_involvement')} style={addBtnStyle}>+ Add</button>
            )}
          </div>

          {showExpForm.campus_involvement && (
            <div style={inlineFormStyle}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Organization *</label>
                <input type="text" value={expForm.organization || ''} onChange={(e) => setExpForm({ ...expForm, organization: e.target.value })} placeholder="Organization name" />
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Role / Position *</label>
                <input type="text" value={expForm.title || ''} onChange={(e) => setExpForm({ ...expForm, title: e.target.value })} placeholder="e.g. President, Member" />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Start Date</label>
                  <input type="month" value={expForm.start_date?.slice(0, 7) || ''} onChange={(e) => setExpForm({ ...expForm, start_date: e.target.value ? e.target.value + '-01' : '' })} />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>End Date</label>
                  <input type="month" value={expForm.end_date?.slice(0, 7) || ''} onChange={(e) => setExpForm({ ...expForm, end_date: e.target.value ? e.target.value + '-01' : '' })} disabled={expForm.is_current} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', marginBottom: '14px', cursor: 'pointer' }}>
                <input type="checkbox" checked={expForm.is_current || false} onChange={(e) => setExpForm({ ...expForm, is_current: e.target.checked, end_date: e.target.checked ? undefined : expForm.end_date })} />
                I&apos;m currently involved
              </label>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Description</label>
                <textarea rows={3} value={expForm.description || ''} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} placeholder="Describe your involvement..." style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-primary" onClick={() => handleSaveExperience('campus_involvement')} disabled={!expForm.title?.trim()} style={{ padding: '10px 24px', fontSize: '0.9rem' }}>
                  {editingExpId ? 'Update' : 'Save'}
                </button>
                <button type="button" onClick={() => closeExpForm('campus_involvement')} style={{ ...smallBtnStyle, padding: '10px 24px' }}>Cancel</button>
              </div>
            </div>
          )}

          {campusInvolvements.map((exp) => (
            <div key={exp.id} style={entryCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{exp.title}</div>
                  {exp.organization && <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{exp.organization}</div>}
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {formatDate(exp.start_date)} — {exp.is_current ? 'Present' : formatDate(exp.end_date)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => openExpForm('campus_involvement', exp)} style={smallBtnStyle}>Edit</button>
                  <button type="button" onClick={() => handleDeleteExperience('campus_involvement', exp.id)} style={deleteBtnStyle}>Delete</button>
                </div>
              </div>
              {exp.description && <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{exp.description}</p>}
            </div>
          ))}
          {campusInvolvements.length === 0 && !showExpForm.campus_involvement && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>No campus involvement added yet.</p>
          )}
        </div>
      </div>

      {/* Organizations */}
      <div className="profile-card" style={cardStyle}>
        <h3 style={sectionHeading}>Organizations</h3>

        {/* Greek Life */}
        <div style={{ marginBottom: '28px' }}>
          <div style={subHeading}>
            <span>Greek Life</span>
            {!showOrgForm.greek_life && (
              <button type="button" onClick={() => openOrgForm('greek_life')} style={addBtnStyle}>+ Add</button>
            )}
          </div>

          {showOrgForm.greek_life && (
            <div style={inlineFormStyle}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Organization Name *</label>
                <input type="text" value={orgForm.name || ''} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} placeholder="e.g. Alpha Phi Alpha" />
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Chapter (optional)</label>
                <input type="text" value={orgForm.chapter || ''} onChange={(e) => setOrgForm({ ...orgForm, chapter: e.target.value })} placeholder="e.g. Alpha Chapter" />
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Role (optional)</label>
                <input type="text" value={orgForm.role || ''} onChange={(e) => setOrgForm({ ...orgForm, role: e.target.value })} placeholder="e.g. President, Treasurer" />
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Joined</label>
                <input type="month" value={orgForm.join_date?.slice(0, 7) || ''} onChange={(e) => setOrgForm({ ...orgForm, join_date: e.target.value ? e.target.value + '-01' : '' })} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-primary" onClick={() => handleSaveOrganization('greek_life')} disabled={!orgForm.name?.trim()} style={{ padding: '10px 24px', fontSize: '0.9rem' }}>
                  {editingOrgId ? 'Update' : 'Save'}
                </button>
                <button type="button" onClick={() => closeOrgForm('greek_life')} style={{ ...smallBtnStyle, padding: '10px 24px' }}>Cancel</button>
              </div>
            </div>
          )}

          {greekLife.map((org) => (
            <div key={org.id} style={entryCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{org.name}{org.chapter ? ` — ${org.chapter}` : ''}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {org.role && `${org.role} · `}{formatDate(org.join_date) && `Joined ${formatDate(org.join_date)}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => openOrgForm('greek_life', org)} style={smallBtnStyle}>Edit</button>
                  <button type="button" onClick={() => handleDeleteOrganization('greek_life', org.id)} style={deleteBtnStyle}>Delete</button>
                </div>
              </div>
            </div>
          ))}
          {greekLife.length === 0 && !showOrgForm.greek_life && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>No Greek life added.</p>
          )}
        </div>

        {/* Clubs / Organizations */}
        <div>
          <div style={subHeading}>
            <span>Clubs / Organizations</span>
            {!showOrgForm.club && (
              <button type="button" onClick={() => openOrgForm('club')} style={addBtnStyle}>+ Add</button>
            )}
          </div>

          {showOrgForm.club && (
            <div style={inlineFormStyle}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Name *</label>
                <input type="text" value={orgForm.name || ''} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} placeholder="e.g. Investment Club" />
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Role / Position (optional)</label>
                <input type="text" value={orgForm.role || ''} onChange={(e) => setOrgForm({ ...orgForm, role: e.target.value })} placeholder="e.g. Vice President" />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Joined</label>
                  <input type="month" value={orgForm.join_date?.slice(0, 7) || ''} onChange={(e) => setOrgForm({ ...orgForm, join_date: e.target.value ? e.target.value + '-01' : '' })} />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>End Date (optional)</label>
                  <input type="month" value={orgForm.end_date?.slice(0, 7) || ''} onChange={(e) => setOrgForm({ ...orgForm, end_date: e.target.value ? e.target.value + '-01' : '' })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-primary" onClick={() => handleSaveOrganization('club')} disabled={!orgForm.name?.trim()} style={{ padding: '10px 24px', fontSize: '0.9rem' }}>
                  {editingOrgId ? 'Update' : 'Save'}
                </button>
                <button type="button" onClick={() => closeOrgForm('club')} style={{ ...smallBtnStyle, padding: '10px 24px' }}>Cancel</button>
              </div>
            </div>
          )}

          {clubs.map((org) => (
            <div key={org.id} style={entryCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{org.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {org.role && `${org.role} · `}{formatDate(org.join_date)}{org.end_date ? ` — ${formatDate(org.end_date)}` : formatDate(org.join_date) ? ' — Present' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => openOrgForm('club', org)} style={smallBtnStyle}>Edit</button>
                  <button type="button" onClick={() => handleDeleteOrganization('club', org.id)} style={deleteBtnStyle}>Delete</button>
                </div>
              </div>
            </div>
          ))}
          {clubs.length === 0 && !showOrgForm.club && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>No clubs or organizations added.</p>
          )}
        </div>
      </div>
    </div>
  );
}
