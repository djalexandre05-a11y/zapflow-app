import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, Trash2, FileText, Upload } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/app-ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  listAccounts,
  listWhatsAppTemplates,
  createWhatsAppTemplate,
  deleteWhatsAppTemplate,
  uploadMediaDirect,
} from "@/lib/zernio.functions";

import { ApiGate } from "@/components/api-gate";
import { TemplatesMeta } from "@/components/templates-meta";
import { useActiveAccount } from "@/lib/account";

export const Route = createFileRoute("/_app/templates")({
  component: TemplatesRoute,
});

function TemplatesRoute() {
  const account = useActiveAccount();
  if (account?.provider === "meta") return <TemplatesMeta account={account} />;
  return <ApiGate>{(apiKey) => <TemplatesPage apiKey={apiKey} />}</ApiGate>;
}

type Account = { _id: string; displayName?: string; platform: string; metadata?: any };
type Tpl = {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components?: Array<{ type: string; format?: string; text?: string; example?: any }>;
};

type HeaderFormat = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";

const CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"] as const;
const STATUS_LABEL: Record<string, string> = {
  APPROVED: "Aprovado",
  PENDING: "Pendente",
  REJECTED: "Rejeitado",
  PAUSED: "Pausado",
  DISABLED: "Desabilitado",
};

function statusColor(s: string) {
  const u = s.toUpperCase();
  if (u === "APPROVED") return "bg-emerald-500/15 text-emerald-400";
  if (u === "REJECTED" || u === "DISABLED") return "bg-rose-500/15 text-rose-400";
  return "bg-amber-500/15 text-amber-400";
}

