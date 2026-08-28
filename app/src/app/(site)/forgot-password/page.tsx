'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-container narrow">
        <button
          type="button"
          onClick={() => { if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push('/'); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, marginBottom: '4px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>
        <div className="auth-logo">
          <Link href="/">
            <img
              src="/internfirst-logo.png"
              alt="InternFirst"
            />
          </Link>
        </div>

        {sent ? (
          <>
            <h1>Check your email</h1>
            <p className="auth-subtitle">
              If an account exists for <strong>{email}</strong>, you&apos;ll
              receive a password reset link shortly. Check your inbox and spam
              folder.
            </p>
            <p className="auth-footer">
              Didn&apos;t receive it?{' '}
              <button
                type="button"
                onClick={() => setSent(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--auth-green)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  padding: 0,
                }}
              >
                Try again
              </button>
            </p>
          </>
        ) : (
          <>
            <h1>Reset your password</h1>
            <p className="auth-subtitle">
              Enter the email address on your account and we&apos;ll send you a
              link to reset your password.
            </p>

            {error && (
              <div className="auth-error" style={{ display: 'block' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  placeholder="Enter your email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn-auth"
                disabled={loading}
                style={{ marginTop: '28px' }}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <p className="auth-footer">
              Remember your password? <Link href="/login">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
