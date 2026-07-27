-- supabase/migrations/20260727004000_admin_management.sql

-- Function to make a user an admin by their email address
-- Runs as SECURITY DEFINER so it can access auth.users
CREATE OR REPLACE FUNCTION public.make_admin_by_email(target_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_id UUID;
  caller_role TEXT;
BEGIN
  -- 1. Verify the caller is an admin
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Not authorized: Only admins can promote other users.';
  END IF;

  -- 2. Find the target user by email in auth.users
  SELECT id INTO target_id FROM auth.users WHERE email = target_email;

  IF target_id IS NULL THEN
    RETURN FALSE; -- User not found
  END IF;

  -- 3. Update the target user's role to 'admin' in public.profiles
  UPDATE public.profiles
  SET role = 'admin'
  WHERE id = target_id;

  RETURN TRUE;
END;
$$;

-- Grant execution permission to authenticated users (the function internally checks if they are admin)
GRANT EXECUTE ON FUNCTION public.make_admin_by_email(TEXT) TO authenticated;
