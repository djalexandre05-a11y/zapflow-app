CREATE TABLE public.wa_incoming (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id text NOT NULL,
  from_number text NOT NULL,
  from_name text,
  message_text text,
  wa_message_id text UNIQUE,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wa_incoming_phone_received_idx ON public.wa_incoming (phone_number_id, received_at DESC);
GRANT ALL ON public.wa_incoming TO service_role;
ALTER TABLE public.wa_incoming ENABLE ROW LEVEL SECURITY;