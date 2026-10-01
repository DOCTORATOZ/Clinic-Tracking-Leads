# Supabase dev + Vercel Preview

## Released checkpoint — 2 October 2026

This checkpoint supersedes the pending-release status below; prior notes remain as history.

- Preview READY: https://clinic-tracking-leads-qy1l9ii9n-doctor-a-to-z.vercel.app
- Deployment `dpl_3V8iKywbC9S8SsjNonoCr1AczsAa`, project `doctor-a-to-z/clinic-tracking-leads`. Vercel Authentication protection remains enabled: sign in to the authorized Vercel team, then the application.
- Approved dev `gispylnpqiwxqbqnvmya` now has migrations 0001–0018. No reset, seed import or production deployment. Public tables without RLS: zero.
- Preview public URL/key target that dev project. Its service-role key is a server-only Sensitive Secret, explicitly approved for Preview only. Calendar sync remains false. Keys/passwords are not recorded here.
- Hosted public signup is now disabled, verified through Auth settings. Sparse config in `supabase-preview-auth/supabase/config.toml` changed only `auth.enable_signup`; no SMTP/site URL/OAuth changes. Invitation UI/API remain disabled.
- Final local checks: lint 0 errors/warnings, typecheck passed, unit 38/38; local browser suite 7/7 including invitation-disable regression. Earlier harness 4/4 and isolated fresh/upgrade migration rehearsals passed. Remote Vercel build passed. GitHub CI has NOT run.
- Remote smoke passed actual browser login, session reload and role/API boundaries for all five roles; intake → assigned task → Nurse report → clinical projection denial → appointment → calendar; admin members/config and platform metadata separation. Unauthenticated session API returned 401.
- Remote smoke artifacts: `/Users/thiti.ch/.yarn_tmp/clinic-preview-smoke.4TBNrU/manifest.json`, `admin.png`, `coordinator.png`. Protection cookies in the same private directory are sensitive; do not share/upload them.
- Cleanup initially failed when bulk membership deactivation hit the final-admin guard. Follow-up verified all five test users banned, platform role revoked, test tenant suspended, and three non-admin memberships disabled. Final Clinic Admin membership intentionally remains active on a banned account in a suspended tenant; guard was not bypassed. Synthetic clinical records were retained, not deleted. Test clinic: `3de99b1a-38cd-4f61-989e-ae11678661ea`.
- Pre-upgrade public schema/data backup: `/Users/thiti.ch/.yarn_tmp/clinic-dev-preupgrade.ImMshF/`. Not a full Auth backup; restore not rehearsed and circular plan FK ordering needs attention. Five operational tables had zero rows before/after migration; no patient import occurred.
- User selected `developer@doctoratoz.co` as Care D Clinic Admin, separate from System Admin; account provisioning verification is recorded below when complete.
- Security Advisor still reports nine SECURITY DEFINER views, executable privileged RPC warnings, and disabled leaked-password protection. Views were inspected for explicit clinic/role filters; the smoke test is NOT a full security clearance. Do not blindly change views to invoker: directory/platform projections need an explicit redesign and regression tests.
- Remaining release work: clinic frontend UAT, complete outstanding requirement/CRUD/concurrency coverage, security findings review, invitation/password setup, and actual CI run. No production sign-off. Changes are uncommitted; test tooling/docs added after deployment do not change deployed app code.

## Historical checkpoint — 1 October 2026

## Authorization and release scope

- User confirmed `gispylnpqiwxqbqnvmya` is development only, without real patient data.
- User approved administrator-provisioned accounts for this Preview. Email invitation UI and POST are disabled until acceptance/password setup is implemented.
- No production deployment, Google sync/OAuth/cron, production secrets, or patient import.
- Vercel project already linked as `clinic-tracking-leads`; CLI 62.1.0 authenticated as `tarthiti`. Remote environment settings have not yet been checked.

## Evidence from this checkpoint

- Lint: zero errors/warnings; TypeScript passed; unit 38/38; harness 4/4.
- Browser workflow: 6/6 after UI refactor; invitation-disable change was made afterward and needs an additional UI/API check.
- Fresh migrations/RLS assertions passed in isolated database `clinic_contract_test_20261001193426_22976`.
- Upgrade rehearsal inserted synthetic seed at 0010, then applied 0011–0018; verified unchanged case identities, patient relations, task/appointment schedules/status, and no inferred plan anchors. Database: `clinic_contract_test_20261001193636_30054`.
- Remote dry run listed only migrations 0011–0018, with no seeds or roles.
- New GitHub Actions workflow runs local gates only; it has NOT run on GitHub and does not deploy automatically.
- No remote migrations applied, no deployment created, and no existing local server stopped in this checkpoint. Changes remain uncommitted.

## Continue in this order

1. Check final build result and rerun local gates on the final tree:
   `yarn lint`, `yarn typecheck`, `yarn test`, `yarn test:harness`, `yarn test:upgrade`, `yarn test:integration`, `NEXT_DIST_DIR=.next-contract-build yarn build`.
   Integration uses isolated project 55321, never Care D. Coordinate if someone is manually testing sandbox 3102 against that same test database.
2. Check admin Users shows the manual-provisioning notice and direct invitation POST returns 503 for Clinic Admin; verify lower roles still get 403 and no Auth email/user is created.
3. Record a backup/recovery point and database counts before upgrading the approved dev project; review migration 0011–0018 impact and existing data. Do not reset or seed the remote database.
4. Run the guarded dry run:

   ```sh
   SUPABASE_DEV_PROJECT_REF=gispylnpqiwxqbqnvmya yarn db:push:dry
   ```

5. After gates pass, apply with explicit confirmation (already authorized for this dev project):

   ```sh
   SUPABASE_DEV_PROJECT_REF=gispylnpqiwxqbqnvmya CONFIRM_SUPABASE_DEV_PROJECT_REF=gispylnpqiwxqbqnvmya yarn db:push:dev
   yarn db:status
   ```

   The wrapper verifies the linked ref and never passes `--include-seed`; it also uses `--skip-vault`. Verify all migrations 0001–0018 are present, retained counts/identities, and RLS afterward. Do not use the old db:link script with the local .env URL (it assumes a remote hostname).

6. Inspect Vercel Preview environment without overwriting local `.env`. Set only Preview scope:
   - `NEXT_PUBLIC_SUPABASE_URL=https://gispylnpqiwxqbqnvmya.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public key from that same dev project
   - `SUPABASE_SERVICE_ROLE_KEY`: server-only key from that dev project; required by member listing. Never expose or log it.
   - `CALENDAR_SYNC_ENABLED=false`
   - Do not set Google, cron or token-encryption secrets. Do not upload local env or Supabase .temp files; `.vercelignore` excludes them.
7. Verify remote Supabase Auth disables public signup (local config does not configure hosted Auth). Provision password accounts and clinic memberships manually; provision System Admin separately without clinic inheritance. Do not reuse local test passwords remotely.
8. Deploy Preview only using authenticated Vercel CLI 62.1.0, not `--prod` or promote. Use normal remote build, not the local build artifact containing localhost public config.
9. Smoke login/session refresh/logout; all five roles; three-step intake; case/plan/result/addendum/appointment; Clinic Admin config; System Admin isolation; disabled invitations and Calendar. Verify Preview requests use the dev Supabase URL, not localhost.

## Not a full requirement sign-off

The existing continuation plan still lists remaining workflow/CRUD/concurrency and visual parity work. A limited, synthetic-data Preview is not production readiness or proof that the entire requirement contract is complete.
