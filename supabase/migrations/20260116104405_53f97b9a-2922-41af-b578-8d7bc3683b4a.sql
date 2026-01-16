-- TEMPORARY DEMO POLICIES - Allow anon access to all tables
-- tickets table
CREATE POLICY "Demo: anon can do everything on tickets"
ON public.tickets FOR ALL TO anon
USING (true) WITH CHECK (true);

-- categories table
CREATE POLICY "Demo: anon can read categories"
ON public.categories FOR SELECT TO anon
USING (true);

-- problem_types table
CREATE POLICY "Demo: anon can read problem_types"
ON public.problem_types FOR SELECT TO anon
USING (true);

-- profiles table
CREATE POLICY "Demo: anon can do everything on profiles"
ON public.profiles FOR ALL TO anon
USING (true) WITH CHECK (true);

-- user_roles table
CREATE POLICY "Demo: anon can read user_roles"
ON public.user_roles FOR SELECT TO anon
USING (true);

-- ticket_comments table
CREATE POLICY "Demo: anon can do everything on ticket_comments"
ON public.ticket_comments FOR ALL TO anon
USING (true) WITH CHECK (true);

-- audit_log table
CREATE POLICY "Demo: anon can do everything on audit_log"
ON public.audit_log FOR ALL TO anon
USING (true) WITH CHECK (true);

-- Storage: Allow anon to access ticket-images bucket
CREATE POLICY "Demo: anon can view ticket images"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'ticket-images');

CREATE POLICY "Demo: anon can upload ticket images"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'ticket-images');

CREATE POLICY "Demo: anon can delete ticket images"
ON storage.objects FOR DELETE TO anon
USING (bucket_id = 'ticket-images');