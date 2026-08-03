'use client';

import { useState } from 'react';
import { uploadApplicationFile, type ListingQuestion, type ApplicationAnswerInput } from '@/lib/supabase';

export type AnswerState = Record<string, { text: string; options: string[]; storagePath: string | null }>;

export function emptyAnswers(questions: ListingQuestion[]): AnswerState {
  return Object.fromEntries(
    questions.map((q) => [q.id, { text: '', options: [], storagePath: null }])
  );
}

function isAnswered(question: ListingQuestion, answer: AnswerState[string] | undefined): boolean {
  if (!answer) return false;
  if (question.question_type === 'file') return !!answer.storagePath;
  if (question.question_type === 'multi_select') return answer.options.length > 0;
  return answer.text.trim().length > 0;
}

// Required questions the student hasn't answered yet — used to block submit.
export function missingRequired(questions: ListingQuestion[], answers: AnswerState): ListingQuestion[] {
  return questions.filter((q) => q.required && !isAnswered(q, answers[q.id]));
}

// Only answered questions produce a row; unanswered optional ones are skipped.
export function toAnswerInputs(questions: ListingQuestion[], answers: AnswerState): ApplicationAnswerInput[] {
  return questions
    .filter((q) => isAnswered(q, answers[q.id]))
    .map((q) => {
      const answer = answers[q.id];
      return {
        question_id: q.id,
        answer_text: q.question_type === 'multi_select' || q.question_type === 'file' ? null : answer.text.trim(),
        answer_options: q.question_type === 'multi_select' ? answer.options : [],
        storage_path: q.question_type === 'file' ? answer.storagePath : null,
      };
    });
}

export default function ApplicationQuestionsForm({ questions, answers, onChange, studentId, showErrors }: {
  questions: ListingQuestion[];
  answers: AnswerState;
  onChange: (answers: AnswerState) => void;
  studentId: string;
  showErrors: boolean;
}) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<Record<string, string>>({});

  if (questions.length === 0) return null;

  function set(questionId: string, patch: Partial<AnswerState[string]>) {
    onChange({ ...answers, [questionId]: { ...answers[questionId], ...patch } });
  }

  async function handleFile(questionId: string, file: File) {
    setUploadingId(questionId);
    setUploadError((prev) => ({ ...prev, [questionId]: '' }));
    try {
      const path = await uploadApplicationFile(studentId, file);
      set(questionId, { storagePath: path, text: file.name });
    } catch (err: unknown) {
      setUploadError((prev) => ({
        ...prev,
        [questionId]: err instanceof Error ? err.message : 'Upload failed.',
      }));
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '10px' }}>
        Questions from the employer
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {questions.map((question) => {
          const answer = answers[question.id] ?? { text: '', options: [], storagePath: null };
          const missing = showErrors && question.required && !isAnswered(question, answer);

          return (
            <div
              key={question.id}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm, 8px)',
                border: missing ? '1.5px solid #e53e3e' : '1px solid var(--border)',
                background: 'var(--bg)',
              }}
            >
              <p style={{ fontSize: '0.88rem', fontWeight: 500, margin: '0 0 2px' }}>
                {question.prompt}
                {question.required && <span style={{ color: '#e53e3e', marginLeft: 4 }}>*</span>}
              </p>
              {question.help_text && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', margin: '0 0 8px' }}>{question.help_text}</p>
              )}
              {!question.help_text && <div style={{ height: 8 }} />}

              {question.question_type === 'short_text' && (
                <input
                  type="text"
                  value={answer.text}
                  onChange={(e) => set(question.id, { text: e.target.value })}
                  style={{ width: '100%' }}
                />
              )}

              {question.question_type === 'long_text' && (
                <textarea
                  rows={4}
                  value={answer.text}
                  onChange={(e) => set(question.id, { text: e.target.value })}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              )}

              {question.question_type === 'single_select' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {question.options.map((option) => (
                    <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name={`q-${question.id}`}
                        checked={answer.text === option}
                        onChange={() => set(question.id, { text: option })}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              )}

              {question.question_type === 'multi_select' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {question.options.map((option) => (
                    <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={answer.options.includes(option)}
                        onChange={(e) =>
                          set(question.id, {
                            options: e.target.checked
                              ? [...answer.options, option]
                              : answer.options.filter((o) => o !== option),
                          })
                        }
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              )}

              {question.question_type === 'yes_no' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['yes', 'no'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set(question.id, { text: value })}
                      style={{
                        padding: '6px 18px',
                        borderRadius: 8,
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        border: answer.text === value ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                        background: answer.text === value ? 'var(--primary-light)' : 'var(--bg)',
                        color: answer.text === value ? 'var(--primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              )}

              {question.question_type === 'file' && (
                <div>
                  <label
                    style={{
                      display: 'inline-block',
                      padding: '7px 14px',
                      borderRadius: 8,
                      border: '1.5px dashed var(--border)',
                      color: 'var(--primary)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: uploadingId === question.id ? 'default' : 'pointer',
                    }}
                  >
                    {uploadingId === question.id ? 'Uploading…' : answer.storagePath ? 'Replace file' : '+ Choose file'}
                    <input
                      type="file"
                      disabled={uploadingId === question.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(question.id, file);
                        e.target.value = '';
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {answer.storagePath && (
                    <span style={{ marginLeft: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {answer.text || 'File attached'}
                    </span>
                  )}
                  {uploadError[question.id] && (
                    <p style={{ color: 'var(--danger-fg)', fontSize: '0.78rem', margin: '6px 0 0' }}>{uploadError[question.id]}</p>
                  )}
                </div>
              )}

              {missing && (
                <p style={{ color: '#e53e3e', fontSize: '0.78rem', margin: '8px 0 0' }}>This question is required.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
