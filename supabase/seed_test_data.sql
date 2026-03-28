-- =============================================================
-- InternFirst Test Data Seed Script
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Creates 3 employer accounts, 10 job listings, 3 students, and applications
-- All accounts use password: testpass1
-- =============================================================

-- =====================
-- EMPLOYER AUTH USERS
-- =====================

-- Employer 1: Apex Digital Solutions
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  'aaaaaaaa-1111-4000-a000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'recruiting@apexdigital.io',
  crypt('testpass1', gen_salt('bf')),
  now(),
  '{"full_name": "David Park", "role": "employer", "company_name": "Apex Digital Solutions"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '', ''
);

-- Employer 2: Greenfield Capital Partners
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  'aaaaaaaa-2222-4000-a000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'talent@greenfieldcap.com',
  crypt('testpass1', gen_salt('bf')),
  now(),
  '{"full_name": "Rachel Thornton", "role": "employer", "company_name": "Greenfield Capital Partners"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '', ''
);

-- Employer 3: BrightPath Marketing Group
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  'aaaaaaaa-3333-4000-a000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'hr@brightpathmarketing.com',
  crypt('testpass1', gen_salt('bf')),
  now(),
  '{"full_name": "Monica Webb", "role": "employer", "company_name": "BrightPath Marketing Group"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '', ''
);

-- Also insert identity records so Supabase auth works properly
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
  ('aaaaaaaa-1111-4000-a000-000000000001', 'aaaaaaaa-1111-4000-a000-000000000001', '{"sub": "aaaaaaaa-1111-4000-a000-000000000001", "email": "recruiting@apexdigital.io"}'::jsonb, 'email', 'aaaaaaaa-1111-4000-a000-000000000001', now(), now(), now()),
  ('aaaaaaaa-2222-4000-a000-000000000002', 'aaaaaaaa-2222-4000-a000-000000000002', '{"sub": "aaaaaaaa-2222-4000-a000-000000000002", "email": "talent@greenfieldcap.com"}'::jsonb, 'email', 'aaaaaaaa-2222-4000-a000-000000000002', now(), now(), now()),
  ('aaaaaaaa-3333-4000-a000-000000000003', 'aaaaaaaa-3333-4000-a000-000000000003', '{"sub": "aaaaaaaa-3333-4000-a000-000000000003", "email": "hr@brightpathmarketing.com"}'::jsonb, 'email', 'aaaaaaaa-3333-4000-a000-000000000003', now(), now(), now());

-- =====================
-- EMPLOYER PROFILES
-- =====================
INSERT INTO profiles (user_id, role, full_name, email) VALUES
  ('aaaaaaaa-1111-4000-a000-000000000001', 'employer', 'David Park', 'recruiting@apexdigital.io'),
  ('aaaaaaaa-2222-4000-a000-000000000002', 'employer', 'Rachel Thornton', 'talent@greenfieldcap.com'),
  ('aaaaaaaa-3333-4000-a000-000000000003', 'employer', 'Monica Webb', 'hr@brightpathmarketing.com');

-- =====================
-- EMPLOYER RECORDS
-- =====================
INSERT INTO employers (id, user_id, company_name, verified, description, website) VALUES
  ('bbbbbbbb-1111-4000-b000-000000000001', 'aaaaaaaa-1111-4000-a000-000000000001', 'Apex Digital Solutions', true,
   'Apex Digital Solutions is a fast-growing software consultancy specializing in cloud infrastructure, full-stack development, and AI-powered products. We partner with Fortune 500 companies and ambitious startups alike to build scalable digital experiences.',
   'https://apexdigital.io'),
  ('bbbbbbbb-2222-4000-b000-000000000002', 'aaaaaaaa-2222-4000-a000-000000000002', 'Greenfield Capital Partners', true,
   'Greenfield Capital Partners is a mid-market investment firm managing over $2B in assets across private equity, venture capital, and structured credit. Our analyst program is consistently ranked among the top internship experiences in finance.',
   'https://greenfieldcap.com'),
  ('bbbbbbbb-3333-4000-b000-000000000003', 'aaaaaaaa-3333-4000-a000-000000000003', 'BrightPath Marketing Group', true,
   'BrightPath Marketing Group is an integrated marketing agency serving consumer brands, B2B SaaS companies, and nonprofits. We offer full-service capabilities in digital strategy, creative, media buying, and analytics.',
   'https://brightpathmarketing.com');

