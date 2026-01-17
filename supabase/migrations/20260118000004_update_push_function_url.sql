-- Update push notification URL to the new project
CREATE OR REPLACE FUNCTION public.notify_ticket_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  notification_type text;
  payload jsonb;
  internal_secret text;
BEGIN
  SELECT value INTO internal_secret
  FROM private.app_settings
  WHERE key = 'push_internal_secret';

  IF internal_secret IS NULL OR length(internal_secret) = 0 THEN
    RETURN new;
  END IF;

  IF tg_op = 'INSERT' THEN
    notification_type := 'created';
  ELSE
    IF old.status IS DISTINCT FROM new.status THEN
      IF new.status = 'resolved' THEN
        notification_type := 'resolved';
      ELSIF new.status = 'verified' THEN
        notification_type := 'verified';
      ELSIF new.status = 'closed' THEN
        notification_type := 'closed';
      ELSE
        notification_type := 'updated';
      END IF;
    ELSIF old.assigned_to IS DISTINCT FROM new.assigned_to AND new.assigned_to IS NOT NULL THEN
      notification_type := 'assigned';
    ELSE
      RETURN new;
    END IF;
  END IF;

  payload := jsonb_build_object(
    'ticketId', new.id,
    'notificationType', notification_type
  );

  PERFORM net.http_post(
    url := 'https://iptfxneryygstdhjmayw.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', internal_secret
    ),
    body := payload
  );

  RETURN new;
END;
$$;
