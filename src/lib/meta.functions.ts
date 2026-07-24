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
  templateBody?: string;
  components?: any[];
};
type ListTplInput = { accessToken: string; wabaId: string; phoneNumberId?: string };
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
  components?: any[];
  message?: string;
  mediaId?: string;
  mediaType?: "image" | "audio" | "video" | "document";
  intervalSeconds?: number;
  templateBody?: string;
};

export async function logOutgoing(phone_number_id: string, from_number: string, message_text: string, res: any) {
  try {
    const wa_message_id = res?.messages?.[0]?.id || `local-${Date.now()}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("wa_incoming").insert({
      phone_number_id,
      from_number,
      from_name: "Bot",
      message_text,
      wa_message_id: `OUT_${wa_message_id}`,
    });
  } catch (e) {
    console.error("Failed to log outgoing msg:", e);
  }
}

export const metaSendText = createServerFn({ method: "POST" })
  .inputValidator((d: SendInput) => {
    if (!d.accessToken || !d.phoneNumberId) throw new Error("Credenciais Meta ausentes");
    if (!d.to) throw new Error("Número destino obrigatório");
    if (!d.message?.trim()) throw new Error("Mensagem vazia");
    return d;
  })
  .handler(async ({ data }) => {
    const to = data.to.replace(/\D/g, "");
    const res = await metaFetch(data.accessToken, `/${data.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: data.message },
      }),
    });
    await logOutgoing(data.phoneNumberId, to, data.message, res);
    return res;
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
    if (data.components?.length) {
      template.components = data.components;
    } else if (data.bodyParams?.length) {
      template.components = [{
        type: "body",
        parameters: data.bodyParams.map((t) => ({ type: "text", text: t })),
      }];
    }
    const res = await metaFetch(data.accessToken, `/${data.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template }),
    });
    
    // Check if components has a media header
    let tplMediaId = "";
    let tplMediaType = "";
    const header = data.components?.find((c: any) => c.type === "header");
    if (header && header.parameters?.[0]) {
      const p = header.parameters[0];
      if (p.type === "image" && (p.image?.id || p.image?.link)) { tplMediaId = p.image.id || p.image.link; tplMediaType = "image"; }
      else if (p.type === "video" && (p.video?.id || p.video?.link)) { tplMediaId = p.video.id || p.video.link; tplMediaType = "video"; }
      else if (p.type === "document" && (p.document?.id || p.document?.link)) { tplMediaId = p.document.id || p.document.link; tplMediaType = "document"; }
    }

    let logText = data.templateBody || `[Template] ${data.templateName}`;
    if (tplMediaId) {
      logText = `[${tplMediaType}]|${tplMediaId}|${logText}`;
    }

    await logOutgoing(data.phoneNumberId, to, logText, res);
    return res;
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
    await logOutgoing(phoneNumberId, dest, `[Media] ${type}`, sendRes);
    return { ...sendRes, _mediaId: mediaId, _type: type };
  });

export const metaSendMediaById = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; phoneNumberId: string; to: string; mediaId: string; type: string; filename?: string }) => {
    if (!d.accessToken || !d.phoneNumberId || !d.to || !d.mediaId || !d.type) throw new Error("Dados incompletos");
    return d;
  })
  .handler(async ({ data }) => {
    const dest = data.to.replace(/\D/g, "");

    const payload: any = {
      messaging_product: "whatsapp",
      to: dest,
      type: data.type,
    };

    payload[data.type] = { id: data.mediaId };
    if (data.type === "document" && data.filename) payload[data.type].filename = data.filename;

    const sendRes = await metaFetch(data.accessToken, `/${data.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await logOutgoing(data.phoneNumberId, dest, `[Media] ${data.type}`, sendRes);
    return { ...sendRes, _mediaId: data.mediaId, _type: data.type };
  });

