# Phase 1 Implementation Plan — Next.js + Supabase

This is the active delivery plan. It supersedes the Cloudflare/D1 technical
proposal in `docs/IMPLEMENTATION_PLAN.md` while preserving that file unchanged
as historical prototype context.

## Milestone 0 — decision and migration baseline

**Tasks**

- Confirm/default Day-0 anchor, default due time, timezone, closure reasons,
  HN normalization, role matrix, retention and consent policy.
- Create Next.js App Router project structure or a deliberate incremental port
  plan for the existing prototype; retain valuable Thai UI behavior.
- Confirm Care D service catalogue: vascular access assessment, AVF creation,
  dialysis catheter care, access intervention and vascular one-day surgery.
- Create separate Supabase dev and production projects and Vercel environment
  configuration. Never place production credentials in source control.
- Add migrations, seed data and RLS test strategy for clinics, memberships,
  sources, plans/steps and audit foundations.

**Acceptance criteria**

- Dev and production database identities are demonstrably different.
- Migration can create a clinic and seed Facebook, LINE OA, TikTok, Phone,
  Other, roles, and the Day 1/3/7/14/30 Standard plan.
- RLS denies a user from another clinic before any feature is built.

## Milestone 1 — identity, intake and lead lifecycle

**Tasks**

- Implement Supabase Auth profile/membership/role context and protected routes.
- Implement patient search/create with optional HN, normalized contact values,
  preferred channel, `do_not_contact`, purpose-specific care-contact consent
  and duplicate warnings.
- Implement lead creation, source metadata/external-ID placeholders, status,
  priority, owner/nurse assignment and assignment history.
- Add Zod contracts and transactional domain services with audit entries.

**Acceptance criteria**

- Admin creates a manual lead for every seeded source and can link/create a
  patient without HN.
- Same-clinic HN/phone warnings are visible; no automatic merge happens.
- Cross-clinic reads/writes fail through both UI/API and direct RLS tests.
- Lead assignment produces an auditable `awaiting_nurse_call` record.

## Milestone 2 — nurse-result capture and follow-up engine

**Tasks**

- Build admin result-entry screen for nurse calls with distinct performed,
  reported and recorded fields/times.
- Implement configurable plan/step administration and transactional task
  generation with version/step snapshots.
- Implement follow-up queue, overdue calculation, reassignment, retries,
  ad-hoc tasks, results/history and timeline.
- Add idempotent scheduled sweep/generation through Supabase Cron/Queue.

**Acceptance criteria**

- Admin can record a nurse's offline result without losing nurse attribution.
- Standard plan generates exactly five correctly dated tasks in Bangkok time.
- Editing a plan only affects permitted future work; historical task schedule
  stays unchanged.
- A task supports multiple attempts; completion needs result or skip/cancel
  reason; queue accurately groups overdue/due/upcoming work.

## Milestone 3 — appointment and operating screens

**Tasks**

- Implement lead detail timeline and searchable work queues.
- Implement appointment create/update/status/reschedule views, including
  one-flow “save result and create appointment.”
- Add basic operational dashboard: new leads, due/overdue tasks, completed
  contacts and appointments by date/status.
- Add an in-app day/week/month calendar for appointments and follow-up tasks,
  with linked detail navigation and timezone-aware filtering.
- Add an internal staff notification inbox for overdue tasks, appointment work
  and calendar-sync exceptions. It is not patient messaging.
- Complete accessible Thai labels, loading/empty/error states and responsive
  operation screens.

**Acceptance criteria**

- A created appointment retains patient, lead and source-result links in both
  directions.
- Confirm/cancel/no-show/reschedule does not silently cancel follow-up tasks.
- Timeline retains lead, assignment, task, result, appointment and audit
  history with correct actor attribution.
- A follow-up task and appointment appear exactly once in the in-app calendar.
- Internal notifications expose work exceptions without leaking symptoms or
  delivering an outbound message.

## Milestone 4 — integration-ready safety and release

**Tasks**

- Add external identities and restricted `integration_events` inbox with
  provider/account/message/conversation/event identifiers, raw-payload policy,
  idempotency and retry state.
- Define normalized integration commands and provider-adapter interface; use a
  fake adapter/test fixture only, no live credentials.
- Implement Google Calendar OAuth/settings and an idempotent outbound sync
  adapter for eligible appointments and follow-up tasks. Persist connection,
  external-event links and sync logs; route Google edits to review.
- When auto-sync is enabled, enqueue a background sync job after each eligible
  clinic mutation; use a bounded retry worker and surface pending/failed state
  plus privileged manual retry.
- Add service, RLS and workflow tests; CI typecheck/lint/test/migration checks.
- Run privacy/security review: least privilege, audit access, logs, Storage
  policy, error redaction and backup/restore procedure.
- Deploy to Vercel preview then production only after authorised operational
  sign-off.

**Acceptance criteria**

- Replaying an integration event ID/key cannot duplicate a domain record.
- Provider input reaches business data only through the validated service
  boundary.
- Retrying a Google sync does not duplicate its event; clinic-side changes
  update the existing event and Google-side edits become `needs_review`.
- Full manual flow passes: intake → nurse assignment → admin-recorded outcome
  → configured follow-ups → appointment → tracked status.
- Production release has a reviewed migration, RLS evidence and named clinic
  owner approval.

## Phase 2 backlog (not a blocker for MVP)

1. Facebook/Meta, LINE OA, TikTok, Phone/CTI, DAZ, HIS and partner adapters.
2. SMS/LINE outbound reminders and rule-driven automation.
3. Patient identity merge/reversal workflow using the preserved merge handoff.
4. Advanced reporting, marketing attribution, richer clinical workflows and
   operational analytics.
5. Patient-facing appointment/follow-up reminders, birthday engagement and
   consent-aware outbound delivery.
6. Restricted clinical document storage and clinician-approved continuing-care
   recommendation workflow.

## Do not build yet

Do not split the monolith into microservices or introduce Kubernetes, EC2,
Redis, a custom queue cluster, provider credentials, live webhooks, automated
outbound messaging or a full nurse portal merely for architectural symmetry.
