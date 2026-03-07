import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function BlogPage() {
  return (
    <>
      <Header />

      <section className="hero">
        <div className="container">
          <div className="hero-badge">Our Blog</div>
          <h1>Latest News &amp; Insights</h1>
          <p className="hero-subtitle">
            Stay up to date with the latest information regarding internships, career tips, and industry trends.
          </p>
        </div>
      </section>

      <section className="blog-section" style={{ paddingTop: '40px' }}>
        <div className="container">
          <div className="blog-grid">

            {/* Card 1 */}
            <article className="blog-card">
              <div className="blog-img">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Rectangle-205.png" alt="Blog post" />
              </div>
              <div className="blog-body">
                <div className="blog-meta">
                  <span>New York</span>
                  <span>March 20, 2024</span>
                </div>
                <h3>Strategies for success: customer engagement art copy</h3>
                <a href="#" className="blog-link">Learn more &rarr;</a>
              </div>
            </article>

            {/* Card 2 */}
            <article className="blog-card">
              <div className="blog-img">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Rectangle-205-1.png" alt="Blog post" />
              </div>
              <div className="blog-body">
                <div className="blog-meta">
                  <span>Texas</span>
                  <span>March 11, 2024</span>
                </div>
                <h3>Smart growth essentials: data-driven content optimization</h3>
                <a href="#" className="blog-link">Learn more &rarr;</a>
              </div>
            </article>

            {/* Card 3 */}
            <article className="blog-card">
              <div className="blog-img">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Rectangle-205-2.png" alt="Blog post" />
              </div>
              <div className="blog-body">
                <div className="blog-meta">
                  <span>California</span>
                  <span>March 2, 2024</span>
                </div>
                <h3>The power of connection: brand storytelling that converts</h3>
                <a href="#" className="blog-link">Learn more &rarr;</a>
              </div>
            </article>

            {/* Card 4 */}
            <article className="blog-card">
              <div className="blog-img">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Rectangle-205.png" alt="Blog post" />
              </div>
              <div className="blog-body">
                <div className="blog-meta">
                  <span>New York</span>
                  <span>February 20, 2024</span>
                </div>
                <h3>Maximizing ROI: how to measure your internship program success</h3>
                <a href="#" className="blog-link">Learn more &rarr;</a>
              </div>
            </article>

            {/* Card 5 */}
            <article className="blog-card">
              <div className="blog-img">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Rectangle-205-1.png" alt="Blog post" />
              </div>
              <div className="blog-body">
                <div className="blog-meta">
                  <span>Texas</span>
                  <span>February 15, 2024</span>
                </div>
                <h3>Strategies for success: customer engagement art copy</h3>
                <a href="#" className="blog-link">Learn more &rarr;</a>
              </div>
            </article>

            {/* Card 6 */}
            <article className="blog-card">
              <div className="blog-img">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Rectangle-205-2.png" alt="Blog post" />
              </div>
              <div className="blog-body">
                <div className="blog-meta">
                  <span>California</span>
                  <span>February 8, 2024</span>
                </div>
                <h3>Building a strong foundation: networking tips for interns</h3>
                <a href="#" className="blog-link">Learn more &rarr;</a>
              </div>
            </article>

          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
