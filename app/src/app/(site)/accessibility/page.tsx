import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Accessibility',
  description:
    'InternFirst’s commitment to an accessible platform for students and employers, the standard we work toward, and how to report a barrier.',
  path: '/accessibility',
});

const sectionHeading = { fontSize: '1.1rem', fontWeight: 700, margin: '24px 0 8px' } as const;

// Keep this honest: it states the standard we aim for and the gaps we know
// about. Update "Known limitations" when one is fixed or found.
export default function AccessibilityPage() {
  return (
    <>
      <Header />
      <main id="main-content">

      <section className="hero" style={{ paddingBottom: '24px' }}>
        <div className="container">
          <h1>Accessibility</h1>
          <p className="hero-subtitle">
            InternFirst should work for every student and employer, including people who use
            assistive technology.
          </p>
        </div>
      </section>

      <section style={{ padding: '0 0 64px' }}>
        <div className="container" style={{ maxWidth: '820px', fontSize: '0.95rem', lineHeight: 1.7 }}>
          <h2 style={sectionHeading}>Our standard</h2>
          <p>
            We work toward the Web Content Accessibility Guidelines (WCAG) 2.1, Level AA, across
            the public site and the student and employer dashboards. The platform is partially
            conformant: most of it meets the standard, and we are fixing the parts that don’t.
          </p>

          <h2 style={sectionHeading}>What we’ve done</h2>
          <ul style={{ paddingLeft: '20px' }}>
            <li>Every page can be navigated by keyboard, with a visible focus indicator and a “Skip to main content” link.</li>
            <li>Text and controls meet AA color-contrast ratios, in both light and dark themes.</li>
            <li>Form fields have labels that screen readers announce.</li>
            <li>Images carry text alternatives.</li>
            <li>Animations are turned off when your device asks for reduced motion.</li>
            <li>Candidates on the employer pipeline board can be moved with a menu as well as by drag-and-drop.</li>
          </ul>

          <h2 style={sectionHeading}>Known limitations</h2>
          <ul style={{ paddingLeft: '20px' }}>
            <li>Some older blog images are missing and show as broken.</li>
            <li>Uploaded documents (resumes, offer letters, certifications) are provided by users, and we can’t guarantee they are accessible.</li>
          </ul>

          <h2 style={sectionHeading}>Report a barrier</h2>
          <p>
            If something on InternFirst is hard or impossible to use, email{' '}
            <a href="mailto:support@intern-first.com" style={{ color: 'var(--primary)', fontWeight: 500 }}>
              support@intern-first.com
            </a>
            . Tell us the page and what happened, and we’ll reply within two business days. If you
            need to apply to a listing or complete a step another way while we fix it, say so and
            we’ll help you do it.
          </p>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '32px' }}>
            Last reviewed September 29, 2026.
          </p>
        </div>
      </section>
      </main>

      <Footer />
    </>
  );
}
