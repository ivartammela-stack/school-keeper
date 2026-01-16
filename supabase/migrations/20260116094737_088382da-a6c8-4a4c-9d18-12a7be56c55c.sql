-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('teacher', 'admin', 'maintenance', 'leadership', 'safety_officer');

-- Create enum for ticket status
CREATE TYPE public.ticket_status AS ENUM ('submitted', 'in_progress', 'resolved', 'verified', 'closed');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create problem_types table
CREATE TABLE public.problem_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create tickets table
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number SERIAL,
  category_id UUID NOT NULL REFERENCES public.categories(id),
  problem_type_id UUID NOT NULL REFERENCES public.problem_types(id),
  location TEXT NOT NULL,
  location_key TEXT GENERATED ALWAYS AS (lower(trim(location))) STORED,
  description TEXT,
  status ticket_status DEFAULT 'submitted' NOT NULL,
  priority INTEGER DEFAULT 1,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  duplicate_of UUID REFERENCES public.tickets(id),
  duplicate_reason TEXT,
  is_safety_related BOOLEAN DEFAULT false,
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Create ticket_comments table
CREATE TABLE public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create audit_log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  old_status ticket_status,
  new_status ticket_status,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper function to check if user has any role
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Helper function to get user's roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS app_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(role) FROM public.user_roles WHERE user_id = _user_id
$$;

-- Helper to check if ticket is safety-related
CREATE OR REPLACE FUNCTION public.is_safety_ticket(_ticket_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_safety_related FROM public.tickets WHERE id = _ticket_id),
    false
  )
$$;

-- PROFILES POLICIES
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admin and leadership can view all profiles"
ON public.profiles FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'leadership')
);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- USER_ROLES POLICIES
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- CATEGORIES POLICIES (read-only for all authenticated users with roles)
CREATE POLICY "Authenticated users with roles can view categories"
ON public.categories FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

-- PROBLEM_TYPES POLICIES (read-only for all authenticated users with roles)
CREATE POLICY "Authenticated users with roles can view problem types"
ON public.problem_types FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

-- TICKETS POLICIES
CREATE POLICY "Teachers can view their own tickets"
ON public.tickets FOR SELECT
USING (
  public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid()
);

CREATE POLICY "Admin and leadership can view all tickets"
ON public.tickets FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'leadership')
);

CREATE POLICY "Maintenance can view assigned or open tickets"
ON public.tickets FOR SELECT
USING (
  public.has_role(auth.uid(), 'maintenance') AND 
  (assigned_to = auth.uid() OR status IN ('submitted', 'in_progress'))
);

CREATE POLICY "Safety officer can view safety tickets"
ON public.tickets FOR SELECT
USING (
  public.has_role(auth.uid(), 'safety_officer') AND is_safety_related = true
);

CREATE POLICY "Teachers and admin can create tickets"
ON public.tickets FOR INSERT
WITH CHECK (
  (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')) 
  AND created_by = auth.uid()
);

CREATE POLICY "Admin can update all tickets"
ON public.tickets FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Maintenance can update assigned tickets"
ON public.tickets FOR UPDATE
USING (
  public.has_role(auth.uid(), 'maintenance') AND 
  (assigned_to = auth.uid() OR status IN ('submitted', 'in_progress'))
);

CREATE POLICY "Safety officer can verify safety tickets"
ON public.tickets FOR UPDATE
USING (
  public.has_role(auth.uid(), 'safety_officer') AND 
  is_safety_related = true AND 
  status = 'resolved'
);

-- TICKET_COMMENTS POLICIES
CREATE POLICY "Users can view comments on accessible tickets"
ON public.ticket_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id AND (
      t.created_by = auth.uid() OR
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'leadership') OR
      (public.has_role(auth.uid(), 'maintenance') AND (t.assigned_to = auth.uid() OR t.status IN ('submitted', 'in_progress'))) OR
      (public.has_role(auth.uid(), 'safety_officer') AND t.is_safety_related = true)
    )
  )
);

CREATE POLICY "Users can add comments to accessible tickets"
ON public.ticket_comments FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id AND (
      t.created_by = auth.uid() OR
      public.has_role(auth.uid(), 'admin') OR
      (public.has_role(auth.uid(), 'maintenance') AND (t.assigned_to = auth.uid() OR t.status IN ('submitted', 'in_progress'))) OR
      (public.has_role(auth.uid(), 'safety_officer') AND t.is_safety_related = true)
    )
  )
);

-- AUDIT_LOG POLICIES
CREATE POLICY "Admin and leadership can view all audit logs"
ON public.audit_log FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'leadership')
);

CREATE POLICY "Maintenance can view audit logs for their tickets"
ON public.audit_log FOR SELECT
USING (
  public.has_role(auth.uid(), 'maintenance') AND
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id AND t.assigned_to = auth.uid()
  )
);

CREATE POLICY "Safety officer can view audit logs for safety tickets"
ON public.audit_log FOR SELECT
USING (
  public.has_role(auth.uid(), 'safety_officer') AND
  public.is_safety_ticket(ticket_id)
);

CREATE POLICY "Teachers can view audit logs for their tickets"
ON public.audit_log FOR SELECT
USING (
  public.has_role(auth.uid(), 'teacher') AND
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id AND t.created_by = auth.uid()
  )
);

