/**
 * The InternFirst wordmark, in both theme variants.
 *
 * Both images are in the DOM and globals.css hides whichever one doesn't match
 * `data-theme` on <html>. The theme attribute is stamped by the inline head
 * script before first paint (see lib/theme.ts), so the right variant is the
 * first one painted — no flash and no hydration-time swap. The dark variant is
 * a recolor of the same artwork (scripts/make-dark-logo.mjs), never a CSS filter.
 *
 * Any className is applied to both images, so existing selectors such as
 * `.logo img` or `.footer-logo` style whichever one is showing.
 */
type Props = {
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
};

export default function BrandLogo({ alt = 'InternFirst', className, width, height }: Props) {
  const extra = className ? ` ${className}` : '';
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/internfirst-logo.png" alt={alt} className={`brand-logo-light${extra}`} width={width} height={height} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/internfirst-logo-dark.png" alt={alt} className={`brand-logo-dark${extra}`} width={width} height={height} />
    </>
  );
}
