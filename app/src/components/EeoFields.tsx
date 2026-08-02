'use client';

import {
  ETHNICITY_OPTIONS,
  RACE_OPTIONS,
  GENDER_OPTIONS,
  VETERAN_OPTIONS,
  DISABILITY_OPTIONS,
  YES_NO_OPTIONS,
  DISABILITY_DISCLOSURE,
} from '@/lib/eeo';
import type { StudentEeoData } from '@/lib/supabase';

// The standard federal self-identification set, rendered identically wherever
// it appears: the onboarding page, the settings editor, and the confirmation
// step of every application. It is defined here in code and never stored as
// employer-owned rows, which is what makes it impossible for an employer to
// remove a question from it — they can only add their own alongside it.

export type EeoValue = {
  workAuth: 'yes' | 'no' | '';
  needsSponsorship: 'yes' | 'no' | '';
  ethnicity: StudentEeoData['ethnicity_hispanic_latino'];
  race: string[];
  raceDeclined: boolean;
  gender: StudentEeoData['gender'];
  genderSelfDescribe: string;
  veteran: StudentEeoData['veteran_status'];
  disability: StudentEeoData['disability_status'];
};

export const EMPTY_EEO: EeoValue = {
  workAuth: '',
  needsSponsorship: '',
  ethnicity: null,
  race: [],
  raceDeclined: false,
  gender: null,
  genderSelfDescribe: '',
  veteran: null,
  disability: null,
};

/** Hydrate the form from a stored student_eeo row. */
export function eeoFromRecord(record: Partial<StudentEeoData> | null | undefined): EeoValue {
  if (!record) return EMPTY_EEO;
  return {
    workAuth: record.work_authorized_us ?? '',
    needsSponsorship: record.requires_sponsorship ?? '',
    ethnicity: record.ethnicity_hispanic_latino ?? null,
    race: record.race ?? [],
    raceDeclined: !!record.race_declined,
    gender: record.gender ?? null,
    genderSelfDescribe: record.gender_self_describe ?? '',
    veteran: record.veteran_status ?? null,
    disability: record.disability_status ?? null,
  };
}

/**
 * Shape the form state for persistence. Unanswered voluntary fields become an
 * explicit 'declined' rather than null — "chose not to say" and "never saw the
 * question" are different facts, and only the former is defensible in a
 * compliance record.
 */
export function eeoToData(value: EeoValue): StudentEeoData {
  return {
    ethnicity_hispanic_latino: value.ethnicity ?? 'declined',
    race: value.raceDeclined ? [] : value.race,
    race_declined: value.raceDeclined || value.race.length === 0,
    gender: value.gender ?? 'declined',
    gender_self_describe:
      value.gender === 'self_describe' ? value.genderSelfDescribe.trim() || null : null,
    veteran_status: value.veteran ?? 'declined',
    disability_status: value.disability ?? 'declined',
    work_authorized_us: (value.workAuth || null) as 'yes' | 'no' | null,
    requires_sponsorship: (value.needsSponsorship || null) as 'yes' | 'no' | null,
  };
}

/** Work authorization is the only part that isn't voluntary. */
export function missingRequiredEeo(value: EeoValue): string | null {
  if (!value.workAuth) return 'Please answer the work authorization question.';
  if (!value.needsSponsorship) return 'Please answer the sponsorship question.';
  return null;
}

export default function EeoFields({
  value,
  onChange,
  compact = false,
}: {
  value: EeoValue;
  onChange: (value: EeoValue) => void;
  /** Tighter spacing for the in-modal confirmation step. */
  compact?: boolean;
}) {
  function set<K extends keyof EeoValue>(key: K, v: EeoValue[K]) {
    onChange({ ...value, [key]: v });
  }

  function toggleRace(option: string) {
    onChange({
      ...value,
      raceDeclined: false,
      race: value.race.includes(option)
        ? value.race.filter((r) => r !== option)
        : [...value.race, option],
    });
  }

  return (
    <>
      <Section title="Work Authorization" subtitle="Required by every employer." compact={compact}>
        <RadioGroup
          name="workAuth"
          label="Are you legally authorized to work in the United States?"
          options={[...YES_NO_OPTIONS]}
          value={value.workAuth}
          onChange={(v) => set('workAuth', v as 'yes' | 'no')}
        />
        <RadioGroup
          name="sponsorship"
          label="Will you now or in the future require sponsorship for employment visa status?"
          options={[...YES_NO_OPTIONS]}
          value={value.needsSponsorship}
          onChange={(v) => set('needsSponsorship', v as 'yes' | 'no')}
        />
      </Section>

      <Section title="Ethnicity" subtitle="Voluntary — you may decline." compact={compact}>
        <RadioGroup
          name="ethnicity"
          label="Are you Hispanic or Latino?"
          options={[...ETHNICITY_OPTIONS]}
          value={value.ethnicity ?? ''}
          onChange={(v) => set('ethnicity', v as EeoValue['ethnicity'])}
        />
      </Section>

      <Section title="Race" subtitle="Voluntary — select all that apply or decline." compact={compact}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          {RACE_OPTIONS.map((opt) => (
            <label key={opt.value} style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={!value.raceDeclined && value.race.includes(opt.value)}
                onChange={() => toggleRace(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={value.raceDeclined}
              onChange={() => onChange({ ...value, raceDeclined: true, race: [] })}
            />
            <span>Decline to answer</span>
          </label>
        </div>
      </Section>

      <Section title="Gender" subtitle="Voluntary — you may decline." compact={compact}>
        <RadioGroup
          name="gender"
          label="How do you identify?"
          options={[...GENDER_OPTIONS]}
          value={value.gender ?? ''}
          onChange={(v) => set('gender', v as EeoValue['gender'])}
        />
        {value.gender === 'self_describe' && (
          <input
            type="text"
            placeholder="Please describe"
            value={value.genderSelfDescribe}
            onChange={(e) => set('genderSelfDescribe', e.target.value)}
            style={{ marginTop: '8px', width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)' }}
          />
        )}
      </Section>

      <Section title="Veteran Status" subtitle="Voluntary — you may decline." compact={compact}>
        <RadioGroup
          name="veteran"
          label="Do you identify as a protected veteran?"
          options={[...VETERAN_OPTIONS]}
          value={value.veteran ?? ''}
          onChange={(v) => set('veteran', v as EeoValue['veteran'])}
        />
      </Section>

      <Section title="Disability Status" subtitle="Voluntary — you may decline." compact={compact}>
        {/* Statutory CC-305 text. Collapsed rather than omitted — it has to be
            available verbatim, but inlining it buries the question itself. */}
        <details style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Why are you being asked this? (Form CC-305)</summary>
          <p style={{ whiteSpace: 'pre-line', marginTop: '8px', lineHeight: 1.5 }}>{DISABILITY_DISCLOSURE}</p>
        </details>
        <RadioGroup
          name="disability"
          label="Do you have a disability, or have you ever had one?"
          options={[...DISABILITY_OPTIONS]}
          value={value.disability ?? ''}
          onChange={(v) => set('disability', v as EeoValue['disability'])}
        />
      </Section>
    </>
  );
}

export function Section({
  title,
  subtitle,
  children,
  compact = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        marginBottom: compact ? '18px' : '28px',
        paddingBottom: compact ? '14px' : '24px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <h2 style={{ fontSize: compact ? '0.95rem' : '1.05rem', fontWeight: 600, margin: 0 }}>{title}</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 14px' }}>{subtitle}</p>
      {children}
    </div>
  );
}

export function RadioGroup({
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

export const checkboxLabelStyle: React.CSSProperties = {
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
