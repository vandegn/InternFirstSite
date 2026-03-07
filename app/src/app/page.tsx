'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const faqData = [
  {
    question: 'What methods of payments are supported?',
    answer:
      'InternFirst supports all major credit and debit cards, including Visa, Mastercard, American Express, and Discover. For universities and enterprise employers, we also support ACH transfers and invoiced billing upon request.',
  },
  {
    question: 'Can I cancel at anytime?',
    answer:
      'Yes. You can cancel your subscription at any time through your account settings. Your plan will remain active until the end of your current billing cycle, and you will not be charged again after cancellation.',
  },
  {
    question: 'How do I get a receipt for my purchase?',
    answer:
      'Receipts are automatically emailed to the billing contact after every successful payment. You can also download past invoices and receipts anytime from the Billing section in your account settings.',
  },
  {
    question: 'How do I get access after signing up?',
    answer:
      'After completing your purchase, access is granted immediately. You can find your purchased theme (or plan features) inside your account dashboard under "Purchases" or "Billing." If access does not appear within a few minutes, contact support and we\'ll resolve it promptly.',
  },
];

export default function Home() {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [email, setEmail] = useState('');

  return (
    <>
      <Header />

      {/* HERO SECTION */}
      <section className="hero">
        <div className="container">
          <div className="hero-badge">#1 platform for interns</div>
          <h1>The easiest way to find an internship</h1>
          <p className="hero-subtitle">
            Connecting ambitious students, world-class employers, and leading universities in one premium platform.
          </p>
          <div className="hero-image">
            <img
              src="https://internfirst-demo.com/wp-content/uploads/2026/01/Frame-1321314341.png"
              alt="InternFirst Platform"
            />
          </div>
        </div>
      </section>

      {/* PARTNER LOGOS */}
      <section className="partners">
        <div className="container">
          <div className="partners-track">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/1-150x150.png" alt="Partner 1" />
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/2-150x150.png" alt="Partner 2" />
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/3-150x150.png" alt="Partner 3" />
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/4-150x150.png" alt="Partner 4" />
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/5-150x150.png" alt="Partner 5" />
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/6-150x150.png" alt="Partner 6" />
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/7-150x150.png" alt="Partner 7" />
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/8-150x150.png" alt="Partner 8" />
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/9-150x150.png" alt="Partner 9" />
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="categories">
        <div className="container">
          <h2 className="section-title">Browse Internships by Category</h2>
          <p className="section-subtitle">
            Start your search by selecting the category that best fits your professional goals
          </p>
          <div className="category-grid">
            <div className="category-card">
              <div className="category-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                  <path d="M2 2l7.586 7.586" />
                  <circle cx="11" cy="11" r="2" />
                </svg>
              </div>
              <h3>Creative design</h3>
              <Link href="/register">68 Internships Available</Link>
            </div>
            <div className="category-card">
              <div className="category-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <h3>Development</h3>
              <Link href="/register">120 Internships Available</Link>
            </div>
            <div className="category-card">
              <div className="category-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              </div>
              <h3>Admin marketing</h3>
              <Link href="/register">200 Internships Available</Link>
            </div>
            <div className="category-card">
              <div className="category-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <h3>Video editor</h3>
              <Link href="/register">124 Internships Available</Link>
            </div>
            <div className="category-card">
              <div className="category-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <h3>Data analyst</h3>
              <Link href="/register">26 Internships Available</Link>
            </div>
            <div className="category-card">
              <div className="category-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h3>Customer Service</h3>
              <Link href="/register">100 Internships Available</Link>
            </div>
            <div className="category-card">
              <div className="category-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <h3>Accounting</h3>
              <Link href="/register">68 Internships Available</Link>
            </div>
            <div className="category-card">
              <div className="category-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>
              <h3>Voice Over</h3>
              <Link href="/register">15 Internships Available</Link>
            </div>
          </div>
          <div className="section-cta">
            <Link href="/register" className="btn-outline">See More</Link>
          </div>
        </div>
      </section>

      {/* INTERNSHIPS */}
      <section className="internships">
        <div className="container">
          <h2 className="section-title">Internships You Might Be Interested In</h2>
          <p className="section-subtitle">
            Explore tailored opportunities across a wide range of specialized industries
          </p>
          <div className="internship-grid">
            <article className="internship-card">
              <div className="internship-img">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/9-1024x1024.png" alt="Product Designer" />
              </div>
              <div className="internship-body">
                <h3>Product Designer</h3>
                <p className="location">Syracuse, Connecticut</p>
                <div className="internship-meta">
                  <span className="badge-type">Full time</span>
                  <span className="badge-salary">$1,500 / mo.</span>
                </div>
                <div className="tags">
                  <span>App</span>
                  <span>Figma</span>
                  <span>PSD</span>
                </div>
                <Link href="/register" className="btn-apply">Apply</Link>
              </div>
            </article>
            <article className="internship-card">
              <div className="internship-img">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/6-1024x1024.png" alt="Medical Assistant" />
              </div>
              <div className="internship-body">
                <h3>Medical Assistant</h3>
                <p className="location">Kent, Utah</p>
                <div className="internship-meta">
                  <span className="badge-type">Full time</span>
                  <span className="badge-salary">$1,500 / mo.</span>
                </div>
                <div className="tags">
                  <span>App</span>
                  <span>Figma</span>
                  <span>PSD</span>
                </div>
                <Link href="/register" className="btn-apply">Apply</Link>
              </div>
            </article>
            <article className="internship-card">
              <div className="internship-img">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/4-1024x1024.png" alt="Librarian" />
              </div>
              <div className="internship-body">
                <h3>Librarian</h3>
                <p className="location">Portland, Illinois</p>
                <div className="internship-meta">
                  <span className="badge-type">Full time</span>
                  <span className="badge-salary">$1,500 / mo.</span>
                </div>
                <div className="tags">
                  <span>App</span>
                  <span>Figma</span>
                  <span>PSD</span>
                </div>
                <Link href="/register" className="btn-apply">Apply</Link>
              </div>
            </article>
            <article className="internship-card">
              <div className="internship-img">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/8-1024x1024.png" alt="Web Designer" />
              </div>
              <div className="internship-body">
                <h3>Web Designer</h3>
                <p className="location">Lafayette, California</p>
                <div className="internship-meta">
                  <span className="badge-type">Full time</span>
                  <span className="badge-salary">$1,500 / mo.</span>
                </div>
                <div className="tags">
                  <span>App</span>
                  <span>Figma</span>
                  <span>PSD</span>
                </div>
                <Link href="/register" className="btn-apply">Apply</Link>
              </div>
            </article>
            <article className="internship-card">
              <div className="internship-img">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/5-1024x1024.png" alt="Marketing Coordinator" />
              </div>
              <div className="internship-body">
                <h3>Marketing Coordinator</h3>
                <p className="location">Lansing, Illinois</p>
                <div className="internship-meta">
                  <span className="badge-type">Full time</span>
                  <span className="badge-salary">$1,500 / mo.</span>
                </div>
                <div className="tags">
                  <span>App</span>
                  <span>Figma</span>
                  <span>PSD</span>
                </div>
                <Link href="/register" className="btn-apply">Apply</Link>
              </div>
            </article>
            <article className="internship-card">
              <div className="internship-img">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/1-1024x1024.png" alt="Dog Trainer" />
              </div>
              <div className="internship-body">
                <h3>Dog Trainer</h3>
                <p className="location">Stockton, New Hampshire</p>
                <div className="internship-meta">
                  <span className="badge-type">Full time</span>
                  <span className="badge-salary">$1,500 / mo.</span>
                </div>
                <div className="tags">
                  <span>App</span>
                  <span>Figma</span>
                  <span>PSD</span>
                </div>
                <Link href="/register" className="btn-apply">Apply</Link>
              </div>
            </article>
            <article className="internship-card">
              <div className="internship-img">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/7-1024x1024.png" alt="Nursing Assistant" />
              </div>
              <div className="internship-body">
                <h3>Nursing Assistant</h3>
                <p className="location">Great Falls, Maryland</p>
                <div className="internship-meta">
                  <span className="badge-type">Full time</span>
                  <span className="badge-salary">$1,500 / mo.</span>
                </div>
                <div className="tags">
                  <span>App</span>
                  <span>Figma</span>
                  <span>PSD</span>
                </div>
                <Link href="/register" className="btn-apply">Apply</Link>
              </div>
            </article>
            <article className="internship-card">
              <div className="internship-img">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/3-1024x1024.png" alt="President of Sales" />
              </div>
              <div className="internship-body">
                <h3>President of Sales</h3>
                <p className="location">Pasadena, Oklahoma</p>
                <div className="internship-meta">
                  <span className="badge-type">Full time</span>
                  <span className="badge-salary">$1,500 / mo.</span>
                </div>
                <div className="tags">
                  <span>App</span>
                  <span>Figma</span>
                  <span>PSD</span>
                </div>
                <Link href="/register" className="btn-apply">Apply</Link>
              </div>
            </article>
          </div>
          <div className="section-cta">
            <Link href="/register" className="btn-outline">See More</Link>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Find The One That&apos;s Right For You</h2>
            <p>Advanced management tools are yours to use, as well as premium access to verified talent.</p>
            <ul className="cta-features">
              <li>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#7B61FF" />
                  <path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Seamless Searching
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#7B61FF" />
                  <path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Get Top Talent For Your Project
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#7B61FF" />
                  <path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Protected Payments System
              </li>
            </ul>
            <div className="cta-buttons">
              <Link href="/register" className="btn-primary">Find Work</Link>
              <Link href="/register" className="btn-secondary">Post an Internship</Link>
            </div>
          </div>
        </div>
      </section>

      {/* MATCHED INTERNSHIP */}
      <section className="matched-section">
        <div className="container">
          <div className="matched-inner">
            <span className="matched-badge">#1 INTERNSHIP PLATFORM</span>
            <h2>Get Your Matched Internship In a Few Minutes</h2>
            <p>Find your dream internship &amp; earn from world leading brands, upload your CV now.</p>
            <Link href="/register" className="btn-white">Get started</Link>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials">
        <div className="container">
          <h2 className="section-title">Success Stories from Interns</h2>
          <p className="section-subtitle">
            Thousands have found their dream internship with us. Hear what they say!
          </p>
          <div className="testimonial-grid">
            <div className="testimonial-card">
              <div className="testimonial-header">
                <img
                  src="https://internfirst-demo.com/wp-content/uploads/2026/02/Logomark.png"
                  alt="Capsule"
                  className="company-logo"
                />
                <span className="company-name">Capsule</span>
              </div>
              <h4>Landed My Dream Internship in Just 2 Weeks!</h4>
              <blockquote>
                &quot;InternFirst made Internship searching effortless. I applied to multiple positions, and within two
                weeks, I got hired!&quot;
              </blockquote>
              <div className="testimonial-author">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-34.png" alt="James W." />
                <div>
                  <strong>James W.</strong>
                  <span>Software Engineer</span>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-header">
                <img
                  src="https://internfirst-demo.com/wp-content/uploads/2026/02/Logomark-1.png"
                  alt="Galileo"
                  className="company-logo"
                />
                <span className="company-name">Galileo</span>
              </div>
              <h4>Easy to Apply, Fast Responses</h4>
              <blockquote>
                &quot;Unlike other Internship sites, InternFirst helped me get responses quickly. Employers here are very
                active!&quot;
              </blockquote>
              <div className="testimonial-author">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-34-3.png" alt="Lisa J." />
                <div>
                  <strong>Lisa J.</strong>
                  <span>Marketing Specialist</span>
                </div>
              </div>
            </div>
            <div className="testimonial-card video-card">
              <div className="video-testimonial">
                <img
                  src="https://internfirst-demo.com/wp-content/uploads/2026/02/Frame-28.png"
                  alt="Video testimonial"
                  className="video-bg"
                />
                <button className="play-btn">
                  <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/PlayCircle.png" alt="Play" />
                </button>
                <div className="video-info">
                  <span className="video-badge">Best Video</span>
                  <h4>Ardoshindo</h4>
                  <p>Software Engineer</p>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-header">
                <img
                  src="https://internfirst-demo.com/wp-content/uploads/2026/02/Logomark-2.png"
                  alt="Focal Point"
                  className="company-logo"
                />
                <span className="company-name">Focal Point</span>
              </div>
              <h4>The Best Internship Portal I&apos;ve Used</h4>
              <blockquote>
                &quot;The platform is user-friendly, and the Internship recommendations are spot on. Highly recommend
                it!&quot;
              </blockquote>
              <div className="testimonial-author">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-34-2.png" alt="Sophia M." />
                <div>
                  <strong>Sophia M.</strong>
                  <span>UI/UX Designer</span>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-header">
                <img
                  src="https://internfirst-demo.com/wp-content/uploads/2026/02/Logomark-2.png"
                  alt="Focal Point"
                  className="company-logo"
                />
                <span className="company-name">Focal Point</span>
              </div>
              <h4>The Best Internship Portal I&apos;ve Used</h4>
              <blockquote>
                &quot;The platform is user-friendly, and the internships recommendations are spot on. Highly recommend
                it!&quot;
              </blockquote>
              <div className="testimonial-author">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-34.png" alt="James W." />
                <div>
                  <strong>James W.</strong>
                  <span>Software Engineer</span>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-header">
                <img
                  src="https://internfirst-demo.com/wp-content/uploads/2026/02/Logomark-3.png"
                  alt="Lumnious"
                  className="company-logo"
                />
                <span className="company-name">Lumnious</span>
              </div>
              <h4>Great for Remote Work Seekers</h4>
              <blockquote>
                &quot;I found a high-paying remote Internship thanks to InternFirst. The filters made it easy to find
                exactly what I wanted.&quot;
              </blockquote>
              <div className="testimonial-author">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-34-1.png" alt="Daniel T." />
                <div>
                  <strong>Daniel T.</strong>
                  <span>Data Analyst</span>
                </div>
              </div>
            </div>
          </div>
          <div className="section-cta">
            <a href="#" className="btn-outline">See all</a>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-it-works">
        <div className="container">
          <h2 className="section-title">How it works</h2>
          <div className="steps">
            <div className="step">
              <div className="step-icon">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Group.png" alt="Create Account" />
              </div>
              <h3>Create Account</h3>
              <p>It&apos;s very easy to open an account and start your journey.</p>
            </div>
            <div className="step-connector">
              <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Vector-30.png" alt="" />
            </div>
            <div className="step">
              <div className="step-icon">
                <img
                  src="https://internfirst-demo.com/wp-content/uploads/2026/02/Group-1.png"
                  alt="Complete Profile"
                />
              </div>
              <h3>Complete Your Profile</h3>
              <p>Complete your profile with all the info to get attention of client.</p>
            </div>
            <div className="step-connector">
              <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Vector-30.png" alt="" />
            </div>
            <div className="step">
              <div className="step-icon">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Group-2.png" alt="Apply" />
              </div>
              <h3>Apply For An Internship</h3>
              <p>Apply &amp; get your preferable internship.</p>
            </div>
          </div>
        </div>
      </section>

      {/* BLOG */}
      <section className="blog-section">
        <div className="container">
          <h2 className="section-title">Blogs You Might Be Interested In</h2>
          <p className="section-subtitle">
            Stay up to date with the latest information regarding internships.
          </p>
          <div className="blog-grid">
            <article className="blog-card">
              <div className="blog-img">
                <img
                  src="https://internfirst-demo.com/wp-content/uploads/2026/02/Rectangle-205.png"
                  alt="Blog post"
                />
              </div>
              <div className="blog-body">
                <div className="blog-meta">
                  <span>New York</span>
                  <span>March 20, 2024</span>
                </div>
                <h3>Strategies for success: customer engagement art copy</h3>
                <a href="#" className="blog-link">Learn more →</a>
              </div>
            </article>
            <article className="blog-card">
              <div className="blog-img">
                <img
                  src="https://internfirst-demo.com/wp-content/uploads/2026/02/Rectangle-205-1.png"
                  alt="Blog post"
                />
              </div>
              <div className="blog-body">
                <div className="blog-meta">
                  <span>New York</span>
                  <span>March 20, 2024</span>
                </div>
                <h3>Strategies for success: customer engagement art copy</h3>
                <a href="#" className="blog-link">Learn more →</a>
              </div>
            </article>
            <article className="blog-card">
              <div className="blog-img">
                <img
                  src="https://internfirst-demo.com/wp-content/uploads/2026/02/Rectangle-205-2.png"
                  alt="Blog post"
                />
              </div>
              <div className="blog-body">
                <div className="blog-meta">
                  <span>New York</span>
                  <span>March 20, 2024</span>
                </div>
                <h3>Strategies for success: customer engagement art copy</h3>
                <a href="#" className="blog-link">Learn more →</a>
              </div>
            </article>
            <article className="blog-card">
              <div className="blog-img">
                <img
                  src="https://internfirst-demo.com/wp-content/uploads/2026/02/Rectangle-205.png"
                  alt="Blog post"
                />
              </div>
              <div className="blog-body">
                <div className="blog-meta">
                  <span>New York</span>
                  <span>March 20, 2024</span>
                </div>
                <h3>Strategies for success: customer engagement art copy</h3>
                <a href="#" className="blog-link">Learn more →</a>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section">
        <div className="container">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <div className="faq-list">
            {faqData.map((faq, index) => (
              <div key={index} className={`faq-item${activeFaq === index ? ' active' : ''}`}>
                <button
                  className="faq-question"
                  onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                >
                  <span>{faq.question}</span>
                  <svg
                    className="faq-icon"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <div className="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="newsletter">
        <div className="container">
          <div className="newsletter-inner">
            <h2>Sign up for our newsletter</h2>
            <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit">Send</button>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
