import { createServerFn } from "@tanstack/react-start";

type FetchInput = { phoneNumberId: string; sinceIso?: string };

export const fetchIncomingMessages = createServerFn({ method: "POST" })
  .inputValidator((d: FetchInput) => {
    if (!d.phoneNumberId) throw new Error("phoneNumberId obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("wa_incoming")
      .select("id, from_number, from_name, message_text, wa_message_id, received_at")
      .eq("phone_number_id", data.phoneNumberId)
      .order("received_at", { ascending: true })
      .limit(500);
    if (data.sinceIso) q = q.gt("received_at", data.sinceIso);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { messages: rows ?? [] };
  });

export const getWebhookInfo = createServerFn({ method: "GET" }).handler(async () => {
  return {
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || "",
  };
});
