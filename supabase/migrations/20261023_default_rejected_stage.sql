-- Every new posting starts with four pipeline columns:
--   Applied -> Interviewing -> Offered -> Rejected
-- The Rejected column used to appear only when an employer added it from the
-- preset dropdown, or when Archive/End Hiring created one on demand. It is now
-- part of the seeded board, after Offered (position 1500), and unlocked like
-- Interviewing so employers can rename, recolor or remove it.
--
-- Colors are the same theme tokens the "Rejected" preset in
-- PIPELINE_STAGE_PRESETS stores (so dark mode gets the matching chip).
create or replace function seed_pipeline_stages_for_listing()
returns trigger as $$
begin
  insert into pipeline_stages (listing_id, label, color_bg, color_text, position, stage_type, locked)
  values
    (new.id, 'Applied',      '#e0e7ff', '#3730a3', 0,    'applied',      true),
    (new.id, 'Interviewing', '#ede9fe', '#5b21b6', 500,  'interviewing', false),
    (new.id, 'Offered',      '#d1fae5', '#065f46', 1000, 'offered',      true),
    (new.id, 'Rejected',     'var(--danger-bg-strong)', 'var(--danger-fg)', 1500, 'rejected', false);
  return new;
end;
$$ language plpgsql security definer;

-- Existing postings without any Rejected column get one too, placed after
-- every column they already have.
insert into pipeline_stages (listing_id, label, color_bg, color_text, position, stage_type, locked)
select
  l.id, 'Rejected', 'var(--danger-bg-strong)', 'var(--danger-fg)',
  coalesce((select max(ps.position) from pipeline_stages ps where ps.listing_id = l.id), 0) + 1,
  'rejected', false
from internship_listings l
where not exists (
  select 1 from pipeline_stages ps
  where ps.listing_id = l.id and ps.stage_type = 'rejected'
);
