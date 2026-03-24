'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, getProfile, getStudentByUserId, getPartnerUniversity } from '@/lib/supabase';

interface UniversityInfo {
  id: string;
  name: string;
  logo_url: string | null;
}

export default function SchoolJobs() {
  const [loading, setLoading] = useState(true);
  const [university, setUniversity] = useState<UniversityInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profile = await getProfile(user.id);
      if (!profile) return;

      // Try to get the student's partner university from their email domain
      const uni = await getPartnerUniversity(user.email || '');
      if (uni) {
        setUniversity(uni);
      } else {
        // Fallback: try to get university from student record
        const student = await getStudentByUserId(user.id);
        if (student?.university_id) {
          const { data } = await supabase
            .from('universities')
            .select('id, name, logo_url')
            .eq('id', student.university_id)
            .single();
          if (data) setUniversity(data);
        }
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="dash-main" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header with university branding */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {university?.logo_url ? (
            <img
              src={university.logo_url}
              alt={`${university.name} logo`}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                objectFit: 'contain',
                border: '1px solid var(--border)',
                background: '#fff',
                padding: '4px',
              }}
            />
          ) : (
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '10px',
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '1.2rem',
            }}>
              {university?.name?.charAt(0) || 'U'}
            </div>
          )}
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
              {university ? `${university.name} Job Portal` : 'School Job Portal'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '2px 0 0' }}>
              Exclusive opportunities from your university&apos;s employer partners
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/student"
          className="btn-secondary"
          style={{ fontSize: '0.85rem', padding: '8px 16px', textDecoration: 'none' }}
        >
          Back to Dashboard
        </Link>
      </div>

      {/* Search and filter bar */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search school-affiliated jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px 12px 42px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              fontSize: '0.95rem',
              background: 'var(--bg)',
              color: 'var(--text)',
              outline: 'none',
            }}
          />
        </div>
        <select
          value={selectedIndustry}
          onChange={(e) => setSelectedIndustry(e.target.value)}
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            fontSize: '0.9rem',
            background: 'var(--bg)',
            color: 'var(--text)',
            cursor: 'pointer',
            minWidth: '180px',
          }}
        >
          <option value="">All Industries</option>
        </select>
      </div>

      {/* Split-view layout */}
      <div style={{
        display: 'flex',
        gap: '24px',
        minHeight: '500px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md, 12px)',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}>
        {/* Left panel - Job list */}
        <div style={{
          width: '360px',
          minWidth: '360px',
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          padding: '16px',
        }}>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '12px',
          }}>
            Job Listings
          </p>
          {/* Placeholder skeleton items */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                marginBottom: '8px',
                opacity: 0.4,
              }}
            >
              <div style={{ height: '14px', width: '70%', background: 'var(--border)', borderRadius: '4px', marginBottom: '10px' }} />
              <div style={{ height: '10px', width: '50%', background: 'var(--border)', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ height: '10px', width: '40%', background: 'var(--border)', borderRadius: '4px' }} />
            </div>
          ))}
        </div>

        {/* Right panel - Job details / Placeholder */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 32px',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '440px' }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary), #a78bfa)',
              margin: '0 auto 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '12px',
              color: 'var(--text)',
            }}>
              School-Affiliated Job Listings Coming Soon
            </h3>
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              marginBottom: '24px',
            }}>
              Your university is working with employers to bring you exclusive opportunities.
              School-affiliated listings will appear here once employer partnerships are established.
            </p>
            <Link
              href="/dashboard/student/internships"
              className="btn-primary"
              style={{
                display: 'inline-block',
                padding: '12px 28px',
                fontSize: '0.95rem',
                textDecoration: 'none',
              }}
            >
              Browse All Internships
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
