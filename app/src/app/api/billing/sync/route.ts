import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getServerSupabase, getAdminSupabase } from '@/lib/supabase-server';

// Source-of-truth check for "card on file": reads the employer's Stripe customer
// directly rather than trusting the webhook-populated column. Reconciles
// employer_billing.default_payment_method so the rest of the app stays correct
// even if the webhook was missed. Returns the card status for the UI.
export async function POST() {
  if (!stripe) {
    return NextResponse.json({ hasCard: false, error: 'Payments not configured.' });
  }

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: employer } = await supabase
    .from('employers')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!employer) return NextResponse.json({ hasCard: false });

  const admin = getAdminSupabase();
  const { data: billing } = await admin
    .from('employer_billing')
    .select('stripe_customer_id, default_payment_method')
    .eq('employer_id', employer.id)
    .maybeSingle();

  if (!billing?.stripe_customer_id) return NextResponse.json({ hasCard: false });

  try {
    const customer = await stripe.customers.retrieve(billing.stripe_customer_id);
    let pmId = (customer as any)?.invoice_settings?.default_payment_method as string | null;

    // No explicit default yet — fall back to the most recently attached card and
    // promote it to default so future PPA invoices can charge it.
    if (!pmId) {
      const pms = await stripe.paymentMethods.list({
        customer: billing.stripe_customer_id,
        type: 'card',
        limit: 1,
      });
      pmId = pms.data[0]?.id ?? null;
      if (pmId) {
        await stripe.customers.update(billing.stripe_customer_id, {
          invoice_settings: { default_payment_method: pmId },
        });
      }
    }

    if (pmId && pmId !== billing.default_payment_method) {
      await admin
        .from('employer_billing')
        .update({ default_payment_method: pmId })
        .eq('employer_id', employer.id);
    }

    let brand: string | undefined;
    let last4: string | undefined;
    if (pmId) {
      const pm = await stripe.paymentMethods.retrieve(pmId);
      brand = pm.card?.brand;
      last4 = pm.card?.last4;
    }

    return NextResponse.json({ hasCard: !!pmId, brand, last4 });
  } catch (err: any) {
    console.error('[billing/sync]', err?.message);
    return NextResponse.json({ hasCard: !!billing.default_payment_method });
  }
}
