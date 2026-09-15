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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