-- =====================
-- INTERNSHIP LISTINGS
-- =====================

-- === Apex Digital Solutions (Technology) — 4 listings ===

INSERT INTO internship_listings (id, employer_id, title, description, location, is_remote, compensation, requirements, key_responsibilities, industry, status, application_deadline) VALUES

('cccccccc-0001-4000-c000-000000000001', 'bbbbbbbb-1111-4000-b000-000000000001',
 'Software Engineering Intern',
 'Join our engineering team to build production-grade features for enterprise clients. You will work in an agile squad alongside senior engineers, participate in code reviews, and ship code that reaches millions of users. This is a hands-on role — expect to own features end-to-end from design through deployment.',
 'San Francisco, CA', false, '$35-40/hr',
 'Currently pursuing a degree in Computer Science, Software Engineering, or a related field. Strong fundamentals in data structures and algorithms. Experience with at least one modern programming language (Python, TypeScript, Java, or Go). Familiarity with Git and collaborative development workflows.',
 'Design, implement, and test new features for our client-facing web platform. Write clean, well-documented code following team standards. Participate in daily standups, sprint planning, and retrospectives. Collaborate with product managers and designers to refine requirements. Contribute to internal tools and developer experience improvements.',
 'Technology', 'active', '2026-06-15'),

('cccccccc-0002-4000-c000-000000000002', 'bbbbbbbb-1111-4000-b000-000000000001',
 'Data Engineering Intern',
 'Help us build and maintain the data pipelines that power our analytics and machine learning products. You will work with large-scale datasets, cloud-native tooling, and modern orchestration frameworks. This role is ideal for someone who enjoys solving infrastructure-level problems and wants exposure to production data systems.',
 'Austin, TX', false, '$30-35/hr',
 'Pursuing a degree in Computer Science, Data Science, Information Systems, or a related field. Proficiency in SQL and Python. Familiarity with cloud platforms (AWS, GCP, or Azure) is a plus. Understanding of ETL concepts and data modeling.',
 'Build and optimize ETL pipelines using Apache Airflow and dbt. Monitor data quality and implement automated validation checks. Collaborate with data scientists to prepare feature datasets. Write documentation for pipeline architecture and runbooks. Assist in migrating legacy batch jobs to streaming architectures.',
 'Technology', 'active', '2026-06-01'),

('cccccccc-0003-4000-c000-000000000003', 'bbbbbbbb-1111-4000-b000-000000000001',
 'UX/UI Design Intern',
 'Work with our design team to create intuitive, accessible interfaces for enterprise SaaS products. You will participate in user research sessions, create wireframes and high-fidelity prototypes, and collaborate closely with engineers to ensure design intent is preserved in production.',
 'Remote', true, '$25-30/hr',
 'Pursuing a degree in Graphic Design, HCI, UX Design, or a related field. Proficiency in Figma. A portfolio demonstrating user-centered design thinking. Basic understanding of accessibility standards (WCAG). Ability to articulate design decisions clearly.',
 'Conduct competitive audits and user research to inform design decisions. Create wireframes, user flows, and interactive prototypes in Figma. Participate in design critiques and iterate based on feedback. Collaborate with front-end engineers during implementation. Contribute to and maintain the team design system.',
 'Technology', 'active', '2026-05-30'),

