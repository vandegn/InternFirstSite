'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navLinks = [
  { href: '/dashboard/student', label: 'Student' },
  { href: '/dashboard/employer', label: 'Employers' },
  { href: '/dashboard/university', label: 'University' },
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="logo">
          <img
            src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png"
            alt="InternFirst"
          />
        </Link>
        <nav className={`main-nav${menuOpen ? ' open' : ''}`}>
          <ul>
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={pathname === link.href ? 'active' : ''}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="header-actions">
          <Link href="/login" className="btn-login">
            Login
          </Link>
          <Link href="/register" className="btn-register">
            Register
          </Link>
        </div>
        <button
          className={`mobile-menu-toggle${menuOpen ? ' active' : ''}`}
          aria-label="Toggle menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  );
}
