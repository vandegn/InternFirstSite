'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
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
        <div className="auth-logo">
          <Link href="/">
            <img
              src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png"
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
