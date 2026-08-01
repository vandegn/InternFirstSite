'use client';

import { useState } from 'react';
import { uploadImage } from '@/lib/supabase';
import { ACCENT_PRESETS } from '@/lib/constants';

const HEX = /^#[0-9a-fA-F]{6}$/;

// Per-listing branding: banner image, accent color, and free-form role tags.
// Role tags are display-only — `industry` stays the preset that drives pricing,
// filtering, and recommendations.
export default function ListingBrandingFields({
  employerId,
  bannerUrl,
  accentColor,
  roleTags,
  onChange,
}: {
  employerId: string | null;
  bannerUrl: string | null;
  accentColor: string | null;
  roleTags: string[];
  onChange: (patch: { bannerUrl?: string | null; accentColor?: string | null; roleTags?: string[] }) => void;
}) {
  const [tagDraft, setTagDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handleBannerUpload(file: File) {
    if (!employerId) return;
    setUploading(true);
    setUploadError('');
    try {
      const ext = file.name.split('.').pop();
      const url = await uploadImage('images', `listing-banners/${employerId}/${Date.now()}.${ext}`, file);
      onChange({ bannerUrl: url });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function commitTag() {
    const tag = tagDraft.trim();
    if (!tag || roleTags.includes(tag)) {
      setTagDraft('');
      return;
    }
    onChange({ roleTags: [...roleTags, tag] });
    setTagDraft('');
  }

  return (
    <div className="form-group" style={{ marginTop: '8px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
      <label style={{ fontSize: '1.05rem', fontWeight: 600 }}>Branding</label>
      <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', margin: '4px 0 12px', display: 'block' }}>
        Optional. Defaults to your company logo and the InternFirst palette.
      </small>

      {/* Banner */}
      <div style={{ marginBottom: '14px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '6px' }}>Banner image</span>
        {bannerUrl && (
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bannerUrl} alt="Listing banner" style={{ width: '100%', aspectRatio: '4 / 1', objectFit: 'cover', borderRadius: 10, display: 'block' }} />
            <button
              type="button"
              onClick={() => onChange({ bannerUrl: null })}
              style={{ position: 'absolute', top: 8, right: 8, padding: '4px 10px', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Remove
            </button>
          </div>
        )}
        <label
          style={{
            display: 'inline-block',
            padding: '8px 14px',
            borderRadius: 8,
            border: '1.5px dashed var(--border)',
            color: 'var(--primary)',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: employerId ? 'pointer' : 'default',
            opacity: employerId ? 1 : 0.5,
          }}
        >
          {uploading ? 'Uploading…' : bannerUrl ? 'Replace image' : '+ Upload image'}
          <input
            type="file"
            accept="image/*"
            disabled={!employerId || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleBannerUpload(file);
              e.target.value = '';
            }}
            style={{ display: 'none' }}
          />
        </label>
        {uploadError && <p style={{ color: '#b91c1c', fontSize: '0.78rem', margin: '6px 0 0' }}>{uploadError}</p>}
      </div>

      {/* Accent color */}
      <div style={{ marginBottom: '14px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '6px' }}>Accent color</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {ACCENT_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ accentColor: color })}
              aria-label={`Accent ${color}`}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: color,
                cursor: 'pointer',
                border: accentColor === color ? '3px solid var(--text-primary)' : '1.5px solid var(--border)',
              }}
            />
          ))}
          <input
            type="text"
            placeholder="#RRGGBB"
            value={accentColor ?? ''}
            onChange={(e) => {
              const next = e.target.value;
              // Keep the raw text in the field while typing, but only push a
              // valid hex up — the column has a CHECK constraint on the format.
              onChange({ accentColor: next === '' || HEX.test(next) ? (next || null) : accentColor });
            }}
            style={{ width: 110 }}
          />
          {accentColor && (
            <button
              type="button"
              onClick={() => onChange({ accentColor: null })}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: 'pointer' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Role tags */}
      <div>
        <span style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '6px' }}>Role tags</span>
        {roleTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            {roleTags.map((tag) => (
              <span
                key={tag}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: 999, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 600 }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onChange({ roleTags: roleTags.filter((t) => t !== tag) })}
                  aria-label={`Remove ${tag}`}
                  style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '0.95rem' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          placeholder="e.g. Frontend, Startup, Mentorship — press Enter to add"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              // Enter would otherwise submit the surrounding listing form.
              e.preventDefault();
              commitTag();
            }
          }}
          onBlur={commitTag}
          style={{ width: '100%' }}
        />
        <small style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
          Shown on the listing. Industry above is what drives search filters and matching.
        </small>
      </div>
    </div>
  );
}
