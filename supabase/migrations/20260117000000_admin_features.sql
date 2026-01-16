-- Admin Features Migration
-- This migration adds tables and extends existing ones for admin management system

-- ================================================
-- 1. EXTEND AUDIT_LOG TABLE
-- ================================================

-- Add new columns to audit_log for broader tracking
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Add comment to action column to clarify usage
COMMENT ON COLUMN public.audit_log.action IS 'Action types: create, update, delete, status_change, assign, verify, login, logout, etc.';
COMMENT ON COLUMN public.audit_log.entity_type IS 'Entity type: ticket, user, school, setting, etc.';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action, created_at DESC);

-- ================================================
-- 2. SYSTEM_SETTINGS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('email', 'notification', 'general', 'maintenance')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_system_settings_category ON public.system_settings(category);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Admin can view all settings
CREATE POLICY "Admin can view settings"
ON public.system_settings FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can update settings
CREATE POLICY "Admin can update settings"
ON public.system_settings FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can insert settings
CREATE POLICY "Admin can insert settings"
ON public.system_settings FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can delete settings
CREATE POLICY "Admin can delete settings"
ON public.system_settings FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default system settings
INSERT INTO public.system_settings (key, value, description, category) VALUES
  ('ticket_auto_close_days', '{"enabled": false, "days": 30}', 'Automatically close resolved tickets after X days', 'maintenance'),
  ('notification_assignment_enabled', '{"enabled": true, "roles": ["maintenance", "admin"]}', 'Send notifications when tickets are assigned', 'notification'),
  ('general_maintenance_mode', '{"enabled": false, "message": "Süsteem on hoolduses"}', 'Enable maintenance mode', 'general')
ON CONFLICT (key) DO NOTHING;

-- ================================================
-- 3. EMAIL_TEMPLATES TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}', -- Available template variables like {{ticket_number}}
  category TEXT NOT NULL CHECK (category IN ('ticket', 'user', 'reminder')),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Admin can view all templates
CREATE POLICY "Admin can view email templates"
ON public.email_templates FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can update templates
CREATE POLICY "Admin can update email templates"
ON public.email_templates FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can insert templates
CREATE POLICY "Admin can insert email templates"
ON public.email_templates FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can delete templates
CREATE POLICY "Admin can delete email templates"
ON public.email_templates FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default email templates
INSERT INTO public.email_templates (name, subject, body, variables, category) VALUES
  (
    'ticket_created',
    'Uus tiket: {{ticket_number}}',
    E'Tere {{user_name}},\n\nSinu tiket on edukalt loodud.\n\nTiketi number: {{ticket_number}}\nKategooria: {{category}}\nAsukoht: {{location}}\n\nTäname!',
    ARRAY['ticket_number', 'user_name', 'category', 'location'],
    'ticket'
  ),
  (
    'ticket_assigned',
    'Tiket määratud: {{ticket_number}}',
    E'Tere {{assigned_to_name}},\n\nSulle on määratud uus tiket.\n\nTiketi number: {{ticket_number}}\nKategooria: {{category}}\nAsukoht: {{location}}\nKirjeldus: {{description}}\n\nPalun vaata üle ja võta töösse.',
    ARRAY['ticket_number', 'assigned_to_name', 'category', 'location', 'description'],
    'ticket'
  ),
  (
    'ticket_resolved',
    'Tiket lahendatud: {{ticket_number}}',
    E'Tere {{user_name}},\n\nSinu tiket on lahendatud.\n\nTiketi number: {{ticket_number}}\nLahendaja: {{resolver_name}}\nLahendatud: {{resolved_at}}\n\nTäname!',
    ARRAY['ticket_number', 'user_name', 'resolver_name', 'resolved_at'],
    'ticket'
  ),
  (
    'user_approved',
    'Kasutaja konto kinnitatud',
    E'Tere {{user_name}},\n\nSinu konto on kinnitatud ja saad nüüd süsteemi sisse logida.\n\nRollid: {{roles}}\n\nTere tulemast!',
    ARRAY['user_name', 'roles'],
    'user'
  ),
  (
    'reminder_open_tickets',
    'Meeldetuletus: {{count}} avatud tiketit',
    E'Tere {{user_name}},\n\nSul on {{count}} avatud tiketit:\n\n{{ticket_list}}\n\nPalun vaata üle ja võta töösse.',
    ARRAY['user_name', 'count', 'ticket_list'],
    'reminder'
  )
ON CONFLICT (name) DO NOTHING;

-- ================================================
-- 4. TICKET_STATISTICS_DAILY TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS public.ticket_statistics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_tickets INTEGER NOT NULL DEFAULT 0,
  submitted_count INTEGER NOT NULL DEFAULT 0,
  in_progress_count INTEGER NOT NULL DEFAULT 0,
  resolved_count INTEGER NOT NULL DEFAULT 0,
  verified_count INTEGER NOT NULL DEFAULT 0,
  closed_count INTEGER NOT NULL DEFAULT 0,
  safety_tickets_count INTEGER NOT NULL DEFAULT 0,
  created_today INTEGER NOT NULL DEFAULT 0,
  resolved_today INTEGER NOT NULL DEFAULT 0,
  avg_resolution_time_hours NUMERIC,
  by_category JSONB DEFAULT '{}',
  by_school JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_statistics_date ON public.ticket_statistics_daily(date DESC);

-- Enable RLS
ALTER TABLE public.ticket_statistics_daily ENABLE ROW LEVEL SECURITY;

-- Admin and leadership can view statistics
CREATE POLICY "Admin and leadership can view statistics"
ON public.ticket_statistics_daily FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'leadership')
);

-- Only admin can insert/update/delete statistics
CREATE POLICY "Admin can manage statistics"
ON public.ticket_statistics_daily FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- ================================================
-- 5. UPDATE EXISTING AUDIT_LOG RLS POLICIES
-- ================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admin can view all audit logs" ON public.audit_log;

-- Recreate with broader access
CREATE POLICY "Admin and leadership can view audit logs"
ON public.audit_log FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'leadership')
);

-- ================================================
-- 6. HELPER FUNCTIONS
-- ================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to system_settings
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger to email_templates
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================
-- COMMENTS FOR DOCUMENTATION
-- ================================================

COMMENT ON TABLE public.system_settings IS 'System-wide configuration settings managed by administrators';
COMMENT ON TABLE public.email_templates IS 'Email notification templates with variable support';
COMMENT ON TABLE public.ticket_statistics_daily IS 'Daily aggregated ticket statistics for reporting';
COMMENT ON COLUMN public.audit_log.entity_type IS 'Type of entity being tracked (ticket, user, school, setting)';
COMMENT ON COLUMN public.audit_log.entity_id IS 'UUID of the entity being tracked';
