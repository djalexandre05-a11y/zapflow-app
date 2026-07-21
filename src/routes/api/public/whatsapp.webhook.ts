import { createFileRoute } from "@tanstack/react-router";

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
              if (!value?.messages?.length) continue;
              const phoneNumberId: string = value?.metadata?.phone_number_id;
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
                else text = `[${m.type}]`;
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
