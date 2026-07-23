CREATE TABLE IF NOT EXISTS public.user_sessions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Allow users to read and update their own session
CREATE POLICY "Users can manage their own session" 
ON public.user_sessions 
FOR ALL 
USING (auth.uid() = user_id);

-- Expose to authenticated users
GRANT ALL ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;
