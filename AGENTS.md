# Repository guidance

## Documentation authority

For the active implementation, read in this order:

1. `docs/CODEX_HANDOFF.md`
2. `docs/REQUIREMENTS.md`
3. `docs/ARCHITECTURE.md`
4. `docs/IMPLEMENTATION_PLAN_NEXT_SUPABASE.md`

Older requirements and the earlier Cloudflare implementation plan are
preserved references, not the active technical direction. Do not delete or
rewrite them to remove history.

## Phase 1 boundaries

- Build a manual-first Next.js App Router + Vercel + Supabase modular monolith.
- Enforce `clinic_id` tenancy with RLS/RBAC from the first migration.
- Keep domain services separate from route handlers/server actions.
- Preserve `performed_by`, `reported_by`, `recorded_by` and audit attribution.
- Treat live integrations, calendar/message automation, automatic merges,
  microservices, Kubernetes, EC2 and Redis as Phase 2/deferred work unless the
  user explicitly reprioritises them.
