-- supabase/migrations/20260728000000_team_status_and_admin_list.sql

-- 1. Add status to teams
ALTER TABLE public.teams ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected'));

-- 2. RPC to get list of admins
CREATE OR REPLACE FUNCTION public.get_admins()
RETURNS TABLE (
  id UUID,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Verify the caller is an admin
  SELECT role INTO caller_role FROM public.profiles WHERE profiles.id = auth.uid();
  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Not authorized: Only admins can view the admin list.';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::TEXT
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.id
  WHERE p.role = 'admin';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admins() TO authenticated;

-- 3. RPC to remove an admin
CREATE OR REPLACE FUNCTION public.remove_admin(target_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_id UUID;
  caller_role TEXT;
BEGIN
  -- 1. Verify the caller is an admin
  SELECT role INTO caller_role FROM public.profiles WHERE profiles.id = auth.uid();
  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Not authorized: Only admins can demote other admins.';
  END IF;

  -- 2. Find the target user by email in auth.users
  SELECT u.id INTO target_id FROM auth.users u WHERE u.email = target_email;

  IF target_id IS NULL THEN
    RETURN FALSE; -- User not found
  END IF;

  -- Prevent demoting oneself
  IF target_id = auth.uid() THEN
     RAISE EXCEPTION 'Not authorized: You cannot demote yourself.';
  END IF;

  -- 3. Update the target user's role to 'user' in public.profiles
  UPDATE public.profiles
  SET role = 'user'
  WHERE profiles.id = target_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_admin(TEXT) TO authenticated;
