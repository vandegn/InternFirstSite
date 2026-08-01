'use client';

// Controlled editor for a listing's custom application questions. Employers add
// free-text questions that students must answer when applying. Used on both the
// "new listing" and "edit listing" pages.
export default function ListingQuestionsEditor({
  questions,
  onChange,
}: {
  questions: string[];
  onChange: (questions: string[]) => void;
}) {
  function updateQuestion(index: number, value: string) {
    onChange(questions.map((q, i) => (i === index ? value : q)));
  }

  function addQuestion() {
    onChange([...questions, '']);
  }

  function removeQuestion(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  return (
    <div className="form-group" style={{ marginTop: '8px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
      <label style={{ fontSize: '1.05rem', fontWeight: 600 }}>Application Questions</label>
      <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', margin: '4px 0 12px', display: 'block' }}>
        Optional. Applicants must answer every question before they can submit — answers cannot be left blank.
      </small>

      {questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
          {questions.map((q, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, paddingTop: '10px', width: '20px', flexShrink: 0 }}>
                {i + 1}.
              </span>
              <input
                type="text"
                value={q}
                onChange={(e) => updateQuestion(i, e.target.value)}
                placeholder="e.g. Why are you interested in this role?"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => removeQuestion(i)}
                aria-label="Remove question"
                style={{
                  padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addQuestion}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--primary)',
          background: 'transparent', color: 'var(--primary)', fontWeight: 600,
          fontSize: '0.85rem', cursor: 'pointer',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add question
      </button>
    </div>
  );
}
