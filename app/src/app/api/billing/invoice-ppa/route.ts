import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getServerSupabase, getAdminSupabase } from '@/lib/supabase-server';

// Tallies un-invoiced PPA applicant charges and bills each employer once via a
// Stripe invoice. Runs monthly via Supabase pg_cron (see
// supabase/migrations/20260629_ppa_invoicing_cron.sql) and can also be triggered
// manually by an admin.
//
// By default only *closed* billing periods are billed (everything before the
// current month) so an in-progress month is never cut off mid-stream. Pass
// `{ "all": true }` in the body to bill open periods too — useful for testing.
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

  const body = await req.json().catch(() => ({}));
  const includeOpen = body?.all === true;

  const admin = getAdminSupabase();

  // First day of the current month (UTC). Closed periods are strictly before it.
  const now = new Date();
  const firstOfMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;

  let query = admin
    .from('applicant_charges')
    .select('id, employer_id, amount_cents, billing_period')
    .eq('invoiced', false);
  if (!includeOpen) query = query.lt('billing_period', firstOfMonth);

  const { data: charges, error } = await query;

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

  const results: { employer_id: string; status: string; invoice?: string | null; amount_cents?: number; paid?: boolean }[] = [];

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
      // Create the invoice first, then attach the line item to THIS invoice
      // explicitly (creating a pending item first doesn't reliably sweep onto
      // the new invoice), then finalize and charge the card on file.
      const invoice = await stripe.invoices.create({
        customer: billing.stripe_customer_id,
        collection_method: 'charge_automatically',
        auto_advance: false,
        metadata: { kind: 'ppa_monthly', employer_id: employerId },
      });

      await stripe.invoiceItems.create({
        customer: billing.stripe_customer_id,
        invoice: invoice.id,
        amount: total,
        currency: 'usd',
        description: `Applications billed (${employerCharges.length}) — ${period}`,
      });

      await stripe.invoices.finalizeInvoice(invoice.id!);
      const charged = await stripe.invoices.pay(invoice.id!).catch((e) => {
        console.error('[invoice-ppa] pay failed', invoice.id, e?.message);
        return null;
      });

      const { data: payment } = await admin
        .from('listing_payments')
        .insert({
          employer_id: employerId,
          type: 'ppa_monthly',
          stripe_ref: invoice.id,
          amount_cents: total,
          status: charged?.status === 'paid' ? 'paid' : 'pending',
          billing_period: period,
        })
        .select('id')
        .single();

      await admin
        .from('applicant_charges')
        .update({ invoiced: true, listing_payment_id: payment?.id ?? null })
        .in('id', employerCharges.map((c) => c.id));

      results.push({ employer_id: employerId, status: 'invoiced', invoice: invoice.id, amount_cents: total, paid: charged?.status === 'paid' });
    } catch (err: any) {
      console.error('[invoice-ppa] employer', employerId, err.message);
      results.push({ employer_id: employerId, status: 'error' });
    }
  }

  return NextResponse.json({ invoiced: results.filter((r) => r.status === 'invoiced').length, results });
}
