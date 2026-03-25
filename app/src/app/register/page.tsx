'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RoleSelector from '@/components/RoleSelector';
import { supabase, isEduEmail, getAllUniversities } from '@/lib/supabase';
import { MAJORS } from '@/lib/constants';

type Role = 'student' | 'employer' | 'university_admin';

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('student');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Student fields
  const [major, setMajor] = useState('');
  const [majorSearch, setMajorSearch] = useState('');
  const [majorDropdownOpen, setMajorDropdownOpen] = useState(false);
  const majorRef = useRef<HTMLDivElement>(null);
  const [graduationYear, setGraduationYear] = useState('');
  // Employer fields
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  // University fields
  const [universityId, setUniversityId] = useState('');
  const [universities, setUniversities] = useState<{ id: string; name: string }[]>([]);
  const [jobTitle, setJobTitle] = useState('');

  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (role === 'university_admin') {
      getAllUniversities().then(setUniversities);
    }
  }, [role]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (majorRef.current && !majorRef.current.contains(e.target as Node)) {
        setMajorDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMajors = MAJORS.filter((m) =>
    m.toLowerCase().includes(majorSearch.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

    if (role === 'employer' && !companyName) {
      setError('Company name is required.');
      return;
    }

    if (role === 'university_admin' && !universityId) {
      setError('Please select your university.');
      return;
    }

    if ((role === 'student' || role === 'university_admin') && !isEduEmail(email)) {
      setError('Student and university accounts require a .edu email address.');
      return;
    }

    setLoading(true);

    try {
      // Build user_metadata with role-specific fields
      const metadata: Record<string, string> = { role, fullName, phone };

      if (role === 'student') {
        metadata.major = major;
        metadata.graduationYear = graduationYear;
      } else if (role === 'employer') {
        metadata.companyName = companyName;
        metadata.website = website;
        metadata.companyDescription = companyDescription;
      } else if (role === 'university_admin') {
        metadata.universityId = universityId;
        metadata.jobTitle = jobTitle;
      }

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: metadata,
        },
      });

      if (authError) throw authError;

      // Redirect to verify-email page
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: 680 }}>
        <div className="auth-logo">
          <Link href="/">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
          </Link>
        </div>
        <h1>Register</h1>
        <p className="auth-subtitle">Create your account. Select your role to get started.</p>

        <RoleSelector selected={role} onChange={setRole} />

        {error && <div className="auth-error" style={{ display: 'block' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input type="text" id="fullName" placeholder="John Doe" required value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input type="tel" id="phone" placeholder="+1 (555) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input type="email" id="email" placeholder="john@university.edu" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input type="password" id="password" placeholder="Create a password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input type="password" id="confirmPassword" placeholder="Confirm your password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>

            {/* Student fields */}
            {role === 'student' && (
              <>
                <div className="form-group">
                  <label htmlFor="major">Major</label>
                  <div ref={majorRef} style={{ position: 'relative' }}>
                    <input
                      type="text"
                      id="major"
                      placeholder="Search for your major..."
                      value={majorDropdownOpen ? majorSearch : major || majorSearch}
                      onChange={(e) => {
                        setMajorSearch(e.target.value);
                        setMajorDropdownOpen(true);
                        if (!e.target.value) setMajor('');
                      }}
                      onFocus={() => setMajorDropdownOpen(true)}
                      autoComplete="off"
                    />
                    {majorDropdownOpen && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        boxShadow: 'var(--shadow-md)',
                        zIndex: 50,
                      }}>
                        {filteredMajors.length === 0 ? (
                          <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            No majors found
                          </div>
                        ) : (
                          filteredMajors.map((m) => (
                            <div
                              key={m}
                              onClick={() => {
                                setMajor(m);
                                setMajorSearch(m);
                                setMajorDropdownOpen(false);
                              }}
                              style={{
                                padding: '10px 14px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                background: major === m ? 'var(--primary-light)' : 'transparent',
                                color: major === m ? 'var(--primary)' : 'var(--text)',
                              }}
                              onMouseEnter={(e) => { if (major !== m) (e.target as HTMLElement).style.background = 'var(--bg-light)'; }}
                              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = major === m ? 'var(--primary-light)' : 'transparent'; }}
                            >
                              {m}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="graduationYear">Graduation Year</label>
                  <select id="graduationYear" value={graduationYear} onChange={e => setGraduationYear(e.target.value)}>
                    <option value="" disabled>Select year</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                    <option value="2029">2029</option>
                    <option value="2030">2030</option>
                  </select>
                </div>
              </>
            )}

            {/* Employer fields */}
            {role === 'employer' && (
              <>
                <div className="form-group">
                  <label htmlFor="companyName">Company Name</label>
                  <input type="text" id="companyName" placeholder="Acme Inc." required value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="website">Company Website</label>
                  <input type="text" id="website" placeholder="example.com" value={website} onChange={e => setWebsite(e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="companyDescription">Company Description</label>
                  <textarea id="companyDescription" placeholder="Tell students about your company..." rows={3} value={companyDescription} onChange={e => setCompanyDescription(e.target.value)} style={{ width: '100%', resize: 'vertical' }} />
                </div>
              </>
            )}

            {/* University fields */}
            {role === 'university_admin' && (
              <>
                <div className="form-group">
                  <label htmlFor="universityId">University</label>
                  <select id="universityId" value={universityId} onChange={e => setUniversityId(e.target.value)} required>
                    <option value="" disabled>Select your university</option>
                    {universities.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  {universities.length === 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      No universities available. Contact support to add yours.
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="jobTitle">Your Title</label>
                  <input type="text" id="jobTitle" placeholder="e.g. Career Services Director" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
                </div>
              </>
            )}
          </div>

          <div className="checkbox-group">
            <input type="checkbox" id="terms" required checked={terms} onChange={e => setTerms(e.target.checked)} />
            <label htmlFor="terms">I agree to the <a href="#">Terms</a> and <a href="#">Privacy Policy</a></label>
          </div>

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">Already have an account? <Link href="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
