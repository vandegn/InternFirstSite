'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, getStudentByUserId, getStudentEeo, upsertStudentEeo } from '@/lib/supabase';
import EeoFields, {
  eeoFromRecord,
  eeoToData,
  missingRequiredEeo,
  EMPTY_EEO,
  type EeoValue,
} from '@/components/EeoFields';
import { VOLUNTARY_DISCLOSURE } from '@/lib/eeo';

// Onboarding / settings editor for the student's saved equal-opportunity
// answers. These are defaults: every application still surfaces them for
// review and snapshots what was actually submitted (see EeoConfirmModal).
// The field markup lives in EeoFields so this page and the apply-time
// confirmation can't drift into asking different questions.

export default function StudentWelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEdit = searchParams.get('from') === 'settings';

  const [studentId, setStudentId] = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eeo, setEeo] = useState<EeoValue>(EMPTY_EEO);

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
        setEeo(eeoFromRecord(existing));
      }
    }
    loadStudent();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!studentId) {
      setError('Could not load your profile. Please refresh and try again.');
      return;
    }

    const missing = missingRequiredEeo(eeo);
    if (missing) {
      setError(missing);
      return;
    }

    setLoading(true);
    try {
      await upsertStudentEeo(studentId, eeoToData(eeo));
      router.replace(isEdit ? '/dashboard/student/settings' : '/dashboard/student');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
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
        <EeoFields value={eeo} onChange={setEeo} />

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
