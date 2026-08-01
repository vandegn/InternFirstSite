'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { joinWaitlist } from '@/lib/supabase';

type Role = 'student' | 'employer';

export default function WaitlistPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');
    setErrorMsg('');

    const { error } = await joinWaitlist({ email, fullName, role });

    if (error) {
      setErrorMsg(
        error.code === '23505'
          ? "You're already on the waitlist — we'll be in touch."
          : error.message || 'Something went wrong. Please try again.'
      );
      setStatus('error');
      setLoading(false);
      return;
    }

    // Notify the team of the new signup. Best-effort — a failed email
    // shouldn't block someone who is already on the waitlist.
    try {
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, role }),
      });
    } catch (err) {
      console.error('Failed to send waitlist notification:', err);
    }

    // Notify the team of the new signup. Best-effort — a failed email
    // shouldn't block someone who is already on the waitlist.
    try {
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, role }),
      });
    } catch (err) {
      console.error('Failed to send waitlist notification:', err);
    }

    setStatus('success');
    setFullName('');
    setEmail('');
    setRole('student');
    setLoading(false);
  }

  return (
    <>
      <Header />

      <section className="hero">
        <div className="container">
          <div className="hero-badge">Coming Soon</div>
          <h1>Join the InternFirst waitlist</h1>
          <p className="hero-subtitle">
            Be the first to know when we open up. We&apos;ll send a single email when your spot is ready. No spam, no off-platform redirects.
          </p>
        </div>
      </section>

      <section className="contact-section">
        <div className="container">
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            {status === 'success' ? (
              <div
                className="card-shell"
                style={{
                  padding: 32,
                  textAlign: 'center',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <h2 style={{ marginBottom: 8 }}>You&apos;re on the list</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                  Thanks for signing up. We&apos;ll email you the moment your spot is ready.
                </p>
                <Link href="/" className="btn-primary">Back to home</Link>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                style={{
                  padding: 32,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                }}
              >
                {errorMsg && (
                  <div className="auth-error" style={{ display: 'block', marginBottom: 16 }}>
                    {errorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="role">I&apos;m signing up as...</label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                  >
                    <option value="student">Student</option>
                    <option value="employer">Employer</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="fullName">Full name</label>
                  <input
                    id="fullName"
                    type="text"
                    placeholder="Your name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    placeholder={
                      role === 'student'
                        ? 'you@school.edu'
                        : role === 'employer'
                          ? 'you@company.com'
                          : 'you@example.com'
                    }
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {role === 'student' && (
                    <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                      Please use your .edu email so we can verify you&apos;re a student.
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="role">I&apos;m a...</label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                  >
                    <option value="student">Student</option>
                    <option value="employer">Employer</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <button type="submit" className="btn-auth" style={{ marginTop: 24 }} disabled={loading}>
                  {loading ? 'Joining...' : 'Join the waitlist'}
                </button>

                <p className="auth-footer" style={{ marginTop: 16 }}>
                  Already have an account? <Link href="/login">Sign in</Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
