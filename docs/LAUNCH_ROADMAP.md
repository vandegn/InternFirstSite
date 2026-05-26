# InternFirst — Launch Roadmap

**Target launch:** Wednesday, July 15, 2026
**Roadmap date:** May 26, 2026 (7 weeks out)
**Team:** 2 developers — *Dev A* (student-side, job portal, frontend, product) · *Dev B* (interviews/video, APIs, integrations, infra)
**Goal:** Launch-ready core platform with monetization. All four heavy feature buckets (multi-user companies, monetization, ranking algorithm, engagement & polish) are in scope.

> **Reality check:** This is an aggressive plan for a 2-person team. It assumes both developers working full-time with minimal blockers. The ranking algorithm and the two payment flows are the highest-risk items. See **§ Risks & Contingency** for the cut-line that still gets us to a launch-ready core if anything slips.

---

## Executive Summary

The platform's core experience is already built and working: student onboarding, job browsing with full filtering, in-platform applications, employer listing management, candidate CRM, messaging, and — as of this week — **Zoom-based interview scheduling and video calls**. The remaining 7 weeks are about turning a functional product into a **revenue-ready, team-ready launch**: companies with multiple users, payments, intelligent job ranking, and the engagement layer (calendars, notifications, real-time messaging).

### Headline timeline

| Milestone | Date | Theme | What the boss can demo |
|-----------|------|-------|------------------------|
| **M1** | Fri May 29 | Foundation & infra | Companies data model live; email + file storage plumbed in |
| **M2** | Fri Jun 5 | Multi-user companies | Multiple recruiters per company, EIN verification, account pages |
| **M3** | Fri Jun 12 | Monetization I | Employers pay to post jobs (Stripe); billing visible |
| **M4** | Fri Jun 19 | Monetization II + Quality | Students book & pay for career services; jobs carry a quality score |
| **M5** | Fri Jun 26 | Ranking & analytics | Intelligent ranked job feed; employer analytics dashboard |
| **M6** | Fri Jul 3 | Engagement & polish | Calendars, real-time chat, notifications, elevator-pitch video |
| **M7** | Fri Jul 10 | Hardening & QA | Feature-complete; full QA pass, bug bash, accessibility |
| **🚀 Launch** | **Wed Jul 15** | Go-live | Production deploy after final regression (Jul 13–15 buffer) |

---

## Where We Are Today (May 26)

**✅ Done and working**
- **Students:** registration (.edu verified), job browse + search, filters (industry, location, paid/unpaid, remote/hybrid, internship length), in-platform apply with resume, application status tracking, profile (skills, experiences, organizations, resume), EEO self-identification, career goals survey, welcome/onboarding page, resources hub (resume guide, interview tips, articles).
- **Employers:** post/edit listings, posted-jobs split view, candidate applications review, CRM kanban board, company account page, listing view tracking.
- **Both:** in-platform messaging, **interview scheduling with Zoom video calls** (merged this week).

**🚧 Remaining toward launch** — the four must-have buckets below.

---

## Week-by-Week Plan

Each week ends with a Friday milestone demo. Owners are a starting split; the two developers will pair on the largest items.

### Week 1 — Foundation & Infra Unblock → **M1 (Fri May 29)**
*Lay the data-model and infrastructure groundwork everything else depends on.*

| Work item | Owner | Notes |
|-----------|-------|-------|
| `companies` + `company_users` tables; migrate existing 1:1 employers | A + B | Foundational for team management & billing |
| Supabase Storage `images` bucket (avatars, logos, video) | B | Currently a known gap; unblocks uploads |
| Transactional email via Resend (baseline) | B | Branch already started (`integrating-resend`) |
| `application_deadline` field on listings | A | Needed downstream for calendar + ranking freshness |

**Demo:** Company data model migrated; email and file uploads working end-to-end.

### Week 2 — Multi-User Companies → **M2 (Fri Jun 5)**
*Turn the 1-account-per-company model into real organizations.*

| Work item | Owner | Notes |
|-----------|-------|-------|
| Team management: invite / add / remove users, roles & permissions | A | |
| Company verification workflow (EIN → pending/verified, gate posting) | B | |
| Recruiter profile + company account page (logo, description, locations) | A | |

**Demo:** Add a teammate to a company, verify the company via EIN, see recruiter + company profiles.

### Week 3 — Monetization I: Job Posting Payments → **M3 (Fri Jun 12)**
*First revenue path: paid job postings.*

