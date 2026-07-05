Purpose
- Provide a short runbook and SQL snippets to verify Row-Level Security (RLS) policies defined in `supabase/migrations/0021_fix_events_rls_for_members.sql`.

Prerequisites
- Supabase project with migrations applied (or apply `0021` locally first).
- An `event` row UUID you can use for tests (create a disposable test event with `is_active = true`).
- Two user IDs (UUIDs): a regular member and an admin. Replace placeholders in the SQL snippets.
- Access to the Supabase SQL editor or psql with permissions to run the test snippets.

What this verifies
- Members can SELECT attendance for active events.
- Members can INSERT attendance only when `attended` is false or NULL (client RSVP should be rejected if `attended = true`).
- Members can UPDATE/DELETE only their own attendance rows.
- Admins can view/insert/update/delete attendance for anyone.

Quick steps
1. (Optional) Apply migrations so the policies are present.
2. Create a disposable event and note its `id`:
   - `INSERT INTO public.events (id, title, is_active, created_at) VALUES ('<EVENT_ID>'::uuid, 'Test event', true, now());`
3. Run the SQL test snippets in `supabase/tests/verify_rls.sql`, replacing the placeholder UUIDs.
4. Observe `NOTICE` lines — expected pass/fail messages are annotated in the SQL file.

Notes on auth simulation
- In Supabase SQL editor you can simulate `auth.uid()` by setting `request.jwt.claims` with `set_config` inside a DO block. The provided SQL uses this approach.
- Some admin checks (e.g., `public.is_admin()`) rely on your app's admin logic; to test admin flows either use a real admin user's UUID (one that `public.is_admin()` returns true for) or run the admin test from a session that has admin claims.

If a test fails unexpectedly
- Confirm migrations are applied and the policy names match `0021_fix_events_rls_for_members.sql`.
- Verify the `event_id` exists and `is_active` is set as expected.
- For admin tests, ensure the admin UUID is actually recognized by `public.is_admin()`; inspect the function `public.is_admin()` implementation if needed.

Next steps after verification
- If member INSERTs with `attended = true` still succeed, tighten the policy by replacing the `WITH CHECK` expression or enforce server-side inserts only.
- If member INSERTs with `attended = false` fail, inspect policy ordering and confirm that the `WITH CHECK` is applied to INSERT operations.

File locations
- Runbook: `supabase/tests/VERIFY_RLS_RUNBOOK.md`
- SQL snippets: `supabase/tests/verify_rls.sql`

Contact
- If you want, I can run a quick SQL lint next or help craft a CI job to run these tests automatically.