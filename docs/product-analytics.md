# Product analytics

Implementation plan (completed in code):
1. Add a first-party event store and authoritative completion triggers.
2. Instrument registration, applications, job creation, listing views and key CTAs.
3. Expose aggregate reports only to admins, with date/role filters and matched funnels.
4. Verify input validation, authorization, correlation, deduplication and publication rules.

## Enablement

Apply `supabase/migrations/20260916_product_analytics.sql` to the target Supabase database **before deploying this application version**. The new listing form writes `analytics_flow_id`, so deploying the app first would break listing creation. The server needs `SUPABASE_SERVICE_ROLE_KEY` for event ingestion; never expose it to the browser. Existing HeyCatch signup events continue unchanged; the admin page uses Supabase, not HeyCatch.

Open `/dashboard/admin/analytics` as an `intern_first_admin`. The page reports migration/database failures explicitly rather than showing misleading zeros. This change does not itself deploy the app or migrate a remote database.

## Definitions

- Listing views: once per browser-tab session per listing, across public details and signed-in student details/split-view previews. This differs from existing `listing_views`, which counts a signed-in account once per listing for its lifetime. Both are labeled separately.
- CTA clicks: explicit Apply buttons and links, registration links, Post a Job links, Browse Internships links, and waitlist links. No generic capture of button text, form contents, query strings, emails or names. These are key acquisition CTAs, not every button in the product.
- Registration start: first changed form field for the selected student/employer role, once per session/role. The same flow ID is saved in auth metadata and survives email verification on another device.
- Registration completion: profile inserted for a student/employer. Employer team invitations also create profiles, but without a matching registration start they are excluded from registration conversion denominators/numerators.
- Application start: student opens the actual application form. Clicking through from a public listing is a CTA click only. Deduplicated per account/listing.
- Application completion: an application row is committed. This matches the existing product's submission boundary; answers and notifications are separate writes, so this is not a guarantee all downstream writes succeeded.
- Posting start: first form change (or submission) on New Listing, once per form instance. A refreshed form is a new attempt.
- Job published: first transition/insert to `active`, including later publication of drafts and scheduled publication. Pausing/reactivating is not another publication. The flow ID stored on a draft correlates its eventual publication with the original start, even when a teammate publishes it.
- Funnels: starts within the selected UTC dates that have a matching completion by the inclusive end date. Completion events without a matching start remain in activity counts, not conversions. Network reordering between a start and completion is tolerated. No starts displays an em dash, not 0%.
- Existing-record totals: created/viewed timestamps in the chosen range, with role filtering. They include pre-instrumentation records but exclude deleted records. Listings include drafts and scheduled posts. These are not historical event backfills.

Tracking begins when the migration and app are deployed. Historical clicks, abandoned forms and exact first-publication times cannot be reconstructed. Older listings reactivated after enablement have no first-publication history and will be counted at their first observed activation.

## Boundaries

Browser events are best-effort and may be lost to network failure or blockers. Stored events are deduplicated; failed sends can retry on the next interaction. Anonymous/session identifiers are generated client-side, so anonymous counts are behavioral telemetry, not fraud-proof accounting. The ingestion function serializes writes and caps each session at 120 stored events/minute; rotating session IDs can evade this limit. Add edge/IP limits if traffic warrants it.

Only a same-origin server endpoint accepts allowlisted client events. Signed-in roles and application identities are resolved server-side. Completions cannot be submitted by the client. Database RLS and the reporting RPC independently enforce admin access; the recording RPC is service-role-only. Analytics stores no names, emails, form answers or full URLs. Flow keys for applications include account UUIDs; raw data is admin-only and should follow the project's data retention policy.

## Verification

From `app/`, run `npm test` (including `product-analytics.test.ts` and admin API route tests). For database behavior, run `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/product_analytics.sql` against an **empty disposable PostgreSQL database only**. That fixture creates minimal prerequisite tables/roles and applies the actual migration, testing deduplication, matched funnels, reactivation, asynchronous arrival, date/role filters, RLS, RPC authorization and rate limiting.
