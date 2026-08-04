'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  supabase, getProfile, getStudentByUserId, updateProfile, updateStudent,
  getStudentResumes, uploadResume, deleteResume, uploadImage,
  getStudentCertifications, uploadCertification, deleteCertification,
  type StudentCertification,
  getStudentSkills, addStudentSkill, removeStudentSkill,
  getStudentExperiences, addStudentExperience, updateStudentExperience, deleteStudentExperience,
  getStudentOrganizations, addStudentOrganization, updateStudentOrganization, deleteStudentOrganization,
} from '@/lib/supabase';
import { MAJORS, MAX_STUDENT_SKILLS } from '@/lib/constants';
import SchoolPicker, { EMPTY_SCHOOL, schoolFromStudent, type SchoolValue } from '@/components/SchoolPicker';

interface Resume { id: string; name: string; uploaded_at: string; }
interface Skill { id: string; name: string; }
interface Experience { id: string; type: string; title: string; organization?: string; location?: string; description?: string; technologies?: string; link?: string; start_date?: string; end_date?: string; is_current?: boolean; }
interface Org { id: string; type: string; name: string; chapter?: string; role?: string; description?: string; join_date?: string; end_date?: string; is_current?: boolean; }

// Organizations is one section covering everything campus-side — Greek life,
// clubs, and general involvement — rather than splitting across two cards with
// "Campus Involvement" stranded under Experience. Experience stays professional.
const ORG_TYPES: { value: string; label: string }[] = [
  { value: 'club', label: 'Club' },
  { value: 'greek_life', label: 'Greek Life' },
  { value: 'campus_involvement', label: 'Campus Involvement' },
  { value: 'other', label: 'Other' },
];

const ORG_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ORG_TYPES.map((t) => [t.value, t.label]),
);

