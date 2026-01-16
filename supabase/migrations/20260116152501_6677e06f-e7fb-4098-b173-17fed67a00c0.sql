-- Create push_tokens table for storing device push tokens
CREATE TABLE public.push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY "Users can view own tokens" ON public.push_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" ON public.push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON public.push_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens" ON public.push_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();