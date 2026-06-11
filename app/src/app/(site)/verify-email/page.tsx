'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    if (cooldown > 0 || !email) return;
    setResending(true);
    setError('');
    setResent(false);

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (resendError) {
      setError(resendError.message);
    } else {
      setResent(true);
      setCooldown(60);
    }
    setResending(false);
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
              src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png"
              alt="InternFirst"
            />
          </Link>
        </div>

        <h1>Check your email</h1>
        <p className="auth-subtitle">
          We&apos;ve sent a verification link to{' '}
          {email ? <strong>{email}</strong> : 'your email address'}.
          Click the link in the email to activate your account.
        </p>
        <p className="auth-subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Don&apos;t see it? Check your spam folder.
        </p>

        {error && (
          <div className="auth-error" style={{ display: 'block' }}>{error}</div>
        )}

        {resent && !error && (
          <div style={{
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.9rem',
            fontWeight: 500,
            marginBottom: '16px',
          }}>
            Verification email resent!
          </div>
        )}

        {email && (
          <button
            type="button"
            className="btn-auth"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            style={{ marginTop: '8px' }}
          >
            {resending
              ? 'Sending...'
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : 'Resend Verification Email'}
          </button>
        )}

        <p className="auth-footer">
          Already verified? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
