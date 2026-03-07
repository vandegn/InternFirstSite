import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <img
              src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png"
              alt="InternFirst"
              className="footer-logo"
            />
            <p>Internship recruitment made simple.</p>
          </div>
          <div className="footer-links">
            <h4>Pages</h4>
            <ul>
              <li><Link href="/">Home</Link></li>
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/career-resources">Resources</Link></li>
              <li><Link href="/register">Register</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Navigation</h4>
            <ul>
              <li><Link href="/dashboard/student">Students</Link></li>
              <li><Link href="/dashboard/employer">Employers</Link></li>
              <li><Link href="/dashboard/university">Universities</Link></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Resources</h4>
            <ul>
              <li>1:1 Resume Help</li>
              <li>Interview Prep</li>
              <li>Resume Templates</li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Contact Us</h4>
            <ul>
              <li>Social Media</li>
              <li>WhatsApp</li>
              <li>Email</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 InternFirst All Rights Reserved.</p>
          <ul>
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms &amp; Conditions</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
