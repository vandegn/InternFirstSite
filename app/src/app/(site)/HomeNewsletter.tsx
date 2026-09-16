'use client';

import { useState } from 'react';
import { subscribeToInternshipAlerts } from '@/lib/supabase';

// This form used to call preventDefault and nothing else: the visitor typed an
// address, saw the page accept it, and it went nowhere. Relabelling the section
// "Get internship alerts" made that worse — it turned a dead input into a
// promise — so the address is now actually recorded. See
// subscribeToInternshipAlerts; it writes to the same `waitlist` table the admin
// dashboard already reads.
export default function HomeNewsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'saving') return;

    setStatus('saving');
    const { error } = await subscribeToInternshipAlerts(email);

    if (error) {
      setStatus('error');
      setMessage('Something went wrong. Try again in a moment.');
      return;
    }

    setStatus('done');
    setMessage("You're on the list — we'll email you when new roles go live.");
    setEmail('');
  }

  if (status === 'done') {
    return (
      <p className="newsletter-status" role="status">
        {message}
      </p>
    );
  }

  return (
    <>
      <form className="newsletter-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="you@school.edu"
          aria-label="Email address"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'saving'}
        />
        <button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? 'Signing up…' : 'Subscribe'}
        </button>
      </form>
      {status === 'error' && (
        <p className="newsletter-status newsletter-status-error" role="alert">
          {message}
        </p>
      )}
    </>
  );
}
