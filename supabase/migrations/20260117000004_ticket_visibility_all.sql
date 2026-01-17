-- Allow all authenticated users with roles to view tickets and profiles

create policy "Authenticated users can view all tickets"
on public.tickets for select
using (public.has_any_role(auth.uid()));

create policy "Authenticated users can view all profiles"
on public.profiles for select
using (public.has_any_role(auth.uid()));
