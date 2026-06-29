import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe';
import { getAdminSupabase } from '@/lib/supabase-server';

// Stripe needs the raw request body to verify the signature.
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500 });
  }

  const sig = req.headers.get('stripe-signature');
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? '', STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('[billing/webhook] signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = getAdminSupabase();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const kind = session.metadata?.kind;

        if (kind === 'ppj_upfront') {
          const listingId = session.metadata?.listing_id;
          const paymentId = session.metadata?.listing_payment_id;
          const durationDays = Number(session.metadata?.duration_days || 0);

          if (paymentId) {
            await admin
              .from('listing_payments')
              .update({ status: 'paid', stripe_ref: session.id })
              .eq('id', paymentId);
          }

          if (listingId) {
            const expiresAt = durationDays
              ? new Date(Date.now() + durationDays * 86400_000).toISOString()
              : null;
            await admin
              .from('internship_listings')
              .update({ payment_status: 'paid', status: 'active', expires_at: expiresAt })
              .eq('id', listingId);
          }
        } else if (kind === 'setup') {
          const employerId = session.metadata?.employer_id;
          const setupIntentId = session.setup_intent as string | null;
          if (employerId && setupIntentId) {
            const si = await stripe.setupIntents.retrieve(setupIntentId);
            const pm = si.payment_method as string | null;
            if (pm && session.customer) {
              // Make it the customer's default for future invoices.
              await stripe.customers.update(session.customer as string, {
                invoice_settings: { default_payment_method: pm },
              });
              await admin
                .from('employer_billing')
                .update({ default_payment_method: pm })
                .eq('employer_id', employerId);
            }
          }
        }
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await admin
          .from('listing_payments')
          .update({ status: event.type === 'invoice.paid' ? 'paid' : 'failed' })
          .eq('stripe_ref', invoice.id);
        break;
      }

      default:
        break;
    }
  } catch (err: any) {
    console.error('[billing/webhook] handler error:', err.message);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
