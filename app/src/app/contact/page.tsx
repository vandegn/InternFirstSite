import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function ContactPage() {
  return (
    <>
      <Header />

      <section className="hero">
        <div className="container">
          <div className="hero-badge">Get in Touch</div>
          <h1>Contact Us</h1>
        </div>
      </section>

      <section className="contact-section">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-info">

              {/* Email Card */}
              <div className="contact-card">
                <div className="contact-card-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 8L14.764 15.882C15.178 16.1747 15.6724 16.3318 16.18 16.3318C16.6876 16.3318 17.182 16.1747 17.596 15.882L28 8" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="2" y="6" width="28" height="20" rx="3" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3>Email</h3>
                <p>info@internfirst.com</p>
              </div>

              {/* Location Card */}
              <div className="contact-card">
                <div className="contact-card-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M26 14C26 22 16 30 16 30C16 30 6 22 6 14C6 11.3478 7.05357 8.8043 8.92893 6.92893C10.8043 5.05357 13.3478 4 16 4C18.6522 4 21.1957 5.05357 23.0711 6.92893C24.9464 8.8043 26 11.3478 26 14Z" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="16" cy="14" r="4" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3>Location</h3>
                <p>United States</p>
              </div>

              {/* Social Media Card */}
              <div className="contact-card">
                <div className="contact-card-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M28 4L14 18" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M28 4L19 28L14 18L4 13L28 4Z" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3>Social Media</h3>
                <p>Follow us on LinkedIn &amp; Twitter</p>
              </div>

            </div>

            <div className="contact-form-wrap">
              <h2>Send us a message</h2>
              <form className="contact-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name">Full Name</label>
                    <input type="text" id="name" placeholder="John Doe" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">Email Address</label>
                    <input type="email" id="email" placeholder="john@example.com" required />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="subject">Subject</label>
                  <input type="text" id="subject" placeholder="How can we help?" />
                </div>
                <div className="form-group">
                  <label htmlFor="message">Message</label>
                  <textarea id="message" rows={5} placeholder="Your message..." required></textarea>
                </div>
                <button type="submit" className="btn-primary">Send Message</button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