CREATE POLICY "System can insert audit logs"
ON public.audit_log FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at on tickets
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create audit log on ticket status change
CREATE OR REPLACE FUNCTION public.log_ticket_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_log (ticket_id, user_id, action, old_status, new_status, details)
    VALUES (
      NEW.id,
      auth.uid(),
      'status_change',
      OLD.status,
      NEW.status,
      jsonb_build_object('changed_at', now())
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_ticket_status_change
  AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_status_change();

-- Insert default categories
INSERT INTO public.categories (name, name_en, description, icon, sort_order) VALUES
  ('Koolimajas', 'Inside School', 'WC, mööbel/inventar, tehnosüsteemid, õppevahendid/tehnika', 'building', 1),
  ('Õues/territoorium', 'Outside/Territory', 'Libedus, vandalism, ohtlik olukord', 'trees', 2),
  ('Ohutus ja töökeskkond', 'Safety and Work Environment', 'Ohutusteated (eraldi töövoog)', 'shield-alert', 3),
  ('Paigaldus/parendustööd', 'Installation/Improvements', 'Põrandakleebised, sildid, stendid, riputused', 'wrench', 4),
  ('Tarvikud/töövahendid', 'Supplies/Tools', 'Taotlused', 'package', 5);

-- Insert problem types for Koolimajas
INSERT INTO public.problem_types (category_id, code, name, sort_order)
SELECT c.id, pt.code, pt.pname, pt.sort_order
FROM public.categories c
CROSS JOIN (VALUES 
  ('WC_BROKEN', 'WC rike', 1),
  ('WC_CLOGGED', 'WC ummistus', 2),
  ('FURNITURE_BROKEN', 'Mööbli kahjustus', 3),
  ('FURNITURE_MISSING', 'Mööbel puudu', 4),
  ('HVAC_HEATING', 'Kütte probleem', 5),
  ('HVAC_VENTILATION', 'Ventilatsiooni probleem', 6),
  ('ELECTRICAL', 'Elektririke', 7),
  ('LIGHTING', 'Valgustuse probleem', 8),
  ('TECH_PROJECTOR', 'Projektori rike', 9),
  ('TECH_COMPUTER', 'Arvuti probleem', 10),
  ('TECH_SMARTBOARD', 'Nutitahvli rike', 11),
  ('TECH_OTHER', 'Muu tehnika', 12)
) AS pt(code, pname, sort_order)
WHERE c.name = 'Koolimajas';

-- Insert problem types for Õues/territoorium
INSERT INTO public.problem_types (category_id, code, name, sort_order)
SELECT c.id, pt.code, pt.pname, pt.sort_order
FROM public.categories c
CROSS JOIN (VALUES 
  ('ICE_SLIPPERY', 'Libedus', 1),
  ('VANDALISM', 'Vandalism', 2),
  ('DANGEROUS_SITUATION', 'Ohtlik olukord', 3),
  ('PLAYGROUND_DAMAGE', 'Mänguväljaku kahjustus', 4),
  ('FENCE_DAMAGE', 'Aia kahjustus', 5),
  ('PARKING_ISSUE', 'Parkimise probleem', 6)
) AS pt(code, pname, sort_order)
WHERE c.name = 'Õues/territoorium';

-- Insert problem types for Ohutus ja töökeskkond
INSERT INTO public.problem_types (category_id, code, name, sort_order)
SELECT c.id, pt.code, pt.pname, pt.sort_order
FROM public.categories c
CROSS JOIN (VALUES 
  ('FIRE_SAFETY', 'Tuleohutuse probleem', 1),
  ('EMERGENCY_EXIT', 'Evakuatsioonitee probleem', 2),
  ('CHEMICAL_HAZARD', 'Keemiline oht', 3),
  ('ELECTRICAL_HAZARD', 'Elektriline oht', 4),
  ('ERGONOMIC', 'Ergonoomika probleem', 5),
  ('FIRST_AID', 'Esmaabi vahendid', 6),
  ('SAFETY_EQUIPMENT', 'Turvavarustus', 7)
) AS pt(code, pname, sort_order)
WHERE c.name = 'Ohutus ja töökeskkond';

-- Insert problem types for Paigaldus/parendustööd
INSERT INTO public.problem_types (category_id, code, name, sort_order)
SELECT c.id, pt.code, pt.pname, pt.sort_order
FROM public.categories c
CROSS JOIN (VALUES 
  ('FLOOR_STICKER', 'Põrandakleebis', 1),
  ('SIGN_INSTALL', 'Sildi paigaldus', 2),
  ('STAND_INSTALL', 'Stendi paigaldus', 3),
  ('HANGING', 'Riputused', 4),
  ('SHELF_INSTALL', 'Riiuli paigaldus', 5),
  ('OTHER_INSTALL', 'Muu paigaldus', 6)
) AS pt(code, pname, sort_order)
WHERE c.name = 'Paigaldus/parendustööd';

-- Insert problem types for Tarvikud/töövahendid
INSERT INTO public.problem_types (category_id, code, name, sort_order)
SELECT c.id, pt.code, pt.pname, pt.sort_order
FROM public.categories c
CROSS JOIN (VALUES 
  ('OFFICE_SUPPLIES', 'Kontoritarbed', 1),
  ('CLEANING_SUPPLIES', 'Koristustarvikud', 2),
  ('TEACHING_MATERIALS', 'Õppematerjalid', 3),
  ('SPORTS_EQUIPMENT', 'Spordivahendid', 4),
  ('TOOLS', 'Tööriistad', 5),
  ('OTHER_SUPPLIES', 'Muud tarvikud', 6)
) AS pt(code, pname, sort_order)
WHERE c.name = 'Tarvikud/töövahendid';

-- Create storage bucket for ticket images
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-images', 'ticket-images', false);

-- Storage policies for ticket images
CREATE POLICY "Users can upload images to their tickets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ticket-images' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view images of accessible tickets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ticket-images' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their own uploaded images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ticket-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);