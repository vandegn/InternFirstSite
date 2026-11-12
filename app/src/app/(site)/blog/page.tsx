import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { pageMetadata } from '@/lib/site';
import { getPublishedArticles, type ArticleSummary } from '@/lib/content-public';

// The guides index. This page used to be six placeholder cards with "#" links
// and was noindex'd for it; it now lists the published rows of
// content_articles, server-rendered so every guide is linked from crawlable
// HTML. Hourly ISR, and publishing revalidates it on the spot.
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: 'Internship Guides',
  description:
    'Practical guides for students searching for internships and employers hiring interns: when to apply, how to stand out, how to interview, and how to hire.',
  path: '/blog',
});

const AUDIENCE_LABEL = { student: 'For students', employer: 'For employers', both: 'Students & employers' } as const;

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <article className="guide-card">
      <div className="guide-card-meta">
        <span className="guide-card-audience">{AUDIENCE_LABEL[article.audience]}</span>
        {article.published_at && <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>}
      </div>
      <h2>
        <Link href={`/blog/${article.slug}`}>{article.title}</Link>
      </h2>
      <p>{article.description}</p>
      <Link href={`/blog/${article.slug}`} className="guide-card-link">
        Read the guide &rarr;
      </Link>
    </article>
  );
}

export default async function BlogIndexPage() {
  const articles = await getPublishedArticles();
  const students = articles.filter((a) => a.audience !== 'employer');
  const employers = articles.filter((a) => a.audience !== 'student');

  return (
    <>
      <Header />
      <main id="main-content">
        <section className="hero" style={{ padding: '64px 0 32px' }}>
          <div className="container">
            <div className="hero-badge">Guides</div>
            <h1>Internship guides for students and employers</h1>
            <p className="hero-subtitle">
              Straight answers on finding, landing and hiring for internships, written by the InternFirst team.
            </p>
          </div>
        </section>

        <section style={{ padding: '20px 0 80px', background: 'var(--bg)' }}>
          <div className="container">
            {articles.length === 0 ? (
              <div className="guide-empty">
                <p>New guides are on the way. In the meantime, every open internship is one click away.</p>
                <Link href="/internships" className="btn-primary">Browse internships</Link>
              </div>
            ) : (
              <>
                {students.length > 0 && (
                  <section className="guide-section" aria-labelledby="guides-students">
                    <h2 id="guides-students">For students</h2>
                    <div className="guide-grid">
                      {students.map((a) => <ArticleCard key={a.id} article={a} />)}
                    </div>
                  </section>
                )}
                {employers.length > 0 && (
                  <section className="guide-section" aria-labelledby="guides-employers">
                    <h2 id="guides-employers">For employers</h2>
                    <div className="guide-grid">
                      {employers.map((a) => <ArticleCard key={a.id} article={a} />)}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
