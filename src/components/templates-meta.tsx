import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Trash2, FileText } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/app-ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { metaListTemplates, metaCreateTemplate, metaDeleteTemplate } from "@/lib/meta.functions";
import type { ZapAccount } from "@/lib/account";

type Tpl = {
  name: string;
  status: string;
  category: string;
  language: string;
  components?: Array<{ type: string; format?: string; text?: string }>;
};

const CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"] as const;
const STATUS_LABEL: Record<string, string> = {
  APPROVED: "Aprovado", PENDING: "Pendente", REJECTED: "Rejeitado",
  PAUSED: "Pausado", DISABLED: "Desabilitado",
};

function statusColor(s: string) {
  const u = s.toUpperCase();
  if (u === "APPROVED") return "bg-emerald-500/15 text-emerald-400";
  if (u === "REJECTED" || u === "DISABLED") return "bg-rose-500/15 text-rose-400";
  return "bg-amber-500/15 text-amber-400";
}

export function TemplatesMeta({ account }: { account: ZapAccount }) {
  const listFn = useServerFn(metaListTemplates);
  const createFn = useServerFn(metaCreateTemplate);
  const deleteFn = useServerFn(metaDeleteTemplate);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("MARKETING");
  const [language, setLanguage] = useState("pt_BR");
  const [body, setBody] = useState("");

  const tplQ = useQuery({
    queryKey: ["meta-tpl-page", account.wabaId],
    queryFn: () => listFn({ data: { accessToken: account.accessToken!, wabaId: account.wabaId! } }),
    enabled: !!account.wabaId && !!account.accessToken,
  });
  const templates: Tpl[] = ((tplQ.data as any)?.data ?? []) as Tpl[];

  const createMut = useMutation({
    mutationFn: () => createFn({
      data: {
        accessToken: account.accessToken!,
        wabaId: account.wabaId!,
        name: name.trim(),
        category,
        language: language.trim(),
        components: [{ type: "BODY", text: body }],
      },
    }),
    onSuccess: () => {
      toast.success("Template enviado para aprovação");
      setName(""); setBody("");
      tplQ.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (n: string) => deleteFn({
      data: { accessToken: account.accessToken!, wabaId: account.wabaId!, name: n },
    }),
    onSuccess: () => { toast.success("Template excluído"); tplQ.refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const inputCls = "mt-1 w-full rounded-md border border-white/10 bg-[#0b1416] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/60 focus:outline-none";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Templates"
        subtitle={`WhatsApp · ${account.name}`}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <Card
            title="Novo template"
            action={
              <button
                onClick={() => tplQ.refetch()}
                disabled={tplQ.isFetching}
                className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-[#0b1416] px-3 py-1.5 text-xs text-sky-300 hover:bg-white/5 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${tplQ.isFetching ? "animate-spin" : ""}`} />
                Sincronizar
              </button>
            }
          >
            <div className="space-y-4">
              <div>
                <Label className="text-xs uppercase text-slate-400">Nome (snake_case)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} className={inputCls} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs uppercase text-slate-400">Categoria</Label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as any)} className={inputCls}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs uppercase text-slate-400">Idioma</Label>
                  <Input value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase text-slate-400">Corpo (use {"{{1}}"}, {"{{2}}"}...)</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
                  placeholder={"Olá {{1}}, seu pedido {{2}} foi confirmado."}
                  className={inputCls} />
              </div>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="bg-emerald-500 text-[#0b1416] hover:bg-emerald-400">
                {createMut.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </Card>

          <Card title={`Templates da conta (${templates.length})`}>
            {tplQ.isLoading ? (
              <div className="p-6 text-center text-sm text-slate-400">Carregando...</div>
            ) : templates.length === 0 ? (
              <EmptyState icon={<FileText className="h-6 w-6" />} title="Sem templates" description="Crie um template acima." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Nome</th>
                      <th className="px-3 py-2">Categoria</th>
                      <th className="px-3 py-2">Idioma</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => {
                      const bodyText = t.components?.find((c) => c.type === "BODY")?.text || "";
                      return (
                        <tr key={`${t.name}-${t.language}`} className="border-b border-white/5 align-top">
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-100">{t.name}</div>
                            <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-slate-400">{bodyText}</div>
                          </td>
                          <td className="px-3 py-3 text-slate-300">{t.category}</td>
                          <td className="px-3 py-3 text-slate-300">{t.language}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded px-2 py-0.5 text-xs ${statusColor(t.status)}`}>
                              {STATUS_LABEL[t.status.toUpperCase()] ?? t.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button onClick={() => { if (confirm(`Excluir "${t.name}"?`)) deleteMut.mutate(t.name); }}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10">
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
