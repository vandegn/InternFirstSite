'use client';

import Link from 'next/link';

const tipBox: React.CSSProperties = {
  padding: '16px 20px',
  borderLeft: '4px solid var(--primary)',
  background: 'rgba(26, 45, 73, 0.04)',
  borderRadius: '0 8px 8px 0',
  marginBottom: '16px',
  fontSize: '0.9rem',
  color: 'var(--text-secondary)',
  lineHeight: 1.7,
};

const sectionStyle: React.CSSProperties = { marginBottom: '32px' };
const h3Style: React.CSSProperties = { fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px' };
const pStyle: React.CSSProperties = { color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.95rem', marginBottom: '12px' };
const listStyle: React.CSSProperties = { color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.95rem', paddingLeft: '20px', marginBottom: '12px' };

export default function ResumeGuide() {
  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <Link href="/dashboard/student/resources" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Back to Resources
      </Link>

      <div className="profile-card" style={{ padding: '36px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Resume Writing Guide</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '36px' }}>Everything you need to build a strong resume that gets noticed by recruiters.</p>

        <section style={sectionStyle}>
          <h3 style={h3Style}>Resume Structure</h3>
          <p style={pStyle}>A well-organized resume makes it easy for recruiters to quickly find the information they need. Here is the recommended order of sections:</p>
          <ol style={listStyle}>
            <li><strong>Contact Information</strong> — Full name, phone number, email, LinkedIn URL, and optionally your city/state. Skip your full address.</li>
            <li><strong>Education</strong> — University name, degree, major, expected graduation date, GPA (if 3.0+), and relevant coursework.</li>
            <li><strong>Experience</strong> — Internships, part-time jobs, research positions. List in reverse chronological order with bullet points describing your impact.</li>
            <li><strong>Projects</strong> — Personal, academic, or open-source projects. Include technologies used and outcomes.</li>
            <li><strong>Skills</strong> — Technical skills, tools, programming languages, certifications. Organize into categories.</li>
            <li><strong>Activities &amp; Leadership</strong> — Clubs, organizations, volunteer work, and leadership roles.</li>
          </ol>
        </section>

        <section style={sectionStyle}>
          <h3 style={h3Style}>Formatting Best Practices</h3>
          <div style={tipBox}>
            <strong>The 6-second rule:</strong> Recruiters typically spend 6-10 seconds on an initial resume scan. Make your most important information easy to find at a glance.
          </div>
          <ul style={listStyle}>
            <li>Keep it to <strong>one page</strong> for internship applications</li>
            <li>Use a clean, professional font (e.g., Calibri, Garamond, or Helvetica) at 10-12pt</li>
            <li>Maintain consistent margins (0.5-1 inch) and spacing throughout</li>
            <li>Use <strong>bold</strong> for job titles and company names to create visual hierarchy</li>
            <li>Save and submit as a <strong>PDF</strong> to preserve formatting</li>
            <li>Avoid graphics, tables, photos, or unusual formatting — many companies use ATS software that cannot parse these</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h3 style={h3Style}>Writing Strong Bullet Points</h3>
          <p style={pStyle}>Every bullet point should follow this formula: <strong>Action Verb + Task + Result/Impact</strong>. Quantify your impact whenever possible.</p>

          <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #fca5a5', background: 'rgba(220, 38, 38, 0.04)' }}>
              <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.85rem' }}>Weak</span>
              <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Helped with social media for the marketing team</p>
            </div>
            <div style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #bbf7d0', background: 'rgba(22, 101, 52, 0.04)' }}>
              <span style={{ color: '#166534', fontWeight: 600, fontSize: '0.85rem' }}>Strong</span>
              <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Managed 3 social media accounts, increasing follower engagement by 45% over 8 weeks through data-driven content scheduling</p>
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h3 style={h3Style}>Action Verbs to Use</h3>
          <p style={pStyle}>Start every bullet point with a strong action verb. Here are some organized by category:</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
            {[
              { category: 'Leadership', verbs: 'Led, Directed, Coordinated, Supervised, Mentored' },
              { category: 'Technical', verbs: 'Developed, Engineered, Implemented, Automated, Optimized' },
              { category: 'Research', verbs: 'Analyzed, Evaluated, Investigated, Synthesized, Assessed' },
              { category: 'Communication', verbs: 'Presented, Authored, Collaborated, Facilitated, Negotiated' },
              { category: 'Achievement', verbs: 'Achieved, Increased, Reduced, Improved, Delivered' },
              { category: 'Creative', verbs: 'Designed, Created, Launched, Produced, Innovated' },
            ].map((group) => (
              <div key={group.category} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px', color: 'var(--primary)' }}>{group.category}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{group.verbs}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={sectionStyle}>
          <h3 style={h3Style}>Tailoring Your Resume</h3>
          <p style={pStyle}>A generic resume will not stand out. Customize your resume for each application:</p>
          <ul style={listStyle}>
            <li><strong>Mirror the job description</strong> — use keywords and phrases from the posting in your bullet points</li>
            <li><strong>Reorder your bullet points</strong> — put the most relevant experience first under each role</li>
            <li><strong>Adjust your skills section</strong> — prioritize skills mentioned in the job requirements</li>
            <li><strong>Write a targeted summary</strong> — if you include one, tailor it to the specific role and company</li>
          </ul>
          <div style={tipBox}>
            <strong>Pro tip:</strong> Keep a &quot;master resume&quot; with all your experiences, then create tailored versions for each application by selecting the most relevant items.
          </div>
        </section>

        <section style={{ marginBottom: 0 }}>
          <h3 style={h3Style}>Common Mistakes to Avoid</h3>
          <ul style={listStyle}>
            <li><strong>Typos and grammatical errors</strong> — proofread multiple times and ask someone else to review</li>
            <li><strong>Including irrelevant information</strong> — every line should support your candidacy for the role</li>
            <li><strong>Using an unprofessional email</strong> — stick to firstname.lastname@email.com</li>
            <li><strong>Listing duties instead of accomplishments</strong> — focus on what you achieved, not just what you were responsible for</li>
            <li><strong>Inconsistent formatting</strong> — dates, fonts, bullet styles, and spacing should be uniform throughout</li>
            <li><strong>Including references or &quot;References available upon request&quot;</strong> — this is outdated and wastes space</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
