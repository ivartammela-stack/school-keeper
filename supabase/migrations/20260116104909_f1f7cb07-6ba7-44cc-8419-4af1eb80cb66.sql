-- Remove all demo policies from tables
DROP POLICY IF EXISTS "Demo: anon can do everything on tickets" ON public.tickets;
DROP POLICY IF EXISTS "Demo: anon can do everything on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Demo: anon can read user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Demo: anon can read categories" ON public.categories;
DROP POLICY IF EXISTS "Demo: anon can read problem_types" ON public.problem_types;
DROP POLICY IF EXISTS "Demo: anon can do everything on ticket_comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Demo: anon can do everything on audit_log" ON public.audit_log;

-- Remove demo policies from storage
DROP POLICY IF EXISTS "Demo: anon can view ticket images" ON storage.objects;
DROP POLICY IF EXISTS "Demo: anon can upload ticket images" ON storage.objects;
DROP POLICY IF EXISTS "Demo: anon can delete ticket images" ON storage.objects;