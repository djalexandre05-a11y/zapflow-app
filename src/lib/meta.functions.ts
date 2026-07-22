import { createServerFn } from "@tanstack/react-start";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function metaFetch(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    const msg = typeof body === "string" ? body : body?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Meta: ${msg}`);
  }
  return body;
}

type SendInput = { accessToken: string; phoneNumberId: string; to: string; message: string };
type SendTplInput = {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  language: string;
  bodyParams?: string[];
};
type ListTplInput = { accessToken: string; wabaId: string };
type CreateTplInput = {
  accessToken: string;
  wabaId: string;
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  components: any[];
};
type DeleteTplInput = { accessToken: string; wabaId: string; name: string };
type BroadcastInput = {
  accessToken: string;
  phoneNumberId: string;
  numbers: string[];
  templateName?: string;
  language?: string;
  message?: string;
  intervalSeconds?: number;
};

export const metaSendText = createServerFn({ method: "POST" })
  .inputValidator((d: SendInput) => {
    if (!d.accessToken || !d.phoneNumberId) throw new Error("Credenciais Meta ausentes");
    if (!d.to) throw new Error("Número destino obrigatório");
    if (!d.message?.trim()) throw new Error("Mensagem vazia");
    return d;
  })
  .handler(async ({ data }) => {
    const to = data.to.replace(/\D/g, "");
    return metaFetch(data.accessToken, `/${data.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: data.message },
      }),
    });
  });

export const metaSendTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: SendTplInput) => {
    if (!d.accessToken || !d.phoneNumberId) throw new Error("Credenciais Meta ausentes");
    if (!d.to) throw new Error("Número destino obrigatório");
    if (!d.templateName) throw new Error("Template obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const to = data.to.replace(/\D/g, "");
    const template: any = {
      name: data.templateName,
      language: { code: data.language || "pt_BR" },
    };
    if (data.bodyParams?.length) {
      template.components = [{
        type: "body",
        parameters: data.bodyParams.map((t) => ({ type: "text", text: t })),
      }];
    }
    return metaFetch(data.accessToken, `/${data.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template }),
    });
  });

export const metaSendMedia = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: any }) => {
    // TanStack Start unwraps FormData automatically in some versions, but let's check
    const isForm = data instanceof FormData;
    const accessToken = isForm ? data.get("accessToken") as string : data.accessToken;
    const phoneNumberId = isForm ? data.get("phoneNumberId") as string : data.phoneNumberId;
    const to = isForm ? data.get("to") as string : data.to;
    const file = (isForm ? data.get("file") : data.file) as File;

    if (!accessToken || !phoneNumberId || !to || !file) throw new Error("Dados incompletos ou arquivo ausente");

    const dest = to.replace(/\D/g, "");

    // 1. Upload media to Meta
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("messaging_product", "whatsapp");

    const uploadRes = await fetch(`${GRAPH}/${phoneNumberId}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData as any,
    });
    
    const uploadBody = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(`Meta Media Upload: ${uploadBody.error?.message || "Erro desconhecido"}`);
    }

    const mediaId = uploadBody.id;

    // 2. Send media message
    let type = "document";
    if (file.type.startsWith("image/")) type = "image";
    if (file.type.startsWith("video/")) type = "video";
    if (file.type.startsWith("audio/")) type = "audio";

    const payload: any = {
      messaging_product: "whatsapp",
      to: dest,
      type: type,
    };

    payload[type] = { id: mediaId };
    if (type === "document") payload[type].filename = file.name;

    const sendRes = await metaFetch(accessToken, `/${phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { ...sendRes, _mediaId: mediaId, _type: type };
  });

export const metaListTemplates = createServerFn({ method: "POST" })
  .inputValidator((d: ListTplInput) => {
    if (!d.accessToken || !d.wabaId) throw new Error("Credenciais Meta ausentes");
    return d;
  })
  .handler(async ({ data }) => {
    return metaFetch(
      data.accessToken,
      `/${data.wabaId}/message_templates?fields=name,language,status,category,components&limit=200`,
    );
  });

export const metaCreateTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: CreateTplInput) => {
    if (!d.accessToken || !d.wabaId) throw new Error("Credenciais Meta ausentes");
    if (!d.name?.trim()) throw new Error("Nome obrigatório");
    if (!d.components?.length) throw new Error("Corpo obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    return metaFetch(data.accessToken, `/${data.wabaId}/message_templates`, {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        category: data.category,
        language: data.language,
        components: data.components,
      }),
    });
  });

export const metaDeleteTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: DeleteTplInput) => {
    if (!d.accessToken || !d.wabaId || !d.name) throw new Error("Dados incompletos");
    return d;
  })
  .handler(async ({ data }) => {
    return metaFetch(
      data.accessToken,
      `/${data.wabaId}/message_templates?name=${encodeURIComponent(data.name)}`,
      { method: "DELETE" },
    );
  });

export const metaBroadcast = createServerFn({ method: "POST" })
  .inputValidator((d: BroadcastInput) => {
    if (!d.accessToken || !d.phoneNumberId) throw new Error("Credenciais Meta ausentes");
    if (!d.numbers?.length) throw new Error("Lista de destinatários vazia");
    if (!d.templateName && !d.message) throw new Error("Informe um template ou mensagem");
    return d;
  })
  .handler(async ({ data }) => {
    const interval = Math.max(0, data.intervalSeconds ?? 0);
    const results: Array<{ to: string; ok: boolean; error?: string }> = [];
    for (let i = 0; i < data.numbers.length; i++) {
      const to = data.numbers[i].replace(/\D/g, "");
      if (!to) continue;
      try {
        if (data.templateName) {
          await metaFetch(data.accessToken, `/${data.phoneNumberId}/messages`, {
            method: "POST",
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to,
              type: "template",
              template: { name: data.templateName, language: { code: data.language || "pt_BR" } },
            }),
          });
        } else {
          await metaFetch(data.accessToken, `/${data.phoneNumberId}/messages`, {
            method: "POST",
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to,
              type: "text",
              text: { body: data.message },
            }),
          });
        }
        results.push({ to, ok: true });
      } catch (e: any) {
        results.push({ to, ok: false, error: e?.message || String(e) });
      }
      if (interval > 0 && i < data.numbers.length - 1) {
        await new Promise((r) => setTimeout(r, interval * 1000));
      }
    }
    return { results, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
  });
