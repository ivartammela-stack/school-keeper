-- Add missing foreign key constraints for resolved_by and closed_by
ALTER TABLE public.tickets
DROP CONSTRAINT IF EXISTS tickets_resolved_by_fkey;

ALTER TABLE public.tickets
DROP CONSTRAINT IF EXISTS tickets_closed_by_fkey;

ALTER TABLE public.tickets
ADD CONSTRAINT tickets_resolved_by_fkey
FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.tickets
ADD CONSTRAINT tickets_closed_by_fkey
FOREIGN KEY (closed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
