'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase, getProfile, DASHBOARD_ROUTES } from '@/lib/supabase';
import BrandLogo from '@/components/BrandLogo';

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

  return (
    <>
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <header className="header">
      <div className="header-inner">
        <Link href={logoHref} className="logo">
          <BrandLogo />
        </Link>
        <nav className={`main-nav${menuOpen ? ' open' : ''}`}>
          <ul>
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={pathname === link.href ? 'active' : ''}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="header-actions">
            <Link href="/login" className="btn-login" onClick={() => setMenuOpen(false)}>
              Login
            </Link>
            <Link href="/register" className="btn-register" onClick={() => setMenuOpen(false)}>
              Register
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
