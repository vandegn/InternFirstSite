'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase, getProfile, getUnreadCount, DASHBOARD_ROUTES } from '@/lib/supabase';
import NotificationBell from './NotificationBell';
import FeedbackButton from './FeedbackButton';
import CommunityBanner from './CommunityBanner';
import Avatar from './Avatar';

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
    href: '/dashboard/employer/pipeline',
    label: 'Pipeline',
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
];

const ADMIN_NAV: NavItem[] = [
  {
    href: '/dashboard/admin',
    label: 'View Waitlist',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    href: '/dashboard/admin/employers',
    label: 'Employer Verification',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
  },
  {
    href: '/dashboard/admin/feedback',
    label: 'Feedback',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
];

const ROLE_LABELS: Record<string, string> = {
  student: 'Student Dashboard',
  employer: 'Employer Dashboard',
  intern_first_admin: 'Admin Dashboard',
};

function getNavForRole(role: string): NavItem[] {
  if (role === 'student') return STUDENT_NAV;
  if (role === 'employer') return EMPLOYER_NAV;
  if (role === 'intern_first_admin') return ADMIN_NAV;
  return [];
}

function isActive(pathname: string, href: string, role: string): boolean {
  // Via DASHBOARD_ROUTES, not `/dashboard/${role}` — the admin role is
  // `intern_first_admin` but its route is `/dashboard/admin`, so deriving the
  // base path from the role name left the index link matching every subpage.
  const basePath = DASHBOARD_ROUTES[role] ?? `/dashboard/${role}`;
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
    let cancelled = false;
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const profile = await getProfile(user.id);
      if (cancelled || !profile) return;
      setProfileName(profile.full_name);
      setProfileAvatar(profile.avatar_url);
    }
    fetchProfile();
    return () => { cancelled = true; };
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    async function refreshUnread() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const unread = await getUnreadCount(user.id);
      if (cancelled) return;
      setUnreadMessages(unread);
    }
    refreshUnread();
    function handleMessagesRead() { refreshUnread(); }
    window.addEventListener('messages-read', handleMessagesRead);
    return () => {
      cancelled = true;
      window.removeEventListener('messages-read', handleMessagesRead);
    };
  }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    // Land on the public home page. A single navigation (no push/replace race)
    // means the Back button behaves normally instead of bouncing off a
    // protected /dashboard/* route.
    router.replace('/');
  }

  const navItems = getNavForRole(role);
  const sidebarWidth = collapsed ? 64 : 240;

  return (
    <div className="dashboard-body">
      {/* Platform-level notice. Admins run the place, so they don't need it. */}
      {role !== 'intern_first_admin' && <CommunityBanner />}

      {/* Header */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            <Link href={DASHBOARD_ROUTES[role] || '/'} className="logo">
              <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
            </Link>
            <span className="portal-label">{ROLE_LABELS[role] || 'Dashboard'}</span>
          </div>
          <div className="dash-header-right">
            <NotificationBell />
            <div className="dash-avatar" ref={avatarRef} onClick={() => setAvatarOpen(!avatarOpen)}>
              <Avatar src={profileAvatar} name={profileName} size={36} />
              {avatarOpen && (
                <div className="avatar-dropdown">
                  {role !== 'intern_first_admin' && (
                    <Link href={`/dashboard/${role}/settings`} className="avatar-dropdown-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z"/></svg>
                      Settings
                    </Link>
                  )}
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

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <aside
          style={{
            width: sidebarWidth,
            minWidth: sidebarWidth,
            background: 'var(--surface)',
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
              background: 'var(--surface)',
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
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
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
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ flexShrink: 0, display: 'flex' }}>{item.icon}</span>
                    {!collapsed && <span>{item.label}</span>}
                  </span>
                  {!collapsed && showBadge && (
                    <span style={{
                      background: 'var(--primary)', color: 'var(--on-primary)', fontSize: '0.65rem',
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
          <div key={pathname} className="page-transition">
            {children}
          </div>
        </main>
      </div>

      {/* Feedback routes into the admin's inbox — pointless for the admin, who
          would just be messaging themselves. */}
      {role !== 'intern_first_admin' && <FeedbackButton />}
    </div>
  );
}
