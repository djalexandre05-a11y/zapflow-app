import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { metaListTemplates, metaBroadcast } from "@/lib/meta.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Card } from "@/components/app-ui";
import type { ZapAccount } from "@/lib/account";

type Contact = { id: string; name: string; phone: string; tags: string[] };
type Tpl = { name: string; language: string; status?: string };
const CONTACTS_KEY = "zapflow.contacts";
const normalize = (n: string) => n.replace(/\D/g, "");

export function DisparosMeta({ account }: { account: ZapAccount }) {
  const listTplFn = useServerFn(metaListTemplates);
  const broadcastFn = useServerFn(metaBroadcast);

  const [numbersText, setNumbersText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [includeFilteredTags, setIncludeFilteredTags] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateLang, setTemplateLang] = useState("pt_BR");
  const [fallback, setFallback] = useState("");
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
      .map((t) => ({ name: t.name, language: t.language, status: t.status }));
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
    mutationFn: () => broadcastFn({
      data: {
        accessToken: account.accessToken!,
        phoneNumberId: account.phoneNumberId!,
        numbers: finalNumbers,
        templateName: templateName || undefined,
        language: templateLang,
        message: fallback || undefined,
        intervalSeconds: interval,
      },
    }),
    onSuccess: (r: any) => {
      toast.success(`Disparo concluído: ${r.sent} enviados, ${r.failed} falharam`);
      setNumbersText("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSend = finalNumbers.length > 0 && (fallback.trim() || templateName);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Disparos" subtitle={`WhatsApp · ${account.name}`} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <Card title="Destinatários">
            <Label className="text-xs uppercase tracking-wide text-slate-400">Números (um por linha, ou separados por vírgula)</Label>
            <Textarea value={numbersText} onChange={(e) => setNumbersText(e.target.value)} rows={6}
              placeholder={"5511999999999\n5511888888888"}
              className="mt-2 border-white/10 bg-[#0b1416] font-mono text-sm" />
            <div className="mt-6">
              <Label className="text-xs uppercase tracking-wide text-slate-400">Ou selecione por tags</Label>
              <select multiple value={selectedTags}
                onChange={(e) => setSelectedTags(Array.from(e.target.selectedOptions).map((o) => o.value))}
                className="mt-2 h-32 w-full rounded-md border border-white/10 bg-[#0b1416] p-2 text-sm text-slate-200">
                {allTags.length === 0 && <option disabled>Nenhuma tag em Contatos</option>}
                {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <label className="mt-2 flex items-center justify-end gap-2 text-sm text-slate-300">
                <Checkbox checked={includeFilteredTags} onCheckedChange={(v) => setIncludeFilteredTags(!!v)} />
                Incluir contatos filtrados
              </label>
            </div>
          </Card>

          <Card title="Mensagem">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-slate-400">Template aprovado (obrigatório fora da janela 24h)</Label>
              <Select value={templateName || "none"} onValueChange={(v) => {
                if (v === "none") { setTemplateName(""); return; }
                setTemplateName(v);
                const t = templates.find((x) => x.name === v);
                if (t?.language) setTemplateLang(t.language);
              }}>
                <SelectTrigger className="border-white/10 bg-[#0b1416]">
                  <SelectValue placeholder={
                    tplQ.isFetching ? "Sincronizando..."
                    : templates.length === 0 ? "Nenhum template aprovado"
                    : "-- selecione --"
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- selecione --</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={`${t.name}-${t.language}`} value={t.name}>{t.name} ({t.language})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.length > 0 && (
                <p className="mt-1 text-xs text-emerald-400">{templates.length} template(s) aprovado(s)</p>
              )}
            </div>
            <div className="mt-4 space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-slate-400">Mensagem (só funciona na janela 24h)</Label>
              <Textarea value={fallback} onChange={(e) => setFallback(e.target.value)} rows={4}
                placeholder="Olá, novidade..." className="border-white/10 bg-[#0b1416]" />
            </div>
          </Card>

          <Card title="Envio">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-slate-400">Intervalo entre envios (segundos)</Label>
              <Input type="number" min={0} value={interval}
                onChange={(e) => setInterval(Math.max(0, Number(e.target.value) || 0))}
                className="border-white/10 bg-[#0b1416]" />
            </div>
            <div className="mt-6 flex items-center justify-between">
              <Button onClick={() => mut.mutate()} disabled={!canSend || mut.isPending}
                className="bg-emerald-500 text-[#0b1416] hover:bg-emerald-400">
                {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="ml-2">Enviar Agora</span>
              </Button>
              <div className="text-sm text-slate-400">{finalNumbers.length} destinatário{finalNumbers.length === 1 ? "" : "s"}</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