('cccccccc-0004-4000-c000-000000000004', 'bbbbbbbb-1111-4000-b000-000000000001',
 'Cloud Infrastructure Intern',
 'Support our DevOps and platform engineering team in managing cloud infrastructure for high-availability applications. You will gain hands-on experience with Infrastructure as Code, CI/CD pipelines, and container orchestration in a production environment.',
 'San Francisco, CA', false, '$35-40/hr',
 'Pursuing a degree in Computer Science, Information Technology, or a related field. Familiarity with Linux and command-line tooling. Exposure to Docker and/or Kubernetes. Basic scripting ability in Python or Bash. Interest in infrastructure automation and reliability engineering.',
 'Assist in managing AWS infrastructure using Terraform modules. Monitor system health and respond to alerts during business hours. Improve CI/CD pipeline performance and reliability. Write runbooks and incident response documentation. Participate in blameless post-incident reviews.',
 'Technology', 'active', '2026-06-15'),

-- === Greenfield Capital Partners (Finance) — 3 listings ===

('cccccccc-0005-4000-c000-000000000005', 'bbbbbbbb-2222-4000-b000-000000000002',
 'Investment Banking Summer Analyst',
 'Greenfield''s Summer Analyst program offers a rigorous, mentorship-driven experience in investment banking. You will support live deal teams on M&A transactions, capital raises, and strategic advisory engagements. Analysts gain direct exposure to client interactions, financial modeling, and deal execution.',
 'New York, NY', false, '$40+/hr',
 'Currently pursuing a degree in Finance, Economics, Accounting, or a related field. Strong financial modeling and valuation skills (DCF, comps, precedent transactions). Advanced Excel proficiency. Excellent written and verbal communication. Ability to work effectively under tight deadlines.',
 'Build and maintain detailed financial models for live M&A and capital markets transactions. Prepare client-ready pitch books, information memoranda, and management presentations. Conduct industry and company research to support deal origination. Assist with due diligence processes and data room management. Attend client calls and meetings alongside senior bankers.',
 'Finance', 'active', '2026-05-01'),

('cccccccc-0006-4000-c000-000000000006', 'bbbbbbbb-2222-4000-b000-000000000002',
 'Private Equity Research Intern',
 'Join our PE research team to evaluate potential acquisition targets and support portfolio company monitoring. This role combines deep fundamental analysis with strategic thinking. You will present findings directly to investment committee members.',
 'New York, NY', false, '$35-40/hr',
 'Pursuing a degree in Finance, Economics, or Business Administration. Solid understanding of financial statements and accounting principles. Experience with Bloomberg Terminal or Capital IQ is a plus. Strong analytical and critical thinking skills.',
 'Screen and evaluate potential investment opportunities across target sectors. Build operating models and perform scenario analysis for prospective deals. Monitor portfolio company performance against key financial and operational KPIs. Prepare investment memos and quarterly review materials. Research macroeconomic trends and sector dynamics affecting the portfolio.',
 'Finance', 'active', '2026-05-15'),

('cccccccc-0007-4000-c000-000000000007', 'bbbbbbbb-2222-4000-b000-000000000002',
 'Quantitative Risk Analyst Intern',
 'Work within our risk management team to develop and validate quantitative models for portfolio risk assessment. This role sits at the intersection of finance and data science, offering exposure to statistical modeling, stress testing, and regulatory frameworks.',
 'Chicago, IL', false, '$30-35/hr',
 'Pursuing a degree in Mathematics, Statistics, Financial Engineering, or a quantitative discipline. Proficiency in Python or R for statistical analysis. Understanding of probability, linear algebra, and regression techniques. Familiarity with financial risk concepts (VaR, stress testing) is a plus.',
 'Develop and back-test quantitative risk models using Python. Assist in portfolio stress testing and scenario analysis. Automate risk reporting dashboards and data visualizations. Validate model assumptions and document methodology. Support regulatory reporting requirements (Basel III/IV frameworks).',
 'Finance', 'active', '2026-05-15'),

-- === BrightPath Marketing Group (Marketing) — 3 listings ===

