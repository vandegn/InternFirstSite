import { NextRequest, NextResponse } from 'next/server';
import { stripe, APP_URL } from '@/lib/stripe';
import { getServerSupabase, getAdminSupabase } from '@/lib/supabase-server';
import { ensureStripeCustomer } from '@/lib/billing-server';
import { computePpjPriceCents, PPJ_APPLICATION_RANGES } from '@/lib/constants';

// Creates a one-time Stripe Checkout Session for a Pay-Per-Job listing. The fee
// is fixed: median(chosen application range) × the listing's group CPA. The
// listing must already exist (pending / paused); the webhook activates it once
// payment succeeds.
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Payments not configured.' }, { status: 500 });
  }

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { listingId, durationDays, rangeIndex } = await req.json();
  if (!listingId || rangeIndex == null) {
    return NextResponse.json({ error: 'listingId and rangeIndex are required' }, { status: 400 });
  }
  const range = PPJ_APPLICATION_RANGES[Number(rangeIndex)];
  if (!range) {
    return NextResponse.json({ error: 'Invalid application range' }, { status: 400 });
  }

  // Verify the listing belongs to this employer.
  const { data: listing } = await supabase
    .from('internship_listings')
    .select('id, title, industry, pricing_model, payment_status, employer:employers!inner(id, company_name, user_id)')
    .eq('id', listingId)
    .single();

  const employer = (listing as any)?.employer;
  if (!listing || employer?.user_id !== user.id) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }
  if (listing.pricing_model !== 'ppj') {
    return NextResponse.json({ error: 'Listing is not Pay-Per-Job' }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const customerId = await ensureStripeCustomer(stripe, admin, employer, user.email);

  // Price is recomputed server-side from the listing's industry CPA — never trusted from the client.
  const amountCents = computePpjPriceCents(listing.industry, range);

  const { data: payment } = await admin
    .from('listing_payments')
    .insert({
      employer_id: employer.id,
      listing_id: listing.id,
      type: 'ppj_upfront',
      amount_cents: amountCents,
      status: 'pending',
      applicant_quota: range.max,
      duration_days: durationDays ? Number(durationDays) : null,
    })
    .select('id')
    .single();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: `Job posting: ${listing.title}`,
            description: `Estimated ${range.min}–${range.max} applications`,
          },
        },
      },
    ],
    success_url: `${APP_URL}/dashboard/employer/posted-jobs?checkout=success`,
    cancel_url: `${APP_URL}/dashboard/employer/listings/${listing.id}/edit?checkout=cancel`,
    metadata: {
      kind: 'ppj_upfront',
      listing_id: listing.id,
      listing_payment_id: payment?.id ?? '',
      duration_days: durationDays ? String(durationDays) : '',
    },
  });

  return NextResponse.json({ url: session.url });
}
