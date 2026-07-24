import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Megaphone, Users, MessageSquareText, Settings2, Paperclip, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import { metaListTemplates, metaBroadcast, metaUploadMedia } from "@/lib/meta.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveAccount } from "@/lib/account";

export const Route = createFileRoute("/_app/broadcasts")({
  component: BroadcastsRoute,
});

function BroadcastsRoute() {
  const account = useActiveAccount();

  if (account?.provider !== "meta") {
    return (
      <div className="flex h-full flex-col bg-[#0b1416]">
        <div className="border-b border-white/5 bg-[#0f1b1e] px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/20 text-blue-400">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Meta Broadcasts</h1>
              <p className="text-sm text-slate-400">Envio em massa oficial via WhatsApp Cloud API</p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-8">
          <div className="mx-auto max-w-2xl rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-purple-500/10 p-8 text-center backdrop-blur-xl">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-blue-500/20 text-blue-400">
              <Megaphone className="h-8 w-8" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-slate-100">Conexão Meta Necessária</h2>
            <p className="text-slate-400">
              Esta tela é exclusiva para envios em massa oficiais utilizando a Cloud API da Meta.
              Conecte seu WABA na tela "Conectar WhatsApp" e selecione a conta no menu global para continuar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <BroadcastsMetaUI account={account} />;
}

type Contact = { id: string; name: string; phone: string; tags: string[] };
type Tpl = { name: string; language: string; status?: string };
const CONTACTS_KEY = "zapflow.contacts";
const normalize = (n: string) => n.replace(/\D/g, "");

function BroadcastsMetaUI({ account }: { account: any }) {
  const listTplFn = useServerFn(metaListTemplates);
  const broadcastFn = useServerFn(metaBroadcast);
  const uploadFn = useServerFn(metaUploadMedia);

  const [numbersText, setNumbersText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [includeFilteredTags, setIncludeFilteredTags] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateLang, setTemplateLang] = useState("pt_BR");
  const [fallback, setFallback] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [interval, setInterval] = useState(2);

  const [contacts, setContacts] = useState<Contact[]>([]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { setContacts(JSON.parse(localStorage.getItem(CONTACTS_KEY) || "[]")); } catch { /* noop */ }
  }, []);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    contacts.forEach((c) => c.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [contacts]);

  const tplQ = useQuery({
    queryKey: ["meta-broadcast-tpl", account.wabaId],
    queryFn: () => listTplFn({ data: { accessToken: account.accessToken!, wabaId: account.wabaId! } }),
    enabled: !!account.wabaId && !!account.accessToken,
    staleTime: 0,
  });
  const templates: Tpl[] = useMemo(() => {
    const raw: any = tplQ.data;
    const list: any[] = raw?.data ?? [];
    return list.filter((t) => String(t.status || "").toUpperCase() === "APPROVED")
      .map((t) => ({ name: t.name, language: t.language, status: t.status, components: t.components }));
  }, [tplQ.data]);

  const finalNumbers = useMemo(() => {
    const set = new Set<string>();
    numbersText.split(/[\s,;]+/).forEach((n) => { const d = normalize(n); if (d) set.add(d); });
    if (includeFilteredTags && selectedTags.length) {
      contacts.forEach((c) => {
        if (c.tags.some((t) => selectedTags.includes(t))) set.add(normalize(c.phone));
      });
    }
    return Array.from(set);
  }, [numbersText, includeFilteredTags, selectedTags, contacts]);

  const mut = useMutation({
    mutationFn: async () => {
      const selectedTpl = templates.find((x) => x.name === templateName);
      
      let mediaId: string | undefined;
      let mediaType: string | undefined;

      if (file) {
        let uploadFile = file;
        const ext = uploadFile.name.split('.').pop()?.toLowerCase() || '';
        const isImage = uploadFile.type.startsWith("image/") || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);

        if (isImage) {
          mediaType = "image";
          if (uploadFile.size > 4 * 1024 * 1024) {
            toast.info("Comprimindo imagem pesada antes do disparo...");
            try {
              const compressedBlob = await imageCompression(uploadFile, {
                maxSizeMB: 3.5,
                maxWidthOrHeight: 1920,
                useWebWorker: true
              });
              uploadFile = new File([compressedBlob], uploadFile.name, { type: compressedBlob.type });
            } catch (err) {
              console.error("Erro na compressão:", err);
            }
          }
        } else if (uploadFile.type.startsWith("video/") || ['mp4', 'webm', 'mov'].includes(ext)) {
          mediaType = "video";
        } else if (uploadFile.type.startsWith("audio/") || ['mp3', 'ogg', 'wav'].includes(ext)) {
          mediaType = "audio";
        } else {
          mediaType = "document";
        }

        const isSmallEnough = uploadFile.size < 4.2 * 1024 * 1024;

        if (!isSmallEnough) {
          // Arquivos grandes (vídeos): Upload direto pelo frontend para evitar limite 413 da Vercel
          const formData = new FormData();
          formData.append("messaging_product", "whatsapp");
          formData.append("file", uploadFile, uploadFile.name);

          const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${account.phoneNumberId}/media`, {
            method: "POST",
            headers: { Authorization: `Bearer ${account.accessToken}` },
            body: formData,
          });

          const uploadBody = await uploadRes.json();
          if (!uploadRes.ok) throw new Error(`Upload frontal falhou: ${uploadBody.error?.message || "Erro desconhecido"}`);
          mediaId = uploadBody.id;
        } else {
          // Arquivos pequenos (fotos e documentos): Upload pelo backend confiável
          const formData = new FormData();
          formData.append("accessToken", account.accessToken!);
          formData.append("phoneNumberId", account.phoneNumberId!);
          formData.append("file", uploadFile);
          
          const uploadRes = await uploadFn({ data: formData });
          mediaId = uploadRes.mediaId;
        }
      }

      let templateComponents: any[] | undefined = undefined;
      let templateBody: string | undefined = undefined;

      if (templateName) {
        templateBody = (selectedTpl as any)?.components?.find((c: any) => c.type === "BODY")?.text || `[Template] ${templateName}`;
        const headerComponent = (selectedTpl as any)?.components?.find((c: any) => c.type === "HEADER");
        if (headerComponent && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format)) {
          if (!mediaId) {
            throw new Error(`O template ${templateName} exige uma mídia (${headerComponent.format}). Anexe o arquivo abaixo.`);
          }
          templateComponents = [{
            type: "header",
            parameters: [
              {
                type: headerComponent.format.toLowerCase(),
                [headerComponent.format.toLowerCase()]: { id: mediaId }
              }
            ]
          }];
        }
      }

      return broadcastFn({
        data: {
          accessToken: account.accessToken!,
          phoneNumberId: account.phoneNumberId!,
          numbers: finalNumbers,
          templateName: templateName || undefined,
          language: templateLang,
          templateBody,
          components: templateComponents,
          message: fallback || undefined,
          mediaId,
          mediaType: mediaType as any,
          intervalSeconds: interval,
        },
      });
    },
    onSuccess: (r: any) => {
      toast.success(`Disparo concluído: ${r.sent} enviados, ${r.failed} falharam`);
      setNumbersText("");
      setFile(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSend = finalNumbers.length > 0 && (fallback.trim() || templateName || file);

  return (
    <div className="flex h-full flex-col bg-[#0b1416]">
      {/* Premium Header */}
      <div className="border-b border-white/5 bg-gradient-to-r from-[#0f1b1e] to-blue-900/10 px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/20">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Meta Broadcasts</h1>
            <p className="flex items-center gap-2 text-sm text-blue-200/60">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              Conectado como <strong className="text-slate-200">{account.name}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 xl:grid-cols-12">
          
          {/* Left Column: Audience */}
          <div className="xl:col-span-5 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md">
              <div className="mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                <Users className="h-5 w-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">Audiência</h2>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-slate-400">Inserção Manual</Label>
                <Textarea 
                  value={numbersText} 
                  onChange={(e) => setNumbersText(e.target.value)} 
                  rows={8}
                  placeholder="Cole aqui os números (um por linha)&#10;Ex: 5511999999999"
                  className="resize-none border-white/10 bg-black/20 font-mono text-sm text-slate-300 placeholder:text-slate-600 focus-visible:ring-blue-500/50" 
                />
              </div>

              <div className="mt-6 space-y-2">
                <Label className="text-xs uppercase tracking-wider text-slate-400">Filtro por Tags (Contatos Salvos)</Label>
                <select multiple value={selectedTags}
                  onChange={(e) => setSelectedTags(Array.from(e.target.selectedOptions).map((o) => o.value))}
                  className="h-32 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300 focus:border-blue-500/50 focus:outline-none">
                  {allTags.length === 0 && <option disabled>Nenhuma tag salva</option>}
                  {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-3 hover:bg-white/10 transition-colors">
                  <Checkbox 
                    checked={includeFilteredTags} 
                    onCheckedChange={(v) => setIncludeFilteredTags(!!v)} 
                    className="border-white/20 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white"
                  />
                  <span className="text-sm font-medium text-slate-300">Incluir contatos selecionados por tag</span>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Message & Send */}
          <div className="xl:col-span-7 space-y-6">
            <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-b from-blue-900/10 to-transparent p-6 shadow-xl backdrop-blur-md">
              <div className="mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                <MessageSquareText className="h-5 w-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">Conteúdo do Disparo</h2>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-slate-400">Template Oficial (Meta)</Label>
                <Select value={templateName || "none"} onValueChange={(v) => {
                  if (v === "none") { setTemplateName(""); return; }
                  setTemplateName(v);
                  const t = templates.find((x) => x.name === v);
                  if (t?.language) setTemplateLang(t.language);
                }}>
                  <SelectTrigger className="h-12 rounded-xl border-white/10 bg-black/20 text-slate-200">
                    <SelectValue placeholder={
                      tplQ.isFetching ? "Carregando templates da Meta..."
                      : templates.length === 0 ? "Nenhum template aprovado encontrado"
                      : "Selecione um template aprovado"
                    } />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#0f1b1e] text-slate-200">
                    <SelectItem value="none">Apenas mensagem livre / arquivo</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={`${t.name}-${t.language}`} value={t.name}>{t.name} ({t.language})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.length > 0 && (
                  <p className="mt-2 text-xs text-blue-400">✓ {templates.length} templates sincronizados com sucesso</p>
                )}
              </div>

              <div className="mt-6 space-y-2">
                <Label className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
                  <span>Mensagem Livre / Arquivo</span>
                  <span className="text-yellow-500/80 normal-case">(Válido apenas na janela de 24h)</span>
                </Label>
                <Textarea 
                  value={fallback} 
                  onChange={(e) => setFallback(e.target.value)} 
                  rows={4}
                  placeholder="Escreva sua mensagem aqui caso não queira usar um template..." 
                  className="resize-none rounded-xl border-white/10 bg-black/20 text-slate-300 placeholder:text-slate-600 focus-visible:ring-blue-500/50" 
                />
                
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="file"
                    id="broadcastFile"
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/10 bg-black/20 text-slate-300 hover:bg-white/10 hover:text-white"
                    onClick={() => document.getElementById("broadcastFile")?.click()}
                  >
                    <Paperclip className="mr-2 h-4 w-4" />
                    Anexar Arquivo
                  </Button>
                  {file && (
                    <div className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-1.5 text-sm text-blue-200">
                      <span className="max-w-[200px] truncate">{file.name}</span>
                      <button type="button" onClick={() => setFile(null)} className="hover:text-white hover:bg-blue-500/30 rounded p-1 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Config & Action */}
            <div className="flex flex-col sm:flex-row items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <div className="flex-1 space-y-2 w-full">
                <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
                  <Settings2 className="h-3 w-3" /> Intervalo (segundos)
                </Label>
                <Input 
                  type="number" min={0} value={interval}
                  onChange={(e) => setInterval(Math.max(0, Number(e.target.value) || 0))}
                  className="h-12 w-full sm:w-32 rounded-xl border-white/10 bg-black/20 text-center text-lg text-slate-200" 
                />
              </div>

              <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                <p className="mb-3 text-sm font-medium text-slate-300">
                  <span className="text-blue-400 text-lg font-bold">{finalNumbers.length}</span> contatos selecionados
                </p>
                <Button 
                  onClick={() => mut.mutate()} 
                  disabled={!canSend || mut.isPending}
                  size="lg"
                  className="w-full sm:w-auto gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-blue-400 focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
                >
                  {mut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  <span>Iniciar Disparo</span>
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
