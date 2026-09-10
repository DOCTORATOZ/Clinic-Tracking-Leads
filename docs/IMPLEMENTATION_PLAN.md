# Phase 1 Implementation Plan

## Repository assessment

This repository is **not blank**. It already contains a Thai-language internal lead-tracking prototype built with React 19, Vinext/Vite, Tailwind, Shadcn-style UI components, and Cloudflare/Sites deployment configuration. The current page is a client-side prototype with sample records only. No application database, authentication, API/domain layer, or Supabase client is currently configured.

Therefore Phase 1 should preserve the existing Vinext/React/Cloudflare direction. Do **not** replace it with Next.js + Supabase. The Next.js + Supabase fallback only applies to a new repository with no established stack.

## Proposed architecture

| Layer | Phase 1 approach | Reason |
|---|---|---|
| UI | Keep Vinext + React + existing component library | Extends the working prototype without a framework rewrite. |
| Server/API | Add Cloudflare Worker-compatible route handlers/domain services within the existing app | Keeps validation and workflow rules on the server boundary, ready for future manual UI and integrations. |
| Database | Add Cloudflare D1 (SQLite) through the existing Sites configuration | Native fit for the existing Cloudflare deployment; relational data and foreign keys suit lead/follow-up/appointment records. |
| Authentication | Implement after clinic confirms identity provider and role detail; initially restrict access at Sites/workspace level if appropriate | Avoids inventing a production access model for patient information. |
| Future integrations | Provider adapters call the same domain services; store provider IDs and idempotency data separately | Prevents Facebook/LINE/TikTok/phone payload formats from leaking into workflow tables. |

Before implementation, enable the D1 binding/migration path in `.openai/hosting.json`; this is a required application capability, not a framework change.

## Delivery order

### Milestone 0 — confirm operational defaults

Confirm only the items that affect irreversible rules: Day 0 anchor, duplicate patient policy, appointment fields/availability rules, closure reasons, staff permissions, and PDPA retention/access policy. Use the recommended defaults in the requirements document if confirmation is not available.

### Milestone 1 — persistence and seed data

1. Define D1 migrations for `staff`, `patients`, `leads`, `lead_status_history`, `follow_up_plans`, `follow_up_plan_steps`, `follow_ups`, `appointments`, and audit/event records.
2. Use UUID-like IDs or a documented ID generator, foreign keys, indexes for status/due date/phone/HN, and timestamp/audit columns.
3. Seed source channels, lead statuses, staff roles, and the configurable standard Day 1/3/7/14/30 plan.
4. Implement service-level validation and transactions for create lead, assign nurse, record nurse assessment, complete follow-up, create appointment, and close/reopen lead.
5. Add audit/status history in the same transaction as every workflow change.

**Exit check:** Manual test data can create a lead, assign a nurse, attribute a nurse assessment separately from admin entry, generate plan steps, create an appointment, and retain history after edits.

### Milestone 2 — operational UI

1. Replace in-memory sample state with data queries/mutations.
2. Build Lead List and Create/Edit Lead with searching by name, phone, HN, channel, and status.
3. Build Lead Detail with status timeline, nurse assignment, complete follow-up history, and appointment section.
4. Build the Admin entry form for Nurse Assessment; show assessor and recorder as separate, required controls/timestamps.
5. Build Follow-up Queue for due/overdue/upcoming work and custom follow-ups.
6. Build appointment create/update from a follow-up, retaining back-links in both record views.
7. Add dashboard counts, with a high-visibility queue/count for `WAITING_FOR_ADMIN_ENTRY`.

**Exit check:** An admin can complete the complete manual workflow without a nurse login.

### Milestone 3 — safety, verification, and readiness

1. Add form validation, status-transition guards, duplicate warnings for matching phone/HN, and closed-record protections.
2. Apply role/access enforcement once roles are confirmed; make activity/audit history readable to authorised users.
3. Test primary workflow, custom follow-up offsets, appointment linkage, overdue calculation, and timezone behavior in Asia/Bangkok.
4. Verify responsive operations screens, accessible form labels, and error/empty states.
5. Build and deploy only after the user requests publication.

**Exit check:** All acceptance checks in `PHASE_1_REQUIREMENTS.md` pass with seeded and manually entered data.

### Milestone 4 — integration-ready boundary (no live connectors)

1. Add optional external identity/integration-event tables and idempotency handling if not included in Milestone 1.
2. Define normalized input contracts such as `CreateInboundLead` and `RecordContact` used by both the manual UI and future provider adapters.
3. Do not add credentials, webhooks, outbound messages, or live provider calls in Phase 1.

## Suggested implementation slices

To keep risk low and create usable value early:

1. **Lead intake → nurse assignment → waiting-for-admin dashboard**
2. **Admin-recorded nurse assessment → standard/custom follow-up generation**
3. **Follow-up queue/history → appointment creation and lifecycle**
4. **Reporting, audit review, access controls, and integration boundary**

## Explicit non-changes

- No framework rewrite to Next.js.
- No Supabase introduction while the repository already targets Cloudflare/Sites and has no Supabase foundation.
- No direct nurse portal requirement in Phase 1.
- No live social, LINE, TikTok, phone, HIS, calendar, or messaging integration in Phase 1.

