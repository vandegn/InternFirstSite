'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase, getProfile, getUnreadCount } from '@/lib/supabase';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
};

const STUDENT_NAV: NavItem[] = [
  {
    href: '/dashboard/student',
    label: 'Home',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    href: '/dashboard/student/internships',
    label: 'Job Portal',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 3h-8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/></svg>,
  },
  {
    href: '/dashboard/student/inbox',
    label: 'Messages',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  },
  {
    href: '/dashboard/student/resources',
    label: 'Career Resources',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
  {
    href: '/dashboard/student/profile',
    label: 'Profile',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  },
  { href: '__divider__', label: '', icon: null },
  {
    href: '/dashboard/student/settings',
    label: 'Settings',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z"/></svg>,
  },
];

const EMPLOYER_NAV: NavItem[] = [
  {
    href: '/dashboard/employer',
    label: 'Home',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    href: '/dashboard/employer/listings/new',
    label: 'Post a Job',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  },
  {
    href: '/dashboard/employer/posted-jobs',
    label: 'Posted Jobs',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  {
    href: '/dashboard/employer/crm',
    label: 'CRM',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  },
  {
    href: '/dashboard/employer/inbox',
    label: 'Messages',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  },
  {
    href: '/dashboard/employer/account',
    label: 'Account',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  },
  { href: '__divider__', label: '', icon: null },
  {
    href: '/dashboard/employer/settings',
    label: 'Settings',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z"/></svg>,
  },
];

const ROLE_LABELS: Record<string, string> = {
  student: 'Student Dashboard',
  employer: 'Employer Dashboard',
};

function getNavForRole(role: string): NavItem[] {
  if (role === 'student') return STUDENT_NAV;
  if (role === 'employer') return EMPLOYER_NAV;
  return [];
}

function isActive(pathname: string, href: string, role: string): boolean {
  const basePath = `/dashboard/${role}`;
  if (href === basePath) return pathname === basePath;
  return pathname.startsWith(href);
}

export default function DashboardShell({ children, role }: { children: React.ReactNode; role: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchShellData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profile = await getProfile(user.id);
      if (profile) {
        setProfileName(profile.full_name);
        setProfileAvatar(profile.avatar_url);
      }

      const unread = await getUnreadCount(user.id);
      setUnreadMessages(unread);
    }
    fetchShellData();
  }, [role]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const navItems = getNavForRole(role);
  const sidebarWidth = collapsed ? 64 : 240;

  return (
    <div className="dashboard-body">
      {/* Header */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            <Link href="/" className="logo">
              <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
            </Link>
            <span className="portal-label">{ROLE_LABELS[role] || 'Dashboard'}</span>
          </div>
          <div className="dash-header-right">
            <div className="dash-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search..." />
            </div>
            <div className="dash-avatar" ref={avatarRef} onClick={() => setAvatarOpen(!avatarOpen)}>
              <img src={profileAvatar || 'https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png'} alt={profileName || 'Profile'} />
              {avatarOpen && (
                <div className="avatar-dropdown">
                  <button onClick={handleSignOut} className="avatar-dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
        {/* Sidebar */}
        <aside
          style={{
            width: sidebarWidth,
            minWidth: sidebarWidth,
            background: '#fff',
            borderRight: '1px solid var(--border)',
            padding: 0,
            transition: 'width 0.2s ease, min-width 0.2s ease',
            overflow: 'visible',
            position: 'relative',
            flexShrink: 0,
            zIndex: 20,
          }}
        >
          {/* Collapse/expand arrow on the right edge */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              position: 'fixed',
              top: 'calc(50vh + 32px)',
              left: sidebarWidth - 12,
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#fff',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              transition: 'background 0.15s, left 0.2s ease',
              color: 'var(--text-secondary)',
              padding: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-light)')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', position: 'sticky', top: 64, maxHeight: 'calc(100vh - 64px)', overflowY: 'auto', paddingTop: '20px', paddingBottom: '20px' }}>
            {navItems.map((item, i) => {
              if (item.href === '__divider__') {
                return <div key={`div-${i}`} className="sidebar-divider" style={collapsed ? { margin: '12px 8px' } : undefined} />;
              }
              const active = isActive(pathname, item.href, role);
              const showBadge = item.label === 'Messages' && unreadMessages > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'space-between',
                    gap: collapsed ? '0' : '12px',
                    padding: collapsed ? '10px 0' : '10px 24px',
                    fontSize: '14px',
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--primary)' : 'var(--text-secondary)',
                    background: active ? 'var(--primary-light)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f8f9fb'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ flexShrink: 0, display: 'flex' }}>{item.icon}</span>
                    {!collapsed && <span>{item.label}</span>}
                  </span>
                  {!collapsed && showBadge && (
                    <span style={{
                      background: 'var(--primary)', color: '#fff', fontSize: '0.65rem',
                      fontWeight: 700, padding: '2px 7px', borderRadius: '10px',
                      minWidth: '20px', textAlign: 'center',
                    }}>
                      {unreadMessages}
                    </span>
                  )}
                  {collapsed && showBadge && (
                    <span style={{
                      position: 'absolute', top: '4px', right: '8px',
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: 'var(--accent, #9FC63C)',
                    }} />
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
