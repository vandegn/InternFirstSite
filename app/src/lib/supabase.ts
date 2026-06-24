import { type SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : (null as unknown as SupabaseClient);

export const DASHBOARD_ROUTES: Record<string, string> = {
  student: '/dashboard/student',
  employer: '/dashboard/employer',
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
  companyDescription?: string;
  logoUrl?: string;
};

export async function createProfileAndRoleData(
  client: SupabaseClient,
  userId: string,
  opts: {
    role: string;
    fullName: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    roleData: RoleData;
  }
) {
  const { role, fullName, email, phone, avatarUrl, roleData } = opts;

  if (role === 'student' && !isEduEmail(email)) {
    throw new Error('Student accounts require a .edu email address.');
  }

  const { error: profileError } = await client.from('profiles').insert({
    user_id: userId,
    role,
    full_name: fullName,
    email,
    phone: phone || null,
    avatar_url: avatarUrl || null,
  });
  if (profileError) throw profileError;

  if (role === 'student') {
    const { error } = await client.from('students').insert({
      user_id: userId,
      major: roleData.major || null,
      graduation_year: roleData.graduationYear
        ? parseInt(roleData.graduationYear)
        : null,
    });
    if (error) throw error;
  } else if (role === 'employer') {
    const { error } = await client.from('employers').insert({
      user_id: userId,
      company_name: roleData.companyName!,
      website: roleData.website || null,
      description: roleData.companyDescription || null,
      logo_url: roleData.logoUrl || null,
    });
    if (error) throw error;
  }
}

export function isEduEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith('.edu');
}