| Work item | Owner | Notes |
|-----------|-------|-------|
| Stripe integration + `payment_transactions` table | B | |
| Posting type selection: Pay-Per-Post / Budget (PPC-PPA) / Organic | A | |
| Checkout flow + billing history in employer settings | A + B | |

**Demo:** Employer selects a paid posting tier, checks out via Stripe, sees the charge in billing.

### Week 4 — Monetization II + Job Quality → **M4 (Fri Jun 19)**
*Second revenue path and the input the ranking algorithm needs.*

| Work item | Owner | Notes |
|-----------|-------|-------|
| Paid career services: booking + Stripe checkout (resume review, coaching, interview prep) | A | |
| Career Resources page: free content hub + paid booking | A | |
| Job Quality Score: expand listing form to 25-field checklist, compute score | B | Feeds ranking in Week 5 |

**Demo:** Student books and pays for a 1:1 service; new listings show a computed quality score.

### Week 5 — Ranking Algorithm & Analytics → **M5 (Fri Jun 26)**
*Make the job feed intelligent and give employers real metrics.*

| Work item | Owner | Notes |
|-----------|-------|-------|
| Engagement tracking: impressions, click-through, apply clicks | B | Extends existing view tracking |
| Ranking algorithm (RS formula): relevance + engagement + quality + payment boost + freshness | A + B | Wire into job portal ordering & recommendations |
| Employer Posted-Jobs analytics dashboard | B | Views / CTR / applies per listing |

**Demo:** Ranked job feed reflects relevance, quality, and paid boost; employers see per-listing analytics.

### Week 6 — Engagement & Polish → **M6 (Fri Jul 3)**
*The layer that makes the product feel alive.*

| Work item | Owner | Notes |
|-----------|-------|-------|
| Reusable calendar → student home (deadlines, interviews, RSVP) + employer home (interviews, company events) | A | |
| Real-time messaging via Supabase Realtime (replace 5s polling) | B | |
| Email notification preferences + privacy/security settings | B | |
| Elevator-pitch video upload (10–30s) | A | |

**Demo:** Interactive calendars, instant chat, notification settings, student video pitches.

### Week 7 — Hardening & QA → **M7 (Fri Jul 10)**
*Stabilize, not build.*

- End-to-end QA across both portals; bug bash.
- Accessibility (WCAG AA) and performance pass.
- Empty states, edge cases, error handling, remaining settings gaps.

**Demo:** Feature-complete build in QA; known-issue list shrinking daily.

### Launch Buffer — **Jul 13–15 → 🚀 Go-Live Wed Jul 15**
- Final regression, production data checks, staged deploy, launch.

---

## Risks & Contingency

**The plan is full but tight.** With 2 developers, the following are the realistic risk points, ordered by likelihood of causing slip:

1. **Ranking algorithm (Week 5)** — the most complex single item; depends on quality score (W4), engagement tracking, and payment data (W3).
2. **Two payment flows (Weeks 3–4)** — Stripe, webhooks, and billing UI are detail-heavy and error-prone.
3. **Multi-user companies (Weeks 1–2)** — a data-model migration that touches every employer feature; if it slips, it cascades.

**Cut-line to still hit a launch-ready core on July 15** (the "core + some monetization" fallback):

| If we slip on… | Launch-day fallback |
|----------------|---------------------|
| Ranking algorithm | Keep current major→industry recommendations + sort by quality score and recency. Full RS formula ships post-launch. |
| Budget (PPC/PPA) posting | Launch **Pay-Per-Post + Organic** only; budget bidding follows. |
| Paid career services | Launch the **free** resources hub + "request a booking" (no payment); monetize post-launch. |
| Real-time messaging | Keep current 5s polling (already functional); Realtime is a post-launch upgrade. |

This guarantees a working, partly-monetized launch even in the worst case.

---

## External Setup / Dependencies (not code)

- **Stripe account** + API keys (test & live) — needed before Week 3. *Please confirm who owns this.*
- **Resend** (or chosen email provider) account + verified sending domain — Week 1.
- **Supabase Storage** `images` bucket configured public — Week 1.
- **Zoom** SDK credentials — already in place (interviews shipped).

---

## Note on the existing `docs/ROADMAP.md`

The current `ROADMAP.md` is a spec-gap analysis that is now **out of date** — it lists interview scheduling, the CRM, posted-jobs analytics, view tracking, and the career survey as MISSING, but those are built. This launch roadmap supersedes it for planning purposes. *Recommend refreshing `ROADMAP.md`'s status columns (a ~30-min task) so the two docs don't contradict each other.*
