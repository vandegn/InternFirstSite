import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getServerSupabase, getAdminSupabase } from '@/lib/supabase-server';

// Safety net for PPJ activation: when Stripe redirects the employer back to the
// success page, this confirms the Checkout Session is paid and activates the
// listing immediately — independent of the webhook. Idempotent: if the webhook
// already activated the listing, this is a no-op. Mirrors the ppj_upfront branch
// of /api/billing/webhook.
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Payments not configured.' }, { status: 500 });
  }

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await req.json().catch(() => ({}));
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ activated: false, status: session.payment_status });
    }

    const listingId = session.metadata?.listing_id;
    const paymentId = session.metadata?.listing_payment_id;
    const durationDays = Number(session.metadata?.duration_days || 0);
    if (!listingId) {
      return NextResponse.json({ activated: false, error: 'No listing on session' });
    }

    // Confirm the listing belongs to the returning employer before activating.
    const { data: listing } = await supabase
      .from('internship_listings')
      .select('id, status, payment_status, employer:employers!inner(user_id)')
      .eq('id', listingId)
      .single();
    if (!listing || (listing as any).employer?.user_id !== user.id) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    if (listing.payment_status === 'paid') {
      return NextResponse.json({ activated: true, alreadyActive: true });
    }

    const admin = getAdminSupabase();
    const expiresAt = durationDays
      ? new Date(Date.now() + durationDays * 86400_000).toISOString()
      : null;

    await admin
      .from('internship_listings')
      .update({ payment_status: 'paid', status: 'active', expires_at: expiresAt })
      .eq('id', listingId);

    if (paymentId) {
      await admin
        .from('listing_payments')
        .update({ status: 'paid', stripe_ref: session.id })
        .eq('id', paymentId);
    }

    return NextResponse.json({ activated: true });
  } catch (err: any) {
    console.error('[billing/verify-checkout]', err?.message);
    return NextResponse.json({ error: err?.message || 'Verification failed.' }, { status: 500 });
  }
}
