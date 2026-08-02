'use client';

import { useState } from 'react';
import EeoFields, { missingRequiredEeo, type EeoValue } from '@/components/EeoFields';
import ApplicationQuestionsForm, {
  missingRequired,
  type AnswerState,
} from '@/components/ApplicationQuestionsForm';
import { VOLUNTARY_DISCLOSURE } from '@/lib/eeo';
import type { ListingQuestion } from '@/lib/supabase';

/**
 * The equal-opportunity step every application passes through.
 *
 * Previously the apply form carried a passive note saying this information was
 * "on file and will be submitted" — the student never saw what was being sent
 * on their behalf. Now the answers are shown, prefilled from their settings,
 * editable in place, and submitted only on an explicit acknowledgement.
 *
 * Two groups render here:
 *  - the standard federal set, which is defined in code and always present;
 *  - any EEO questions the employer added to this listing, which are additive
 *    and can be required.
 *
 * Editing here updates both the student's saved defaults and this
 * application's own immutable snapshot — see saveApplicationEeo.
 */
export default function EeoConfirmModal({
  value,
  onChange,
  employerQuestions,
  answers,
  onAnswersChange,
  studentId,
  submitting,
  onCancel,
  onSubmit,
}: {
  value: EeoValue;
  onChange: (value: EeoValue) => void;
  employerQuestions: ListingQuestion[];
  answers: AnswerState;
  onAnswersChange: (answers: AnswerState) => void;
  studentId: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  function handleSubmit() {
    const missingEeo = missingRequiredEeo(value);
    if (missingEeo) {
      setShowErrors(true);
      setError(missingEeo);
      return;
    }

    const unanswered = missingRequired(employerQuestions, answers);
    if (unanswered.length > 0) {
      setShowErrors(true);
      setError(`Please answer all required questions (${unanswered.length} remaining).`);
      return;
    }

    if (!acknowledged) {
      setError('Please confirm your responses before submitting.');
      return;
    }

    setError(null);
    onSubmit();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Equal opportunity questions"
      onClick={submitting ? undefined : onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius, 12px)',
          width: 'min(680px, 100%)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '22px 24px 14px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
            Equal opportunity questions
          </h3>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.5 }}>
            We&apos;ve filled these in from your settings. Review them, change anything
            you&apos;d like for this application, and confirm to submit.
          </p>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <div
            style={{
              padding: '14px 16px',
              marginBottom: '20px',
              borderRadius: 'var(--radius-sm, 8px)',
              background: 'var(--bg-light, #f7f8fb)',
              border: '1px solid var(--border)',
            }}
          >
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
              {VOLUNTARY_DISCLOSURE}
            </p>
          </div>

          <EeoFields value={value} onChange={onChange} compact />

          {employerQuestions.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 4px' }}>
                Additional questions from this employer
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                Unlike the questions above, these were added by the employer and their
                answers are visible to them.
              </p>
              <ApplicationQuestionsForm
                questions={employerQuestions}
                answers={answers}
                onChange={onAnswersChange}
                studentId={studentId}
                showErrors={showErrors}
              />
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--border)' }}>
          {error && (
            <p style={{ color: 'var(--danger-fg, #e53e3e)', fontSize: '0.84rem', margin: '0 0 10px' }}>{error}</p>
          )}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              fontSize: '0.86rem',
              lineHeight: 1.5,
              cursor: 'pointer',
              marginBottom: '14px',
            }}
          >
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => {
                setAcknowledged(e.target.checked);
                if (e.target.checked) setError(null);
              }}
              style={{ marginTop: 3, accentColor: 'var(--primary)' }}
            />
            <span>
              I confirm these responses are mine and I&apos;m submitting them with this
              application.
            </span>
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ padding: '10px 26px', fontSize: '0.95rem', opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
            <button
              onClick={onCancel}
              disabled={submitting}
              style={{
                padding: '10px 20px',
                fontSize: '0.9rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
