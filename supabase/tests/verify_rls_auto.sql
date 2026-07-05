-- verify_rls_auto.sql
-- Automated RLS verification: generates a test event, member, and admin UUIDs
-- Run this in the Supabase SQL editor. It will print NOTICE messages for each test.

DO $$
DECLARE
  event_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  _aid uuid;
BEGIN
  -- Create test event
  INSERT INTO public.events (id, title, is_active, created_at)
    VALUES (event_id, 'RLS auto test event', true, now());
  RAISE NOTICE 'Created test event %', event_id;
  RAISE NOTICE 'Member id: %', member_id;
  RAISE NOTICE 'Admin id: % (note: public.is_admin() may not treat this as admin)', admin_id;

  -- Test 1: Member inserting attended = true (EXPECTED: fail)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', member_id::text)::text, true);
  BEGIN
    INSERT INTO public.attendance (id, event_id, user_id, attended, created_at)
    VALUES (gen_random_uuid(), event_id, member_id, true, now());
    RAISE NOTICE 'TEST FAILED: Member insert with attended=true succeeded (UNEXPECTED)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TEST PASSED: Member insert with attended=true failed as expected: %', SQLERRM;
  END;

  -- Test 2: Member inserting attended = false (EXPECTED: allowed)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', member_id::text)::text, true);
  BEGIN
    INSERT INTO public.attendance (id, event_id, user_id, attended, created_at)
    VALUES (gen_random_uuid(), event_id, member_id, false, now());
    RAISE NOTICE 'TEST PASSED: Member insert with attended=false succeeded as expected';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TEST FAILED: Member insert with attended=false failed: %', SQLERRM;
  END;

  -- Test 3: Member updating own row to set attended = true (EXPECTED: fail)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', member_id::text)::text, true);
  _aid := gen_random_uuid();
  INSERT INTO public.attendance (id, event_id, user_id, attended, created_at)
    VALUES (_aid, event_id, member_id, false, now());
  BEGIN
    UPDATE public.attendance SET attended = true WHERE id = _aid;
    RAISE NOTICE 'TEST FAILED: Member updated attended to true (UNEXPECTED)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TEST PASSED: Member update to attended=true failed as expected: %', SQLERRM;
  END;

  -- Test 4: Admin inserting attended = true (EXPECTED: allowed if admin)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id::text)::text, true);
  BEGIN
    INSERT INTO public.attendance (id, event_id, user_id, attended, created_at)
    VALUES (gen_random_uuid(), event_id, member_id, true, now());
    RAISE NOTICE 'ADMIN TEST: insert attended=true succeeded (may be expected if admin)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ADMIN TEST: insert attended=true failed: %', SQLERRM;
  END;

  -- Cleanup test rows
  DELETE FROM public.attendance WHERE event_id = event_id;
  DELETE FROM public.events WHERE id = event_id;
  RAISE NOTICE 'Cleanup completed for event %', event_id;
END;
$$;