('cccccccc-0008-4000-c000-000000000008', 'bbbbbbbb-3333-4000-b000-000000000003',
 'Digital Marketing Intern',
 'Immerse yourself in full-funnel digital marketing across paid media, organic social, email, and content. You will manage real campaign budgets, analyze performance data, and present optimization recommendations to clients. This internship provides meaningful portfolio-building opportunities.',
 'Los Angeles, CA', false, '$20-25/hr',
 'Pursuing a degree in Marketing, Communications, Business, or a related field. Familiarity with social media platforms and digital advertising concepts. Basic understanding of Google Analytics or similar tools. Strong writing skills and attention to detail. Comfortable working with data and drawing insights.',
 'Plan and execute paid social campaigns across Meta, TikTok, and LinkedIn. Monitor campaign performance and prepare weekly analytics reports. Draft copy for email marketing campaigns and landing pages. Assist with SEO audits and content optimization. Collaborate with the creative team on ad concepts and A/B testing strategies.',
 'Marketing', 'active', '2026-06-01'),

('cccccccc-0009-4000-c000-000000000009', 'bbbbbbbb-3333-4000-b000-000000000003',
 'Content Strategy Intern',
 'Help shape the voice and content direction for some of the most recognizable consumer brands in the country. You will research trends, draft editorial calendars, write long-form and short-form content, and learn how content strategy drives measurable business outcomes.',
 'Remote', true, '$20-25/hr',
 'Pursuing a degree in English, Journalism, Communications, Marketing, or a related field. Exceptional writing and editing skills — include 2-3 writing samples with your application. Familiarity with SEO principles and content management systems. Ability to adapt tone and voice for different audiences. Genuine curiosity about consumer culture and media trends.',
 'Research trending topics and competitive content landscapes for assigned client accounts. Draft blog posts, social media copy, newsletters, and case studies. Maintain and update editorial calendars across multiple accounts. Optimize existing content for search performance. Track content KPIs and contribute to monthly performance reports.',
 'Marketing', 'active', '2026-06-15'),

('cccccccc-0010-4000-c000-000000000010', 'bbbbbbbb-3333-4000-b000-000000000003',
 'Market Research & Analytics Intern',
 'Dive deep into consumer behavior and market dynamics to inform strategic decisions for our clients. You will design surveys, analyze quantitative and qualitative data, and translate findings into actionable recommendations presented in polished deliverables.',
 'Los Angeles, CA', false, '$20-25/hr',
 'Pursuing a degree in Marketing, Statistics, Psychology, Sociology, or a related field. Experience with survey design and data analysis (Excel required, SPSS or R a plus). Strong analytical thinking and storytelling with data. Ability to synthesize complex findings into clear, concise presentations. Detail-oriented and highly organized.',
 'Design and deploy consumer surveys and focus group discussion guides. Clean, analyze, and visualize quantitative research data. Conduct competitive landscape and industry trend analyses. Prepare insight reports and client-ready presentations. Support the strategy team with ad hoc research requests and data pulls.',
 'Marketing', 'active', '2026-06-01');

-- =====================
-- STUDENT AUTH USERS
-- =====================

-- Student 1: Sarah Chen
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  'dddddddd-1111-4000-d000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'sarah.chen@osu.edu',
  crypt('testpass1', gen_salt('bf')),
  now(),
  '{"full_name": "Sarah Chen", "role": "student", "major": "Computer Science", "graduation_year": 2027}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '', ''
);

-- Student 2: Marcus Johnson
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  'dddddddd-2222-4000-d000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'marcus.johnson@umich.edu',
  crypt('testpass1', gen_salt('bf')),
  now(),
  '{"full_name": "Marcus Johnson", "role": "student", "major": "Finance", "graduation_year": 2027}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '', ''
);

