-- Create zapflow_media bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('zapflow_media', 'zapflow_media', true) 
ON CONFLICT (id) DO NOTHING;

-- Create template_media_defaults table
CREATE TABLE IF NOT EXISTS public.template_media_defaults (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number_id text NOT NULL,
    template_name text NOT NULL,
    media_url text NOT NULL,
    media_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(phone_number_id, template_name)
);

-- RLS policies
ALTER TABLE public.template_media_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to template_media_defaults" 
ON public.template_media_defaults 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access to template_media_defaults" 
ON public.template_media_defaults 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access to template_media_defaults" 
ON public.template_media_defaults 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access to template_media_defaults" 
ON public.template_media_defaults 
FOR DELETE 
USING (true);

-- Storage policies for zapflow_media bucket
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'zapflow_media' );

CREATE POLICY "Public Insert" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'zapflow_media' );

CREATE POLICY "Public Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'zapflow_media' );

CREATE POLICY "Public Delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'zapflow_media' );
