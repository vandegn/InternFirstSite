// Where each role's dashboard lives. Split out of lib/supabase.ts so the
// middleware can import it without pulling in the browser Supabase client,
// which is constructed at module scope there and has no business running in
// the edge runtime. lib/supabase.ts re-exports this, so existing
// `import { DASHBOARD_ROUTES } from '@/lib/supabase'` call sites are unchanged.
export const DASHBOARD_ROUTES: Record<string, string> = {
  student: '/dashboard/student',
  employer: '/dashboard/employer',
  intern_first_admin: '/dashboard/admin',
};