export async function getEmployerByUserId(userId: string) {
  const { data, error } = await supabase
    .from('employers')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function uploadImage(bucket: string, path: string, file: File) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function updateEmployer(employerId: string, fields: {
  company_name?: string;
  website?: string;
  logo_url?: string;
  description?: string;
}) {
  const { data, error } = await supabase
    .from('employers')
    .update(fields)
    .eq('id', employerId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createListing(listing: {
  employer_id: string;
  title: string;
  description: string;
  location?: string;
  is_remote?: boolean;
  is_hybrid?: boolean;
  compensation?: string;
  requirements?: string;
  key_responsibilities?: string;
  industry: string;
  application_deadline?: string;
  duration?: string;
}) {
  const { data, error } = await supabase
    .from('internship_listings')
    .insert(listing)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getEmployerListings(employerId: string, page = 1, pageSize = 10) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from('internship_listings')
    .select('*', { count: 'exact' })
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) return { data: [], totalCount: 0 };
  return { data: data ?? [], totalCount: count ?? 0 };
}

export type ActiveListingsFilters = {
  industry?: string;
  search?: string;
  location?: string;
  paid?: 'all' | 'paid' | 'unpaid';
  mode?: 'all' | 'remote' | 'hybrid' | 'in-person';
  duration?: string;
};

// Local "today" as YYYY-MM-DD, for comparing against the date-typed
// application_deadline column. A listing is considered expired the day
// after its deadline, so it stays visible through the deadline date itself.
function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Filter out listings whose application deadline has passed. Listings with no
// deadline (null) never expire and always pass.
function excludeExpired<T extends { or: (f: string) => T }>(query: T): T {
  return query.or(`application_deadline.is.null,application_deadline.gte.${todayDateStr()}`);
}

export async function getActiveListings(
  page = 1,
  pageSize = 10,
  filters: ActiveListingsFilters = {}
) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from('internship_listings')
    .select('*, employers(company_name, logo_url)', { count: 'exact' })
    .eq('status', 'active');
  query = excludeExpired(query);

  if (filters.industry) {
    query = query.eq('industry', filters.industry);
  }

  if (filters.duration) {
    query = query.eq('duration', filters.duration);
  }

  if (filters.location && filters.location.trim()) {
    query = query.ilike('location', `%${filters.location.trim()}%`);
  }

  if (filters.search && filters.search.trim()) {
    // PostgREST .or() uses commas/parens/periods/quotes as separators — strip them.
    const q = filters.search.trim().replace(/[,()."*]/g, ' ');
    query = query.or(
      `title.ilike.%${q}%,description.ilike.%${q}%,requirements.ilike.%${q}%`
    );
  }

  if (filters.paid === 'paid') {
    // Paid = compensation set and not "Unpaid"
    query = query.not('compensation', 'is', null).neq('compensation', 'Unpaid');
  } else if (filters.paid === 'unpaid') {
    query = query.or('compensation.is.null,compensation.eq.Unpaid');
  }

  if (filters.mode === 'remote') {
    query = query.eq('is_remote', true);
  } else if (filters.mode === 'hybrid') {
    query = query.eq('is_hybrid', true);
  } else if (filters.mode === 'in-person') {
    query = query.eq('is_remote', false).eq('is_hybrid', false);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) return { data: [], totalCount: 0 };
  return { data: data ?? [], totalCount: count ?? 0 };
}

export async function getListingById(id: string) {
  const { data, error } = await supabase
    .from('internship_listings')
    .select('*, employers(company_name, logo_url, website)')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data;
}

export async function getRecommendedListings(industries: string[], limit = 3) {
  if (industries.length === 0) return [];
  const { data, error } = await excludeExpired(
    supabase
      .from('internship_listings')
      .select('*, employers(company_name, logo_url)')
      .eq('status', 'active')
      .in('industry', industries)
  )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

// ---- Messages ----

export async function getConversations(userId: string) {
  // Get all messages where user is sender or receiver, grouped by the other party
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url, role), receiver:profiles!messages_receiver_id_fkey(full_name, avatar_url, role)')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('sent_at', { ascending: false });
  if (error || !data) return [];
  // Group by the other user
  const convMap = new Map<string, { otherUserId: string; otherName: string; otherAvatar: string | null; otherRole: string; lastMessage: string; lastSentAt: string; unreadCount: number }>();
  for (const msg of data) {
    const otherUserId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
    const other = msg.sender_id === userId ? msg.receiver : msg.sender;
    if (!convMap.has(otherUserId)) {
      convMap.set(otherUserId, {
        otherUserId,
        otherName: other?.full_name || 'Unknown',
        otherAvatar: other?.avatar_url || null,
        otherRole: other?.role || '',
        lastMessage: msg.body,
        lastSentAt: msg.sent_at,
        unreadCount: 0,
      });
    }
    if (msg.receiver_id === userId && !msg.read) {
      const conv = convMap.get(otherUserId)!;
      conv.unreadCount++;
    }
  }
  return Array.from(convMap.values());
}

export async function getMessagesWith(userId: string, otherUserId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url)')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
    .order('sent_at', { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function sendMessage(_senderId: string, receiverId: string, body: string) {
  const res = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiverId, body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to send message');
  }
  return res.json();
}

export async function markMessagesAsRead(userId: string, otherUserId: string) {
  const { count } = await supabase
    .from('messages')
    .update({ read: true }, { count: 'exact' })
    .eq('receiver_id', userId)
    .eq('sender_id', otherUserId)
    .eq('read', false);
  return count ?? 0;
}

export async function getUnreadCount(userId: string) {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('read', false);
  if (error) return 0;
  return count ?? 0;
}

export async function getEmployerUserIdByListingId(listingId: string) {
  const { data, error } = await supabase
    .from('internship_listings')
    .select('employers(user_id)')
    .eq('id', listingId)
    .single();
  if (error || !data) return null;
  return (data as any).employers?.user_id as string | null;
}

export async function getStudentByUserId(userId: string) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data;
}

// Notifies the listing's employer that a new student applied. Best-effort.
async function notifyEmployerOfApplication(listingId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [employerUserId, listingRes, me] = await Promise.all([
      getEmployerUserIdByListingId(listingId),
      supabase.from('internship_listings').select('title').eq('id', listingId).single(),
      getProfile(user.id),
    ]);
    if (!employerUserId) return;
    const listingTitle = (listingRes.data as any)?.title as string | undefined;
    await createNotification({
      userId: employerUserId,
      actorId: user.id,
      type: 'new_application',
      title: 'New applicant',
      body: `${me?.full_name ?? 'A student'} applied to "${listingTitle ?? 'your listing'}".`,
      link: '/dashboard/employer/applications',
    });
  } catch (e) {
    console.error('[notifyEmployerOfApplication] failed', e);
  }
}

export async function applyToListing(studentId: string, listingId: string) {
  const { data, error } = await supabase
    .from('applications')
    .insert({ student_id: studentId, listing_id: listingId })
    .select()
    .single();
  if (error) throw error;
  await notifyEmployerOfApplication(listingId);
  return data;
}

export async function getEmployerApplications(employerId: string) {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id,
      status,
      stage_id,
      applied_at,
      updated_at,
      resume_id,
      resume:student_resumes(id, name, file_url),
      listing:internship_listings!inner(id, title, employer_id),
      stage:pipeline_stages(id, label, color_bg, color_text, position, stage_type),
      student:students!inner(
        id,
        major,
        graduation_year,
        bio,
        user_id,
        profile:profiles!students_user_id_fkey(full_name, email, avatar_url)
      )
    `)
    .eq('listing.employer_id', employerId)
    .order('applied_at', { ascending: false });
  if (error) {
    console.error('[getEmployerApplications] Error:', error.message, error);
    return [];
  }
  return data ?? [];
}

export async function updateApplicationStatus(applicationId: string, status: string) {
  const { data, error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', applicationId)
    .select('*, student:students!inner(user_id), listing:internship_listings!inner(title)')
    .single();
  if (error) throw error;

  // Notify the student that their application moved to a new stage.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const studentUserId = (data as any).student?.user_id as string | undefined;
    const listingTitle = (data as any).listing?.title as string | undefined;
    const label = APPLICATION_STATUS_LABELS[status] ?? status;
    if (user && studentUserId) {
      await createNotification({
        userId: studentUserId,
        actorId: user.id,
        type: 'application_status',
        title: `Application update: ${label}`,
        body: listingTitle
          ? `Your application for "${listingTitle}" is now ${label}.`
          : `Your application is now ${label}.`,
        link: '/dashboard/student/applications',
      });
    }
  } catch (e) {
    console.error('[updateApplicationStatus] notification failed', e);
  }

  return data;
}

export async function getEmployerStats(employerId: string) {
  // Get all listing IDs for this employer
  const { data: listings } = await supabase
    .from('internship_listings')
    .select('id')
    .eq('employer_id', employerId);
  if (!listings || listings.length === 0) return { totalApplicants: 0, interviewing: 0, offered: 0 };

  const listingIds = listings.map(l => l.id);
  const { data: apps } = await supabase
    .from('applications')
    .select('stage:pipeline_stages(stage_type)')
    .in('listing_id', listingIds);
  if (!apps) return { totalApplicants: 0, interviewing: 0, offered: 0 };

  const stageType = (a: any) =>
    Array.isArray(a.stage) ? a.stage[0]?.stage_type : a.stage?.stage_type;

  return {
    totalApplicants: apps.length,
    interviewing: apps.filter(a => stageType(a) === 'interviewing').length,
    offered: apps.filter(a => stageType(a) === 'offered').length,
  };
}

// ---- Pipeline Stages (per-listing kanban columns) ----

export type PipelineStage = {
  id: string;
  listing_id: string;
  label: string;
  color_bg: string;
  color_text: string;
  position: number;
  stage_type: 'applied' | 'reviewing' | 'interviewing' | 'offered' | 'rejected';
  locked: boolean;
};

export async function getListingStages(listingId: string): Promise<PipelineStage[]> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('listing_id', listingId)
    .order('position', { ascending: true });
  if (error) {
    console.error('[getListingStages] Error:', error.message);
    return [];
  }
  return (data ?? []) as PipelineStage[];
}

export async function createStage(opts: {
  listingId: string;
  label: string;
  colorBg?: string;
  colorText?: string;
}) {
  // Insert just before the "Offered" anchor: take the max position
  // among non-offered stages and add one.
  const { data: existing } = await supabase
    .from('pipeline_stages')
    .select('position')
    .eq('listing_id', opts.listingId)
    .neq('stage_type', 'offered')
    .order('position', { ascending: false })
    .limit(1);
  const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 1;

  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({
      listing_id: opts.listingId,
      label: opts.label,
      color_bg: opts.colorBg ?? '#e0e7ff',
      color_text: opts.colorText ?? '#3730a3',
      position: nextPosition,
      stage_type: 'reviewing',
      locked: false,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as PipelineStage;
}

export async function updateStage(stageId: string, patch: Partial<{
  label: string;
  color_bg: string;
  color_text: string;
  position: number;
  stage_type: PipelineStage['stage_type'];
}>) {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .update(patch)
    .eq('id', stageId)
    .select('*')
    .single();
  if (error) throw error;
  return data as PipelineStage;
}

// Reassign every application in `stageId` to `reassignToStageId`, then
// delete the stage. If `reassignToStageId` is null, the applications in
// that stage are deleted along with it.
export async function deleteStage(stageId: string, reassignToStageId: string | null) {
  if (reassignToStageId) {
    const { error: moveErr } = await supabase
      .from('applications')
      .update({ stage_id: reassignToStageId })
      .eq('stage_id', stageId);
    if (moveErr) throw moveErr;
  } else {
    const { error: delAppsErr } = await supabase
      .from('applications')
      .delete()
      .eq('stage_id', stageId);
    if (delAppsErr) throw delAppsErr;
  }
  const { error } = await supabase
    .from('pipeline_stages')
    .delete()
    .eq('id', stageId);
  if (error) throw error;
}

export async function reorderStages(orderedStageIds: string[]) {
  const updates = orderedStageIds.map((id, position) =>
    supabase.from('pipeline_stages').update({ position }).eq('id', id)
  );
  await Promise.all(updates);
}

// Move an application to a new stage. The DB trigger keeps
// applications.status in sync with the new stage's label.
export async function updateApplicationStage(applicationId: string, stageId: string) {
  const { data, error } = await supabase
    .from('applications')
    .update({ stage_id: stageId })
    .eq('id', applicationId)
    .select('*, student:students!inner(user_id), listing:internship_listings!inner(title), stage:pipeline_stages(label)')
    .single();
  if (error) throw error;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const studentUserId = (data as any).student?.user_id as string | undefined;
    const listingTitle = (data as any).listing?.title as string | undefined;
    const stageRow = (data as any).stage;
    const label = (Array.isArray(stageRow) ? stageRow[0]?.label : stageRow?.label) ?? 'Updated';
    if (user && studentUserId) {
      await createNotification({
        userId: studentUserId,
        actorId: user.id,
        type: 'application_status',
        title: `Application update: ${label}`,
        body: listingTitle
          ? `Your application for "${listingTitle}" is now ${label}.`
          : `Your application is now ${label}.`,
        link: '/dashboard/student/applications',
      });
    }
  } catch (e) {
    console.error('[updateApplicationStage] notification failed', e);
  }

  return data;
}

export async function getApplicationStatus(studentId: string, listingId: string) {
  const { data, error } = await supabase
    .from('applications')
    .select('status')
    .eq('student_id', studentId)
    .eq('listing_id', listingId)
    .single();
  if (error || !data) return null;
  return data.status as string;
}

// ---- Student Resumes ----

export async function uploadResume(studentId: string, file: File, displayName: string) {
  const ext = file.name.split('.').pop();
  const path = `resumes/${studentId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('images').getPublicUrl(path);

  const { data, error } = await supabase
    .from('student_resumes')
    .insert({ student_id: studentId, name: displayName, file_url: urlData.publicUrl })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getStudentResumes(studentId: string) {
  const { data, error } = await supabase
    .from('student_resumes')
    .select('*')
    .eq('student_id', studentId)
    .order('uploaded_at', { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function deleteResume(resumeId: string) {
  const { error } = await supabase
    .from('student_resumes')
    .delete()
    .eq('id', resumeId);
  if (error) throw error;
}

// ---- Student Applications ----

export async function getStudentApplications(studentId: string) {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id,
      status,
      stage_id,
      applied_at,
      updated_at,
      resume_id,
      stage:pipeline_stages(label, color_bg, color_text, stage_type),
      listing:internship_listings!inner(
        id, title, location, is_remote, is_hybrid, compensation, industry, application_deadline,
        employers:employers!inner(company_name, logo_url)
      )
    `)
    .eq('student_id', studentId)
    .order('applied_at', { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getStudentStats(studentId: string) {
  const { data, error } = await supabase
    .from('applications')
    .select('status')
    .eq('student_id', studentId);
  if (error || !data) return { total: 0, offers: 0 };
  return {
    total: data.length,
    offers: data.filter(a => a.status === 'offered').length,
  };
}

// ---- Update student profile ----

export async function updateStudent(studentId: string, fields: {
  major?: string;
  graduation_year?: number;
  bio?: string;
}) {
  const { data, error } = await supabase
    .from('students')
    .update(fields)
    .eq('id', studentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, fields: {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
}) {
  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Apply with resume ----

// ---- Listing Analytics ----

export async function getListingViewCounts(employerId: string) {
  const { data: listings } = await supabase
    .from('internship_listings')
    .select('id')
    .eq('employer_id', employerId);
  if (!listings || listings.length === 0) return {};

  const listingIds = listings.map(l => l.id);
  const { data: views } = await supabase
    .from('listing_views')
    .select('listing_id')
    .in('listing_id', listingIds);
  if (!views) return {};

  const counts: Record<string, number> = {};
  for (const v of views) {
    counts[v.listing_id] = (counts[v.listing_id] || 0) + 1;
  }
  return counts;
}

export async function trackListingView(listingId: string, viewerId: string | null) {
  await supabase.from('listing_views').insert({
    listing_id: listingId,
    viewer_id: viewerId,
  });
}

// ---- Employer Listings with full details ----

export async function getEmployerListingsWithStats(employerId: string) {
  const { data: listings, error } = await supabase
    .from('internship_listings')
    .select('*')
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false });
  if (error || !listings) return [];

  const listingIds = listings.map(l => l.id);
  if (listingIds.length === 0) return listings.map(l => ({ ...l, applicant_count: 0, view_count: 0 }));

  const [{ data: apps }, { data: views }] = await Promise.all([
    supabase.from('applications').select('listing_id').in('listing_id', listingIds),
    supabase.from('listing_views').select('listing_id').in('listing_id', listingIds),
  ]);

  const appCounts: Record<string, number> = {};
  for (const a of apps || []) {
    appCounts[a.listing_id] = (appCounts[a.listing_id] || 0) + 1;
  }
  const viewCounts: Record<string, number> = {};
  for (const v of views || []) {
    viewCounts[v.listing_id] = (viewCounts[v.listing_id] || 0) + 1;
  }

  return listings.map(l => ({
    ...l,
    applicant_count: appCounts[l.id] || 0,
    view_count: viewCounts[l.id] || 0,
  }));
}

export async function applyToListingWithResume(studentId: string, listingId: string, resumeId: string | null) {
  const row: any = { student_id: studentId, listing_id: listingId };
  if (resumeId) row.resume_id = resumeId;
  const { data, error } = await supabase
    .from('applications')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  await notifyEmployerOfApplication(listingId);
  return data;
}

// ---- Listing Management (Edit/Close) ----

// ---- Student Skills ----

export async function getStudentSkills(studentId: string) {
  const { data, error } = await supabase
    .from('student_skills')
    .select('*')
    .eq('student_id', studentId)
    .order('name', { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function addStudentSkill(studentId: string, name: string, isCustom: boolean) {
  const { data, error } = await supabase
    .from('student_skills')
    .insert({ student_id: studentId, name, is_custom: isCustom })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeStudentSkill(skillId: string) {
  const { error } = await supabase
    .from('student_skills')
    .delete()
    .eq('id', skillId);
  if (error) throw error;
}

// ---- Student Experiences ----

export async function getStudentExperiences(studentId: string, type?: string) {
  let query = supabase
    .from('student_experiences')
    .select('*')
    .eq('student_id', studentId);
  if (type) query = query.eq('type', type);
  const { data, error } = await query.order('start_date', { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function addStudentExperience(studentId: string, experience: {
  type: string;
  title: string;
  organization?: string;
  location?: string;
  description?: string;
  technologies?: string;
  link?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
}) {
  const { data, error } = await supabase
    .from('student_experiences')
    .insert({ student_id: studentId, ...experience })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStudentExperience(experienceId: string, fields: {
  title?: string;
  organization?: string;
  location?: string;
  description?: string;
  technologies?: string;
  link?: string;
  start_date?: string;
  end_date?: string | null;
  is_current?: boolean;
}) {
  const { data, error } = await supabase
    .from('student_experiences')
    .update(fields)
    .eq('id', experienceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStudentExperience(experienceId: string) {
  const { error } = await supabase
    .from('student_experiences')
    .delete()
    .eq('id', experienceId);
  if (error) throw error;
}

// ---- Student Organizations ----

export async function getStudentOrganizations(studentId: string, type?: string) {
  let query = supabase
    .from('student_organizations')
    .select('*')
    .eq('student_id', studentId);
  if (type) query = query.eq('type', type);
  const { data, error } = await query.order('join_date', { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function addStudentOrganization(studentId: string, org: {
  type: string;
  name: string;
  chapter?: string;
  role?: string;
  join_date?: string;
  end_date?: string;
}) {
  const { data, error } = await supabase
    .from('student_organizations')
    .insert({ student_id: studentId, ...org })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStudentOrganization(orgId: string, fields: {
  name?: string;
  chapter?: string;
  role?: string;
  join_date?: string;
  end_date?: string | null;
}) {
  const { data, error } = await supabase
    .from('student_organizations')
    .update(fields)
    .eq('id', orgId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStudentOrganization(orgId: string) {
  const { error } = await supabase
    .from('student_organizations')
    .delete()
    .eq('id', orgId);
  if (error) throw error;
}

// ---- Career Survey ----

export type CareerSurveyData = {
  industries: string[];
  work_environment: string;
  preferred_duration: string;
  skills: string[];
  career_goals: string;
};

export async function getCareerSurvey(studentId: string): Promise<(CareerSurveyData & { completed_at: string; updated_at: string }) | null> {
  const { data, error } = await supabase
    .from('career_survey_responses')
    .select('industries, work_environment, preferred_duration, skills, career_goals, completed_at, updated_at')
    .eq('student_id', studentId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function upsertCareerSurvey(studentId: string, data: CareerSurveyData) {
  const { error } = await supabase
    .from('career_survey_responses')
    .upsert(
      {
        student_id: studentId,
        industries: data.industries,
        work_environment: data.work_environment,
        preferred_duration: data.preferred_duration,
        skills: data.skills,
        career_goals: data.career_goals,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id' }
    );
  if (error) throw error;
}

// ---- Student EEO / Voluntary Self-Identification ----
//
// IMPORTANT: This data is intentionally not exposed to employers. The
// student_eeo table has no employer SELECT policy in RLS, so even if a
// future code path joined against it, employers would not be able to read
// the rows. Keep it that way.

export type StudentEeoData = {
  ethnicity_hispanic_latino: 'yes' | 'no' | 'declined' | null;
  race: string[];
  race_declined: boolean;
  gender: 'male' | 'female' | 'non_binary' | 'self_describe' | 'declined' | null;
  gender_self_describe: string | null;
  veteran_status: 'protected_veteran' | 'not_veteran' | 'declined' | null;
  disability_status: 'yes' | 'no' | 'declined' | null;
  work_authorized_us: 'yes' | 'no' | null;
  requires_sponsorship: 'yes' | 'no' | null;
};

export async function getStudentEeo(
  studentId: string
): Promise<(StudentEeoData & { completed_at: string; updated_at: string }) | null> {
  const { data, error } = await supabase
    .from('student_eeo')
    .select(
      'ethnicity_hispanic_latino, race, race_declined, gender, gender_self_describe, veteran_status, disability_status, work_authorized_us, requires_sponsorship, completed_at, updated_at'
    )
    .eq('student_id', studentId)
    .maybeSingle();
  if (error || !data) return null;
  return data as StudentEeoData & { completed_at: string; updated_at: string };
}

export async function upsertStudentEeo(studentId: string, data: StudentEeoData) {
  const { error } = await supabase
    .from('student_eeo')
    .upsert(
      {
        student_id: studentId,
        ethnicity_hispanic_latino: data.ethnicity_hispanic_latino,
        race: data.race,
        race_declined: data.race_declined,
        gender: data.gender,
        gender_self_describe: data.gender_self_describe,
        veteran_status: data.veteran_status,
        disability_status: data.disability_status,
        work_authorized_us: data.work_authorized_us,
        requires_sponsorship: data.requires_sponsorship,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id' }
    );
  if (error) throw error;
}

// ---- Events ----

export async function getEventById(eventId: string) {
  const { data, error } = await supabase
    .from('university_events')
    .select('*, university:universities(name, logo_url)')
    .eq('id', eventId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function getEventRegistrationCount(eventId: string) {
  const { count, error } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (error) return 0;
  return count ?? 0;
}

export async function registerForEvent(eventId: string, studentId: string) {
  const { data, error } = await supabase
    .from('event_registrations')
    .insert({ event_id: eventId, student_id: studentId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function unregisterFromEvent(eventId: string, studentId: string) {
  const { error } = await supabase
    .from('event_registrations')
    .delete()
    .eq('event_id', eventId)
    .eq('student_id', studentId);
  if (error) throw error;
}

export async function isRegisteredForEvent(eventId: string, studentId: string) {
  const { data, error } = await supabase
    .from('event_registrations')
    .select('id')
    .eq('event_id', eventId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

// ---- University Partner Listings ----

export async function getUniversityPartnerListings(
  universityId: string,
  page = 1,
  pageSize = 20,
  industry?: string
) {
  const { data: partnerships } = await supabase
    .from('university_employer_partnerships')
    .select('employer_id')
    .eq('university_id', universityId)
    .eq('status', 'active');

  if (!partnerships || partnerships.length === 0) {
    return { data: [], totalCount: 0 };
  }

  const employerIds = partnerships.map(p => p.employer_id);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('internship_listings')
    .select('*, employers(company_name, logo_url)', { count: 'exact' })
    .eq('status', 'active')
    .in('employer_id', employerIds);

  if (industry) {
    query = query.eq('industry', industry);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return { data: [], totalCount: 0 };
  return { data: data ?? [], totalCount: count ?? 0 };
}

export async function updateListing(listingId: string, fields: {
  title?: string;
  description?: string;
  location?: string;
  is_remote?: boolean;
  is_hybrid?: boolean;
  compensation?: string;
  requirements?: string;
  key_responsibilities?: string;
  industry?: string;
  status?: string;
  application_deadline?: string | null;
  duration?: string | null;
}) {
  const { data, error } = await supabase
    .from('internship_listings')
    .update(fields)
    .eq('id', listingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Interview Schedules ----

export type InterviewStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'reschedule_requested'
  | 'cancelled'
  | 'completed';

export async function createInterview(opts: {
  applicationId: string;
  employerId: string;
  studentId: string;
  listingId: string;
  scheduledAt: string;
  durationMinutes: number;
  notes?: string;
}) {
  const res = await fetch('/api/interviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to create interview');
  }
  return res.json();
}

export async function getEmployerInterviews(employerId: string) {
  const { data, error } = await supabase
    .from('interview_schedules')
    .select(`
      *,
      application:applications(id, status),
      listing:internship_listings(id, title),
      student:students(
        id, major, graduation_year, user_id,
        profile:profiles!inner(full_name, email, avatar_url)
      )
    `)
    .eq('employer_id', employerId)
    .order('scheduled_at', { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function getStudentInterviews(studentId: string) {
  const { data, error } = await supabase
    .from('interview_schedules')
    .select(`
      *,
      application:applications(id, status),
      listing:internship_listings(id, title),
      employer:employers(id, company_name, logo_url, user_id)
    `)
    .eq('student_id', studentId)
    .order('scheduled_at', { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function getInterviewById(interviewId: string) {
  const { data, error } = await supabase
    .from('interview_schedules')
    .select(`
      *,
      application:applications(id, status),
      listing:internship_listings(id, title),
      employer:employers(id, company_name, logo_url, user_id),
      student:students(
        id, major, graduation_year, user_id,
        profile:profiles!inner(full_name, email, avatar_url)
      )
    `)
    .eq('id', interviewId)
    .single();
  if (error) return null;
  return data;
}

export async function respondToInterview(
  interviewId: string,
  action: 'accept' | 'decline' | 'reschedule',
) {
  const newStatus: InterviewStatus =
    action === 'accept' ? 'accepted'
    : action === 'decline' ? 'declined'
    : 'reschedule_requested';

  const { data, error } = await supabase
    .from('interview_schedules')
    .update({ status: newStatus })
    .eq('id', interviewId)
    .select(`*, application_id`)
    .single();
  if (error) throw error;

  if (action === 'decline' && data?.application_id) {
    await supabase
      .from('applications')
      .update({ status: 'reviewed' })
      .eq('id', data.application_id);
  }

  // Notify the employer how the candidate responded.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const recipient = await employerUserId((data as any).employer_id);
    const titleByAction = {
      accept: 'Interview accepted',
      decline: 'Interview declined',
      reschedule: 'Reschedule requested',
    } as const;
    if (user && recipient) {
      await createNotification({
        userId: recipient,
        actorId: user.id,
        type: 'interview',
        title: titleByAction[action],
        body:
          action === 'accept' ? 'A candidate accepted the interview invitation.'
          : action === 'decline' ? 'A candidate declined the interview invitation.'
          : 'A candidate requested a different interview time.',
        link: '/dashboard/employer/applications',
      });
    }
  } catch (e) {
    console.error('[respondToInterview] notification failed', e);
  }

  return data;
}

export async function cancelInterview(interviewId: string, cancelledBy: 'employer' | 'student') {
  const { data, error } = await supabase
    .from('interview_schedules')
    .update({
      status: 'cancelled',
      cancelled_by: cancelledBy,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', interviewId)
    .select()
    .single();
  if (error) throw error;

  // Notify the other party that the interview was cancelled.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const notifyEmployer = cancelledBy === 'student';
    const recipient = notifyEmployer
      ? await employerUserId((data as any).employer_id)
      : await studentUserId((data as any).student_id);
    if (user && recipient) {
      await createNotification({
        userId: recipient,
        actorId: user.id,
        type: 'interview',
        title: 'Interview cancelled',
        body: `Your interview was cancelled by the ${cancelledBy}.`,
        link: notifyEmployer
          ? '/dashboard/employer/applications'
          : `/dashboard/student/interviews/${(data as any).id}`,
      });
    }
  } catch (e) {
    console.error('[cancelInterview] notification failed', e);
  }

  return data;
}

export async function rescheduleInterview(
  interviewId: string,
  fields: { scheduledAt: string; durationMinutes: number; notes?: string },
) {
  const res = await fetch(`/api/interviews/${interviewId}/reschedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to reschedule interview');
  }
  return res.json();
}

export async function sendRescheduleRequestMessage(opts: {
  senderUserId: string;
  receiverUserId: string;
  applicationId: string;
  body: string;
}) {
  const { error } = await supabase.from('messages').insert({
    sender_id: opts.senderUserId,
    receiver_id: opts.receiverUserId,
    application_id: opts.applicationId,
    body: opts.body,
  });
  if (error) throw error;
}

// ---- Notifications ----

export type NotificationType =
  | 'message'
  | 'application_status'
  | 'new_application'
  | 'interview';

export type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
  actor?: { full_name: string | null; avatar_url: string | null } | null;
};

// Human-readable labels for application statuses, used in notification copy.
export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  applied: 'Applied',
  reviewed: 'Under Review',
  interviewing: 'Interviewing',
  offered: 'Offered',
  rejected: 'Not Selected',
};

// Creates a notification for `userId`, with the current user as the actor.
// Failures are logged but never thrown — a notification should never break
// the underlying action (sending a message, moving a pipeline card, etc.).
async function createNotification(opts: {
  userId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}) {
  if (!opts.userId || opts.userId === opts.actorId) return;
  const { error } = await supabase.from('notifications').insert({
    user_id: opts.userId,
    actor_id: opts.actorId,
    type: opts.type,
    title: opts.title,
    body: opts.body ?? null,
    link: opts.link ?? null,
  });
  if (error) console.error('[createNotification]', error.message);
}

export async function getNotifications(userId: string, limit = 20): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, actor:profiles!notifications_actor_id_fkey(full_name, avatar_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as NotificationRow[];
}

export async function getUnreadNotificationCount(userId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) return 0;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
}

export async function markAllNotificationsRead(userId: string) {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}

export async function joinWaitlist(opts: {
  email: string;
  fullName: string;
  role: 'student' | 'employer' | 'other';
}) {
  const { error } = await supabase.from('waitlist').insert({
    email: opts.email.trim().toLowerCase(),
    full_name: opts.fullName.trim(),
    role: opts.role,
  });
  return { error };
}

async function employerUserId(employerId: string): Promise<string | undefined> {
  const { data } = await supabase.from('employers').select('user_id').eq('id', employerId).single();
  return (data as any)?.user_id;
}

async function studentUserId(studentId: string): Promise<string | undefined> {
  const { data } = await supabase.from('students').select('user_id').eq('id', studentId).single();
  return (data as any)?.user_id;
}
