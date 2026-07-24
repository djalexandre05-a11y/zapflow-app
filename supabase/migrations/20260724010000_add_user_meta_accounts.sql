-- Add user_meta_accounts table
CREATE TABLE IF NOT EXISTS public.user_meta_accounts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    phone_number_id text NOT NULL,
    waba_id text NOT NULL,
    access_token text NOT NULL,
    active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, phone_number_id)
);

-- RLS policies
ALTER TABLE public.user_meta_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own accounts" ON public.user_meta_accounts FOR ALL USING (auth.uid() = user_id);
