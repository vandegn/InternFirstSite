'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, getProfile, getStudentByUserId, getPartnerUniversity, getStudentResumes } from '@/lib/supabase';

interface Resume {
  id: string;
  name: string;
  file_url: string;
  uploaded_at: string;
}

export default function StudentProfile() {
  const [loading, setLoading] = useState(true);

  // Profile data
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [major, setMajor] = useState('');
  const [graduationYear, setGraduationYear] = useState<number | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [resumes, setResumes] = useState<Resume[]>([]);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profile = await getProfile(user.id);
      if (profile) {
        setFullName(profile.full_name || '');
        setAvatarUrl(profile.avatar_url || '');
      }

      const student = await getStudentByUserId(user.id);
      if (student) {
        setMajor(student.major || '');
        setGraduationYear(student.graduation_year || null);
        setBio(student.bio || '');

        const studentResumes = await getStudentResumes(student.id);
        setResumes(studentResumes);
      }

      if (user.email) {
        const partner = await getPartnerUniversity(user.email);
        if (partner) {
          setSchoolName(partner.name);
        }
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  const sectionCard: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '28px 32px',
    marginBottom: '20px',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: '1.1rem',
    fontWeight: 600,
    marginBottom: '16px',
    color: 'var(--text-primary)',
  };

  const placeholderBox: React.CSSProperties = {
    border: '2px dashed var(--border)',
    borderRadius: '10px',
    padding: '24px',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
  };

  const subSectionTitle: React.CSSProperties = {
    fontSize: '0.95rem',
    fontWeight: 600,
    marginBottom: '8px',
    color: 'var(--text-primary)',
  };

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <Link href="/dashboard/student" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Dashboard
      </Link>

      {/* Header Card - Photo, Name, School, Major, Grad Year */}
      <div style={{ ...sectionCard, display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
        {/* Avatar */}
        <div style={{ flexShrink: 0 }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName}
              style={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--border)',
              }}
            />
          ) : (
            <div style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '2rem',
              fontWeight: 700,
            }}>
              {fullName ? fullName.charAt(0).toUpperCase() : '?'}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
              {fullName || 'Student'}
            </h1>
            <Link
              href="/dashboard/student/settings"
              className="btn-primary"
              style={{
                padding: '8px 20px',
                fontSize: '0.9rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit Profile
            </Link>
          </div>

          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {schoolName && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                {schoolName}
              </span>
            )}
            {major && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                {major}
              </span>
            )}
            {graduationYear && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Class of {graduationYear}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      <div style={sectionCard}>
        <h2 style={sectionTitle}>About</h2>
        {bio ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
            {bio}
          </p>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>
            No bio added yet. Tell employers about yourself in Settings.
          </p>
        )}
      </div>

      {/* Resume */}
      <div style={sectionCard}>
        <h2 style={sectionTitle}>Resume</h2>
        {resumes.length > 0 ? (
          <div>
            {resumes.map((r) => (
              <a
                key={r.id}
                href={r.file_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  textDecoration: 'none',
                  color: 'var(--primary)',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                {r.name}
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: 'auto' }}>
                  Uploaded {new Date(r.uploaded_at).toLocaleDateString()}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>
            No resumes uploaded yet. Upload one in{' '}
            <Link href="/dashboard/student/settings" style={{ color: 'var(--primary)' }}>Settings</Link>.
          </p>
        )}
      </div>

      {/* Elevator Pitch Video */}
      <div style={sectionCard}>
        <h2 style={sectionTitle}>Elevator Pitch Video</h2>
        <div style={placeholderBox}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', opacity: 0.5 }}>
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Record your 10-30 second elevator pitch
          </p>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>
            Stand out to recruiters with a short video introduction. Upload or record your pitch to make a strong first impression.
          </p>
          <div style={{
            marginTop: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            cursor: 'default',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Coming Soon
          </div>
        </div>
      </div>

      {/* Skills */}
      <div style={sectionCard}>
        <h2 style={sectionTitle}>Skills</h2>
        <div style={placeholderBox}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', opacity: 0.5 }}>
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
          <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Add your skills to improve job matching
          </p>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>
            List technical skills, tools, languages, and soft skills so recruiters can find you and you get better internship recommendations.
          </p>
          <div style={{
            marginTop: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            cursor: 'default',
          }}>
            Coming Soon
          </div>
        </div>
      </div>

      {/* Experience */}
      <div style={sectionCard}>
        <h2 style={sectionTitle}>Experience</h2>

        {/* Internships */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={subSectionTitle}>Internships</h3>
          <div style={placeholderBox}>
            <p style={{ margin: 0 }}>
              Add past or current internship experiences to showcase your professional background.
            </p>
            <div style={{
              marginTop: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              cursor: 'default',
            }}>
              Coming Soon
            </div>
          </div>
        </div>

        {/* Projects */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={subSectionTitle}>Projects</h3>
          <div style={placeholderBox}>
            <p style={{ margin: 0 }}>
              Highlight personal, academic, or open source projects you have worked on.
            </p>
            <div style={{
              marginTop: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              cursor: 'default',
            }}>
              Coming Soon
            </div>
          </div>
        </div>

        {/* Campus Involvement */}
        <div>
          <h3 style={subSectionTitle}>Campus Involvement</h3>
          <div style={placeholderBox}>
            <p style={{ margin: 0 }}>
              Share your involvement in student organizations, leadership roles, and campus activities.
            </p>
            <div style={{
              marginTop: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              cursor: 'default',
            }}>
              Coming Soon
            </div>
          </div>
        </div>
      </div>

      {/* Optional Attributes */}
      <div style={sectionCard}>
        <h2 style={sectionTitle}>Optional Attributes</h2>

        {/* Greek Life */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={subSectionTitle}>Greek Life</h3>
          <div style={placeholderBox}>
            <p style={{ margin: 0 }}>
              Add your fraternity or sorority affiliation if applicable.
            </p>
            <div style={{
              marginTop: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              cursor: 'default',
            }}>
              Coming Soon
            </div>
          </div>
        </div>

        {/* Clubs / Organizations */}
        <div>
          <h3 style={subSectionTitle}>Clubs / Organizations</h3>
          <div style={placeholderBox}>
            <p style={{ margin: 0 }}>
              List clubs, honor societies, or professional organizations you belong to.
            </p>
            <div style={{
              marginTop: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              cursor: 'default',
            }}>
              Coming Soon
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
