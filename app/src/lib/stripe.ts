import Stripe from 'stripe';

// Server-side Stripe client. Returns null when no key is configured so that
// routes can fail gracefully (mirrors the `resend` singleton in src/lib/resend.ts).
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { typescript: true })
  : null;

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// Base URL used to build Stripe success/cancel redirect URLs.
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