function TemplatesPage({ apiKey }: { apiKey: string }) {
  const _listAccounts = useServerFn(listAccounts);
  const _listTpls = useServerFn(listWhatsAppTemplates);
  const _createTpl = useServerFn(createWhatsAppTemplate);
  const _deleteTpl = useServerFn(deleteWhatsAppTemplate);
  const _upload = useServerFn(uploadMediaDirect);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // form
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("MARKETING");
  const [language, setLanguage] = useState("pt_BR");
  const [status] = useState("PENDING"); // read-only informational
  const [headerFormat, setHeaderFormat] = useState<HeaderFormat>("NONE");
  const [mediaUrl, setMediaUrl] = useState("");
  const [docFilename, setDocFilename] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res: any = await _listAccounts({ data: { apiKey } });
        const wa = (res?.accounts ?? []).filter((a: Account) => a.platform === "whatsapp");
        setAccounts(wa);
        if (wa[0]) setAccountId(wa[0]._id);
      } catch (e: any) {
        toast.error(e?.message ?? "Falha ao carregar contas");
      }
    })();
  }, []);

  const loadTemplates = async (silent = false) => {
    if (!accountId) return;
    silent ? setSyncing(true) : setLoading(true);
    try {
      const res: any = await _listTpls({ data: { apiKey, accountId } });
      setTemplates(res?.templates ?? []);
      if (silent) toast.success("Templates sincronizados");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao listar templates");
    } finally {
      setSyncing(false); setLoading(false);
    }
  };

  useEffect(() => { loadTemplates(false); }, [accountId]);

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const fileBase64 = btoa(bin);
      const res: any = await _upload({ data: { apiKey, fileBase64, filename: file.name, contentType: file.type || "application/octet-stream" } });
      setMediaUrl(res.url);
      if (headerFormat === "DOCUMENT" && !docFilename) setDocFilename(file.name);
      toast.success("Arquivo enviado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!accountId) return toast.error("Selecione uma conta WhatsApp");
    if (!name.trim()) return toast.error("Informe o nome do template");
    if (!body.trim()) return toast.error("Informe o corpo do template");

    const components: any[] = [];
    if (headerFormat !== "NONE") {
      if (headerFormat === "TEXT") {
        components.push({ type: "HEADER", format: "TEXT", text: mediaUrl || "" });
      } else if (mediaUrl) {
        const example: any = { header_handle: [mediaUrl] };
        const comp: any = { type: "HEADER", format: headerFormat, example };
        if (headerFormat === "DOCUMENT" && docFilename) comp.example.header_filename = docFilename;
        components.push(comp);
      }
    }
    components.push({ type: "BODY", text: body });

    setSaving(true);
    try {
      await _createTpl({ data: { apiKey, accountId, name: name.trim(), category, language: language.trim(), components } });
      toast.success("Template enviado para aprovação");
      setName(""); setBody(""); setMediaUrl(""); setDocFilename(""); setHeaderFormat("NONE");
      loadTemplates(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar template");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: Tpl) => {
    if (!accountId) return;
    if (!confirm(`Excluir template "${t.name}"?`)) return;
    try {
      await _deleteTpl({ data: { apiKey, accountId, templateId: t.id, name: t.name } });
      toast.success("Template excluído");
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir");
    }
  };

  const inputCls = "mt-1 w-full rounded-md border border-white/10 bg-[#0b1416] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none";

  const list = useMemo(() => templates, [templates]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Templates"
        subtitle="Templates aprovados pela Meta para envios fora da janela de 24h"
        right={
          <div className="flex items-center gap-2">
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="rounded-md border border-white/10 bg-[#0b1416] px-3 py-2 text-sm text-slate-100"
            >
              {accounts.length === 0 && <option value="">Sem contas WhatsApp</option>}
              {accounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.displayName || a.metadata?.verifiedName || a._id}
                </option>
              ))}
            </select>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <Card
            title="Novo template"
            action={
              <button
                onClick={() => loadTemplates(true)}
                disabled={syncing || !accountId}
                className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-[#0b1416] px-3 py-1.5 text-xs text-sky-300 hover:bg-white/5 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                Sincronizar Templates
              </button>
            }
          >
            <div className="space-y-4">
              <div>
                <Label className="text-xs uppercase text-slate-400">Nome (snake_case, ex.: boas_vindas)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} className={inputCls} />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs uppercase text-slate-400">Categoria</Label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as any)} className={inputCls}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs uppercase text-slate-400">Idioma</Label>
                  <Input value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <Label className="text-xs uppercase text-slate-400">Status</Label>
                  <select value={status} disabled className={`${inputCls} opacity-70`}>
                    <option>Pendente</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs uppercase text-slate-400">Cabeçalho (mídia)</Label>
                  <select value={headerFormat} onChange={(e) => setHeaderFormat(e.target.value as HeaderFormat)} className={inputCls}>
                    <option value="NONE">Nenhum</option>
                    <option value="TEXT">Texto</option>
                    <option value="IMAGE">Imagem</option>
                    <option value="VIDEO">Vídeo</option>
                    <option value="DOCUMENT">Documento</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs uppercase text-slate-400">
                    {headerFormat === "TEXT" ? "Texto do cabeçalho" : "URL pública do arquivo"}
                  </Label>
                  <Input
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder={headerFormat === "TEXT" ? "Título do cabeçalho" : "https://.../arquivo.jpg"}
                    className={inputCls}
                    disabled={headerFormat === "NONE"}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase text-slate-400">Nome do arquivo (documentos)</Label>
                  <Input
                    value={docFilename}
                    onChange={(e) => setDocFilename(e.target.value)}
                    placeholder="catalogo.pdf"
                    className={inputCls}
                    disabled={headerFormat !== "DOCUMENT"}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-[#0b1416] px-3 py-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                  <Upload className="h-4 w-4" />
                  <span className="rounded border border-white/15 px-2 py-1">Escolher arquivo</span>
                  <input
                    type="file"
                    className="hidden"
                    disabled={headerFormat === "NONE" || headerFormat === "TEXT" || uploading}
                    onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  />
                  <span className="text-slate-500">{uploading ? "Enviando..." : "Nenhum arquivo escolhido"}</span>
                </label>
                <span className="text-xs text-slate-500">Enviar arquivo do computador · ou cole a URL acima</span>
              </div>

              <div>
                <Label className="text-xs uppercase text-slate-400">Corpo (use {"{{1}}"}, {"{{2}}"}...)</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  placeholder={"Olá {{1}}, seu pedido {{2}} foi confirmado."}
                  className={inputCls}
                />
              </div>

              <p className="text-xs text-slate-500">Selecione um arquivo do PC e clique em Enviar — a URL pública é preenchida automaticamente.</p>

              <Button onClick={save} disabled={saving} className="bg-emerald-500 text-[#0b1416] hover:bg-emerald-400">
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </Card>

          <p className="text-xs text-slate-500">Os status aqui refletem o que a Meta aprovou. Só templates APROVADOS podem ser usados fora da janela 24h.</p>

          <Card title={`Templates da conta (${list.length})`}>
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-400">Carregando...</div>
            ) : list.length === 0 ? (
              <EmptyState icon={<FileText className="h-6 w-6" />} title="Sem templates" description="Crie um template acima ou sincronize com a Meta." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Nome</th>
                      <th className="px-3 py-2">Categoria</th>
                      <th className="px-3 py-2">Idioma</th>
                      <th className="px-3 py-2">Mídia</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((t) => {
                      const header = t.components?.find((c) => c.type === "HEADER");
                      const bodyText = t.components?.find((c) => c.type === "BODY")?.text || "";
                      return (
                        <tr key={t.id} className="border-b border-white/5 align-top">
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-100">{t.name}</div>
                            <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-slate-400">{bodyText}</div>
                          </td>
                          <td className="px-3 py-3 text-slate-300">{t.category}</td>
                          <td className="px-3 py-3 text-slate-300">{t.language}</td>
                          <td className="px-3 py-3 text-slate-300">{header?.format ?? "—"}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded px-2 py-0.5 text-xs ${statusColor(t.status)}`}>
                              {STATUS_LABEL[t.status.toUpperCase()] ?? t.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button onClick={() => remove(t)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10">
                              <Trash2 className="h-3.5 w-3.5" /> Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
