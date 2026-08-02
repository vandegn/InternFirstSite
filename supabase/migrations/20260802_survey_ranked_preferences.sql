-- Ranked, multi-select work environment and internship length.
--
-- Students were forced to pick exactly one of each, so someone open to both
-- remote and hybrid had to misrepresent themselves. The answers are now
-- ordered arrays — position 0 is the strongest preference — and match scoring
-- gives later picks proportionally less credit (see lib/matching.ts). That
-- answers both halves of the request: multi-select, and multi-select that
-- doesn't quietly count every pick as a first choice.
--
-- The original scalar columns stay and are kept in sync with element 1 by a
-- trigger. They are NOT NULL and read from several places; mirroring them is
-- cheaper and safer than chasing down every reader.

alter table career_survey_responses
  add column if not exists work_environments text[] not null default '{}';

alter table career_survey_responses
  add column if not exists preferred_durations text[] not null default '{}';

-- Backfill: an existing single answer is a one-element ranking.
update career_survey_responses
   set work_environments = array[work_environment]
 where cardinality(work_environments) = 0;

update career_survey_responses
   set preferred_durations = array[preferred_duration]
 where cardinality(preferred_durations) = 0;

-- Keep the scalars authoritative-by-mirror. Writers may send either shape:
-- arrays win when provided, otherwise the scalar seeds a one-element array.
create or replace function sync_survey_preference_arrays()
returns trigger language plpgsql as $$
begin
  if cardinality(new.work_environments) > 0 then
    new.work_environment := new.work_environments[1];
  elsif new.work_environment is not null then
    new.work_environments := array[new.work_environment];
  end if;

  if cardinality(new.preferred_durations) > 0 then
    new.preferred_duration := new.preferred_durations[1];
  elsif new.preferred_duration is not null then
    new.preferred_durations := array[new.preferred_duration];
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_survey_preference_arrays on career_survey_responses;
create trigger trg_sync_survey_preference_arrays
  before insert or update on career_survey_responses
  for each row execute function sync_survey_preference_arrays();

comment on column career_survey_responses.work_environments is
  'Work environments in preference order, strongest first. work_environment mirrors element 1.';
comment on column career_survey_responses.preferred_durations is
  'Internship lengths in preference order, strongest first. preferred_duration mirrors element 1.';
