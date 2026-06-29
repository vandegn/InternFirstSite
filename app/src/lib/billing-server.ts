import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

// Ensure the employer has a Stripe customer + an employer_billing row, creating
// both on first use. Returns the stripe_customer_id. Uses an admin (service
// role) Supabase client so it can upsert regardless of RLS.
export async function ensureStripeCustomer(
  stripe: Stripe,
  admin: SupabaseClient,
  employer: { id: string; company_name?: string | null },
  email?: string | null,
): Promise<string> {
  const { data: existing } = await admin
    .from('employer_billing')
    .select('stripe_customer_id')
    .eq('employer_id', employer.id)
    .maybeSingle();

  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const customer = await stripe.customers.create({
    name: employer.company_name ?? undefined,
    email: email ?? undefined,
    metadata: { employer_id: employer.id },
  });

  await admin
    .from('employer_billing')
    .upsert(
      { employer_id: employer.id, stripe_customer_id: customer.id },
      { onConflict: 'employer_id' },
    );

  return customer.id;
}
