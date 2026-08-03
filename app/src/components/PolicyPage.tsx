'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RoleSelector from '@/components/RoleSelector';
import PolicyBlocksView from '@/components/PolicyBlocks';
import { getPolicyDoc, type PolicyKind, type PolicyRole } from '@/lib/policies';

// Public, always-readable version of the legal documents users acknowledge at
// signup (same content source, so the two can't diverge). One page per
// document kind; the Student/Employer variants are a toggle.
export default function PolicyPage({ kind }: { kind: PolicyKind }) {
  const [role, setRole] = useState<PolicyRole>('student');
  const doc = getPolicyDoc(role, kind);
  const other = kind === 'terms'
    ? { href: '/privacy', label: 'Privacy Policy' }
    : { href: '/terms', label: 'Terms & Conditions' };

  return (
    <>
      <Header />

      <section className="hero" style={{ paddingBottom: '24px' }}>
        <div className="container">
          <h1>{kind === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}</h1>
          <p className="hero-subtitle">
            The {kind === 'terms' ? 'terms' : 'privacy policy'} you agree to when creating an
            InternFirst account. Also see the <Link href={other.href}>{other.label}</Link>.
          </p>
        </div>
      </section>

      <section style={{ padding: '0 0 64px' }}>
        <div className="container" style={{ maxWidth: '820px' }}>
          <RoleSelector selected={role} onChange={setRole} />

          <article
            style={{
              marginTop: '20px', padding: '28px 32px',
              border: '1px solid var(--border)', borderRadius: '16px',
              background: '#fff', fontSize: '0.9rem', lineHeight: 1.65,
            }}
          >
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 2px' }}>{doc.title}</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Pilot Version {doc.version} · Effective {doc.effectiveDate}
            </p>
            <PolicyBlocksView blocks={doc.blocks} />
          </article>
        </div>
      </section>

      <Footer />
    </>
  );
}
