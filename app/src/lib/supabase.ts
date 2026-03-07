import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as unknown as ReturnType<typeof createClient>);

export const DASHBOARD_ROUTES: Record<string, string> = {
  student: '/dashboard/student',
  employer: '/dashboard/employer',
  university_admin: '/dashboard/university',
};

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data;
}

export type RoleData = {
  major?: string;
  graduationYear?: string;
  companyName?: string;
  website?: string;
  universityName?: string;
  jobTitle?: string;
  universityId?: string;
};

export async function createProfileAndRoleData(
  userId: string,
  opts: {
    role: string;
    fullName: string;
    email: string;
    phone?: string;
    roleData: RoleData;
  }
) {
  const { role, fullName, email, phone, roleData } = opts;

  const { error: profileError } = await supabase.from('profiles').insert({
    user_id: userId,
    role,
    full_name: fullName,
    email,
    phone: phone || null,
  });
  if (profileError) throw profileError;

  if (role === 'student') {
    const { error } = await supabase.from('students').insert({
      user_id: userId,
      major: roleData.major || null,
      graduation_year: roleData.graduationYear
        ? parseInt(roleData.graduationYear)
        : null,
    });
    if (error) throw error;
  } else if (role === 'employer') {
    const { error } = await supabase.from('employers').insert({
      user_id: userId,
      company_name: roleData.companyName!,
      website: roleData.website || null,
    });
    if (error) throw error;
  } else if (role === 'university_admin') {
    const { error } = await supabase.from('university_admins').insert({
      user_id: userId,
      university_id: roleData.universityId || null,
      job_title: roleData.jobTitle || null,
    });
    if (error) throw error;
  }
}
