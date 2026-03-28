'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ── Survey data ── */
const INDUSTRY_OPTIONS = [
  'Technology', 'Finance & Banking', 'Healthcare', 'Marketing & Advertising',
  'Consulting', 'Media & Entertainment', 'Education', 'Government & Policy',
  'Engineering', 'Nonprofit & Social Impact', 'Real Estate', 'Energy & Sustainability',
];

const SKILL_OPTIONS = [
  'Data Analysis', 'Project Management', 'Public Speaking', 'Technical Writing',
  'Software Development', 'UI/UX Design', 'Financial Modeling', 'Research',
  'Leadership', 'Communication', 'Problem Solving', 'Marketing Strategy',
];

type Step = {
  id: string;
  title: string;
  subtitle: string;
};

const STEPS: Step[] = [
  { id: 'industries', title: 'Which industries interest you?', subtitle: 'Select up to 3 that excite you most' },
  { id: 'environment', title: 'Ideal work environment?', subtitle: 'Where do you do your best work' },
  { id: 'duration', title: 'Preferred internship length?', subtitle: 'This helps us filter the right openings' },
  { id: 'skills', title: 'Skills you want to develop?', subtitle: 'Pick the areas you want to grow in' },
  { id: 'goals', title: 'What are your career goals?', subtitle: 'A sentence or two about where you\'re headed' },
];

export type CareerSurveyFormData = {
  industries: string[];
  work_environment: string;
  preferred_duration: string;
  skills: string[];
  career_goals: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CareerSurveyFormData) => void;
  initialData?: CareerSurveyFormData | null;
};

