import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getServerSupabase, getAdminSupabase } from '@/lib/supabase-server';

// Tallies un-invoiced PPA applicant charges and bills each employer once via a
// Stripe invoice. Intended to run monthly (manual/admin trigger for now; can be
// driven by pg_cron or an external scheduler later).
//
// Auth: either a matching `x-cron-secret` header (for schedulers) or a logged-in
// intern_first_admin.
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Payments not configured.' }, { status: 500 });
  }

  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get('x-cron-secret');
  let authorized = !!cronSecret && headerSecret === cronSecret;

  if (!authorized) {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      authorized = profile?.role === 'intern_first_admin';
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminSupabase();

  const { data: charges, error } = await admin
    .from('applicant_charges')
    .select('id, employer_id, amount_cents, billing_period')
    .eq('invoiced', false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!charges || charges.length === 0) {
    return NextResponse.json({ invoiced: 0, message: 'No pending charges.' });
  }

  // Group charges by employer.
  const byEmployer = new Map<string, typeof charges>();
  for (const c of charges) {
    const list = byEmployer.get(c.employer_id) ?? [];
    list.push(c);
    byEmployer.set(c.employer_id, list);
  }

  const results: { employer_id: string; status: string; invoice?: string; amount_cents?: number }[] = [];

  for (const [employerId, employerCharges] of byEmployer) {
    const { data: billing } = await admin
      .from('employer_billing')
      .select('stripe_customer_id')
      .eq('employer_id', employerId)
      .maybeSingle();

    if (!billing?.stripe_customer_id) {
      results.push({ employer_id: employerId, status: 'skipped_no_customer' });
      continue;
    }

    const total = employerCharges.reduce((sum, c) => sum + c.amount_cents, 0);
    const period = employerCharges
      .map((c) => c.billing_period)
      .sort()
      .slice(-1)[0];

    try {
      // One aggregated line item for the period's applicants.
      await stripe.invoiceItems.create({
        customer: billing.stripe_customer_id,
        amount: total,
        currency: 'usd',
        description: `Applicants received (${employerCharges.length}) — ${period}`,
      });

      const invoice = await stripe.invoices.create({
        customer: billing.stripe_customer_id,
        collection_method: 'charge_automatically',
        auto_advance: true,
        metadata: { kind: 'ppa_monthly', employer_id: employerId },
      });

      if (invoice.id) {
        await stripe.invoices.finalizeInvoice(invoice.id);
      }

      const { data: payment } = await admin
        .from('listing_payments')
        .insert({
          employer_id: employerId,
          type: 'ppa_monthly',
          stripe_ref: invoice.id,
          amount_cents: total,
          status: 'pending',
          billing_period: period,
        })
        .select('id')
        .single();

      await admin
        .from('applicant_charges')
        .update({ invoiced: true, listing_payment_id: payment?.id ?? null })
        .in('id', employerCharges.map((c) => c.id));

      results.push({ employer_id: employerId, status: 'invoiced', invoice: invoice.id, amount_cents: total });
    } catch (err: any) {
      console.error('[invoice-ppa] employer', employerId, err.message);
      results.push({ employer_id: employerId, status: 'error' });
    }
  }

  return NextResponse.json({ invoiced: results.filter((r) => r.status === 'invoiced').length, results });
}
