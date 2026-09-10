# Clinic Tracking Leads — Codex Handoff

**Status:** canonical handoff, 11 September 2026  
**Product language:** Thai-first UI; English identifiers and APIs are acceptable.

## Start here

This document resolves the direction for the next implementation. Read it
before the older documents in this repository.

1. Build a **manual-first Phase 1** clinic lead and follow-up operations
   system.
2. The approved target stack is **Next.js App Router + React + TypeScript on
   Vercel, with Supabase**. It replaces the earlier proposed Vinext/Cloudflare
   implementation direction; it does not invalidate the product requirements
   or UI prototype.
3. Treat `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, and
   `docs/IMPLEMENTATION_PLAN_NEXT_SUPABASE.md` as the implementation source of
   truth. The existing documents remain preserved as detailed historical and
   additive references.

## Document map

| Document | Use it for | Status |
|---|---|---|
| `docs/REQUIREMENTS.md` | Consolidated Phase 1 product, workflow, data and acceptance requirements | Canonical |
| `docs/ARCHITECTURE.md` | Target technical architecture, security, schema and environment design | Canonical |
| `docs/IMPLEMENTATION_PLAN_NEXT_SUPABASE.md` | Ordered delivery plan and exit criteria | Canonical |
| `REQUIREMENTS.md` | Detailed original requirement baseline | Preserved reference |
| `docs/PHASE_1_REQUIREMENTS.md` | Earlier Phase 1 source-of-truth draft | Preserved reference; merge into canonical docs |
| `docs/PATIENT_IDENTITY_MERGE_REQUIREMENTS.md` | Additive duplicate/merge and reversal design | Phase 2 unless explicitly pulled forward |
| `docs/CALENDAR_AUTOMATION_HANDOFF.md` | Calendar, outbound messaging and Google Calendar design | Calendar/task sync scope is pulled forward below; messaging/automation remains Phase 2 |
| `docs/IMPLEMENTATION_PLAN.md` | Earlier Cloudflare/D1 delivery proposal | Superseded technically; preserve for prototype context only |

## Reconciled decisions and conflicts

| Topic | Decision to implement | Why / effect |
|---|---|---|
| Runtime and hosting | Next.js App Router deployed to Vercel | Latest requested architecture; do not extend the Vinext/Cloudflare server plan. |
| Database and auth | Separate Supabase PostgreSQL/Auth/Storage/Realtime/Cron/Queue services | Replaces D1 and workspace-only access. |
| Existing UI prototype | Reuse its Thai labels, workflow knowledge and suitable shadcn-style components; port incrementally | Preserve product value, not its runtime constraint. |
| Nurse access | Admin is the required Phase 1 operator; a nurse account/login is optional | The system must still record the nurse as performer/reporter when admin enters results. |
| Patient duplicate handling | Search and warn by HN/phone; admin chooses link/create; no automatic merge | The complete merge/reversal module is Phase 2. |
| Calendar/messages/providers | In-app calendar and idempotent Google Calendar sync for appointments and follow-up tasks are in scope; SMS, LINE sending and all other provider APIs remain Phase 2 | Clinic is the source of truth; Google edits become review items, never silent workflow mutations. |
| Future inbound channels | Model sources/external IDs and integration inbox now; manual intake only now | Keeps Facebook, LINE OA, TikTok, phone, DAZ/HIS and partner integrations safe later. |
| Follow-up after appointment | Remains active by default | Appointment status never silently cancels remaining follow-up tasks. |

## Guardrails for the implementation agent

- Do not delete or rewrite the existing requirements documents. Add a short
  supersession note only if an older document is edited.
- Never treat a person/patient, lead/case, follow-up task/result, and
  appointment as the same record.
- Implement all mutations in domain services. Route handlers, server actions,
  scheduled jobs and future adapters must use those services.
- No external platform may write a business table directly. Google Calendar
  changes must enter a restricted sync/review boundary; no provider may update
  a task or appointment directly.
- Ingest every other provider payload
  into the integration inbox/event log and process it idempotently.
- Use `clinic_id` on tenant-owned data and enforce tenant boundaries with RLS
  and RBAC from the first migration.
- Do not introduce microservices, Kubernetes, EC2, Redis, a separate queue
  service, or live integration credentials for Phase 1.

## Questions to confirm before production

The recommended defaults are usable for development, but clinic approval is
required for: Day-0 anchor and due time; holiday/weekend policy; retention and
access policy under PDPA; exact role permissions; closure reasons; appointment
duration/collision rules; HN normalization/HIS matching rule; and acceptable
contact-consent rules.
