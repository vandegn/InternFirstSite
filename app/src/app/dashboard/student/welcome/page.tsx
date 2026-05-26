'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, getStudentByUserId, getStudentEeo, upsertStudentEeo, type StudentEeoData } from '@/lib/supabase';
import {
  ETHNICITY_OPTIONS,
  RACE_OPTIONS,
  GENDER_OPTIONS,
  VETERAN_OPTIONS,
  DISABILITY_OPTIONS,
  YES_NO_OPTIONS,
  VOLUNTARY_DISCLOSURE,
  DISABILITY_DISCLOSURE,
} from '@/lib/eeo';

export default function StudentWelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEdit = searchParams.get('from') === 'settings';

  const [studentId, setStudentId] = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Work auth (required, not protected category)
  const [workAuth, setWorkAuth] = useState<'yes' | 'no' | ''>('');
  const [needsSponsorship, setNeedsSponsorship] = useState<'yes' | 'no' | ''>('');

  // Voluntary self-id (every field is optional / declinable)
  const [ethnicity, setEthnicity] = useState<StudentEeoData['ethnicity_hispanic_latino']>(null);
  const [race, setRace] = useState<string[]>([]);
  const [raceDeclined, setRaceDeclined] = useState(false);
  const [gender, setGender] = useState<StudentEeoData['gender']>(null);
  const [genderSelfDescribe, setGenderSelfDescribe] = useState('');
  const [veteran, setVeteran] = useState<StudentEeoData['veteran_status']>(null);
  const [disability, setDisability] = useState<StudentEeoData['disability_status']>(null);

  useEffect(() => {
    async function loadStudent() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const student = await getStudentByUserId(user.id);
      if (!student) return;
      setStudentId(student.id);

      const existing = await getStudentEeo(student.id);
      if (existing) {
        setHasExisting(true);
        setWorkAuth(existing.work_authorized_us ?? '');
        setNeedsSponsorship(existing.requires_sponsorship ?? '');
        setEthnicity(existing.ethnicity_hispanic_latino);
        setRace(existing.race ?? []);
        setRaceDeclined(!!existing.race_declined);
        setGender(existing.gender);
        setGenderSelfDescribe(existing.gender_self_describe ?? '');
        setVeteran(existing.veteran_status);
        setDisability(existing.disability_status);
      }
    }
    loadStudent();
  }, []);

  function toggleRace(value: string) {
    if (raceDeclined) setRaceDeclined(false);
    setRace((prev) => (prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]));
  }

  function handleRaceDeclined() {
    setRaceDeclined(true);
    setRace([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!studentId) {
      setError('Could not load your profile. Please refresh and try again.');
      return;
    }
    if (!workAuth) {
      setError('Please answer the work authorization question.');
      return;
    }
    if (!needsSponsorship) {
      setError('Please answer the sponsorship question.');
      return;
    }

    setLoading(true);
    try {
      await upsertStudentEeo(studentId, {
        ethnicity_hispanic_latino: ethnicity ?? 'declined',
        race: raceDeclined ? [] : race,
        race_declined: raceDeclined || (race.length === 0),
        gender: gender ?? 'declined',
        gender_self_describe: gender === 'self_describe' ? genderSelfDescribe.trim() || null : null,
        veteran_status: veteran ?? 'declined',
        disability_status: disability ?? 'declined',
        work_authorized_us: workAuth,
        requires_sponsorship: needsSponsorship,
      });
      router.replace(isEdit ? '/dashboard/student/settings' : '/dashboard/student');
    } catch (err: any) {
      setError(err.message || 'Failed to save. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>
        {isEdit ? 'Equal Employment Information' : 'Welcome to InternFirst'}
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
        {isEdit
          ? 'Update your responses to the standard application questions. Your answers are private and not visible to employers.'
          : 'Before you start applying, please take a moment to fill in some standard application information. This way, you won’t have to re-enter it on every internship you apply to.'}
      </p>

      <div className="profile-card" style={{ padding: '20px 24px', marginBottom: '24px', background: 'var(--bg-light)', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
          {VOLUNTARY_DISCLOSURE}
        </p>
      </div>

      {error && (
        <div className="auth-error" style={{ display: 'block', marginBottom: '16px' }}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <Section title="Work Authorization" subtitle="Required by every employer.">
          <RadioGroup
            name="workAuth"
            label="Are you legally authorized to work in the United States?"
            options={[...YES_NO_OPTIONS]}
            value={workAuth}
            onChange={(v) => setWorkAuth(v as 'yes' | 'no')}
          />
          <RadioGroup
            name="sponsorship"
            label="Will you now or in the future require sponsorship for employment visa status?"
            options={[...YES_NO_OPTIONS]}
            value={needsSponsorship}
            onChange={(v) => setNeedsSponsorship(v as 'yes' | 'no')}
          />
        </Section>

        <Section title="Ethnicity" subtitle="Voluntary — you may decline.">
          <RadioGroup
            name="ethnicity"
            label="Are you Hispanic or Latino?"
            options={[...ETHNICITY_OPTIONS]}
            value={ethnicity ?? ''}
            onChange={(v) => setEthnicity(v as StudentEeoData['ethnicity_hispanic_latino'])}
          />
        </Section>

        <Section title="Race" subtitle="Voluntary — you may select all that apply or decline.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            {RACE_OPTIONS.map((opt) => (
              <label key={opt.value} style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={!raceDeclined && race.includes(opt.value)}
                  onChange={() => toggleRace(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
            <label style={checkboxLabelStyle}>
              <input type="checkbox" checked={raceDeclined} onChange={handleRaceDeclined} />
              <span>Decline to answer</span>
            </label>
          </div>
        </Section>

        <Section title="Gender" subtitle="Voluntary — you may decline.">
          <RadioGroup
            name="gender"
            label="How do you identify?"
            options={[...GENDER_OPTIONS]}
            value={gender ?? ''}
            onChange={(v) => setGender(v as StudentEeoData['gender'])}
          />
          {gender === 'self_describe' && (
            <input
              type="text"
              placeholder="Please describe"
              value={genderSelfDescribe}
              onChange={(e) => setGenderSelfDescribe(e.target.value)}
              style={{ marginTop: '8px', width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)' }}
            />
          )}
        </Section>

        <Section title="Veteran Status" subtitle="Voluntary — you may decline.">
          <RadioGroup
            name="veteran"
            label="Do you identify as a protected veteran?"
            options={[...VETERAN_OPTIONS]}
            value={veteran ?? ''}
            onChange={(v) => setVeteran(v as StudentEeoData['veteran_status'])}
          />
        </Section>

        <Section title="Disability Status" subtitle="Voluntary — you may decline.">
          <details style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Why are you being asked this? (Form CC-305)</summary>
            <p style={{ whiteSpace: 'pre-line', marginTop: '8px', lineHeight: 1.5 }}>{DISABILITY_DISCLOSURE}</p>
          </details>
          <RadioGroup
            name="disability"
            label="Do you have a disability, or have you ever had one?"
            options={[...DISABILITY_OPTIONS]}
            value={disability ?? ''}
            onChange={(v) => setDisability(v as StudentEeoData['disability_status'])}
          />
        </Section>

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ width: '100%', padding: '14px', fontSize: '1rem', marginTop: '8px' }}
        >
          {loading ? 'Saving...' : hasExisting ? 'Save Changes' : 'Continue to Dashboard'}
        </button>
      </form>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{title}</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 14px' }}>{subtitle}</p>
      {children}
    </div>
  );
}

function RadioGroup({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ fontSize: '0.92rem', fontWeight: 500, display: 'block', marginBottom: '8px' }}>{label}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {options.map((opt) => (
          <label key={opt.value} style={checkboxLabelStyle}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  cursor: 'pointer',
  fontSize: '0.9rem',
  lineHeight: 1.4,
  background: 'var(--bg)',
};
