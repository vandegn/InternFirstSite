import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <>
      <Header />

      {/* Hero */}
      <section className="hero about-hero">
        <div className="container">
          <div className="hero-badge">#1 platform for interns</div>
          <h1>About Intern First</h1>
          <p className="hero-subtitle">
            InternFirst exists to simplify and modernize the internship ecosystem. We connect verified students, forward-thinking employers, and data-driven universities through one centralized platform designed specifically for early talent.
          </p>
        </div>
      </section>

      {/* About image */}
      <section className="about-image-section">
        <div className="container">
          <div className="about-hero-img">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/IMG_6644-scaled.jpeg" alt="InternFirst Team" />
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section className="about-block">
        <div className="container">
          <div className="about-content-centered">
            <h2>Our Mission</h2>
            <p>
              InternFirst exists to simplify and modernize the internship ecosystem. We connect verified students, forward-thinking employers, and data-driven universities through one centralized platform designed specifically for early talent. Our goal is simple: make internships easier to find, easier to manage, and easier to measure.
            </p>
          </div>
        </div>
      </section>

      {/* Why We Built InternFirst */}
      <section className="about-block alt-bg">
        <div className="container">
          <div className="about-content-centered">
            <h2>Why We Built InternFirst</h2>
            <p>
              The internship landscape is fragmented. Students juggle multiple apps for applications, interviews, messaging, and resume help. Employers manage job boards and spreadsheets. Universities rely on outdated systems to track outcomes. InternFirst consolidates applications, messaging, analytics, events, surveys, and workflow management into one seamless platform.
            </p>
          </div>
        </div>
      </section>

      {/* Our Vision */}
      <section className="about-block">
        <div className="container">
          <div className="about-content-centered">
            <h2>Our Vision</h2>
            <p>
              We believe internships are the gateway to long-term career success. InternFirst is building the infrastructure for the next generation of interns, creating transparency and opportunity for all stakeholders in the early talent pipeline.
            </p>
          </div>
        </div>
      </section>

      {/* Who We Serve */}
      <section className="who-we-serve">
        <div className="container">
          <h2 className="section-title">Who we serve</h2>
          <div className="serve-grid">

            {/* Students Card */}
            <div className="serve-card">
              <div className="serve-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 4L4 14L24 24L44 14L24 4Z" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 34L24 44L44 34" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 24L24 34L44 24" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3>Students</h3>
              <ul>
                <li>Verified .edu access</li>
                <li>Centralized job portal</li>
                <li>Application tracking</li>
                <li>Career center scheduling</li>
                <li>Networking tools</li>
                <li>Interview management</li>
                <li>Deadline tracking</li>
                <li>Career fair RSVPs</li>
                <li>Recruiter connections</li>
              </ul>
            </div>

            {/* Employers Card */}
            <div className="serve-card">
              <div className="serve-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M40 16H8C5.79086 16 4 17.7909 4 20V40C4 42.2091 5.79086 44 8 44H40C42.2091 44 44 42.2091 44 40V20C44 17.7909 42.2091 16 40 16Z" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M32 44V12C32 10.9391 31.5786 9.92172 30.8284 9.17157C30.0783 8.42143 29.0609 8 28 8H20C18.9391 8 17.9217 8.42143 17.1716 9.17157C16.4214 9.92172 16 10.9391 16 12V44" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3>Employers</h3>
              <ul>
                <li>Flexible job posting</li>
                <li>Built-in ATS</li>
                <li>Interview delegation</li>
                <li>Integrated CRM</li>
                <li>Outreach management</li>
                <li>Candidate ranking</li>
                <li>Performance tracking</li>
              </ul>
            </div>

            {/* Universities Card */}
            <div className="serve-card">
              <div className="serve-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 44V18" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M40 44V18" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 18L24 4L44 18" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 44H44" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 44V30H24V44" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M32 28H36" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M32 36H36" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3>Universities</h3>
              <ul>
                <li>Real-time KPI dashboards</li>
                <li>Survey distribution</li>
                <li>Event tracking</li>
                <li>Appointment management</li>
                <li>Simplified CRM</li>
                <li>Student outcome measurement</li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* What Makes InternFirst Different */}
      <section className="about-block alt-bg">
        <div className="container">
          <div className="about-split">
            <div className="about-split-text">
              <h2>What Makes InternFirst Different</h2>
              <ul className="feature-list">
                <li>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#7B61FF" /><path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Verified Student network (.edu gated)
                </li>
                <li>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#7B61FF" /><path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Integrated ATS and CRM tools
                </li>
                <li>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#7B61FF" /><path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Real-time University KPI dashboards
                </li>
                <li>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#7B61FF" /><path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Event RSVP and attendance tracking
                </li>
                <li>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#7B61FF" /><path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Built-in survey distribution
                </li>
                <li>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#7B61FF" /><path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Centralized messaging and scheduling
                </li>
                <li>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#7B61FF" /><path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  One platform for entire internship lifecycle
                </li>
              </ul>
            </div>
            <div className="about-split-img">
              <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="matched-section">
        <div className="container">
          <div className="matched-inner">
            <h2>Launch your future - One project at a time.</h2>
            <Link href="/register" className="btn-white">Get Started</Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
