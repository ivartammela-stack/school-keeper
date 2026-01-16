-- Update the handle_new_user function to automatically assign the school with code 'PK001'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _school_id uuid;
BEGIN
  -- Get the school_id for school with code 'PK001'
  SELECT id INTO _school_id FROM public.schools WHERE code = 'PK001' LIMIT 1;
  
  INSERT INTO public.profiles (id, full_name, email, school_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email,
    _school_id
  );
  RETURN NEW;
END;
$function$;