-- Student 3: Emily Rodriguez
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  'dddddddd-3333-4000-d000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'emily.rodriguez@ufl.edu',
  crypt('testpass1', gen_salt('bf')),
  now(),
  '{"full_name": "Emily Rodriguez", "role": "student", "major": "Marketing", "graduation_year": 2026}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '', ''
);

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
  ('dddddddd-1111-4000-d000-000000000001', 'dddddddd-1111-4000-d000-000000000001', '{"sub": "dddddddd-1111-4000-d000-000000000001", "email": "sarah.chen@osu.edu"}'::jsonb, 'email', 'dddddddd-1111-4000-d000-000000000001', now(), now(), now()),
  ('dddddddd-2222-4000-d000-000000000002', 'dddddddd-2222-4000-d000-000000000002', '{"sub": "dddddddd-2222-4000-d000-000000000002", "email": "marcus.johnson@umich.edu"}'::jsonb, 'email', 'dddddddd-2222-4000-d000-000000000002', now(), now(), now()),
  ('dddddddd-3333-4000-d000-000000000003', 'dddddddd-3333-4000-d000-000000000003', '{"sub": "dddddddd-3333-4000-d000-000000000003", "email": "emily.rodriguez@ufl.edu"}'::jsonb, 'email', 'dddddddd-3333-4000-d000-000000000003', now(), now(), now());

-- =====================
-- STUDENT PROFILES
-- =====================
INSERT INTO profiles (user_id, role, full_name, email) VALUES
  ('dddddddd-1111-4000-d000-000000000001', 'student', 'Sarah Chen', 'sarah.chen@osu.edu'),
  ('dddddddd-2222-4000-d000-000000000002', 'student', 'Marcus Johnson', 'marcus.johnson@umich.edu'),
  ('dddddddd-3333-4000-d000-000000000003', 'student', 'Emily Rodriguez', 'emily.rodriguez@ufl.edu');

-- =====================
-- STUDENT RECORDS
-- =====================
INSERT INTO students (id, user_id, major, graduation_year, bio) VALUES
  ('eeeeeeee-1111-4000-e000-000000000001', 'dddddddd-1111-4000-d000-000000000001', 'Computer Science', 2027,
   'Junior CS student at Ohio State with a focus on full-stack web development and cloud computing. Actively building projects with React, Node.js, and AWS. Looking for a summer internship where I can contribute to real products and grow as an engineer.'),
  ('eeeeeeee-2222-4000-e000-000000000002', 'dddddddd-2222-4000-d000-000000000002', 'Finance', 2027,
   'Finance major at the University of Michigan Ross School of Business. Passionate about capital markets, financial modeling, and data-driven investing. Seeking an internship in investment banking or private equity to apply classroom knowledge to real transactions.'),
  ('eeeeeeee-3333-4000-e000-000000000003', 'dddddddd-3333-4000-d000-000000000003', 'Marketing', 2026,
   'Senior marketing student at the University of Florida with hands-on experience in social media management, content creation, and Google Analytics. Led digital campaigns for two campus organizations. Looking for a role that blends creative strategy with performance analytics.');

-- =====================
-- STUDENT SKILLS
-- =====================
INSERT INTO student_skills (student_id, name) VALUES
  -- Sarah Chen (CS)
  ('eeeeeeee-1111-4000-e000-000000000001', 'JavaScript'),
  ('eeeeeeee-1111-4000-e000-000000000001', 'TypeScript'),
  ('eeeeeeee-1111-4000-e000-000000000001', 'Python'),
  ('eeeeeeee-1111-4000-e000-000000000001', 'React'),
  ('eeeeeeee-1111-4000-e000-000000000001', 'Node.js'),
  ('eeeeeeee-1111-4000-e000-000000000001', 'Git'),
  ('eeeeeeee-1111-4000-e000-000000000001', 'AWS'),
  ('eeeeeeee-1111-4000-e000-000000000001', 'SQL'),
  -- Marcus Johnson (Finance)
  ('eeeeeeee-2222-4000-e000-000000000002', 'Financial Modeling'),
  ('eeeeeeee-2222-4000-e000-000000000002', 'Financial Analysis'),
  ('eeeeeeee-2222-4000-e000-000000000002', 'Excel (Advanced)'),
  ('eeeeeeee-2222-4000-e000-000000000002', 'Python'),
  ('eeeeeeee-2222-4000-e000-000000000002', 'SQL'),
  ('eeeeeeee-2222-4000-e000-000000000002', 'Power BI'),
  -- Emily Rodriguez (Marketing)
  ('eeeeeeee-3333-4000-e000-000000000003', 'Digital Marketing'),
  ('eeeeeeee-3333-4000-e000-000000000003', 'SEO/SEM'),
  ('eeeeeeee-3333-4000-e000-000000000003', 'Social Media Marketing'),
  ('eeeeeeee-3333-4000-e000-000000000003', 'Content Writing'),
  ('eeeeeeee-3333-4000-e000-000000000003', 'Google Analytics'),
  ('eeeeeeee-3333-4000-e000-000000000003', 'Copywriting'),
  ('eeeeeeee-3333-4000-e000-000000000003', 'Figma');

