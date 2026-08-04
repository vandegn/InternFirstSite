import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getAdminSupabase } from '@/lib/supabase-server';

// Serves private applicant documents (resumes, application file-answers,
// certifications) from the private `applicant-docs` bucket. Authorization
// reuses the tables' RLS: the row is selected with the caller's own session, so
// if RLS hides it the caller isn't allowed to see the file either. Only after
// that gate passes do we sign the object with the service role and redirect.
const KIND_TO_TABLE: Record<string, string> = {
  resume: 'student_resumes',
  'application-answer': 'application_answers',
  certification: 'student_certifications',
  // Written by the employer, read by both sides — `offers` RLS already says who.
  offer: 'offers',
};

const SIGNED_URL_SECONDS = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params;
  const table = KIND_TO_TABLE[kind];
  if (!table) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // RLS-gated lookup: returns nothing unless the caller owns the document or
  // is the employer on the application it belongs to.
  const { data: row } = await supabase
    .from(table)
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();
  if (!row?.storage_path) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: signed, error } = await getAdminSupabase()
    .storage.from('applicant-docs')
    .createSignedUrl(row.storage_path, SIGNED_URL_SECONDS, { download: false });
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Could not create file link' }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
