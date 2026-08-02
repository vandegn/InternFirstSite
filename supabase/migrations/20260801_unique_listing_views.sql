-- One listing view per account
-- ============================================
-- listing_views previously got a new row on every page load, so a single
-- student re-visiting a listing inflated the employer's view count. Collapse
-- history to one row per (listing, viewer) and enforce it with a unique index
-- so the count means "unique accounts that viewed this listing".
--
-- viewer_id stays nullable and NULLs remain distinct under the index, so any
-- future anonymous/logged-out views are unaffected by this constraint.

-- Collapse existing duplicates, keeping the earliest view per account.
delete from listing_views lv
using listing_views keep
where lv.viewer_id is not null
  and keep.viewer_id = lv.viewer_id
  and keep.listing_id = lv.listing_id
  and (keep.viewed_at, keep.id) < (lv.viewed_at, lv.id);

create unique index idx_listing_views_unique_viewer
  on listing_views(listing_id, viewer_id);
