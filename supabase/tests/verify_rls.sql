-- verify_rls.sql
-- Replace placeholders: <EVENT_ID>, <MEMBER_UUID>, <ADMIN_UUID>

-- Create a disposable event for testing (run once if needed)
-- INSERT INTO public.events (id, title, is_active, created_at)
-- VALUES ('<EVENT_ID>'::uuid, 'RLS test event', true, now());

-- Helper: simulate auth.uid() by setting JWT claim 'sub'
-- Test 1: Member inserting attended = true (EXPECTED: policy prevents this -> failure)
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '<MEMBER_UUID>')::text, true);
  BEGIN
    INSERT INTO public.attendance (id, event_id, user_id, attended, created_at)
    VALUES (gen_random_uuid(), '<EVENT_ID>'::uuid, '<MEMBER_UUID>'::uuid, true, now());
    RAISE NOTICE 'TEST FAILED: Member insert with attended=true succeeded (UNEXPECTED)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TEST PASSED: Member insert with attended=true failed as expected: %', SQLERRM;
  END;
END;
$$;

-- Test 2: Member inserting attended = false (EXPECTED: allowed)
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '<MEMBER_UUID>')::text, true);
  BEGIN
    INSERT INTO public.attendance (id, event_id, user_id, attended, created_at)
    VALUES (gen_random_uuid(), '<EVENT_ID>'::uuid, '<MEMBER_UUID>'::uuid, false, now());
    RAISE NOTICE 'TEST PASSED: Member insert with attended=false succeeded as expected';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TEST FAILED: Member insert with attended=false failed: %', SQLERRM;
  END;
END;
$$;

-- Test 3: Member updating own row to set attended = true (EXPECTED: update should fail if policy prevents members from marking attended true)
DO $$
DECLARE
  _aid uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '<MEMBER_UUID>')::text, true);
  -- create a row to update
  _aid := gen_random_uuid();
  INSERT INTO public.attendance (id, event_id, user_id, attended, created_at)
    VALUES (_aid, '<EVENT_ID>'::uuid, '<MEMBER_UUID>'::uuid, false, now());
  BEGIN
    UPDATE public.attendance SET attended = true WHERE id = _aid;
    RAISE NOTICE 'TEST FAILED: Member updated attended to true (UNEXPECTED)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TEST PASSED: Member update to attended=true failed as expected: %', SQLERRM;
  END;
END;
$$;

-- Test 4: Admin inserting attended = true (EXPECTED: allowed for admin)
-- NOTE: ensure <ADMIN_UUID> is recognized by public.is_admin() or run this as a session that returns true for public.is_admin()
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '<ADMIN_UUID>')::text, true);
  BEGIN
    INSERT INTO public.attendance (id, event_id, user_id, attended, created_at)
    VALUES (gen_random_uuid(), '<EVENT_ID>'::uuid, '<MEMBER_UUID>'::uuid, true, now());
    RAISE NOTICE 'ADMIN TEST: insert attended=true succeeded (expected if <ADMIN_UUID> is admin)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ADMIN TEST: insert attended=true failed: %', SQLERRM;
  END;
END;
$$;

-- Cleanup guidance: delete test rows after verifying
-- DELETE FROM public.attendance WHERE event_id = '<EVENT_ID>'::uuid;
-- DELETE FROM public.events WHERE id = '<EVENT_ID>'::uuid;

-- End of file
