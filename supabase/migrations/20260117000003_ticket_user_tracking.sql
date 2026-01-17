-- Track who resolves and closes tickets
alter table public.tickets
  add column if not exists resolved_by uuid references auth.users(id),
  add column if not exists closed_by uuid references auth.users(id);

-- Tighten maintenance update policy to assigned or claimable tickets
drop policy if exists "Maintenance can update assigned tickets" on public.tickets;

create policy "Maintenance can update own or claim tickets"
on public.tickets for update
using (
  public.has_role(auth.uid(), 'maintenance') and (
    assigned_to = auth.uid() or (assigned_to is null and status = 'submitted')
  )
)
with check (
  assigned_to = auth.uid() or (assigned_to is null and status = 'submitted')
);
