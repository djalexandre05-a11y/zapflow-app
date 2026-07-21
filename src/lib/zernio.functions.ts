import { createServerFn } from "@tanstack/react-start";

const BASE = "https://zernio.com/api/v1";

function assertKey(k?: string) {
  if (!k) throw new Error("Adicione uma API Key em Configuração");
  return k;
}

async function zfetch(apiKey: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${assertKey(apiKey)}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    const msg = typeof body === "string" ? body : body?.error || body?.message || `HTTP ${res.status}`;
    throw new Error(`Zernio [${res.status}]: ${msg}`);
  }
  return body;
}

type WithKey<T> = T & { apiKey: string };

export const listProfiles = createServerFn({ method: "POST" })
  .inputValidator((d: { apiKey: string }) => { assertKey(d.apiKey); return d; })
  .handler(async ({ data }) => zfetch(data.apiKey, "/profiles?includeOverLimit=true"));

export const listAccounts = createServerFn({ method: "POST" })
  .inputValidator((d: { apiKey: string }) => { assertKey(d.apiKey); return d; })
  .handler(async ({ data }) => zfetch(data.apiKey, "/accounts?includeOverLimit=true"));

type CreatePostInput = WithKey<{
  profileId: string;
  accountIds: string[];
  content: string;
  publishNow?: boolean;
  scheduledAt?: string;
}>;

export const createPost = createServerFn({ method: "POST" })
  .inputValidator((d: CreatePostInput) => {
    assertKey(d.apiKey);
    if (!d.profileId) throw new Error("profileId obrigatório");
    if (!d.accountIds?.length) throw new Error("Selecione ao menos 1 conta");
    if (!d.content?.trim()) throw new Error("Conteúdo obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const body: Record<string, unknown> = {
      profileId: data.profileId,
      accountIds: data.accountIds,
      content: data.content,
      publishNow: !!data.publishNow,
    };
    if (!data.publishNow && data.scheduledAt) body.scheduledAt = data.scheduledAt;
    return zfetch(data.apiKey, "/posts", { method: "POST", body: JSON.stringify(body) });
  });

type WhatsAppInput = WithKey<{
  profileId: string;
  accountId: string;
  name: string;
  message?: string;
  to?: string[];
  templateName?: string;
  templateLanguage?: string;
  intervalSeconds?: number;
  scheduledAt?: string;
}>;

export const sendWhatsAppBroadcast = createServerFn({ method: "POST" })
  .inputValidator((d: WhatsAppInput) => {
    assertKey(d.apiKey);
    if (!d.profileId || !d.accountId) throw new Error("Perfil e conta WhatsApp obrigatórios");
    if (!d.name?.trim()) throw new Error("Nome do broadcast obrigatório");
    if (!d.message?.trim() && !d.templateName) throw new Error("Informe uma mensagem ou template");
    return d;
  })
  .handler(async ({ data }) => {
    const body: Record<string, unknown> = {
      profileId: data.profileId,
      accountId: data.accountId,
      platform: "whatsapp",
      name: data.name,
    };
    if (data.templateName) {
      body.message = {
        template: { name: data.templateName, language: data.templateLanguage || "pt_BR" },
      };
    } else {
      body.message = { text: data.message };
    }
    if (data.to?.length) body.to = data.to;
    if (data.intervalSeconds) body.intervalSeconds = data.intervalSeconds;
    if (data.scheduledAt) body.scheduledAt = data.scheduledAt;
    return zfetch(data.apiKey, "/broadcasts", { method: "POST", body: JSON.stringify(body) });
  });

// ============ Inbox / DMs ============
export const listConversations = createServerFn({ method: "POST" })
  .inputValidator((d: WithKey<{
    profileId?: string;
    accountId?: string;
    platform?: string;
    status?: "active" | "archived";
    sortOrder?: "asc" | "desc";
    limit?: number;
    cursor?: string;
  }>) => { assertKey(d.apiKey); return d; })
  .handler(async ({ data }): Promise<any> => {
    const all: any[] = [];
    let cursor: string | undefined = data.cursor;
    let lastPagination: any = null;
    for (let i = 0; i < 20; i++) {
      const q = new URLSearchParams();
      if (data.profileId) q.set("profileId", data.profileId);
      if (data.accountId) q.set("accountId", data.accountId);
      if (data.platform) q.set("platform", data.platform);
      if (data.status) q.set("status", data.status);
      if (data.sortOrder) q.set("sortOrder", data.sortOrder);
      q.set("limit", String(data.limit ?? 100));
      if (cursor) q.set("cursor", cursor);
      const page: any = await zfetch(data.apiKey, `/inbox/conversations?${q.toString()}`);
      if (Array.isArray(page?.data)) all.push(...page.data);
      lastPagination = page?.pagination ?? null;
      const next = page?.pagination?.nextCursor;
      if (!next) break;
      cursor = next;
    }
    return { data: all, pagination: lastPagination };
  });

