'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import CompanyMark from '@/components/CompanyMark';
import { employerHasIconColumn, updateEmployer, uploadImage } from '@/lib/supabase';
import { ICON_ACCEPT, iconStoragePath, validateIconFile } from '@/lib/company-icon';

type Props = {
  employerId: string;
  companyName: string;
  /** Current employers.icon_url. The prompt renders nothing once one exists. */
  iconUrl: string | null;
  /** The viewer's team role. Only Master Admins can update the company row (RLS). */
  memberRole: string | null | undefined;
  /** Called with the new public URL after a successful upload. */
  onUploaded: (url: string) => void;
  /** Show a "Not now" link that hides the prompt for the rest of the browser session. */
  dismissible?: boolean;
  compact?: boolean;
};

const DISMISS_KEY = 'if:company-icon-prompt-dismissed';

/**
 * Nudges a company with no icon to add one. Without it every posting card
 * falls back to the company's initial, and registration can't take the upload
 * (no session until the email is verified), so this is the first moment we can
 * ask. Master Admins upload right here; other teammates are pointed at them.
 */
export default function CompanyIconPrompt({
  employerId, companyName, iconUrl, memberRole, onUploaded, dismissible, compact,
}: Props) {
  const [columnReady, setColumnReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    // Before the icon migration runs there is nowhere to save it, so stay quiet.
    employerHasIconColumn().then((ok) => { if (live) setColumnReady(ok); });
    if (dismissible) {
      try { setDismissed(sessionStorage.getItem(`${DISMISS_KEY}:${employerId}`) === '1'); } catch { /* storage blocked */ }
    }
    return () => { live = false; };
  }, [employerId, dismissible]);

  if (!columnReady || iconUrl || dismissed || !employerId) return null;

  const canUpload = memberRole === 'master_admin';

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = validateIconFile(file);
    if (problem) { setError(problem); return; }
    setError('');
    setUploading(true);
    try {
      const url = await uploadImage('images', iconStoragePath(employerId, file.type), file);
      await updateEmployer(employerId, { icon_url: url });
      onUploaded(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function dismiss() {
    setDismissed(true);
    try { sessionStorage.setItem(`${DISMISS_KEY}:${employerId}`, '1'); } catch { /* storage blocked */ }
  }

  return (
    <div
      role="region"
      aria-label="Add your company icon"
      className="profile-card"
      style={{
        display: 'flex', alignItems: 'center', gap: compact ? 14 : 18, flexWrap: 'wrap',
        padding: compact ? '14px 18px' : '18px 22px', marginBottom: compact ? 20 : 24,
        borderLeft: '4px solid var(--primary)',
      }}
    >
      <CompanyMark name={companyName} size={compact ? 40 : 48} radius={10} fontSize={compact ? '1rem' : '1.2rem'} />
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: compact ? '0.9rem' : '0.98rem', marginBottom: 2 }}>
          Add your company icon
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {canUpload
            ? 'Your postings show only your initial right now. Upload a square logo and it appears on every posting, including ones already live.'
            : 'Your postings show only your initial right now. Ask your Master Admin to upload a company icon from the Account page.'}
        </p>
        {error && (
          <p role="alert" style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--danger-fg)' }}>{error}</p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ICON_ACCEPT}
              onChange={handleFile}
              style={{ display: 'none' }}
              aria-label="Company icon file"
            />
            <button
              type="button"
              className="btn-primary"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              style={{ fontSize: '0.85rem', padding: '8px 16px' }}
            >
              {uploading ? 'Uploading…' : 'Upload icon'}
            </button>
            <Link href="/dashboard/employer/account" style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
              Account page
            </Link>
          </>
        )}
        {dismissible && (
          <button
            type="button"
            onClick={dismiss}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
          >
            Not now
          </button>
        )}
      </div>
    </div>
  );
}
