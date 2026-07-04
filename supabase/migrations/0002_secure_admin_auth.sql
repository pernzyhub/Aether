CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superuser'),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements"
  ON public.announcements
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage rules" ON public.rules;
CREATE POLICY "Admins can manage rules"
  ON public.rules
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DO $$
DECLARE
  target_email CONSTANT TEXT := 'it.pernzy@gmail.com';
  target_password CONSTANT TEXT := 'admin123!';
  target_user_id UUID;
BEGIN
  SELECT id
  INTO target_user_id
  FROM auth.users
  WHERE email = target_email;

  IF target_user_id IS NULL THEN
    target_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      target_user_id,
      'authenticated',
      'authenticated',
      target_email,
      crypt(target_password, gen_salt('bf')),
      NOW(),
      '',
      '',
      '',
      '',
      jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email'),
        'role', 'admin'
      ),
      '{}'::jsonb,
      NOW(),
      NOW()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt(target_password, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
          jsonb_build_object(
            'provider', 'email',
            'providers', jsonb_build_array('email'),
            'role', 'admin'
          ),
        updated_at = NOW()
    WHERE id = target_user_id;
  END IF;

  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT
    target_user_id::TEXT,
    target_user_id,
    jsonb_build_object(
      'sub', target_user_id::TEXT,
      'email', target_email,
      'email_verified', TRUE
    ),
    'email',
    NOW(),
    NOW(),
    NOW()
  WHERE NOT EXISTS (
    SELECT 1
    FROM auth.identities
    WHERE user_id = target_user_id
      AND provider = 'email'
  );
END;
$$;
