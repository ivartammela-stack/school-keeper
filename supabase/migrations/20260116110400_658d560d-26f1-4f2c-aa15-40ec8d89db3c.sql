-- Create schools table
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Everyone with a role can view schools
CREATE POLICY "Authenticated users can view schools"
ON public.schools FOR SELECT
TO authenticated
USING (has_any_role(auth.uid()));

-- Only admin can manage schools
CREATE POLICY "Admin can manage schools"
ON public.schools FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add school_id to profiles
ALTER TABLE public.profiles 
ADD COLUMN school_id uuid REFERENCES public.schools(id);

-- Insert a default school
INSERT INTO public.schools (name, code) VALUES ('Põhikool', 'PK001');