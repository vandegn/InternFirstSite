import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

vi.mock('@/lib/supabase', () => ({ uploadApplicationFile: vi.fn() }));

import ApplicationQuestionsForm, { emptyAnswers, toAnswerInputs, type AnswerState } from './ApplicationQuestionsForm';
import type { ListingQuestion } from '@/lib/supabase';

function question(overrides: Partial<ListingQuestion>): ListingQuestion {
  return {
    id: 'q1', listing_id: 'l1', prompt: 'Why this role?', help_text: null,
    question_type: 'long_text', options: [], required: true, knockout_answer: null,
    position: 0, is_eeo: false, ...overrides,
  };
}

function Harness({ questions, onAnswers }: { questions: ListingQuestion[]; onAnswers?: (a: AnswerState) => void }) {
  const [answers, setAnswers] = useState(emptyAnswers(questions));
  return (
    <ApplicationQuestionsForm
      questions={questions}
      answers={answers}
      onChange={(a) => { setAnswers(a); onAnswers?.(a); }}
      studentId="s1"
      showErrors={false}
    />
  );
}

describe('ApplicationQuestionsForm text answers', () => {
  it('renders short and long answers as resizable multi-line textareas', () => {
    const questions = [
      question({ id: 'short', prompt: 'Your GPA?', question_type: 'short_text', required: false }),
      question({ id: 'long', prompt: 'Why this role?' }),
    ];
    render(<Harness questions={questions} />);

    const short = screen.getByRole('textbox', { name: 'Your GPA?' });
    const long = screen.getByRole('textbox', { name: 'Why this role?' });
    expect(short.tagName).toBe('TEXTAREA');
    expect(long.tagName).toBe('TEXTAREA');
    expect(short).toHaveAttribute('rows', '2');
    expect(long).toHaveAttribute('rows', '5');
    expect(long.style.resize).toBe('vertical');
    expect(long).toHaveAttribute('aria-required', 'true');
    expect(short).not.toHaveAttribute('aria-required');
  });

  it('keeps line breaks in multi-line answers', async () => {
    let latest: AnswerState = {};
    const questions = [question({})];
    render(<Harness questions={questions} onAnswers={(a) => { latest = a; }} />);

    await userEvent.type(screen.getByRole('textbox', { name: 'Why this role?' }), 'First line{enter}Second line');
    expect(toAnswerInputs(questions, latest)[0].answer_text).toBe('First line\nSecond line');
  });
});
