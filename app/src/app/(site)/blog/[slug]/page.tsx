import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SITE_NAME, OG_IMAGE } from '@/lib/site';
import { articleJsonLd, articleUrl, faqPageJsonLd, readingMinutes } from '@/lib/content-articles';
import { getPublishedArticle, getPublishedArticles } from '@/lib/content-public';
import { breadcrumbJsonLd, serializeJsonLd } from '@/lib/structured-data';

// One guide. A server component so the whole article — takeaways, body, FAQ
// — is in the initial HTML for crawlers and answer engines, with Article,
// FAQPage and BreadcrumbList structured data alongside.
export const revalidate = 3600;

type PageProps = { params: Promise<{ slug: string }> };

// Pre-render every published guide at build time; new ones render on demand.
export async function generateStaticParams() {
  const articles = await getPublishedArticles();
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) return { title: 'Guide not found', robots: { index: false, follow: true } };

  const url = articleUrl(article.slug);
  const fullTitle = `${article.title} | ${SITE_NAME}`;
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      locale: 'en_US',
      url,
      title: fullTitle,
      description: article.description,
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.updated_at,
      authors: [SITE_NAME],
      tags: article.tags,
      images: [OG_IMAGE],
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description: article.description, images: [OG_IMAGE.url] },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) notFound();

  const url = articleUrl(article.slug);
  const faqJson = faqPageJsonLd(article.faq, url);
  const published = article.published_at ?? article.created_at;
  const updated = article.updated_at.slice(0, 10) !== published.slice(0, 10);
  const cta =
    article.audience === 'employer'
      ? { href: '/register?role=employer', label: 'Post an internship', blurb: 'Reviewed employers post roles and hire interns on InternFirst at no charge during the pilot.' }
      : { href: '/internships', label: 'Browse internships', blurb: 'Every open internship from reviewed employers, no account needed to look.' };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleJsonLd(article)) }} />
      {faqJson && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJson) }} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Guides', path: '/blog' },
              { name: article.title, path: `/blog/${article.slug}` },
            ]),
          ),
        }}
      />

      <Header />
      <main id="main-content" className="guide-page">
        <article className="guide-article">
          <nav aria-label="Breadcrumb" className="guide-breadcrumb">
            <Link href="/blog">Guides</Link>
            <span aria-hidden="true"> / </span>
            <span>{article.audience === 'employer' ? 'For employers' : 'For students'}</span>
          </nav>

          <header className="guide-header">
            <h1>{article.title}</h1>
            <p className="guide-lede">{article.description}</p>
            <p className="guide-byline">
              By the {SITE_NAME} team · <time dateTime={published}>{formatDate(published)}</time>
              {updated && <> · Updated <time dateTime={article.updated_at}>{formatDate(article.updated_at)}</time></>}
              {' · '}{readingMinutes(article.body_markdown)} min read
            </p>
          </header>

          {article.key_takeaways.length > 0 && (
            <aside className="guide-takeaways" aria-labelledby="key-takeaways">
              <h2 id="key-takeaways">Key takeaways</h2>
              <ul>
                {article.key_takeaways.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </aside>
          )}

          <div className="markdown-content guide-body">
            <ReactMarkdown>{article.body_markdown}</ReactMarkdown>
          </div>

          {article.faq.length > 0 && (
            <section className="guide-faq" aria-labelledby="guide-faq-heading">
              <h2 id="guide-faq-heading">Frequently asked questions</h2>
              {article.faq.map((item) => (
                <details key={item.question} className="guide-faq-item">
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </section>
          )}

          <aside className="guide-cta">
            <h2>{cta.label} on {SITE_NAME}</h2>
            <p>{cta.blurb}</p>
            <Link href={cta.href} className="btn-primary">{cta.label}</Link>
          </aside>
        </article>
      </main>
      <Footer />
    </>
  );
}
