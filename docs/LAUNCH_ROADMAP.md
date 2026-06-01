# InternFirst — Launch Roadmap

**Dev-complete target:** Monday, July 20, 2026
**Roadmap date:** May 26, 2026 (~8 weeks out)
**Team:** 2 developers, split by layer — **Dev A = Frontend / Product** (UI, pages, forms, client flows) · **Dev B = Backend / Integrations / Infra** (DB schema & migrations, API routes, Stripe, Supabase Realtime, email, storage). Full-stack features split by layer: **B builds the API + schema, A builds the UI on top.**
**Goal:** Launch-ready platform with monetization, multi-user companies, intelligent ranking, AND the UX/posting polish from the May 26 planning notes.

> **Reality check — this plan is overcommitted.** Per the May 26 decision we are keeping *everything*: the original heavy buckets (multi-user companies, monetization, ranking algorithm, engagement) **plus** 12 new UX/posting items, in 8 weeks with 2 developers. Weeks 6–7 are especially dense. This is achievable only with zero major blockers; realistically, expect to invoke the **cut-line** in § Risks. Treat the late weeks as the flex.

**Owner key:** **A** = frontend/UI · **B** = backend/data/APIs · **A + B** = full-stack, split by layer (B does API/schema, A does UI).

---

## Executive Summary

The core platform already works: student onboarding, job browsing + filtering, in-platform applications, employer listings, candidate CRM, messaging, and Zoom-based interview scheduling. The next 8 weeks turn it into a **public-facing, revenue-ready, team-ready product** — a real landing page and guest browsing at the top of the funnel; multi-user companies and payments for employers; an intelligent ranked job feed; and a polished engagement layer (notifications, calendars, in-person + video interviews). Development completes **July 20**.

### Headline timeline

| Milestone | Date | Theme | What the boss can demo |
|-----------|------|-------|------------------------|
| **M1** | Fri May 29 | Foundation & infra | Company data model live; new landing page draft |
| **M2** | Fri Jun 5 | Top of funnel | Polished homepage; guests browse listings; smoother login |
| **M3** | Fri Jun 12 | Multi-user companies | Multiple recruiters per company, EIN verification, account pages |
| **M4** | Fri Jun 19 | Postings + payments | Richer customizable postings; employers pay to post (Stripe) |
| **M5** | Fri Jun 26 | Job import + quality | Import a Workday posting to auto-fill; job quality score |
| **M6** | Fri Jul 3 | Ranking, analytics, services | Ranked feed; employer analytics; paid career services |
| **M7** | Fri Jul 10 | Engagement | Notifications bell + email alerts; calendars; in-person/video interviews; real-time chat |
| **M8** | Fri Jul 17 | UX polish + hardening | Surveys, EEO improvements, work-exp prefill, FAQ; full QA |
| **🚀 Dev complete** | **Mon Jul 20** | Go-live | Final regression and launch |

---

## Where We Are Today (May 26)

**✅ Done and working**
- **Students:** registration (.edu verified), job browse + search, filters (industry, location, paid/unpaid, remote/hybrid, length), in-platform apply with resume, application tracking, profile (skills, experiences, organizations, resume), EEO self-identification, career goals survey, welcome page, resources hub.
- **Employers:** post/edit listings, posted-jobs split view, applications review, CRM kanban, company account page, listing view tracking, **application deadline on listings**.
- **Both:** in-platform messaging, **Zoom interview scheduling + video** (merged this week).
- **Infra:** **Resend email** (contact form + signup verification) already live in `main`.

**🚧 Remaining** — everything in the week-by-week plan below.

---

## Week-by-Week Plan

Each week ends with a Friday milestone demo.

### Week 1 — Foundation & Infra → **M1 (Fri May 29)**
| Work item | Owner | Notes |
|-----------|-------|-------|
| `companies` + `company_users` tables; migrate existing 1:1 employers | B | **Critical path.** Foundation for team management & billing |
| Supabase Storage `images` bucket (avatars, logos, video) | B | Confirm/create — `uploadImage` helper already exists |
| Landing / hero page — start (modeled on internfirst-demo.com) | A | Mission statement in the About section |

