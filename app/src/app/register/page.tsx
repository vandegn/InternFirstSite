'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RoleSelector from '@/components/RoleSelector';
import { supabase, createProfileAndRoleData, type RoleData } from '@/lib/supabase';

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
  const [graduationYear, setGraduationYear] = useState('');
  // Employer fields
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  // University fields
  const [universityName, setUniversityName] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role },
        },
      });

      if (authError) throw authError;

      const roleData: RoleData = {};
      if (role === 'student') {
        roleData.major = major;
        roleData.graduationYear = graduationYear;
      } else if (role === 'employer') {
        roleData.companyName = companyName;
        roleData.website = website;
      } else if (role === 'university_admin') {
        roleData.universityName = universityName;
        roleData.jobTitle = jobTitle;
      }

      await createProfileAndRoleData(data.user!.id, {
        role,
        fullName,
        email,
        phone,
        roleData,
      });

      alert('Account created! Check your email for a confirmation link.');
      router.push('/login');
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
                  <input type="text" id="major" placeholder="e.g. Computer Science" value={major} onChange={e => setMajor(e.target.value)} />
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
                  <input type="text" id="companyName" placeholder="Acme Inc." value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="website">Company Website</label>
                  <input type="url" id="website" placeholder="https://example.com" value={website} onChange={e => setWebsite(e.target.value)} />
                </div>
              </>
            )}

            {/* University fields */}
            {role === 'university_admin' && (
              <>
                <div className="form-group">
                  <label htmlFor="universityName">University Name</label>
                  <input type="text" id="universityName" placeholder="University of North Carolina" value={universityName} onChange={e => setUniversityName(e.target.value)} />
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
