-- Secure push notifications: require internal secret and notify on all changes
-- Set the secret with: ALTER DATABASE postgres SET app.settings.push_internal_secret = '...';
create or replace function public.notify_ticket_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  notification_type text;
  payload jsonb;
  internal_secret text;
begin
  internal_secret := current_setting('app.settings.push_internal_secret', true);
  if internal_secret is null or length(internal_secret) = 0 then
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
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', internal_secret
    ),
    body := payload
  );

  return new;
end;
$$;