export const listConversationMessages = createServerFn({ method: "POST" })
  .inputValidator((d: WithKey<{ conversationId: string; accountId: string; cursor?: string }>) => {
    assertKey(d.apiKey);
    if (!d.conversationId) throw new Error("conversationId obrigatório");
    if (!d.accountId) throw new Error("accountId obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const q = new URLSearchParams({ accountId: data.accountId, sortOrder: "asc", limit: "100" });
    if (data.cursor) q.set("cursor", data.cursor);
    return zfetch(data.apiKey, `/inbox/conversations/${encodeURIComponent(data.conversationId)}/messages?${q.toString()}`);
  });

export const sendConversationMessage = createServerFn({ method: "POST" })
  .inputValidator((d: WithKey<{ conversationId: string; accountId: string; message: string }>) => {
    assertKey(d.apiKey);
    if (!d.conversationId) throw new Error("conversationId obrigatório");
    if (!d.accountId) throw new Error("accountId obrigatório");
    if (!d.message?.trim()) throw new Error("Mensagem vazia");
    return d;
  })
  .handler(async ({ data }) => {
    return zfetch(data.apiKey, `/inbox/conversations/${encodeURIComponent(data.conversationId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ accountId: data.accountId, message: data.message }),
    });
  });

export const sendConversationTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: WithKey<{
    conversationId: string;
    accountId: string;
    templateName: string;
    language: string;
    components?: any[];
  }>) => {
    assertKey(d.apiKey);
    if (!d.conversationId) throw new Error("conversationId obrigatório");
    if (!d.accountId) throw new Error("accountId obrigatório");
    if (!d.templateName) throw new Error("Template obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    return zfetch(data.apiKey, `/inbox/conversations/${encodeURIComponent(data.conversationId)}/messages`, {
      method: "POST",
      body: JSON.stringify({
        accountId: data.accountId,
        template: {
          name: data.templateName,
          language: data.language,
          ...(data.components?.length ? { components: data.components } : {}),
        },
      }),
    });
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .inputValidator((d: WithKey<{ conversationId: string; accountId: string }>) => {
    assertKey(d.apiKey);
    if (!d.conversationId) throw new Error("conversationId obrigatório");
    if (!d.accountId) throw new Error("accountId obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    return zfetch(data.apiKey, `/inbox/conversations/${encodeURIComponent(data.conversationId)}/read`, {
      method: "POST",
      body: JSON.stringify({ accountId: data.accountId }),
    });
  });

// ============ WhatsApp Templates ============
export const listWhatsAppTemplates = createServerFn({ method: "POST" })
  .inputValidator((d: WithKey<{ accountId: string }>) => {
    assertKey(d.apiKey);
    if (!d.accountId) throw new Error("accountId obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    return zfetch(data.apiKey, `/whatsapp/templates?accountId=${encodeURIComponent(data.accountId)}`);
  });

type TplComponent = { type: string; format?: string; text?: string; example?: any; buttons?: any[] };
export const createWhatsAppTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: WithKey<{
    accountId: string;
    name: string;
    category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
    language: string;
    components: TplComponent[];
  }>) => {
    assertKey(d.apiKey);
    if (!d.accountId) throw new Error("accountId obrigatório");
    if (!/^[a-z][a-z0-9_]*$/.test(d.name)) throw new Error("Nome deve estar em snake_case (ex: boas_vindas)");
    if (!d.components?.length) throw new Error("Adicione ao menos um componente (corpo)");
    return d;
  })
  .handler(async ({ data }) => {
    const { apiKey, ...body } = data;
    return zfetch(apiKey, `/whatsapp/templates`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  });

export const deleteWhatsAppTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: WithKey<{ accountId: string; templateId: string; name?: string }>) => {
    assertKey(d.apiKey);
    if (!d.accountId || !d.templateId) throw new Error("accountId e templateId obrigatórios");
    return d;
  })
  .handler(async ({ data }) => {
    const q = new URLSearchParams({ accountId: data.accountId });
    if (data.name) q.set("name", data.name);
    return zfetch(data.apiKey, `/whatsapp/templates/${encodeURIComponent(data.templateId)}?${q.toString()}`, {
      method: "DELETE",
    });
  });

export const uploadMediaDirect = createServerFn({ method: "POST" })
  .inputValidator((d: WithKey<{ fileBase64: string; filename: string; contentType: string }>) => {
    assertKey(d.apiKey);
    if (!d.fileBase64) throw new Error("Arquivo obrigatório");
    return d;
  })
  .handler(async ({ data }): Promise<{ url: string; filename: string; contentType: string; size: number }> => {
    const bin = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bin], { type: data.contentType });
    const form = new FormData();
    form.append("file", blob, data.filename);
    form.append("contentType", data.contentType);
    const res = await fetch(`${BASE}/messages/upload-media-direct`, {
      method: "POST",
      headers: { Authorization: `Bearer ${assertKey(data.apiKey)}` },
      body: form,
    });
    const text = await res.text();
    const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
    if (!res.ok) {
      const msg = typeof body === "string" ? body : (body as any)?.error || `HTTP ${res.status}`;
      throw new Error(`Zernio upload [${res.status}]: ${msg}`);
    }
    return body as any;
  });

// ============ Connect WhatsApp (OAuth + Credentials) ============
export const getWhatsAppConnectUrl = createServerFn({ method: "POST" })
  .inputValidator((d: WithKey<{ profileId: string; redirectUrl: string; headless?: boolean }>) => {
    assertKey(d.apiKey);
    if (!d.profileId) throw new Error("profileId obrigatório");
    if (!d.redirectUrl) throw new Error("redirectUrl obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const q = new URLSearchParams({ profileId: data.profileId, redirect_url: data.redirectUrl });
    if (data.headless) q.set("headless", "true");
    return zfetch(data.apiKey, `/connect/whatsapp?${q.toString()}`);
  });

export const connectWhatsAppCredentials = createServerFn({ method: "POST" })
  .inputValidator((d: {
    apiKey?: string;
    profileId?: string;
    accessToken: string;
    wabaId: string;
    phoneNumberId: string;
  }) => {
    if (!d.accessToken?.trim() || !d.wabaId?.trim() || !d.phoneNumberId?.trim()) {
      throw new Error("Preencha todos os campos");
    }
    return {
      ...d,
      apiKey: d.apiKey?.trim() || undefined,
      profileId: d.profileId?.trim() || undefined,
      accessToken: d.accessToken.trim(),
      wabaId: d.wabaId.trim(),
      phoneNumberId: d.phoneNumberId.trim(),
    };
  })
  .handler(async ({ data }) => {
    if (data.apiKey && data.profileId) {
      const { apiKey, ...body } = data;
      return zfetch(apiKey, `/connect/whatsapp/credentials`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    }

    const graphUrl = new URL(`https://graph.facebook.com/v23.0/${encodeURIComponent(data.wabaId)}/phone_numbers`);
    graphUrl.searchParams.set("fields", "id,display_phone_number,verified_name,quality_rating,code_verification_status");
    const response = await fetch(graphUrl, {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    const result = await response.json() as {
      data?: Array<{
        id?: string;
        display_phone_number?: string;
        verified_name?: string;
        quality_rating?: string;
        code_verification_status?: string;
      }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(result.error?.message || "A Meta recusou essas credenciais");
    }

    const phone = result.data?.find((item) => item.id === data.phoneNumberId);
    if (!phone) {
      throw new Error("O Phone Number ID não pertence ao WABA ID informado");
    }

    return {
      connected: true,
      message: `Número ${phone.display_phone_number || data.phoneNumberId} conectado`,
      account: {
        id: phone.id || data.phoneNumberId,
        name: phone.verified_name || "WhatsApp Business",
        phone: phone.display_phone_number || "",
        qualityRating: phone.quality_rating || "UNKNOWN",
        verificationStatus: phone.code_verification_status || "UNKNOWN",
      },
    };
  });
