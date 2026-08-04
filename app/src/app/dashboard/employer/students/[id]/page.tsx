'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getStudentProfileForEmployer } from '@/lib/supabase';
import Avatar from '@/components/Avatar';

type Experience = {
  id: string;
  type: string;
  title: string;
  organization: string | null;
  location: string | null;
  description: string | null;
  technologies: string | null;
  link: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
};

type Organization = {
  id: string;
  type: string;
  name: string;
  chapter: string | null;
  role: string | null;
  description: string | null;
  join_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
};

type Certification = {
  id: string;
  name: string;
  certification_number: string | null;
  file_url: string;
  uploaded_at: string;
};

type StudentProfile = {
  id: string;
  major: string | null;
  minor: string | null;
  school_name: string | null;
  school_state: string | null;
  graduation_year: number | null;
  gpa: number | null;
  bio: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  profile: { full_name: string; email: string; avatar_url: string | null } | null;
  skills: { id: string; name: string }[];
  experiences: Experience[];
  organizations: Organization[];
  certifications: Certification[];
};

const EXPERIENCE_LABELS: Record<string, string> = {
  internship: 'Internship',
  work: 'Work Experience',
  project: 'Project',
};

const ORGANIZATION_LABELS: Record<string, string> = {
  greek_life: 'Greek Life',
  club: 'Club',
  campus_involvement: 'Campus Involvement',
  other: 'Other',
};

function formatMonth(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function dateRange(start: string | null, end: string | null, isCurrent: boolean | null): string {
  const from = formatMonth(start);
  const to = isCurrent ? 'Present' : formatMonth(end);
  if (!from && !to) return '';
  if (!from) return to;
  if (!to) return from;
  return `${from} — ${to}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-base" style={{ padding: '24px', marginBottom: '16px' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>{title}</h3>
      {children}
    </div>
  );
}

export default function EmployerStudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getStudentProfileForEmployer(id);
      setStudent(data as unknown as StudentProfile);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="dash-main" style={{ padding: '32px', color: 'var(--text-secondary)' }}>
        Loading profile…
      </div>
    );
  }

  if (!student) {
    return (
      <div className="dash-main" style={{ padding: '32px' }}>
        <p style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '8px' }}>Profile unavailable</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
          This candidate&apos;s profile can&apos;t be shown. Employer accounts can only view
          students who have applied to one of their listings.
        </p>
        <button onClick={() => router.back()} className="btn-secondary" style={{ fontSize: '0.88rem', padding: '9px 18px' }}>
          Go back
        </button>
      </div>
    );
  }

  const name = student.profile?.full_name || 'Candidate';
  const experiences = student.experiences ?? [];
  const organizations = student.organizations ?? [];
  const skills = student.skills ?? [];
  const certifications = student.certifications ?? [];

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <button
        onClick={() => router.back()}
        className="btn-secondary"
        style={{ fontSize: '0.82rem', padding: '7px 14px', marginBottom: '20px' }}
      >
        ← Back
      </button>

      {/* Identity */}
      <div className="card-base" style={{ padding: '24px', marginBottom: '16px', display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Avatar src={student.profile?.avatar_url} name={name} size={80} />
        <div style={{ flex: 1, minWidth: '220px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{name}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
            {[student.school_name, student.major].filter(Boolean).join(' · ') || 'No school or major listed'}
            {student.graduation_year ? ` · Class of ${student.graduation_year}` : ''}
          </p>
          {student.minor && (
            <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginTop: '2px' }}>
              Minor in {student.minor}
            </p>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
            {student.profile?.email && (
              <a
                href={`mailto:${student.profile.email}`}
                style={{ fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'none' }}
              >
                {student.profile.email}
              </a>
            )}
            {student.linkedin_url && (
              <a href={student.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'none' }}>
                LinkedIn
              </a>
            )}
            {student.portfolio_url && (
              <a href={student.portfolio_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'none' }}>
                Portfolio
              </a>
            )}
          </div>
          <Link
            href="/dashboard/employer/inbox"
            className="btn-primary"
            style={{ display: 'inline-block', marginTop: '16px', fontSize: '0.85rem', padding: '9px 18px', textDecoration: 'none' }}
          >
            Message candidate
          </Link>
        </div>
      </div>

      {student.bio && (
        <Section title="About">
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{student.bio}</p>
        </Section>
      )}

      {skills.length > 0 && (
        <Section title="Skills">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {skills.map((s) => (
              <span
                key={s.id}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                }}
              >
                {s.name}
              </span>
            ))}
          </div>
        </Section>
      )}

      {experiences.length > 0 && (
        <Section title="Experience">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {experiences.map((exp) => (
              <div key={exp.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.92rem' }}>{exp.title}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {[exp.organization, exp.location].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: 'var(--chip-indigo-bg)',
                        color: 'var(--chip-indigo-ink)',
                      }}
                    >
                      {EXPERIENCE_LABELS[exp.type] ?? exp.type}
                    </span>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: '4px' }}>
                      {dateRange(exp.start_date, exp.end_date, exp.is_current)}
                    </p>
                  </div>
                </div>
                {exp.description && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
                    {exp.description}
                  </p>
                )}
                {exp.technologies && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: '4px' }}>
                    {exp.technologies}
                  </p>
                )}
                {exp.link && (
                  <a href={exp.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none' }}>
                    View project →
                  </a>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {certifications.length > 0 && (
        <Section title="Certifications">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {certifications.map((cert) => (
              <div
                key={cert.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cert.name}</p>
                  {cert.certification_number && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                      Certification No. {cert.certification_number}
                    </p>
                  )}
                </div>
                <a
                  href={cert.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', flexShrink: 0 }}
                >
                  View PDF →
                </a>
              </div>
            ))}
          </div>
        </Section>
      )}

      {organizations.length > 0 && (
        <Section title="Organizations & Involvement">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {organizations.map((org) => (
              <div key={org.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                      {org.name}
                      {org.chapter ? ` — ${org.chapter}` : ''}
                    </p>
                    {org.role && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{org.role}</p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: 'var(--chip-blue-bg)',
                        color: 'var(--chip-blue-ink)',
                      }}
                    >
                      {ORGANIZATION_LABELS[org.type] ?? org.type}
                    </span>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: '4px' }}>
                      {dateRange(org.join_date, org.end_date, org.is_current)}
                    </p>
                  </div>
                </div>
                {org.description && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
                    {org.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {skills.length === 0 && experiences.length === 0 && organizations.length === 0 && certifications.length === 0 && !student.bio && (
        <div className="card-base" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '0.92rem' }}>This candidate hasn&apos;t filled out their profile yet.</p>
        </div>
      )}
    </div>
  );
}
