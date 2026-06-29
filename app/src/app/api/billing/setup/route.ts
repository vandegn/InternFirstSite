import { NextRequest, NextResponse } from 'next/server';
import { stripe, APP_URL } from '@/lib/stripe';
import { getServerSupabase, getAdminSupabase } from '@/lib/supabase-server';
import { ensureStripeCustomer } from '@/lib/billing-server';

// Creates a Stripe Checkout Session in `setup` mode so the employer can save a
// card on file. Required before posting a Pay-Per-Applicant listing (which is
// billed monthly) and used by the billing page's "update card" action.
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Payments not configured.' }, { status: 500 });
  }

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { returnTo } = await req.json().catch(() => ({}));

  const { data: employer } = await supabase
    .from('employers')
    .select('id, company_name, user_id')
    .eq('user_id', user.id)
    .single();

  if (!employer) {
    return NextResponse.json({ error: 'Employer profile not found' }, { status: 404 });
  }

  const admin = getAdminSupabase();
  const customerId = await ensureStripeCustomer(stripe, admin, employer, user.email);

  const dest = typeof returnTo === 'string' && returnTo.startsWith('/')
    ? returnTo
    : '/dashboard/employer/billing';

  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer: customerId,
    payment_method_types: ['card'],
    success_url: `${APP_URL}${dest}?card=saved`,
    cancel_url: `${APP_URL}${dest}?card=cancel`,
    metadata: { kind: 'setup', employer_id: employer.id },
  });

  return NextResponse.json({ url: session.url });
}