// Pencil icon button
function EditBtn({ onClick, editing }: { onClick: () => void; editing: boolean }) {
  return (
    <button
      onClick={onClick}
      title={editing ? 'Done editing' : 'Edit'}
      style={{
        background: editing ? 'var(--primary)' : 'transparent',
        border: '1px solid ' + (editing ? 'var(--primary)' : 'var(--border)'),
        borderRadius: '6px',
        padding: '5px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={editing ? 'var(--on-primary)' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>
  );
}

export default function StudentProfile() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [studentId, setStudentId] = useState('');

  // Profile data
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [major, setMajor] = useState('');
  const [phone, setPhone] = useState('');
  const [graduationYear, setGraduationYear] = useState<number | ''>('');
  const [school, setSchool] = useState<SchoolValue>(EMPTY_SCHOOL);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [certifications, setCertifications] = useState<StudentCertification[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [internships, setInternships] = useState<Experience[]>([]);
  const [jobs, setJobs] = useState<Experience[]>([]);
  const [projects, setProjects] = useState<Experience[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);

  // Edit mode per section
  const [editingHero, setEditingHero] = useState(false);
  const [editingSkills, setEditingSkills] = useState(false);
  const [editingResume, setEditingResume] = useState(false);
  const [editingCerts, setEditingCerts] = useState(false);
  const [editingExp, setEditingExp] = useState(false);
  const [editingOrgs, setEditingOrgs] = useState(false);

  // Hero edit drafts
  const [draftName, setDraftName] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [draftMajor, setDraftMajor] = useState('');
  const [draftSchool, setDraftSchool] = useState<SchoolValue>(EMPTY_SCHOOL);
  const [draftMajorSearch, setDraftMajorSearch] = useState('');
  const [draftGradYear, setDraftGradYear] = useState<number | ''>('');
  const [draftPhone, setDraftPhone] = useState('');
  const [showMajorDropdown, setShowMajorDropdown] = useState(false);
  const majorDropdownRef = useRef<HTMLDivElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [savingHero, setSavingHero] = useState(false);

  // Skills
  const [skillSearch, setSkillSearch] = useState('');
  const [debouncedSkillSearch, setDebouncedSkillSearch] = useState('');
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const skillDropdownRef = useRef<HTMLDivElement>(null);
  // Autocomplete catalog (loaded lazily from /skills.json on first edit)
  const [skillCatalog, setSkillCatalog] = useState<string[]>([]);
  const skillCatalogLoaded = useRef(false);

  // Resume upload
  const [resumeName, setResumeName] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Certification upload — PDF plus the credential number employers verify against
  const [certName, setCertName] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [certFile, setCertFile] = useState<File | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [certError, setCertError] = useState('');
  const certFileInputRef = useRef<HTMLInputElement>(null);

  // Experience forms
  const [showExpForm, setShowExpForm] = useState<{ internship: boolean; work: boolean; project: boolean }>({ internship: false, work: false, project: false });
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [expForm, setExpForm] = useState<Partial<Experience>>({});
  const [expError, setExpError] = useState('');

  // Organization forms
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState<Partial<Org>>({});
  const [orgError, setOrgError] = useState('');

  // Status
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const profile = await getProfile(user.id);
      if (profile) {
        setFullName(profile.full_name || '');
        setAvatarUrl(profile.avatar_url || '');
        setPhone(profile.phone || '');
      }

      const student = await getStudentByUserId(user.id);
      if (student) {
        setStudentId(student.id);
        setMajor(student.major || '');
        setGraduationYear(student.graduation_year || '');
        setSchool(schoolFromStudent(student));
        setBio(student.bio || '');

        const [studentResumes, studentCertifications] = await Promise.all([
          getStudentResumes(student.id),
          getStudentCertifications(student.id),
        ]);
        setResumes(studentResumes);
        setCertifications(studentCertifications);

        const [studentSkills, allExperiences, allOrganizations] = await Promise.all([
          getStudentSkills(student.id),
          getStudentExperiences(student.id),
          getStudentOrganizations(student.id),
        ]);
        setSkills(studentSkills);
        setInternships(allExperiences.filter((e: Experience) => e.type === 'internship'));
        setJobs(allExperiences.filter((e: Experience) => e.type === 'work'));
        setProjects(allExperiences.filter((e: Experience) => e.type === 'project'));
        setOrgs(allOrganizations);
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (majorDropdownRef.current && !majorDropdownRef.current.contains(e.target as Node)) setShowMajorDropdown(false);
      if (skillDropdownRef.current && !skillDropdownRef.current.contains(e.target as Node)) setShowSkillDropdown(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lazy-load the skill autocomplete catalog the first time the user edits skills.
  // Kept out of the JS bundle (public/skills.json) so it doesn't bloat every page.
  useEffect(() => {
    if (!editingSkills || skillCatalogLoaded.current) return;
    skillCatalogLoaded.current = true;
    fetch('/skills.json')
      .then((r) => r.json())
      .then((data: string[]) => setSkillCatalog(data))
      .catch(() => { skillCatalogLoaded.current = false; });
  }, [editingSkills]);

  // Debounce the search input so filtering stays snappy as the catalog grows.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSkillSearch(skillSearch), 120);
    return () => clearTimeout(t);
  }, [skillSearch]);

  function formatDate(dateStr?: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  function showSaved() {
    setSaveMsg('Saved!');
    setTimeout(() => setSaveMsg(''), 2000);
  }

  // ---- Hero save ----
  function startEditHero() {
    setDraftName(fullName);
    setDraftBio(bio);
    setDraftMajor(major);
    setDraftMajorSearch(major);
    setDraftSchool(school);
    setDraftGradYear(graduationYear);
    setDraftPhone(phone);
    setAvatarFile(null);
    setAvatarPreview(null);
    setEditingHero(true);
  }

  async function saveHero() {
    setSavingHero(true);
    try {
      let finalAvatarUrl = avatarUrl;
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() || 'jpg';
        const path = `avatars/${userId}.${ext}`;
        finalAvatarUrl = await uploadImage('images', path, avatarFile);
        setAvatarUrl(finalAvatarUrl);
        setAvatarFile(null);
        setAvatarPreview(null);
      }
      await updateProfile(userId, {
        full_name: draftName,
        phone: draftPhone || undefined,
        avatar_url: finalAvatarUrl || undefined,
      });
      await updateStudent(studentId, {
        major: draftMajor || undefined,
        graduation_year: draftGradYear ? Number(draftGradYear) : undefined,
        bio: draftBio || undefined,
        // Explicit nulls, unlike the fields above: clearing a school has to
        // actually clear it, not fall back to the stored value.
        school_id: draftSchool.id,
        school_name: draftSchool.name || null,
        school_state: draftSchool.state,
      });
      setFullName(draftName);
      setBio(draftBio);
      setMajor(draftMajor);
      setSchool(draftSchool);
      setGraduationYear(draftGradYear);
      setPhone(draftPhone);
      setEditingHero(false);
      showSaved();
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSavingHero(false);
    }
  }

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

  const filteredMajors = MAJORS.filter((m) => m.toLowerCase().includes(draftMajorSearch.toLowerCase()));

  // ---- Skills handlers ----
  const existingSkillNames = skills.map((s) => s.name.toLowerCase());
  const skillQuery = debouncedSkillSearch.toLowerCase().trim();
  // Rank matches by relevance (prefix > word-start > substring), not alphabetically,
  // so a broad query like "eng" surfaces "Engineering" instead of the first 20 A–C hits.
  // With no query the full catalog is browsable — students shouldn't have to
  // guess a search term to discover what's on offer. Results stay uncapped and
  // the dropdown scrolls.
  const filteredSkills = skillQuery === ''
    ? skillCatalog.filter((s) => !existingSkillNames.includes(s.toLowerCase()))
    : skillCatalog
      .reduce<{ name: string; score: number }[]>((acc, s) => {
        const lower = s.toLowerCase();
        if (existingSkillNames.includes(lower)) return acc;
        const idx = lower.indexOf(skillQuery);
        if (idx === -1) return acc;
        const score = idx === 0 ? 0 : lower[idx - 1] === ' ' ? 1 : 2;
        acc.push({ name: s, score });
        return acc;
      }, [])
      .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
      .map((x) => x.name);

  async function handleAddSkill(name: string) {
    // Only skills chosen from the catalog can be added — no custom entries, to keep matching consistent.
    try {
      const newSkill = await addStudentSkill(studentId, name);
      setSkills((prev) => [...prev, newSkill].sort((a, b) => a.name.localeCompare(b.name)));
      setSkillSearch('');
      setShowSkillDropdown(false);
    } catch { /* ignore */ }
  }

  async function handleRemoveSkill(skillId: string) {
    try {
      await removeStudentSkill(skillId);
      setSkills((prev) => prev.filter((s) => s.id !== skillId));
    } catch { /* ignore */ }
  }

  // ---- Resume handlers ----
  async function handleUploadResume(e: React.FormEvent) {
    e.preventDefault();
    if (!resumeFile || !resumeName.trim()) return;
    setUploadingResume(true);
    try {
      const newResume = await uploadResume(studentId, resumeFile, resumeName.trim());
      setResumes((prev) => [newResume, ...prev]);
      setResumeName('');
      setResumeFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showSaved();
    } catch (err) { console.error(err); }
    finally { setUploadingResume(false); }
  }

  async function handleDeleteResume(resumeId: string) {
    try {
      await deleteResume(resumeId);
      setResumes((prev) => prev.filter((r) => r.id !== resumeId));
    } catch { /* ignore */ }
  }

  // ---- Certification handlers ----
  async function handleUploadCertification(e: React.FormEvent) {
    e.preventDefault();
    if (!certFile || !certName.trim() || !certNumber.trim()) return;
    setUploadingCert(true);
    setCertError('');
    try {
      const newCert = await uploadCertification(studentId, certFile, certName.trim(), certNumber.trim());
      setCertifications((prev) => [newCert, ...prev]);
      setCertName('');
      setCertNumber('');
      setCertFile(null);
      if (certFileInputRef.current) certFileInputRef.current.value = '';
      showSaved();
    } catch (err) {
      setCertError(errorMessage(err, 'Uploading the certification failed. Please try again.'));
    } finally {
      setUploadingCert(false);
    }
  }

  function handleCertFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    // Catch a non-PDF at pick time rather than after the student has filled in
    // the rest of the form and hit Upload.
    if (file && !(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      setCertError('Certifications must be a PDF file.');
      setCertFile(null);
      if (certFileInputRef.current) certFileInputRef.current.value = '';
      return;
    }
    setCertError('');
    setCertFile(file);
  }

  async function handleDeleteCertification(certId: string) {
    try {
      await deleteCertification(certId);
      setCertifications((prev) => prev.filter((c) => c.id !== certId));
    } catch (err) {
      setCertError(errorMessage(err, 'Removing the certification failed. Please try again.'));
    }
  }

  // Save failures used to disappear into console.error, so a rejected insert
  // looked identical to a successful one minus the row. Every handler below
  // surfaces the message instead.
  function errorMessage(err: unknown, fallback: string) {
    if (err && typeof err === 'object' && 'message' in err) {
      const m = (err as { message?: unknown }).message;
      if (typeof m === 'string' && m.trim()) return m;
    }
    return fallback;
  }

  // ---- Experience handlers ----
  function getExpSetter(type: string): React.Dispatch<React.SetStateAction<Experience[]>> {
    if (type === 'internship') return setInternships;
    if (type === 'work') return setJobs;
    return setProjects;
  }

  function openExpForm(type: string, existing?: Experience) {
    setExpError('');
    if (existing) { setEditingExpId(existing.id); setExpForm({ ...existing }); }
    else { setEditingExpId(null); setExpForm({ type }); }
    setShowExpForm((prev) => ({ ...prev, [type]: true }));
  }

  function closeExpForm(type: string) {
    setShowExpForm((prev) => ({ ...prev, [type]: false }));
    setEditingExpId(null);
    setExpForm({});
    setExpError('');
  }

  async function handleSaveExperience(type: string) {
    const setter = getExpSetter(type);
    // Whitelist the columns rather than spreading the row and stripping keys —
    // a spread quietly carries along anything the table gains later.
    const fields = {
      title: expForm.title || '',
      organization: expForm.organization,
      location: expForm.location,
      description: expForm.description,
      technologies: expForm.technologies,
      link: expForm.link,
      start_date: expForm.start_date,
      end_date: expForm.is_current ? null : expForm.end_date,
      is_current: expForm.is_current ?? false,
    };
    setExpError('');
    try {
      if (editingExpId) {
        const updated = await updateStudentExperience(editingExpId, fields);
        setter((prev) => prev.map((e) => (e.id === editingExpId ? updated : e)));
      } else {
        const newExp = await addStudentExperience(studentId, {
          type,
          ...fields,
          end_date: fields.end_date ?? undefined,
        });
        setter((prev) => [newExp, ...prev]);
      }
      closeExpForm(type);
      showSaved();
    } catch (err) {
      setExpError(errorMessage(err, 'Could not save. Please try again.'));
    }
  }

  async function handleDeleteExperience(type: string, id: string) {
    const setter = getExpSetter(type);
    try {
      await deleteStudentExperience(id);
      setter((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setExpError(errorMessage(err, 'Could not delete that entry.'));
    }
  }

  // ---- Organization handlers ----
  // Current memberships first, then most recently joined.
  function sortOrgs(list: Org[]) {
    return [...list].sort((a, b) => {
      if (!!a.is_current !== !!b.is_current) return a.is_current ? -1 : 1;
      return (b.join_date || '').localeCompare(a.join_date || '');
    });
  }

  function openOrgForm(existing?: Org) {
    setOrgError('');
    if (existing) { setEditingOrgId(existing.id); setOrgForm({ ...existing }); }
    else { setEditingOrgId(null); setOrgForm({ type: 'club', is_current: true }); }
    setShowOrgForm(true);
  }

  function closeOrgForm() {
    setShowOrgForm(false);
    setEditingOrgId(null);
    setOrgForm({});
    setOrgError('');
  }

  async function handleSaveOrganization() {
    const type = orgForm.type || 'club';
    const fields = {
      type,
      name: orgForm.name?.trim() || '',
      // Chapter only means anything for Greek life; don't carry a stale value
      // over if the student switches the type after typing one.
      chapter: type === 'greek_life' ? orgForm.chapter : undefined,
      role: orgForm.role,
      description: orgForm.description,
      join_date: orgForm.join_date,
      end_date: orgForm.is_current ? null : orgForm.end_date,
      is_current: orgForm.is_current ?? false,
    };
    setOrgError('');
    try {
      if (editingOrgId) {
        const updated = await updateStudentOrganization(editingOrgId, fields);
        setOrgs((prev) => sortOrgs(prev.map((o) => (o.id === editingOrgId ? updated : o))));
      } else {
        const newOrg = await addStudentOrganization(studentId, fields);
        setOrgs((prev) => sortOrgs([newOrg, ...prev]));
      }
      closeOrgForm();
      showSaved();
    } catch (err) {
      setOrgError(errorMessage(err, 'Could not save. Please try again.'));
    }
  }

  async function handleDeleteOrganization(id: string) {
    try {
      await deleteStudentOrganization(id);
      setOrgs((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      setOrgError(errorMessage(err, 'Could not delete that organization.'));
    }
  }

  // ---- Shared styles ----
  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '20px 24px',
  };

  const cardHeader: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: '0.95rem',
    fontWeight: 700,
    margin: 0,
    color: 'var(--text)',
  };

  const subLabel: React.CSSProperties = {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    margin: '0 0 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1.5px solid var(--border)',
    fontSize: '0.85rem',
    background: 'var(--bg)',
    color: 'var(--text)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const smallBtnStyle: React.CSSProperties = {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
  };

  const addBtnStyle: React.CSSProperties = {
    padding: '4px 10px',
    fontSize: '0.78rem',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    background: 'var(--surface)',
    cursor: 'pointer',
    color: 'var(--primary)',
    fontWeight: 500,
  };

  const inlineFormStyle: React.CSSProperties = {
    padding: '16px',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    marginBottom: '12px',
    background: 'var(--bg)',
  };

  if (loading) {
    return (
      <div className="dash-main" style={{ padding: '24px', maxWidth: '1060px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  const hasExperience = internships.length > 0 || jobs.length > 0 || projects.length > 0;
  const certFormReady = Boolean(certFile) && certName.trim() !== '' && certNumber.trim() !== '';
  const displayAvatar = avatarPreview || avatarUrl;

  const emptyText = (text: string) => (
    <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontStyle: 'italic' }}>{text}</span>
  );

  const errorBanner = (msg: string) => (
    <div style={{
      padding: '8px 12px', borderRadius: '8px', marginBottom: '10px',
      background: 'var(--danger-bg)', color: 'var(--danger-fg)',
      border: '1px solid var(--danger-border)', fontSize: '0.8rem',
    }}>{msg}</div>
  );

  // "Jan 2025 — Present" / "Jan 2025 — May 2026" / "" when no dates are set.
  function dateRange(start?: string, end?: string, current?: boolean) {
    const from = formatDate(start);
    const to = current ? 'Present' : formatDate(end);
    if (!from && !to) return '';
    if (!from) return to;
    return `${from} — ${to || 'Present'}`;
  }

  // ---- Experience inline form (reusable) ----
  function renderExpForm(type: string, fields: { showOrg?: boolean; showLoc?: boolean; showTech?: boolean; showLink?: boolean; showDates?: boolean; titleLabel?: string; orgLabel?: string }) {
    const { showOrg = true, showLoc = false, showTech = false, showLink = false, showDates = true, titleLabel = 'Title *', orgLabel = 'Company' } = fields;
    return (
      <div style={inlineFormStyle}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{titleLabel}</label>
          <input style={inputStyle} type="text" value={expForm.title || ''} onChange={(e) => setExpForm({ ...expForm, title: e.target.value })} />
        </div>
        {showOrg && (
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>{orgLabel}</label>
            <input style={inputStyle} type="text" value={expForm.organization || ''} onChange={(e) => setExpForm({ ...expForm, organization: e.target.value })} />
          </div>
        )}
        {showLoc && (
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Location</label>
            <input style={inputStyle} type="text" value={expForm.location || ''} onChange={(e) => setExpForm({ ...expForm, location: e.target.value })} />
          </div>
        )}
        {showDates && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Start</label>
              <input style={inputStyle} type="month" value={expForm.start_date?.slice(0, 7) || ''} onChange={(e) => setExpForm({ ...expForm, start_date: e.target.value ? e.target.value + '-01' : '' })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>End</label>
              <input style={inputStyle} type="month" value={expForm.end_date?.slice(0, 7) || ''} onChange={(e) => setExpForm({ ...expForm, end_date: e.target.value ? e.target.value + '-01' : '' })} disabled={expForm.is_current} />
            </div>
          </div>
        )}
        {showDates && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', marginBottom: '10px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={expForm.is_current || false} onChange={(e) => setExpForm({ ...expForm, is_current: e.target.checked, end_date: e.target.checked ? undefined : expForm.end_date })} />
            Current
          </label>
        )}
        {showTech && (
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Technologies</label>
            <input style={inputStyle} type="text" value={expForm.technologies || ''} onChange={(e) => setExpForm({ ...expForm, technologies: e.target.value })} placeholder="React, Node.js, etc." />
          </div>
        )}
        {showLink && (
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Link</label>
            <input style={inputStyle} type="url" value={expForm.link || ''} onChange={(e) => setExpForm({ ...expForm, link: e.target.value })} />
          </div>
        )}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Description</label>
          <textarea rows={2} value={expForm.description || ''} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} style={{ ...inputStyle, resize: 'vertical' as const }} />
        </div>
        {expError && errorBanner(expError)}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button type="button" onClick={() => handleSaveExperience(type)} disabled={!expForm.title?.trim()} style={{ ...addBtnStyle, background: 'var(--primary)', color: 'var(--on-primary)', border: '1px solid var(--primary)', opacity: expForm.title?.trim() ? 1 : 0.5 }}>
            {editingExpId ? 'Update' : 'Save'}
          </button>
          <button type="button" onClick={() => closeExpForm(type)} style={smallBtnStyle}>Cancel</button>
        </div>
      </div>
    );
  }

  // ---- Org inline form ----
  function renderOrgForm() {
    const type = orgForm.type || 'club';
    return (
      <div style={inlineFormStyle}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Type</label>
          <select style={inputStyle} value={type} onChange={(e) => setOrgForm({ ...orgForm, type: e.target.value })}>
            {ORG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            {type === 'greek_life' ? 'Organization *' : 'Name *'}
          </label>
          <input style={inputStyle} type="text" value={orgForm.name || ''} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} placeholder={type === 'greek_life' ? 'e.g. Sigma Chi' : 'e.g. Finance Club'} />
        </div>
        {type === 'greek_life' && (
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Chapter</label>
            <input style={inputStyle} type="text" value={orgForm.chapter || ''} onChange={(e) => setOrgForm({ ...orgForm, chapter: e.target.value })} />
          </div>
        )}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Role</label>
          <input style={inputStyle} type="text" value={orgForm.role || ''} onChange={(e) => setOrgForm({ ...orgForm, role: e.target.value })} placeholder="e.g. Treasurer, Member" />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Joined</label>
            <input style={inputStyle} type="month" value={orgForm.join_date?.slice(0, 7) || ''} onChange={(e) => setOrgForm({ ...orgForm, join_date: e.target.value ? e.target.value + '-01' : '' })} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>End</label>
            <input
              style={{ ...inputStyle, opacity: orgForm.is_current ? 0.5 : 1 }}
              type="month"
              value={orgForm.end_date?.slice(0, 7) || ''}
              onChange={(e) => setOrgForm({ ...orgForm, end_date: e.target.value ? e.target.value + '-01' : '' })}
              disabled={orgForm.is_current}
            />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', marginBottom: '10px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={orgForm.is_current ?? false}
            onChange={(e) => setOrgForm({ ...orgForm, is_current: e.target.checked, end_date: e.target.checked ? undefined : orgForm.end_date })}
          />
          I&apos;m still a member
        </label>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Description</label>
          <textarea rows={2} value={orgForm.description || ''} onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })} style={{ ...inputStyle, resize: 'vertical' as const }} placeholder="What you do there..." />
        </div>
        {orgError && errorBanner(orgError)}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button type="button" onClick={handleSaveOrganization} disabled={!orgForm.name?.trim()} style={{ ...addBtnStyle, background: 'var(--primary)', color: 'var(--on-primary)', border: '1px solid var(--primary)', opacity: orgForm.name?.trim() ? 1 : 0.5 }}>
            {editingOrgId ? 'Update' : 'Save'}
          </button>
          <button type="button" onClick={closeOrgForm} style={smallBtnStyle}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-main" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>My Profile</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {saveMsg && (
            <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 500, animation: 'fadeIn 0.2s' }}>{saveMsg}</span>
          )}
          <Link
            href="/dashboard/student"
            style={{
              fontSize: '0.82rem',
              padding: '7px 14px',
              textDecoration: 'none',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontWeight: 500,
            }}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ maxWidth: '1060px', margin: '0 auto' }}>

          {/* Hero card */}
          <div style={{ ...cardStyle, marginBottom: '16px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            {/* Avatar */}
            <div style={{ flexShrink: 0, position: 'relative' }}>
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={fullName}
                  style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--border)' }}
                />
              ) : (
                <div style={{
                  width: 88, height: 88, borderRadius: '50%', background: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--on-primary)', fontSize: '1.8rem', fontWeight: 700,
                }}>
                  {fullName ? fullName.charAt(0).toUpperCase() : '?'}
                </div>
              )}
              {editingHero && (
                <>
                  <input type="file" ref={avatarInputRef} accept="image/*" onChange={handleAvatarFileChange} style={{ display: 'none' }} />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    style={{
                      position: 'absolute', bottom: -2, right: -2,
                      background: 'var(--primary)', border: '2px solid var(--surface)', borderRadius: '50%',
                      width: 28, height: 28, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--on-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                {editingHero ? (
                  <input
                    style={{ ...inputStyle, fontSize: '1.2rem', fontWeight: 700, padding: '6px 10px', maxWidth: '320px' }}
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Full Name"
                  />
                ) : (
                  <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{fullName || 'Student'}</h1>
                )}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {editingHero ? (
                    <>
                      <button
                        type="button"
                        onClick={saveHero}
                        disabled={savingHero}
                        style={{ ...addBtnStyle, background: 'var(--primary)', color: 'var(--on-primary)', border: '1px solid var(--primary)' }}
                      >
                        {savingHero ? 'Saving...' : 'Save'}
                      </button>
                      <button type="button" onClick={() => { setEditingHero(false); setAvatarPreview(null); setAvatarFile(null); }} style={smallBtnStyle}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <EditBtn onClick={startEditHero} editing={false} />
                  )}
                </div>
              </div>

              {editingHero ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>School</label>
                    <SchoolPicker
                      id="profile-school"
                      value={draftSchool}
                      onChange={setDraftSchool}
                      inputStyle={inputStyle}
                      placeholder="Search your college or university..."
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1, position: 'relative' }} ref={majorDropdownRef}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Major</label>
                      <input
                        style={inputStyle}
                        value={draftMajorSearch}
                        onChange={(e) => { setDraftMajorSearch(e.target.value); setShowMajorDropdown(true); }}
                        onFocus={() => setShowMajorDropdown(true)}
                        placeholder="Search majors..."
                        autoComplete="off"
                      />
                      {showMajorDropdown && filteredMajors.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '180px',
                          overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: '8px', zIndex: 10, boxShadow: 'var(--shadow-md)',
                        }}>
                          {filteredMajors.slice(0, 20).map((m) => (
                            <div
                              key={m}
                              onClick={() => { setDraftMajor(m); setDraftMajorSearch(m); setShowMajorDropdown(false); }}
                              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem', background: m === draftMajor ? 'var(--primary-light)' : 'transparent' }}
                              onMouseEnter={(e) => { if (m !== draftMajor) e.currentTarget.style.background = 'var(--bg)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = m === draftMajor ? 'var(--primary-light)' : 'transparent'; }}
                            >{m}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ width: '120px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Grad Year</label>
                      <input style={inputStyle} type="number" min={2020} max={2035} value={draftGradYear} onChange={(e) => setDraftGradYear(e.target.value ? parseInt(e.target.value) : '')} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Phone</label>
                    <input style={{ ...inputStyle, maxWidth: '220px' }} type="text" value={draftPhone} onChange={(e) => setDraftPhone(e.target.value)} placeholder="(555) 123-4567" />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Bio</label>
                    <textarea rows={3} value={draftBio} onChange={(e) => setDraftBio(e.target.value)} style={{ ...inputStyle, resize: 'vertical' as const }} placeholder="Tell employers about yourself..." />
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: bio ? '10px' : 0 }}>
                    {school.name && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                        {school.name}
                      </span>
                    )}
                    {major && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                        {major}
                      </span>
                    )}
                    {graduationYear && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Class of {graduationYear}
                      </span>
                    )}
                  </div>
                  {bio && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>{bio}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Two-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Skills */}
              <div style={cardStyle}>
                <div style={cardHeader}>
                  <h3 style={sectionTitle}>
                    Skills{' '}
                    <span style={{ fontWeight: 400, fontSize: '0.8rem', color: skills.length >= MAX_STUDENT_SKILLS ? 'var(--primary)' : 'var(--text-secondary)' }}>
                      ({skills.length}/{MAX_STUDENT_SKILLS})
                    </span>
                  </h3>
                  <EditBtn onClick={() => { setEditingSkills(!editingSkills); setSkillSearch(''); }} editing={editingSkills} />
                </div>
                {skills.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {skills.map((s) => (
                      <span key={s.id} style={{
                        padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem',
                        background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 500,
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                      }}>
                        {s.name}
                        {editingSkills && (
                          <button onClick={() => handleRemoveSkill(s.id)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            color: 'var(--primary)', lineHeight: 1, display: 'flex', opacity: 0.6,
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                ) : emptyText('No skills added yet.')}
                {editingSkills && skills.length >= MAX_STUDENT_SKILLS && (
                  <p style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    You&apos;ve reached the {MAX_STUDENT_SKILLS}-skill limit. Remove a skill to add a different one.
                  </p>
                )}
                {editingSkills && skills.length < MAX_STUDENT_SKILLS && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ position: 'relative', marginBottom: '8px' }} ref={skillDropdownRef}>
                      <input
                        style={inputStyle}
                        type="text"
                        placeholder="Browse or search skills..."
                        value={skillSearch}
                        onChange={(e) => { setSkillSearch(e.target.value); setShowSkillDropdown(true); }}
                        onFocus={() => setShowSkillDropdown(true)}
                        autoComplete="off"
                      />
                      {showSkillDropdown && filteredSkills.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '240px',
                          overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: '8px', zIndex: 10, boxShadow: 'var(--shadow-md)',
                        }}>
                          {filteredSkills.map((s) => (
                            <div key={s} onClick={() => handleAddSkill(s)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            >{s}</div>
                          ))}
                        </div>
                      )}
                      {showSkillDropdown && filteredSkills.length === 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0,
                          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px',
                          zIndex: 10, boxShadow: 'var(--shadow-md)', padding: '8px 12px',
                          fontSize: '0.78rem', color: 'var(--text-secondary)',
                        }}>
                          {skillCatalog.length === 0 ? 'Loading skills…' : 'No matching skill in our list.'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Resume */}
              <div style={cardStyle}>
                <div style={cardHeader}>
                  <h3 style={sectionTitle}>Resume</h3>
                  <EditBtn onClick={() => setEditingResume(!editingResume)} editing={editingResume} />
                </div>
                {resumes.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {resumes.map((r) => (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <a href={`/api/files/resume/${r.id}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, color: 'var(--primary)', fontWeight: 500, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.name}
                        </a>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', flexShrink: 0 }}>
                          {new Date(r.uploaded_at).toLocaleDateString()}
                        </span>
                        {editingResume && (
                          <button onClick={() => handleDeleteResume(r.id)} style={{ ...smallBtnStyle, border: '1px solid var(--danger-border)', color: 'var(--danger-accent)', padding: '3px 8px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : emptyText('No resumes uploaded yet.')}
                {editingResume && (
                  <form onSubmit={handleUploadResume} style={{ marginTop: '12px', padding: '14px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg)' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Display Name</label>
                      <input style={inputStyle} type="text" placeholder="e.g. Fall 2026 Resume" required value={resumeName} onChange={(e) => setResumeName(e.target.value)} />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>File</label>
                      <input type="file" accept=".pdf,.doc,.docx" ref={fileInputRef} onChange={(e) => setResumeFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: resumeFile ? '1.5px solid var(--accent)' : '1.5px dashed var(--border)',
                          background: resumeFile ? 'var(--accent-light)' : 'var(--surface)',
                          color: resumeFile ? 'var(--accent-dark)' : 'var(--text-secondary)',
                          fontSize: '0.82rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          width: '100%',
                          justifyContent: 'center',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        {resumeFile ? resumeFile.name : 'Choose a PDF, DOC, or DOCX file'}
                      </button>
                    </div>
                    <button type="submit" disabled={uploadingResume || !resumeFile || !resumeName.trim()} style={{ ...addBtnStyle, background: resumeFile && resumeName.trim() ? 'var(--primary)' : 'var(--border)', color: resumeFile && resumeName.trim() ? 'var(--on-primary)' : 'var(--text-secondary)', border: '1px solid ' + (resumeFile && resumeName.trim() ? 'var(--primary)' : 'var(--border)'), cursor: resumeFile && resumeName.trim() ? 'pointer' : 'not-allowed' }}>
                      {uploadingResume ? 'Uploading...' : 'Upload Resume'}
                    </button>
                  </form>
                )}
              </div>

              {/* Certifications — a PDF of the credential plus the number an
                  employer can verify it by (Six Sigma belts, OSHA, CPR, …) */}
              <div style={cardStyle}>
                <div style={cardHeader}>
                  <h3 style={sectionTitle}>Certifications</h3>
                  <EditBtn onClick={() => { setEditingCerts(!editingCerts); if (editingCerts) setCertError(''); }} editing={editingCerts} />
                </div>
                {certError && errorBanner(certError)}
                {certifications.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {certifications.map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                        </svg>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <a href={`/api/files/certification/${c.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 500, fontSize: '0.85rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </a>
                          {c.certification_number && (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                              Certification No. {c.certification_number}
                            </span>
                          )}
                        </div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', flexShrink: 0 }}>
                          {new Date(c.uploaded_at).toLocaleDateString()}
                        </span>
                        {editingCerts && (
                          <button onClick={() => handleDeleteCertification(c.id)} style={{ ...smallBtnStyle, border: '1px solid var(--danger-border)', color: 'var(--danger-accent)', padding: '3px 8px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : emptyText('No certifications uploaded yet.')}
                {editingCerts && (
                  <form onSubmit={handleUploadCertification} style={{ marginTop: '12px', padding: '14px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg)' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Certification Name</label>
                      <input style={inputStyle} type="text" placeholder="e.g. Lean Six Sigma Green Belt" required value={certName} onChange={(e) => setCertName(e.target.value)} />
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Certification Number</label>
                      <input style={inputStyle} type="text" placeholder="As printed on the certificate" required value={certNumber} onChange={(e) => setCertNumber(e.target.value)} />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>File (PDF)</label>
                      <input type="file" accept="application/pdf,.pdf" ref={certFileInputRef} onChange={handleCertFileChange} style={{ display: 'none' }} />
                      <button
                        type="button"
                        onClick={() => certFileInputRef.current?.click()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: certFile ? '1.5px solid var(--accent)' : '1.5px dashed var(--border)',
                          background: certFile ? 'var(--accent-light)' : 'var(--surface)',
                          color: certFile ? 'var(--accent-dark)' : 'var(--text-secondary)',
                          fontSize: '0.82rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          width: '100%',
                          justifyContent: 'center',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        {certFile ? certFile.name : 'Choose a PDF file'}
                      </button>
                    </div>
                    <button type="submit" disabled={uploadingCert || !certFormReady} style={{ ...addBtnStyle, background: certFormReady ? 'var(--primary)' : 'var(--border)', color: certFormReady ? 'var(--on-primary)' : 'var(--text-secondary)', border: '1px solid ' + (certFormReady ? 'var(--primary)' : 'var(--border)'), cursor: certFormReady ? 'pointer' : 'not-allowed' }}>
                      {uploadingCert ? 'Uploading...' : 'Upload Certification'}
                    </button>
                  </form>
                )}
              </div>

              {/* Organizations — Greek life, clubs, and campus involvement in one place */}
              <div style={cardStyle}>
                <div style={cardHeader}>
                  <h3 style={sectionTitle}>Organizations</h3>
                  <EditBtn onClick={() => { setEditingOrgs(!editingOrgs); if (editingOrgs) closeOrgForm(); }} editing={editingOrgs} />
                </div>

                {editingOrgs && !showOrgForm && (
                  <button type="button" onClick={() => openOrgForm()} style={{ ...addBtnStyle, marginBottom: '10px' }}>+ Add organization</button>
                )}
                {showOrgForm && renderOrgForm()}
                {orgError && !showOrgForm && errorBanner(orgError)}

                {orgs.length > 0 ? (
                  orgs.map((org) => (
                    <div key={org.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{org.name}{org.chapter ? ` — ${org.chapter}` : ''}</span>
                          <span style={{
                            padding: '1px 7px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600,
                            background: 'var(--primary-light)', color: 'var(--primary)',
                          }}>{ORG_TYPE_LABELS[org.type] ?? org.type}</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                          {org.role && `${org.role}`}
                          {org.role && dateRange(org.join_date, org.end_date, org.is_current) && ' · '}
                          {dateRange(org.join_date, org.end_date, org.is_current)}
                        </div>
                        {org.description && <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{org.description}</p>}
                      </div>
                      {editingOrgs && (
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button type="button" onClick={() => openOrgForm(org)} style={smallBtnStyle}>Edit</button>
                          <button type="button" onClick={() => handleDeleteOrganization(org.id)} style={{ ...smallBtnStyle, border: '1px solid var(--danger-border)', color: 'var(--danger-accent)' }}>Del</button>
                        </div>
                      )}
                    </div>
                  ))
                ) : !showOrgForm && emptyText('No organizations added — clubs, Greek life, and anything else you’re involved in on campus.')}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Experience */}
              <div style={cardStyle}>
                <div style={cardHeader}>
                  <h3 style={sectionTitle}>Experience</h3>
                  <EditBtn onClick={() => setEditingExp(!editingExp)} editing={editingExp} />
                </div>

                {(hasExperience || editingExp) ? (
                  <div>
                    {/* Internships */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={subLabel}>
                        <span>Internships</span>
                        {editingExp && !showExpForm.internship && (
                          <button type="button" onClick={() => openExpForm('internship')} style={addBtnStyle}>+ Add</button>
                        )}
                      </div>
                      {showExpForm.internship && renderExpForm('internship', { showOrg: true, showLoc: true, orgLabel: 'Company' })}
                      {internships.map((exp) => (
                        <div key={exp.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{exp.title}</div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {formatDate(exp.start_date)} — {exp.is_current ? 'Present' : formatDate(exp.end_date)}
                              </div>
                            </div>
                            {exp.organization && <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{exp.organization}{exp.location ? ` · ${exp.location}` : ''}</div>}
                            {exp.description && <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{exp.description}</p>}
                          </div>
                          {editingExp && (
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginTop: '2px' }}>
                              <button type="button" onClick={() => openExpForm('internship', exp)} style={smallBtnStyle}>Edit</button>
                              <button type="button" onClick={() => handleDeleteExperience('internship', exp.id)} style={{ ...smallBtnStyle, border: '1px solid var(--danger-border)', color: 'var(--danger-accent)' }}>Del</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {internships.length === 0 && !showExpForm.internship && emptyText('None added.')}
                    </div>

                    {/* Jobs — part-time and full-time work that isn't an internship */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={subLabel}>
                        <span>Jobs</span>
                        {editingExp && !showExpForm.work && (
                          <button type="button" onClick={() => openExpForm('work')} style={addBtnStyle}>+ Add</button>
                        )}
                      </div>
                      {showExpForm.work && renderExpForm('work', { showOrg: true, showLoc: true, orgLabel: 'Employer', titleLabel: 'Job Title *' })}
                      {jobs.map((exp) => (
                        <div key={exp.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{exp.title}</div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {dateRange(exp.start_date, exp.end_date, exp.is_current)}
                              </div>
                            </div>
                            {exp.organization && <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{exp.organization}{exp.location ? ` · ${exp.location}` : ''}</div>}
                            {exp.description && <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{exp.description}</p>}
                          </div>
                          {editingExp && (
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginTop: '2px' }}>
                              <button type="button" onClick={() => openExpForm('work', exp)} style={smallBtnStyle}>Edit</button>
                              <button type="button" onClick={() => handleDeleteExperience('work', exp.id)} style={{ ...smallBtnStyle, border: '1px solid var(--danger-border)', color: 'var(--danger-accent)' }}>Del</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {jobs.length === 0 && !showExpForm.work && emptyText('None added.')}
                    </div>

                    {/* Projects */}
                    <div>
                      <div style={subLabel}>
                        <span>Projects</span>
                        {editingExp && !showExpForm.project && (
                          <button type="button" onClick={() => openExpForm('project')} style={addBtnStyle}>+ Add</button>
                        )}
                      </div>
                      {showExpForm.project && renderExpForm('project', { showOrg: false, showTech: true, showLink: true, showDates: false, titleLabel: 'Project Name *' })}
                      {projects.map((exp) => (
                        <div key={exp.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{exp.title}</div>
                            {exp.technologies && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                {exp.technologies.split(',').map((t, i) => (
                                  <span key={i} style={{
                                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem',
                                    background: 'var(--accent-light)', color: 'var(--accent-dark)', fontWeight: 500,
                                  }}>{t.trim()}</span>
                                ))}
                              </div>
                            )}
                            {exp.description && <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{exp.description}</p>}
                            {exp.link && <a href={exp.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 500, marginTop: '2px', display: 'inline-block' }}>{exp.link}</a>}
                          </div>
                          {editingExp && (
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginTop: '2px' }}>
                              <button type="button" onClick={() => openExpForm('project', exp)} style={smallBtnStyle}>Edit</button>
                              <button type="button" onClick={() => handleDeleteExperience('project', exp.id)} style={{ ...smallBtnStyle, border: '1px solid var(--danger-border)', color: 'var(--danger-accent)' }}>Del</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {projects.length === 0 && !showExpForm.project && emptyText('None added.')}
                    </div>
                  </div>
                ) : emptyText('No experience added yet.')}
                {expError && !showExpForm.internship && !showExpForm.work && !showExpForm.project && errorBanner(expError)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
