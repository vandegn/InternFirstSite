-- =============================================
-- STUDENT EEO / VOLUNTARY SELF-IDENTIFICATION
-- =============================================
-- Stores federally-recognized voluntary self-identification responses
-- (race, ethnicity, gender, veteran status, disability) plus work
-- authorization. Per Title VII / OFCCP rules, every category MUST
-- accept "declined" — voluntariness is preserved by application code,
-- not the schema.
--
-- IMPORTANT: This table is intentionally NOT visible to employers.
-- RLS policies restrict reads to the student themselves. There is
-- no employer SELECT policy, which means with RLS enabled employers
-- cannot read this data at all.

CREATE TABLE student_eeo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,

  -- Hispanic / Latino ethnicity (separate from race per federal standard)
  ethnicity_hispanic_latino text CHECK (ethnicity_hispanic_latino IN ('yes', 'no', 'declined')),

  -- Race (multi-select; per OMB categories)
  race text[] NOT NULL DEFAULT '{}',
  race_declined boolean NOT NULL DEFAULT false,

  -- Gender
  gender text CHECK (gender IN ('male', 'female', 'non_binary', 'self_describe', 'declined')),
  gender_self_describe text,

  -- Veteran status (OFCCP categories)
  veteran_status text CHECK (veteran_status IN ('protected_veteran', 'not_veteran', 'declined')),

  -- Disability (Form CC-305 / OMB 1250-0005)
  disability_status text CHECK (disability_status IN ('yes', 'no', 'declined')),

  -- Work authorization (NOT a protected category — required for hiring)
  work_authorized_us text CHECK (work_authorized_us IN ('yes', 'no')),
  requires_sponsorship text CHECK (requires_sponsorship IN ('yes', 'no')),

  completed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_eeo_student ON student_eeo(student_id);

ALTER TABLE student_eeo ENABLE ROW LEVEL SECURITY;

-- Students can view their own row
CREATE POLICY "Students can view own EEO"
  ON student_eeo FOR SELECT
  USING (student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  ));

-- Students can insert their own row
CREATE POLICY "Students can insert own EEO"
  ON student_eeo FOR INSERT
  WITH CHECK (student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  ));

-- Students can update their own row
CREATE POLICY "Students can update own EEO"
  ON student_eeo FOR UPDATE
  USING (student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  ));

-- NOTE: No employer policy. Employers cannot read student_eeo.

CREATE TRIGGER set_student_eeo_updated_at
  BEFORE UPDATE ON student_eeo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
