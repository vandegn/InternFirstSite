-- Starter topic queue for the GEO content engine (docs/geo-seo.md).
-- Run once from the Supabase SQL editor after migrations/20261111_content_articles.sql.
-- Each row is a question people actually ask an AI assistant or Google about
-- internships; the agent drafts a guide per row and an admin publishes it from
-- /dashboard/admin/content. Safe to re-run: it skips topics already present.

insert into content_topics (topic, target_query, audience, notes)
select v.topic, v.target_query, v.audience, v.notes
from (values
  ('How to get an internship with no experience', 'how to get an internship with no experience', 'student', 'Coursework, clubs, projects and part-time jobs all count. Give a concrete resume example.'),
  ('When to apply for summer internships: a month-by-month timeline', 'when should I apply for summer internships', 'student', 'Cover finance/consulting (fall), tech (fall–winter), and most other industries (January–March). U.S. calendar.'),
  ('Can a freshman or sophomore get an internship?', 'can a sophomore get an internship', 'student', 'Yes; explain which roles are realistic and how to position early coursework.'),
  ('Do you need a .edu email to apply for internships?', 'do I need a .edu email for internships', 'student', 'Explain why InternFirst requires one (enrollment verification) and what to do if your school issues a different domain.'),
  ('How to write a resume for an internship (with a template)', 'internship resume template', 'student', 'One page. Sections in order. Show a before/after bullet.'),
  ('How to answer "tell me about yourself" in an internship interview', 'tell me about yourself internship interview', 'student', 'Give a 60-second structure and two example answers (business, engineering).'),
  ('Paid vs. unpaid internships: what students should know', 'are unpaid internships legal', 'student', 'Stay factual about U.S. FLSA primary-beneficiary test without giving legal advice.'),
  ('Remote internships: how they work and how to find one', 'how to find a remote internship', 'student', 'What remote roles expect, and how to show you can work independently.'),
  ('How many internships should you apply to?', 'how many internships should I apply to', 'student', 'Batches, tracking, and when to stop tweaking the resume.'),
  ('What to do after an internship interview: follow-up and next steps', 'follow up after internship interview', 'student', 'Thank-you note timing and wording, how long to wait, how to handle silence.'),
  ('How to turn an internship into a full-time offer', 'how to get a return offer from internship', 'student', 'Weekly habits during the internship; the mid-point check-in.'),
  ('How to ask a professor for a recommendation or reference', 'how to ask a professor for a reference for an internship', 'student', 'Email template included.'),
  ('How to write an internship job description that students actually apply to', 'how to write an internship job description', 'employer', 'Concrete responsibilities, honest compensation, a clear deadline. Show a short example.'),
  ('How to hire interns for a small business or startup', 'how to hire an intern for a small business', 'employer', 'Scope a 10-week project, interview in under an hour, onboard in a day.'),
  ('What to pay interns: setting internship compensation', 'how much to pay an intern', 'employer', 'No invented market rates; discuss hourly vs. stipend, minimum-wage obligations in general terms, and why pay affects applicant quality.'),
  ('Internship interview questions employers should ask (and what to listen for)', 'intern interview questions to ask', 'employer', 'Ten questions with what a strong answer sounds like.'),
  ('How to run an internship program that interns recommend to classmates', 'how to run a good internship program', 'employer', 'Structure, mentorship, feedback cadence, final presentation.')
) as v(topic, target_query, audience, notes)
where not exists (select 1 from content_topics t where t.topic = v.topic);
