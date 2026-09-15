# Production environment and credential checklist

The application does not enable live Google Calendar delivery by default.
Copy `.env.example` into the deployment environment and provision all values
before setting `CALENDAR_SYNC_ENABLED=true`.

| Variable | Owner | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase | Browser-safe project values only. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server/worker only; never expose it to a client bundle. |
| Google OAuth variables | Google Cloud | One clinic-owned destination calendar per connection. |
| `TOKEN_ENCRYPTION_KEY` | Platform owner | KMS-managed in production; database stores only an encrypted token reference. |
| `CRON_SECRET` | Vercel | Required by the calendar outbox worker endpoint. |

## Development defaults

- Day-0 anchor: `cases.source_received_at`; due time: 10:00 Asia/Bangkok; no holiday/weekend exclusion.
- Standard plan: Day 1, 3, 7, 14, 30. Generated tasks store step snapshots, so later plan edits never mutate history.
- Google Calendar is a projection only. The clinic is the source of truth; Google-side edits become `needs_review`, never silent workflow changes.

## Supabase project creation

Create a neutral SaaS project name such as `daz-care-ops-dev`, choose Southeast
Asia (Singapore), enable the Data API and automatic RLS, and leave
“Automatically expose new tables” disabled. Migration `0003` explicitly grants
only authenticated application access after RLS policies are defined. Do not
use an anonymous/public grant for clinic data.
