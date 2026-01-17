-- Enable async HTTP requests for server-side push notifications
create extension if not exists pg_net with schema extensions;

-- Trigger function to notify on server-side ticket changes
create or replace function public.notify_ticket_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  notification_type text;
  payload jsonb;
begin
  -- Skip client-initiated changes (client already sends notifications)
  if auth.uid() is not null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    notification_type := 'created';
  else
    if old.status is distinct from new.status then
      if new.status = 'resolved' then
        notification_type := 'resolved';
      elsif new.status = 'verified' then
        notification_type := 'verified';
      elsif new.status = 'closed' then
        notification_type := 'closed';
      else
        notification_type := 'updated';
      end if;
    elsif old.assigned_to is distinct from new.assigned_to and new.assigned_to is not null then
      notification_type := 'assigned';
    else
      return new;
    end if;
  end if;

  payload := jsonb_build_object(
    'ticketId', new.id,
    'notificationType', notification_type
  );

  perform net.http_post(
    url := 'https://tiiuggexuateqkqrxeoa.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload
  );

  return new;
end;
$$;

drop trigger if exists on_ticket_push_notify_insert on public.tickets;
create trigger on_ticket_push_notify_insert
  after insert on public.tickets
  for each row execute function public.notify_ticket_push();

drop trigger if exists on_ticket_push_notify_update on public.tickets;
create trigger on_ticket_push_notify_update
  after update on public.tickets
  for each row
  when (old.status is distinct from new.status or old.assigned_to is distinct from new.assigned_to)
  execute function public.notify_ticket_push();