export const metaListTemplates = createServerFn({ method: "POST" })
  .inputValidator((d: ListTplInput) => {
    if (!d.accessToken || !d.wabaId) throw new Error("Credenciais Meta ausentes");
    return d;
  })
  .handler(async ({ data }) => {
    const res = await metaFetch(
      data.accessToken,
      `/${data.wabaId}/message_templates?fields=name,language,status,category,components&limit=200`,
    );
    
    if (res.data && data.phoneNumberId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: defaults } = await (supabaseAdmin as any)
        .from("template_media_defaults")
        .select("template_name, media_url, media_type")
        .eq("phone_number_id", data.phoneNumberId);
        
      if (defaults && defaults.length > 0) {
        const defMap = new Map(defaults.map((d: any) => [d.template_name, d]));
        res.data = res.data.map((tpl: any) => {
          const d = defMap.get(tpl.name);
          if (d) {
            return { ...tpl, defaultMediaUrl: (d as any).media_url, defaultMediaType: (d as any).media_type };
          }
          return tpl;
        });
      }
    }
    
    return res;
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

export const metaUploadMedia = createServerFn({ method: "POST" })
  .inputValidator((d: any) => d)
  .handler(async ({ data }: { data: any }) => {
    const isForm = data instanceof FormData;
    const accessToken = isForm ? data.get("accessToken") as string : data.accessToken;
    const phoneNumberId = isForm ? data.get("phoneNumberId") as string : data.phoneNumberId;
    const file = (isForm ? data.get("file") : data.file) as File;

    if (!accessToken || !phoneNumberId || !file) throw new Error("Dados incompletos para upload");

    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("messaging_product", "whatsapp");

    const uploadRes = await fetch(`${GRAPH}/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData as any,
    });
    
    const uploadBody = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(`Meta Media Upload: ${uploadBody.error?.message || "Erro desconhecido"}`);
    
    return { mediaId: uploadBody.id };
  });

export const saveTemplateDefaultMedia = createServerFn({ method: "POST" })
  .inputValidator((d: any) => d)
  .handler(async ({ data }: { data: any }) => {
    const isForm = data instanceof FormData;
    const phoneNumberId = isForm ? data.get("phoneNumberId") as string : data.phoneNumberId;
    const templateName = isForm ? data.get("templateName") as string : data.templateName;
    const file = (isForm ? data.get("file") : data.file) as File;

    if (!phoneNumberId || !templateName || !file) throw new Error("Dados incompletos para salvar mídia padrão");

    let type = "document";
    if (file.type.startsWith("image/")) type = "image";
    if (file.type.startsWith("video/")) type = "video";
    if (file.type.startsWith("audio/")) type = "audio";

    // Upload file to Supabase Storage
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Generate unique filename
    const ext = file.name.split('.').pop();
    const filename = `${phoneNumberId}/${templateName}_${Date.now()}.${ext}`;
    
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from("zapflow_media")
      .upload(filename, file, { contentType: file.type, upsert: true });
      
    if (uploadError) throw new Error(`Erro ao fazer upload da mídia: ${uploadError.message}`);
    
    const { data: publicUrlData } = supabaseAdmin
      .storage
      .from("zapflow_media")
      .getPublicUrl(filename);
      
    const mediaUrl = publicUrlData.publicUrl;

    // Save to database
    const { error: dbError } = await (supabaseAdmin as any)
      .from("template_media_defaults")
      .upsert({
        phone_number_id: phoneNumberId,
        template_name: templateName,
        media_url: mediaUrl,
        media_type: type
      }, { onConflict: "phone_number_id, template_name" });
      
    if (dbError) throw new Error(`Erro ao salvar no banco: ${dbError.message}`);
    
    return { success: true, mediaUrl, type };
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
    if (!d.templateName && !d.message && !d.mediaId) throw new Error("Informe um template, mensagem ou mídia");
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
          const res = await metaFetch(data.accessToken, `/${data.phoneNumberId}/messages`, {
            method: "POST",
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to,
              type: "template",
              template: { 
                name: data.templateName, 
                language: { code: data.language || "pt_BR" },
                ...(data.components?.length ? { components: data.components } : {})
              },
            }),
          });
          
          let tplMediaId: string | undefined;
          let tplMediaType: string | undefined;
          const header = data.components?.find((c: any) => c.type === "header");
          if (header?.parameters?.[0]) {
            const p = header.parameters[0];
            if (p.type === "image" && (p.image?.id || p.image?.link)) { tplMediaId = p.image.id || p.image.link; tplMediaType = "image"; }
            else if (p.type === "video" && (p.video?.id || p.video?.link)) { tplMediaId = p.video.id || p.video.link; tplMediaType = "video"; }
            else if (p.type === "document" && (p.document?.id || p.document?.link)) { tplMediaId = p.document.id || p.document.link; tplMediaType = "document"; }
          }
          let logText = data.templateBody || `[Template] ${data.templateName}`;
          if (tplMediaId) {
            logText = `[${tplMediaType}]|${tplMediaId}|${logText}`;
          }
          
          await logOutgoing(data.phoneNumberId, to, logText, res);
        } else if (data.mediaId && data.mediaType) {
          const res = await metaFetch(data.accessToken, `/${data.phoneNumberId}/messages`, {
            method: "POST",
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to,
              type: data.mediaType,
              [data.mediaType]: { id: data.mediaId, caption: data.message || "" },
            }),
          });
          await logOutgoing(data.phoneNumberId, to, `[${data.mediaType}]|${data.mediaId}|${data.message || ""}`, res);
        } else {
          const res = await metaFetch(data.accessToken, `/${data.phoneNumberId}/messages`, {
            method: "POST",
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to,
              type: "text",
              text: { body: data.message },
            }),
          });
          await logOutgoing(data.phoneNumberId, to, data.message || "", res);
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

export const metaUpdateProfilePicture = createServerFn({ method: "POST" })
  .validator((d: FormData) => d)
  .handler(async ({ data }) => {
    const accessToken = data.get("accessToken") as string;
    const phoneNumberId = data.get("phoneNumberId") as string;
    const file = data.get("file") as File;
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileSize = fileBuffer.length;
    const fileType = file.type || "image/jpeg";
    const fileName = file.name || "profile.jpg";

    // 1. Descobrir o App ID a partir do token (necessário para Resumable Upload API)
    const appRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const appBody = await appRes.json();
    // Para tokens de sistema/WABA, retorna o app associado via campo 'id'
    // Fallback: tenta extrair do token debug
    let appId: string = appBody?.id;
    if (!appId) throw new Error("Não foi possível obter o App ID do token.");

    // 2. Criar sessão de upload (Resumable Upload API)
    const sessionRes = await fetch(
      `https://graph.facebook.com/v21.0/${appId}/uploads?file_name=${encodeURIComponent(fileName)}&file_length=${fileSize}&file_type=${encodeURIComponent(fileType)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const sessionBody = await sessionRes.json();
    if (!sessionRes.ok) throw new Error(`Sessão de upload falhou: ${sessionBody.error?.message || "Erro desconhecido"}`);
    const uploadSessionId = sessionBody.id;

    // 3. Fazer upload dos bytes do arquivo
    const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${uploadSessionId}`, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${accessToken}`,
        "file_offset": "0",
        "Content-Type": fileType,
      },
      body: fileBuffer,
    });
    const uploadBody = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(`Upload falhou: ${uploadBody.error?.message || "Erro desconhecido"}`);
    const handle = uploadBody.h; // handle no formato "2:abc..."

    // 4. Atualizar foto de perfil do número com o handle
    const profileRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/whatsapp_business_profile`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        profile_picture_handle: handle,
      }),
    });
    const profileBody = await profileRes.json();
    if (!profileRes.ok) throw new Error(`Erro ao atualizar perfil: ${profileBody.error?.message || "Erro desconhecido"}`);
    return { success: true };
  });
