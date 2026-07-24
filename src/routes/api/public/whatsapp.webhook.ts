import { createFileRoute } from "@tanstack/react-router";
import { dispatchInboundToFlows } from "@/lib/flows/engine";

// Handles Meta WhatsApp Cloud API webhook: GET verify + POST message delivery.
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
        if (mode === "subscribe" && expected && token === expected) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        try {
          const body: any = await request.json();
          const rows: Array<{
            phone_number_id: string;
            from_number: string;
            from_name: string | null;
            message_text: string | null;
            wa_message_id: string;
          }> = [];
          const entries = body?.entry ?? [];
          for (const entry of entries) {
            for (const change of entry?.changes ?? []) {
              const value = change?.value;
              const phoneNumberId: string = value?.metadata?.phone_number_id;
              
              // Process statuses (errors)
              if (value?.statuses?.length) {
                for (const st of value.statuses) {
                  if (st.status === "failed" && st.errors?.length) {
                    const err = st.errors[0];
                    rows.push({
                      phone_number_id: phoneNumberId,
                      from_number: st.recipient_id,
                      from_name: "Sistema (Erro Meta)",
                      message_text: `[ERRO DE ENTREGA] A Meta bloqueou o envio (Código ${err.code}): ${err.title || err.message}`,
                      wa_message_id: st.id + "-err",
                    });
                  }
                }
              }

              if (!value?.messages?.length) continue;
              const contacts: any[] = value?.contacts ?? [];
              const nameByWaId = new Map<string, string>();
              for (const c of contacts) {
                if (c?.wa_id) nameByWaId.set(c.wa_id, c?.profile?.name ?? "");
              }
              for (const m of value.messages) {
                let text: string | null = null;
                if (m.type === "text") text = m.text?.body ?? null;
                else if (m.type === "button") text = m.button?.text ?? null;
                else if (m.type === "interactive")
                  text = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null;
                else if (["image", "video", "audio", "document"].includes(m.type)) {
                  const mediaId = m[m.type]?.id;
                  const caption = m[m.type]?.caption || m[m.type]?.filename || "";
                  text = `[${m.type}]${mediaId ? `|${mediaId}` : ""}${caption ? `|${caption}` : ""}`;
                } else text = `[${m.type}]`;
                rows.push({
                  phone_number_id: phoneNumberId,
                  from_number: m.from,
                  from_name: nameByWaId.get(m.from) || null,
                  message_text: text,
                  wa_message_id: m.id,
                });
              }
            }
          }
          if (rows.length) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin.from("wa_incoming").upsert(rows, { onConflict: "wa_message_id", ignoreDuplicates: true });
            
            // Call Flow Engine
            for (const row of rows) {
              if (row.message_text && !row.message_text.startsWith("[ERRO")) {
                // Fetch the client's specific Meta token and user_id from the DB
                const { data: acc } = await (supabaseAdmin as any)
                  .from("user_meta_accounts")
                  .select("access_token, user_id")
                  .eq("phone_number_id", row.phone_number_id)
                  .eq("active", true)
                  .maybeSingle();

                // Fallback to env token if no account is found (for legacy support during migration)
                const metaToken = acc?.access_token || process.env.META_ACCESS_TOKEN || "";
                // If we don't have a specific user_id, flows won't work well, but we pass an empty string or something
                const userId = acc?.user_id || "";

                if (metaToken && userId) {
                  await dispatchInboundToFlows(row.from_number, row.message_text, metaToken, row.phone_number_id, userId);
                } else if (metaToken) {
                  // Legacy fallback: pass "" as userId, it will probably not match any flow, but it won't crash
                  await dispatchInboundToFlows(row.from_number, row.message_text, metaToken, row.phone_number_id, "");
                }
              }
            }
          }
          return new Response("ok", { status: 200 });
        } catch (e) {
          console.error("webhook error", e);
          // Always 200 so Meta doesn't retry-loop
          return new Response("ok", { status: 200 });
        }
      },
    },
  },
});
