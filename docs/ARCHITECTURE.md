# Clinic Tracking Leads — Target Architecture

## 1. Chosen architecture

Build a **modular monolith**: one Next.js repository and deployment, with
clear modules and service boundaries rather than microservices.

```text
Browser (Thai operations UI)
        │
Next.js App Router on Vercel
  ├─ Server Components / Client UI
  ├─ Route Handlers + Server Actions (thin transport layer)
  ├─ Zod validation and authorization boundary
  └─ Domain services
      ├─ leads / patients / assignments
      ├─ follow-ups / appointments
      ├─ audit / reporting
      ├─ calendar / Google sync
      └─ integration processing
        │
Supabase
  ├─ PostgreSQL + migrations + RLS/RBAC
  ├─ Auth
  ├─ Storage (restricted attachments only when needed)
  ├─ Realtime (queue/dashboard refresh)
  ├─ Cron + Queues (scheduled task generation / asynchronous work)
  ├─ Calendar connections + sync logs
  └─ Integration inbox/events (retry + idempotency)
        │
Future adapters: Meta / LINE OA / TikTok / Phone / DAZ / HIS / partners
```

Use React, TypeScript, Tailwind CSS and shadcn/ui. Use Zod at every external
boundary. Either the Supabase TypeScript SDK or Drizzle is valid: choose **one
primary persistence approach**. Recommended: Supabase SDK for auth/RLS and
transactional PostgreSQL RPC/service functions where needed; add Drizzle only
if its typed migration/query workflow is explicitly adopted. Do not dual-write
or duplicate schema ownership.

GitHub is the source repository. Vercel preview deployments validate pull
requests; protected production deployment follows main/release checks.

## 2. Module layout

Suggested layout (adapt names to the actual app without a disruptive rewrite):

```text
app/                       routes, screens, Route Handlers only
components/                reusable UI
lib/auth/                  session, role and clinic-context helpers
lib/validation/            Zod schemas and form/API contracts
modules/patients/          services, repositories, policies, types
modules/leads/
modules/follow-ups/
modules/appointments/
modules/audit/
modules/integrations/      inbox, idempotency, provider adapters
supabase/migrations/       SQL schema, RLS policies, functions, seeds
```

Route handlers and Server Actions authenticate, establish `clinic_id`, parse
Zod input and call a service. Services enforce transitions and use a database
transaction/RPC that writes the business change, history and audit event
together. UI never owns workflow state as its only source of truth.

## 3. Multi-tenancy, access and privacy

- `clinics` is the tenant root. Include `clinic_id` on all patient, lead,
  task, result, appointment, plan, source, audit and integration records.
- Map `auth.users` to application profiles/memberships. Roles: admin,
  nurse, manager, system_admin; scope permissions by clinic and action.
- Enable RLS on every exposed table. Policies derive clinic membership from
  the authenticated subject and restrict select/mutate operations accordingly.
- Use a server-only service-role key only for narrowly scoped jobs/webhook
  processing; never send it to the browser and never let it bypass a missing
  business authorization check.
- Make audit records append-only to ordinary users. Restrict sensitive notes,
  raw provider payloads and storage objects to authorised roles.
- Store UTC; render with clinic timezone (`Asia/Bangkok` initially). Record
  actor, action, entity, timestamp and safe before/after metadata.

## 4. Core data and integrity rules

Implement the logical schema in `docs/REQUIREMENTS.md`. Important constraints:

- unique clinic-scoped HN only when non-null, per approved normalization rule;
- unique active provider identity on `(clinic_id, provider, external_account_id,
  external_user_id)` when a provider ID is supplied;
- unique `(clinic_id, idempotency_key)` for integration events;
- unique plan sequence per plan and case/plan-cycle task sequence;
- foreign keys from lead → patient/source/plan and task/result/appointment →
  lead; do not cascade-delete operational history;
- indexes for clinic + workflow status/due time, patient normalized phone/HN,
  lead case number, appointment start/status and integration retry state.

Create follow-up tasks by snapshotting plan-step label/offset/version. Store
`recorded_by`, `reported_by`, and `performed_by` where appropriate rather than
using one generic author column. Status changes and assignment changes produce
append-only history/activity records.

## 5. Scheduling, realtime and integration processing

Supabase Cron triggers bounded, idempotent jobs: generate/sweep due follow-up
tasks, mark/recompute queue state, and later dispatch integration work. Use
Supabase Queues for asynchronous retries and provider processing, not a custom
Redis worker. Scheduled jobs must use a testable clock, `clinic_id` scope,
locking/idempotency keys, retry limits and safe failure logs.

When Google Calendar auto-sync is enabled for a clinic connection, the same
transaction that changes an eligible task or appointment enqueues an outbox/job
after the domain write succeeds. A bounded worker performs provider calls and
records the sync result; no browser request performs or owns the sync.

Realtime can refresh authorised queue/dashboard views, but it must not replace
the persisted state or authorization checks.

For Google Calendar, a calendar sync service is the only component permitted
to translate eligible appointment/follow-up-task changes into provider calls.
It persists a sync log and external event ID before retries, uses the clinic as
the source of truth, and sends external edits to a review queue. For future
integrations, a Vercel webhook endpoint verifies the provider,
persists an inbox `integration_event`, then enqueues processing. The processor
claims one event, invokes a normalized command/domain service and marks it
processed/failed/needs-review. Persist first; retry safely; never map raw
vendor payloads directly into business tables.

## 6. Environments and delivery

Use at least two isolated Supabase projects and Vercel environments:

| Environment | Vercel | Supabase | Rule |
|---|---|---|---|
| Development | local + preview | dedicated dev project | test data only; migrations/seeds rehearsed here |
| Production | production | dedicated production project | real clinic data; restricted secrets and audited access |

Keep separate URL/anon key/server secret settings per environment. Version SQL
migrations in Git; apply dev first, review migration and RLS tests, then apply
the same migration to production through a controlled release. Do not share a
database, Auth users or Storage bucket between dev and production.

CI should at minimum run typecheck, lint, unit/service tests and migration/RLS
verification. Add end-to-end smoke coverage for the manual lead-to-appointment
flow once authentication and a test tenant exist.

## 7. Explicitly deferred infrastructure

Phase 1 does **not** need microservices, Kubernetes, EC2, Redis, a separate
message broker, a separate API gateway, or a data warehouse. Revisit only when
measured scale, isolation or provider throughput requires it.