*Already done:* application deadline ✅, Resend email baseline ✅.
**Demo:** company data model migrated; landing-page draft live.

### Week 2 — Top of Funnel: Landing, Guest Browsing, Smoother Auth → **M2 (Fri Jun 5)**
| Work item | Owner | Notes |
|-----------|-------|-------|
| Finish hero/landing page + About/mission | A | Match internfirst-demo.com feel |
| Guest browsing: search/browse listings without an account | A + B | B: public read policy/query; A: browse+search UI |
| "Create account to apply" gate + demo listings for signed-out users | A | Apply → signup prompt |
| Smoother auth: stay logged in N days; show login only on first login / logout | A + B | B: persistent session config; A: redirect/flow polish |

**Demo:** a visitor lands on the new homepage, browses/searches internships as a guest, hits Apply → prompted to sign up; returning users skip the login screen.

### Week 3 — Multi-User Companies → **M3 (Fri Jun 12)**
| Work item | Owner | Notes |
|-----------|-------|-------|
| Team management: invite / add / remove members, basic roles | A + B | B: `company_users` API + RLS; A: management UI |
| Company verification (EIN → pending/verified, gate posting) | A + B | B: verification logic + gate; A: status UI |
| Recruiter profile + company account page (logo, description, locations) | A | Reuses W1 company schema |

> *Advanced recruiter-**admin** account management and duty de-confliction are deferred — see § Post-Launch.*

**Demo:** add a teammate to a company, verify via EIN, view recruiter + company profiles.

### Week 4 — Job Postings: Customization + Payments → **M4 (Fri Jun 19)**
| Work item | Owner | Notes |
|-----------|-------|-------|
| More customizable job postings (richer fields/sections) | A | From notes; also feeds quality score |
| Posting type selection: Pay-Per-Post / Budget (PPC-PPA) / Organic | A | Frontend form |
| Stripe integration + `payment_transactions` table + webhooks | B | Backend |
| Checkout flow + billing history in employer settings | A + B | B: Stripe sessions/webhooks; A: checkout + billing UI |

**Demo:** richer posting form; employer selects a paid tier, checks out via Stripe, sees the charge.

### Week 5 — Job Import Parser + Quality Score → **M5 (Fri Jun 26)**
| Work item | Owner | Notes |
|-----------|-------|-------|
| External posting parser incl. **multi-page Workday** → auto-fill listing | B | Committed full build. ⚠️ see ToS/legal note in Risks |
| Parser import/review UI (paste URL → prefilled form to confirm) | A | |
| Job Quality Score: 25-field checklist + score computation | A + B | B: scoring logic; A: expanded form. Feeds ranking (W6) |

**Demo:** import a Workday posting to prefill a new listing; listings show a quality score.

### Week 6 — Ranking, Analytics + Paid Career Services → **M6 (Fri Jul 3)** · *heavy week*
| Work item | Owner | Notes |
|-----------|-------|-------|
| Engagement tracking: impressions, click-through, apply clicks | B | Extends existing view tracking |
| Ranking algorithm (RS formula): relevance + engagement + quality + payment boost + freshness | A + B | B: scoring compute; A: wire ordering into portal + recs |
| Employer Posted-Jobs analytics dashboard | A + B | B: metrics queries; A: dashboard UI |
| Paid career services: booking + Stripe checkout; Career Resources page (free + paid) | A + B | B: booking data + Stripe; A: booking + resources UI |

**Demo:** ranked job feed; per-listing analytics; students book/pay for resume reviews & coaching.

### Week 7 — Engagement: Notifications, Calendars, Interviews, Messaging → **M7 (Fri Jul 10)** · *heavy week*
| Work item | Owner | Notes |
|-----------|-------|-------|
| Notifications bell (alert messages + meeting notifs) | A + B | B: notification data/triggers; A: bell UI |
| Resend email alerts for meetings | B | Hook meetings into existing Resend |
| Calendars (student + employer) with meetings made more prominent | A + B | A: calendar UI; B: event/deadline feeds |
| In-person interview option (provide time + location), alongside Zoom | A + B | B: interview type/location; A: scheduling UI |
| Real-time messaging via Supabase Realtime (replace 5s polling) | A + B | B: Realtime channels; A: Inbox subscribe |
| Elevator-pitch video upload (10–30s) | A + B | A: upload UI; B: storage wiring |