export default function CareerSurveyModal({ open, onClose, onSubmit, initialData }: Props) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Answers
  const [industries, setIndustries] = useState<Set<string>>(new Set());
  const [environment, setEnvironment] = useState('');
  const [duration, setDuration] = useState('');
  const [skills, setSkills] = useState<Set<string>>(new Set());
  const [goals, setGoals] = useState('');

  // Pre-fill from initialData when modal opens
  useEffect(() => {
    if (open && initialData) {
      setIndustries(new Set(initialData.industries));
      setEnvironment(initialData.work_environment);
      setDuration(initialData.preferred_duration);
      setSkills(new Set(initialData.skills));
      setGoals(initialData.career_goals);
      setStep(0);
    } else if (open && !initialData) {
      setIndustries(new Set());
      setEnvironment('');
      setDuration('');
      setSkills(new Set());
      setGoals('');
      setStep(0);
    }
  }, [open, initialData]);

  // Mount / unmount animation
  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
      const t = setTimeout(() => {
        setVisible(false);
        setStep(0);
      }, 240);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const toggleSet = useCallback((set: Set<string>, value: string, max: number): Set<string> => {
    const next = new Set(set);
    if (next.has(value)) {
      next.delete(value);
    } else if (next.size < max) {
      next.add(value);
    }
    return next;
  }, []);

  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return industries.size > 0;
      case 1: return environment !== '';
      case 2: return duration !== '';
      case 3: return skills.size > 0;
      case 4: return goals.trim().length > 0;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      onSubmit({
        industries: Array.from(industries),
        work_environment: environment,
        preferred_duration: duration,
        skills: Array.from(skills),
        career_goals: goals,
      });
    }
  };

  if (!visible) return null;

  const progress = ((step + 1) / STEPS.length) * 100;
  const current = STEPS[step];

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: animating ? 'rgba(15, 23, 42, 0.45)' : 'rgba(15, 23, 42, 0)',
        backdropFilter: animating ? 'blur(4px)' : 'blur(0px)',
        WebkitBackdropFilter: animating ? 'blur(4px)' : 'blur(0px)',
        transition: 'background 0.24s cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.15)',
          border: '1px solid var(--border, #e5e7eb)',
          transform: animating ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          opacity: animating ? 1 : 0,
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
      >
        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--border, #e5e7eb)' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--accent, #9FC63C)',
            borderRadius: '0 2px 2px 0',
            transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }} />
        </div>

        {/* Header */}
        <div style={{ padding: '24px 28px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-dark, #8ab32e)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Step {step + 1} of {STEPS.length}
            </span>
            <button
              onClick={onClose}
              aria-label="Close survey"
              style={{
                background: 'none',
                border: 'none',
                padding: 4,
                cursor: 'pointer',
                color: 'var(--text-secondary, #6b7280)',
                borderRadius: 6,
                display: 'flex',
                transition: 'color 0.15s',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '8px 0 4px', color: 'var(--text, #2d2d2d)', letterSpacing: '-0.01em' }}>
            {current.title}
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #6b7280)', margin: '0 0 20px' }}>
            {current.subtitle}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '0 28px 24px', minHeight: 200 }}>
          {/* Step 0: Industries (multi-select chips) */}
          {step === 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {INDUSTRY_OPTIONS.map(ind => {
                const selected = industries.has(ind);
                const atMax = industries.size >= 3 && !selected;
                return (
                  <button
                    key={ind}
                    onClick={() => setIndustries(toggleSet(industries, ind, 3))}
                    disabled={atMax}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 999,
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      border: selected ? '1.5px solid var(--accent, #9FC63C)' : '1px solid var(--border, #e5e7eb)',
                      background: selected ? 'var(--accent-light, #eef5da)' : '#fff',
                      color: selected ? 'var(--accent-dark, #8ab32e)' : atMax ? 'var(--text-light, #9ca3af)' : 'var(--text, #2d2d2d)',
                      cursor: atMax ? 'default' : 'pointer',
                      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                      transform: selected ? 'scale(1)' : 'scale(1)',
                    }}
                    onMouseDown={e => { if (!atMax) (e.currentTarget.style.transform = 'scale(0.96)'); }}
                    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                    {ind}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 1: Work environment (single select) */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { value: 'in_person', label: 'In-person', desc: 'Working on-site at the company office' },
                { value: 'remote', label: 'Remote', desc: 'Working from home or anywhere with wifi' },
                { value: 'hybrid', label: 'Hybrid', desc: 'A mix of in-person and remote days' },
                { value: 'no_preference', label: 'No preference', desc: 'Open to any arrangement' },
              ].map(opt => {
                const selected = environment === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setEnvironment(opt.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 18px',
                      borderRadius: 12,
                      border: selected ? '1.5px solid var(--accent, #9FC63C)' : '1px solid var(--border, #e5e7eb)',
                      background: selected ? 'var(--accent-light, #eef5da)' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
                    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: selected ? '6px solid var(--accent, #9FC63C)' : '2px solid var(--border, #e5e7eb)',
                      flexShrink: 0,
                      transition: 'border 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    }} />
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text, #2d2d2d)' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)', marginTop: 1 }}>{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Duration (single select) */}
          {step === 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { value: '1_month', label: '1 month', sub: 'Short-term project' },
                { value: '3_months', label: '3 months', sub: 'One semester' },
                { value: '6_months', label: '6 months', sub: 'Two semesters / co-op' },
                { value: '12_months', label: '12 months', sub: 'Full-year placement' },
              ].map(opt => {
                const selected = duration === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setDuration(opt.value)}
                    style={{
                      padding: '18px 16px',
                      borderRadius: 12,
                      border: selected ? '1.5px solid var(--accent, #9FC63C)' : '1px solid var(--border, #e5e7eb)',
                      background: selected ? 'var(--accent-light, #eef5da)' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
                    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: selected ? 'var(--accent-dark, #8ab32e)' : 'var(--text, #2d2d2d)' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #6b7280)', marginTop: 2 }}>{opt.sub}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 3: Skills (multi-select chips) */}
          {step === 3 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SKILL_OPTIONS.map(skill => {
                const selected = skills.has(skill);
                const atMax = skills.size >= 4 && !selected;
                return (
                  <button
                    key={skill}
                    onClick={() => setSkills(toggleSet(skills, skill, 4))}
                    disabled={atMax}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 999,
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      border: selected ? '1.5px solid var(--accent, #9FC63C)' : '1px solid var(--border, #e5e7eb)',
                      background: selected ? 'var(--accent-light, #eef5da)' : '#fff',
                      color: selected ? 'var(--accent-dark, #8ab32e)' : atMax ? 'var(--text-light, #9ca3af)' : 'var(--text, #2d2d2d)',
                      cursor: atMax ? 'default' : 'pointer',
                      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onMouseDown={e => { if (!atMax) (e.currentTarget.style.transform = 'scale(0.96)'); }}
                    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                    {skill}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 4: Career goals (text area) */}
          {step === 4 && (
            <div>
              <textarea
                value={goals}
                onChange={e => setGoals(e.target.value)}
                placeholder="e.g., I want to break into product management at a mid-size tech company after graduation, focusing on B2B SaaS products..."
                rows={5}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: '1px solid var(--border, #e5e7eb)',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                  color: 'var(--text, #2d2d2d)',
                  background: '#fff',
                  resize: 'vertical',
                  outline: 'none',
                  lineHeight: 1.6,
                  transition: 'border-color 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent, #9FC63C)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)'; }}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-light, #9ca3af)', marginTop: 6, textAlign: 'right' }}>
                {goals.length} / 500 characters
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 28px',
          borderTop: '1px solid var(--border, #e5e7eb)',
          background: 'var(--bg, #F8F9FC)',
        }}>
          <button
            onClick={() => { if (step > 0) setStep(s => s - 1); else onClose(); }}
            style={{
              padding: '9px 18px',
              borderRadius: 10,
              fontSize: '0.82rem',
              fontWeight: 600,
              border: '1px solid var(--border, #e5e7eb)',
              background: '#fff',
              color: 'var(--text-secondary, #6b7280)',
              cursor: 'pointer',
              transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {/* Step dots */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === step ? 'var(--accent, #9FC63C)' : i < step ? 'var(--accent-dark, #8ab32e)' : 'var(--border, #e5e7eb)',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={!canAdvance()}
            style={{
              padding: '9px 22px',
              borderRadius: 10,
              fontSize: '0.82rem',
              fontWeight: 600,
              border: 'none',
              background: canAdvance() ? 'var(--accent, #9FC63C)' : 'var(--border, #e5e7eb)',
              color: canAdvance() ? '#fff' : 'var(--text-light, #9ca3af)',
              cursor: canAdvance() ? 'pointer' : 'default',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseDown={e => { if (canAdvance()) e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {step === STEPS.length - 1 ? 'Submit' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
