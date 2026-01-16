-- Deny anonymous access to tickets table
CREATE POLICY "deny_anon_access" ON public.tickets FOR SELECT TO anon USING (false);

-- Deny anonymous access to profiles table
CREATE POLICY "deny_anon_access" ON public.profiles FOR SELECT TO anon USING (false);