**Demo:** notification bell with alerts + meeting reminders (incl. email); prominent calendar meetings; schedule an in-person *or* video interview; instant chat; student video pitches.

### Week 8 — Student UX Polish, Surveys, FAQ + Hardening → **M8 (Fri Jul 17)**
| Work item | Owner | Notes |
|-----------|-------|-------|
| Survey: add "Where did you hear about us?" | A | New survey field |
| Post-apply micro-survey ("how easy was it to apply?") | A + B | Trigger after a random 3–10 applications (count TBD) |
| EEO: collect once (don't re-ask); at apply-time, remind they're using stored EEO so they can update it | A | Refinement of existing EEO |
| Pre-fill work experience at apply-time (from profile) | A | So students don't retype |
| FAQ page (instead of AI chatbot for now) | A | |
| QA, bug bash, accessibility (WCAG AA), edge cases | A + B | |

**Demo:** surveys live; smoother EEO + apply experience; FAQ page; feature-complete build in QA.

### Dev Complete — **Mon Jul 20**
- Final regression, production data checks, deploy, launch.

---

## Risks & Contingency

**This plan is overcommitted for 2 developers.** Highest-risk items, by likelihood of causing slip:

1. **Weeks 6–7 are overloaded** — ranking + analytics + paid services (W6) and the entire engagement layer (W7) are each really 1.5 weeks of work. These are the first place to expect slip.
2. **Workday parser (W5)** — scraping multi-page external job boards is technically uncertain *and* has **legal/ToS exposure** (many job boards prohibit scraping). Strongly consider a "paste the job text → parse" approach or official APIs instead of live scraping. Worth a legal/founder check before building.
3. **Ranking algorithm (W6)** — most complex single item; depends on quality score (W5), engagement tracking, and payment data (W4).
4. **Two payment flows (W4, W6)** — Stripe + webhooks + billing UI are detail-heavy.
5. **Multi-user companies (W3)** — data-model migration touching every employer feature.

**Cut-line to still hit a launch-ready core on July 20** (deprioritize in this order):

| If we slip… | Launch-day fallback |
|-------------|---------------------|
| Workday parser | Manual posting only; parser becomes post-launch. |
| Ranking algorithm | Keep current major→industry recs + sort by quality score & recency. Full RS formula post-launch. |
| Paid career services | Ship the **free** resources hub + "request a booking" (no payment); monetize later. |
| Real-time messaging | Keep current 5s polling (works); Realtime is a post-launch upgrade. |
| Elevator-pitch video | Defer; not core to apply/hire flow. |
| Budget (PPC/PPA) posting | Launch **Pay-Per-Post + Organic** only; budget bidding follows. |

---

## Open Product Decisions (from May 26 notes)

- **EEO scope:** should we collect *all* applicant EEO info, or a reduced set? Affects W3/W8 design. *Needs a decision.*
- **Post-apply survey trigger:** exact count within the 3–10 range (and one-time vs recurring). Default assumption: fire once, at a random count in 3–10.
- **Workday parsing approach:** live scrape vs. paste-text vs. official API — see Risk #2 (legal). *Needs a decision before W5.*

---

## Post-Launch (Phase 2) — "Do Later"

Explicitly out of the July 20 scope:
- **Recruiter-admin accounts** that manage recruiters in a company (create / update / delete recruiter accounts) — a permissions tier above the basic multi-user companies shipping in W3.
- **Duty de-confliction** — preventing recruiters from overlapping (e.g. double-inviting the same candidate to an interview) so the team isn't reliant on an admin.

---

## Note

The previous `docs/ROADMAP.md` (a stale spec-gap analysis listing already-shipped features as missing) has been **removed**. This launch roadmap is the single source of truth for planning.
