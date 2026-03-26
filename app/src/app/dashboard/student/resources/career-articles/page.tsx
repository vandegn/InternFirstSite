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

const sectionStyle: React.CSSProperties = { marginBottom: '36px', paddingBottom: '36px', borderBottom: '1px solid var(--border)' };
const lastSection: React.CSSProperties = { marginBottom: 0 };
const h3Style: React.CSSProperties = { fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px' };
const pStyle: React.CSSProperties = { color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.95rem', marginBottom: '12px' };
const listStyle: React.CSSProperties = { color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.95rem', paddingLeft: '20px', marginBottom: '12px' };

export default function CareerArticles() {
  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <Link href="/dashboard/student/resources" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Back to Resources
      </Link>

      <div className="profile-card" style={{ padding: '36px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Career Development Articles</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '36px' }}>Practical advice to help you build your professional foundation and stand out in the internship market.</p>

        {/* Article 1 */}
        <section style={sectionStyle}>
          <h3 style={h3Style}>Networking 101: Building Professional Relationships</h3>
          <p style={pStyle}>Networking is one of the most effective ways to find internships. Many positions are filled through referrals before they are ever posted publicly. Building genuine professional relationships early in your career pays dividends for years to come.</p>
          <ul style={listStyle}>
            <li><strong>Start with your existing network</strong> — professors, alumni, family friends, and classmates who have interned before are all great starting points</li>
            <li><strong>Attend career fairs and info sessions</strong> — these are low-pressure environments designed for students. Prepare a 30-second intro about yourself.</li>
            <li><strong>Use LinkedIn strategically</strong> — connect with recruiters, alumni from your university, and professionals in your target industry. Personalize every connection request.</li>
            <li><strong>Informational interviews</strong> — reach out to professionals for a 15-20 minute chat about their career path. Most people are happy to share their experience.</li>
            <li><strong>Follow up and maintain relationships</strong> — networking is not transactional. Stay in touch, share relevant articles, and congratulate connections on milestones.</li>
          </ul>
          <div style={tipBox}>
            <strong>Conversation starter:</strong> &quot;Hi [Name], I am a [major] student at [school] and I am really interested in [industry/role]. I would love to hear about your experience at [company]. Would you have 15 minutes for a quick chat?&quot;
          </div>
        </section>

        {/* Article 2 */}
        <section style={sectionStyle}>
          <h3 style={h3Style}>Building Your Personal Brand as a Student</h3>
          <p style={pStyle}>Your personal brand is how you present yourself professionally — online and offline. A strong personal brand helps recruiters remember you and see you as a serious candidate.</p>
          <ul style={listStyle}>
            <li><strong>Optimize your LinkedIn profile</strong> — professional headshot, compelling headline (not just &quot;Student at X&quot;), detailed experience section, and a summary that tells your story</li>
            <li><strong>Create a portfolio or personal website</strong> — especially valuable for design, engineering, marketing, and writing roles. Showcase your best projects.</li>
            <li><strong>Be intentional on social media</strong> — employers will search for you. Make sure public profiles reflect the image you want to project.</li>
            <li><strong>Develop a consistent narrative</strong> — know your story: what you are passionate about, what you have done, and where you are headed. This should come through in your resume, cover letter, and interviews.</li>
            <li><strong>Share your expertise</strong> — write about what you are learning, share projects, comment thoughtfully on industry posts. This positions you as engaged and knowledgeable.</li>
          </ul>
        </section>

        {/* Article 3 */}
        <section style={sectionStyle}>
          <h3 style={h3Style}>Making the Most of Your First Internship</h3>
          <p style={pStyle}>Your first internship is a learning experience above all else. How you approach it sets the tone for your early career and can open doors to future opportunities.</p>
          <ul style={listStyle}>
            <li><strong>Set clear goals in week one</strong> — ask your manager what success looks like for the internship. Write down 2-3 things you want to learn or accomplish.</li>
            <li><strong>Ask questions early and often</strong> — no one expects an intern to know everything. Showing curiosity is a strength, not a weakness.</li>
            <li><strong>Take initiative</strong> — when you finish assigned tasks, ask for more. Volunteer for projects outside your direct scope. This is how you get noticed.</li>
            <li><strong>Build relationships with your team</strong> — learn everyone&apos;s name, attend social events, have lunch with different people. These connections matter.</li>
            <li><strong>Document everything</strong> — keep notes on projects, metrics, and accomplishments. You will need this for your resume and future interviews.</li>
            <li><strong>Ask for feedback</strong> — do not wait for your mid-point review. Regular check-ins with your manager show maturity and a growth mindset.</li>
          </ul>
          <div style={tipBox}>
            <strong>Before your last day:</strong> Ask your manager if you can stay in touch, request a LinkedIn recommendation, and send thank-you notes to everyone who helped you. If you want to return, say so explicitly.
          </div>
        </section>

        {/* Article 4 */}
        <section style={sectionStyle}>
          <h3 style={h3Style}>Understanding Salary and Compensation</h3>
          <p style={pStyle}>Even as an intern, understanding compensation helps you make informed decisions and sets good habits for your career.</p>
          <ul style={listStyle}>
            <li><strong>Know the market rate</strong> — research typical internship pay for your industry and location using sites like Glassdoor, Levels.fyi, or Handshake</li>
            <li><strong>Understand the full package</strong> — some internships offer housing stipends, relocation assistance, or signing bonuses in addition to hourly pay</li>
            <li><strong>Unpaid internships</strong> — weigh the value of the experience and connections against the financial cost. Unpaid does not automatically mean bad, but be selective.</li>
            <li><strong>When to negotiate</strong> — if you receive a competing offer, it is appropriate to ask if there is flexibility. Be professional and cite specific data.</li>
            <li><strong>Consider total value</strong> — mentorship, brand name, project quality, and return offer rates can be more valuable than a few extra dollars per hour</li>
          </ul>
        </section>

        {/* Article 5 */}
        <section style={lastSection}>
          <h3 style={h3Style}>Transitioning from College to Career</h3>
          <p style={pStyle}>The shift from student to professional can feel overwhelming. These strategies help you navigate the transition smoothly.</p>
          <ul style={listStyle}>
            <li><strong>Start early</strong> — begin your job search 6-9 months before graduation. Many companies recruit early, especially in finance and consulting.</li>
            <li><strong>Leverage your internship network</strong> — former managers and colleagues are your best advocates. Reach out about openings at their companies.</li>
            <li><strong>Build professional habits now</strong> — email etiquette, time management, meeting preparation, and workplace communication are skills you can develop before day one.</li>
            <li><strong>Be open to unexpected paths</strong> — your first job does not have to be your dream job. What matters most is learning, growing, and building momentum.</li>
            <li><strong>Invest in continuous learning</strong> — certifications, online courses, and professional development show initiative and keep your skills current</li>
          </ul>
          <div style={tipBox}>
            <strong>Remember:</strong> Everyone starts somewhere. The skills you build as an intern — communication, problem-solving, teamwork, and adaptability — are the same skills that drive long-term career success regardless of your specific role or industry.
          </div>
        </section>
      </div>
    </div>
  );
}
