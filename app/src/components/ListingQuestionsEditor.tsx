'use client';

import { QUESTION_TYPES, OPTION_QUESTION_TYPES, type QuestionType } from '@/lib/constants';
import type { ListingQuestionInput } from '@/lib/supabase';

// Builder for the custom screening questions students answer when applying.
// Order is the array order — persisted as `position` by replaceListingQuestions.
export default function ListingQuestionsEditor({ questions, onChange }: {
  questions: ListingQuestionInput[];
  onChange: (questions: ListingQuestionInput[]) => void;
}) {
  function update(index: number, patch: Partial<ListingQuestionInput>) {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function remove(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function changeType(index: number, question_type: QuestionType) {
    // Drop the fields that no longer apply so a type switch can't leave stale
    // options or a knockout answer behind.
    update(index, {
      question_type,
      options: OPTION_QUESTION_TYPES.includes(question_type) ? questions[index].options ?? [''] : [],
      knockout_answer: question_type === 'yes_no' ? questions[index].knockout_answer ?? null : null,
    });
  }

  return (
    <div className="form-group" style={{ marginTop: '8px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
      <label style={{ fontSize: '1.05rem', fontWeight: 600 }}>Screening Questions</label>
      <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', margin: '4px 0 12px', display: 'block' }}>
        Optional questions students answer when they apply. Answers show up with the application.
      </small>

      {questions.map((question, i) => {
        const showOptions = OPTION_QUESTION_TYPES.includes(question.question_type);
        const options = question.options ?? [];

        return (
          <div
            key={question.id ?? `new-${i}`}
            style={{
              border: '1.5px solid var(--border)',
              borderRadius: 10,
              padding: '14px',
              marginBottom: '12px',
              background: 'var(--bg-light)',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', flexShrink: 0 }}>
                Q{i + 1}
              </span>
              <input
                type="text"
                placeholder="Question, e.g. Why do you want this role?"
                value={question.prompt}
                onChange={(e) => update(i, { prompt: e.target.value })}
                style={{ flex: 1 }}
              />
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move question up" style={iconButtonStyle(i === 0)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} aria-label="Move question down" style={iconButtonStyle(i === questions.length - 1)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              <button type="button" onClick={() => remove(i)} aria-label="Remove question" style={{ ...iconButtonStyle(false), color: 'var(--danger-fg)', borderColor: 'var(--danger-border)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
              <select
                value={question.question_type}
                onChange={(e) => changeType(i, e.target.value as QuestionType)}
                style={{ flex: '1 1 180px' }}
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={question.required ?? false}
                  onChange={(e) => update(i, { required: e.target.checked })}
                  style={{ accentColor: 'var(--primary)' }}
                />
                Required
              </label>
            </div>

            <input
              type="text"
              placeholder="Helper text (optional)"
              value={question.help_text ?? ''}
              onChange={(e) => update(i, { help_text: e.target.value })}
              style={{ width: '100%', marginBottom: showOptions || question.question_type === 'yes_no' ? '10px' : 0 }}
            />

            {showOptions && (
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase' }}>Options</span>
                {options.map((opt, oi) => (
                  <div key={oi} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                    <input
                      type="text"
                      placeholder={`Option ${oi + 1}`}
                      value={opt}
                      onChange={(e) => update(i, { options: options.map((o, x) => (x === oi ? e.target.value : o)) })}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => update(i, { options: options.filter((_, x) => x !== oi) })}
                      aria-label="Remove option"
                      style={{ ...iconButtonStyle(false), color: 'var(--danger-fg)', borderColor: 'var(--danger-border)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => update(i, { options: [...options, ''] })}
                  style={{ marginTop: '8px', padding: '6px 12px', borderRadius: 8, border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  + Add option
                </button>
              </div>
            )}

            {question.question_type === 'yes_no' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Flag the application if the answer is</span>
                {([null, 'yes', 'no'] as const).map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => update(i, { knockout_answer: value })}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 999,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: (question.knockout_answer ?? null) === value ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                      background: (question.knockout_answer ?? null) === value ? 'var(--primary-light)' : 'var(--bg)',
                      color: (question.knockout_answer ?? null) === value ? 'var(--primary)' : 'var(--text-secondary)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {value === null ? 'Never' : value}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onChange([...questions, { prompt: '', question_type: 'short_text', options: [], required: false, knockout_answer: null }])}
        style={{
          padding: '9px 16px',
          borderRadius: 8,
          border: '1.5px dashed var(--border)',
          background: 'transparent',
          color: 'var(--primary)',
          fontWeight: 600,
          fontSize: '0.85rem',
          cursor: 'pointer',
        }}
      >
        + Add question
      </button>
    </div>
  );
}

function iconButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 8,
    border: '1.5px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-secondary)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    flexShrink: 0,
  };
}
