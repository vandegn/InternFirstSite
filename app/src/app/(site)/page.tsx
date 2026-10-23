import type { Metadata } from 'next';
import Link from 'next/link';
import { Red_Hat_Display } from 'next/font/google';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { pageMetadata } from '@/lib/site';
import { organizationJsonLd, serializeJsonLd } from '@/lib/structured-data';
import schools from '@/data/us-schools.json';
import CampusMap from './_home/CampusMap';
import PressCard from './_home/PressCard';
import { buildDots } from './_home/map-data';
import s from './_home/home.module.css';

// A static server component on purpose: crawlers get the full HTML and links,
// and the "send logged-in users to their dashboard" redirect happens in
// middleware.ts as a 302 before any HTML is sent.
//
// This is the "Every Campus" direction picked from /concepts.

export const metadata: Metadata = pageMetadata({
  absoluteTitle: 'InternFirst | Find Internships for College Students',
  description:
    'Browse open internships from reviewed employers — no account needed to look. Students with a .edu email apply, message, and interview entirely on InternFirst.',
  path: '/',
});

const display = Red_Hat_Display({ subsets: ['latin'], weight: ['400', '500', '700', '900'] });

const { dots, width, height } = buildDots();
const schoolCount = (schools as unknown[]).length.toLocaleString('en-US');

export default function LandingPage() {
  return (
    <>
      {/* schema.org Organization. This is the entity Google and the AI answer
          engines attach the brand's name, logo and social profiles to — without
          it "InternFirst" is just a string on a page. Homepage only: one
          Organization node per site, on the page its @id points at. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd()) }}
      />

      <Header />
      <div className={`${s.page} ${display.className}`}>
        <section className={s.heroBand}>
          <div className={s.hero} id="main-content">
            <div className={s.heroCopy}>
              <h1 className={`${s.h1} ${s.h1Inter}`}>For everyone whose parents don’t know the CEO</h1>
              <p className={s.sub}>
                Apply, interview and get hired all on InternFirst as a student at any of the {schoolCount}{' '}
                accredited U.S. colleges.
              </p>
              <p className={s.sub}>
                Browse every listing <strong className={s.emph}>without</strong> an account below
                <svg className={s.downArrow} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M12 4v15M6 13l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </p>
              <div className={s.ctas}>
                <Link href="/internships" className={s.btnLime}>Browse internships</Link>
              </div>
            </div>
            <div className={s.heroMap}>
              <CampusMap dots={dots} width={width} height={height} />
            </div>
          </div>
        </section>

        <main className={s.split}>
          <PressCard>
            <h2 className={s.h2}>Students</h2>
            <ul className={s.ticks}>
              <li>Look at every live listing before you sign up.</li>
              <li>One profile with your resume, skills and school.</li>
              <li>Message employers and pick interview times in your inbox.</li>
              <li>Read your offer letter and accept it here.</li>
            </ul>
            <Link href="/register?role=student" className={s.btnNavy}>Create a student account</Link>
          </PressCard>
          <PressCard>
            <h2 className={s.h2}>Employers</h2>
            <ul className={s.ticks}>
              <li>Every applicant has a verified .edu email</li>
              <li>Streamline your internship recruitment process</li>
              <li>Pay based on the results you receive</li>
              <li>Make hiring decisions backed by measurable data</li>
            </ul>
            <Link href="/register?role=employer" className={s.btnNavy}>Create an employer account</Link>
          </PressCard>
        </main>
      </div>

      <Footer />
    </>
  );
}
