'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Red_Hat_Display } from 'next/font/google';
import { supabase, getProfile, DASHBOARD_ROUTES } from '@/lib/supabase';

// The one public top bar. It is the navy band from the homepage, lifted out so
// every marketing and auth page carries the same chrome instead of each page
// drawing its own. Styles live under `.header` in globals.css.
const display = Red_Hat_Display({ subsets: ['latin'], weight: ['500', '700'] });

const navLinks = [
  { href: '/about', label: 'About' },
  { href: '/internships', label: 'Internships' },
  { href: '/contact', label: 'Contact' },
];

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoHref, setLogoHref] = useState('/');

  useEffect(() => {
    let active = true;
    async function resolveLogoHref() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const profile = await getProfile(user.id);
      if (active && profile?.role) {
        setLogoHref(DASHBOARD_ROUTES[profile.role] || '/');
      }
    }
    resolveLogoHref();
    return () => {
      active = false;
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <header className={`header ${display.className}`}>
      <div className="header-inner">
        <Link href={logoHref} className="logo" aria-label="InternFirst home" onClick={closeMenu}>
          {/* Always the light-on-white artwork: the chip is white in both themes. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="logo-chip"><img src="/internfirst-logo.png" alt="InternFirst" /></span>
        </Link>
        <nav className={`main-nav${menuOpen ? ' open' : ''}`} aria-label="Primary">
          <ul>
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={pathname === link.href ? 'active' : ''}
                  aria-current={pathname === link.href ? 'page' : undefined}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="header-actions">
            <Link href="/login" className="btn-login" onClick={closeMenu}>
              Log in
            </Link>
            <Link href="/register" className="btn-register" onClick={closeMenu}>
              Create account
            </Link>
          </div>
        </nav>
        <button
          className={`mobile-menu-toggle${menuOpen ? ' active' : ''}`}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
    </>
  );
}