-- =====================
-- APPLICATIONS
-- =====================
-- Sarah Chen applies to: Software Eng (Apex), Data Eng (Apex), Cloud Infra (Apex)
INSERT INTO applications (student_id, listing_id, status) VALUES
  ('eeeeeeee-1111-4000-e000-000000000001', 'cccccccc-0001-4000-c000-000000000001', 'applied'),
  ('eeeeeeee-1111-4000-e000-000000000001', 'cccccccc-0002-4000-c000-000000000002', 'applied'),
  ('eeeeeeee-1111-4000-e000-000000000001', 'cccccccc-0004-4000-c000-000000000004', 'applied');

-- Marcus Johnson applies to: IB Analyst (Greenfield), PE Research (Greenfield), Quant Risk (Greenfield)
INSERT INTO applications (student_id, listing_id, status) VALUES
  ('eeeeeeee-2222-4000-e000-000000000002', 'cccccccc-0005-4000-c000-000000000005', 'applied'),
  ('eeeeeeee-2222-4000-e000-000000000002', 'cccccccc-0006-4000-c000-000000000006', 'applied'),
  ('eeeeeeee-2222-4000-e000-000000000002', 'cccccccc-0007-4000-c000-000000000007', 'applied');

-- Emily Rodriguez applies to: Digital Marketing (BrightPath), Content Strategy (BrightPath), Market Research (BrightPath), UX/UI (Apex)
INSERT INTO applications (student_id, listing_id, status) VALUES
  ('eeeeeeee-3333-4000-e000-000000000003', 'cccccccc-0008-4000-c000-000000000008', 'applied'),
  ('eeeeeeee-3333-4000-e000-000000000003', 'cccccccc-0009-4000-c000-000000000009', 'applied'),
  ('eeeeeeee-3333-4000-e000-000000000003', 'cccccccc-0010-4000-c000-000000000010', 'applied'),
  ('eeeeeeee-3333-4000-e000-000000000003', 'cccccccc-0003-4000-c000-000000000003', 'applied');

-- Cross-interest applications (students exploring outside their major)
-- Sarah applies to Quant Risk (she knows Python + SQL)
INSERT INTO applications (student_id, listing_id, status) VALUES
  ('eeeeeeee-1111-4000-e000-000000000001', 'cccccccc-0007-4000-c000-000000000007', 'applied');

-- Marcus applies to Data Engineering (he knows Python + SQL)
INSERT INTO applications (student_id, listing_id, status) VALUES
  ('eeeeeeee-2222-4000-e000-000000000002', 'cccccccc-0002-4000-c000-000000000002', 'applied');

-- =====================
-- DONE
-- =====================
-- Test accounts summary:
--
-- EMPLOYERS (password: testpass1)
--   recruiting@apexdigital.io      — Apex Digital Solutions (4 tech listings)
--   talent@greenfieldcap.com       — Greenfield Capital Partners (3 finance listings)
--   hr@brightpathmarketing.com     — BrightPath Marketing Group (3 marketing listings)
--
-- STUDENTS (password: testpass1)
--   sarah.chen@osu.edu             — CS major, applied to 4 listings
--   marcus.johnson@umich.edu       — Finance major, applied to 4 listings
--   emily.rodriguez@ufl.edu        — Marketing major, applied to 4 listings
