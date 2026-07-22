import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Calendar } from "lucide-react";
import { listAccounts, listProfiles, listWhatsAppTemplates, sendWhatsAppBroadcast } from "@/lib/zernio.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Card } from "@/components/app-ui";
import { ApiGate } from "@/components/api-gate";
import { useActiveAccount } from "@/lib/account";

export const Route = createFileRoute("/_app/disparos")({
  component: DisparosRoute,
});

function DisparosRoute() {
  const account = useActiveAccount();
  if (account?.provider === "meta") {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Disparos" subtitle="Envio em massa via ZapFlow." />
        <div className="flex-1 p-6">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6 shadow-xl text-emerald-200">
            <h2 className="text-lg font-semibold mb-2">Conta Meta Selecionada</h2>
            <p className="text-emerald-200/80">
              Esta tela é exclusiva para disparos via ZapFlow. Para fazer envios pela Meta, acesse a aba <b>Broadcasts</b> no menu lateral.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return <ApiGate>{(apiKey) => <DisparosPage apiKey={apiKey} />}</ApiGate>;
}

type Profile = { _id: string; name: string };
type Account = {
  _id: string;
  profileId: string | { _id: string; name?: string };
  platform: string;
  username?: string;
  displayName?: string;
};
type Contact = { id: string; name: string; phone: string; tags: string[] };
type Tpl = { id?: string; _id?: string; name: string; language?: string; status?: string };

const CONTACTS_KEY = "zapflow.contacts";

function normalize(n: string) { return n.replace(/\D/g, ""); }

function DisparosPage({ apiKey }: { apiKey: string }) {
  const profilesFn = useServerFn(listProfiles);
  const accountsFn = useServerFn(listAccounts);
  const tplsFn = useServerFn(listWhatsAppTemplates);
  const sendFn = useServerFn(sendWhatsAppBroadcast);

  const profilesQ = useQuery({ queryKey: ["z", "profiles", apiKey], queryFn: () => profilesFn({ data: { apiKey } }) });
  const accountsQ = useQuery({ queryKey: ["z", "accounts", apiKey], queryFn: () => accountsFn({ data: { apiKey } }) });
  const profiles: Profile[] = (profilesQ.data as { profiles?: Profile[] } | undefined)?.profiles ?? [];
  const accounts: Account[] = (accountsQ.data as { accounts?: Account[] } | undefined)?.accounts ?? [];

  const [profileId, setProfileId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [numbersText, setNumbersText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [includeFilteredTags, setIncludeFilteredTags] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateLang, setTemplateLang] = useState("pt_BR");
  const [fallback, setFallback] = useState("");
  const [interval, setInterval] = useState(2);
  const [scheduledAt, setScheduledAt] = useState("");

  const waAccounts = useMemo(
    () => accounts.filter((a) => {
      const linkedProfileId = typeof a.profileId === "string" ? a.profileId : a.profileId?._id;
      return a.platform === "whatsapp" && (!profileId || linkedProfileId === profileId);
    }),
    [accounts, profileId],
  );

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

  const tplsQ = useQuery({
    queryKey: ["z", "templates", apiKey, accountId],
    queryFn: () => tplsFn({ data: { apiKey, accountId } }),
    enabled: !!accountId,
    staleTime: 0,
    retry: 2,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const templates: Tpl[] = useMemo(() => {
    const d = tplsQ.data as any;
    const list: Tpl[] = d?.templates ?? d?.data ?? (Array.isArray(d) ? d : []);
    return list;
  }, [tplsQ.data]);


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

  const pasteClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      setNumbersText((prev) => (prev ? prev + "\n" : "") + t);
    } catch { toast.error("Não foi possível ler o clipboard"); }
  };
  const copyFinal = async () => {
    try { await navigator.clipboard.writeText(finalNumbers.join("\n")); toast.success("Copiado"); }
    catch { toast.error("Falha ao copiar"); }
  };

  const mutation = useMutation({
    mutationFn: (payload: { scheduled: boolean }) =>
      sendFn({
        data: {
          apiKey,
          profileId,
          accountId,
          name: name || `Disparo ${new Date().toLocaleString("pt-BR")}`,
          to: groupId ? undefined : finalNumbers,
          templateName: templateName || undefined,
          templateLanguage: templateLang,
          message: fallback || undefined,
          intervalSeconds: interval,
          scheduledAt: payload.scheduled && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        },
      }),
    onSuccess: (_d, v) => {
      toast.success(v.scheduled ? "Disparo agendado!" : "Disparo iniciado!");
      setNumbersText(""); setSelectedTags([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSend = !!profileId && !!accountId && (groupId || finalNumbers.length > 0) && !!templateName;
  const destCount = groupId ? 1 : finalNumbers.length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Disparos" subtitle="Envie mensagens WhatsApp em massa" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <Card title="Conta">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Perfil">
                <Select value={profileId} onValueChange={(v) => { setProfileId(v); setAccountId(""); }}>
                  <SelectTrigger className="border-white/10 bg-[#0b1416]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{profiles.map((p) => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Conta WhatsApp">
                <Select value={accountId} onValueChange={(value) => {
                  setAccountId(value);
                  setTemplateName("");
                }} disabled={!profileId}>
                  <SelectTrigger className="border-white/10 bg-[#0b1416]"><SelectValue placeholder={waAccounts.length ? "Selecione" : "Sem contas WA"} /></SelectTrigger>
                  <SelectContent>{waAccounts.map((a) => <SelectItem key={a._id} value={a._id}>{a.displayName || a.username || a._id}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Nome do disparo (opcional)">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promoção Semanal" className="border-white/10 bg-[#0b1416]" />
              </Field>
            </div>
          </Card>

          <Card title="Destinatários">
            <Label className="text-xs uppercase tracking-wide text-slate-400">
              Números (um por linha, ou separados por vírgula/ponto-e-vírgula)
            </Label>
            <Textarea
              value={numbersText}
              onChange={(e) => setNumbersText(e.target.value)}
              rows={6}
              placeholder={"5511999999999\n5511888888888, 5511777777777"}
              className="mt-2 border-white/10 bg-[#0b1416] font-mono text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <button type="button" onClick={pasteClipboard} className="text-emerald-400 hover:underline">Colar do clipboard</button>
              <button type="button" onClick={copyFinal} className="text-emerald-400 hover:underline">Copiar números da lista final</button>
              <button type="button" onClick={() => setNumbersText("")} className="text-emerald-400 hover:underline">Limpar</button>
            </div>

            <div className="mt-6">
              <Label className="text-xs uppercase tracking-wide text-slate-400">Ou selecione por tags de contatos</Label>
              <select
                multiple
                value={selectedTags}
                onChange={(e) => setSelectedTags(Array.from(e.target.selectedOptions).map((o) => o.value))}
                className="mt-2 h-32 w-full rounded-md border border-white/10 bg-[#0b1416] p-2 text-sm text-slate-200"
              >
                {allTags.length === 0 && <option disabled>Nenhuma tag salva em Contatos</option>}
                {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <label className="mt-2 flex items-center justify-end gap-2 text-sm text-slate-300">
                <Checkbox checked={includeFilteredTags} onCheckedChange={(v) => setIncludeFilteredTags(!!v)} />
                Incluir contatos filtrados pelas tags acima
              </label>
            </div>

            <div className="mt-6">
              <Field label="Disparar para um Grupo ao invés de contatos individuais? (Opcional)">
                <Select value={groupId || "none"} onValueChange={(v) => setGroupId(v === "none" ? "" : v)}>
                  <SelectTrigger className="border-white/10 bg-[#0b1416]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não (Enviar individualmente para a lista acima)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Mensagem">
            <Field label="Template aprovado (obrigatório fora da janela 24h)">
              <Select value={templateName || "none"} onOpenChange={(open) => {
                if (open && accountId) void tplsQ.refetch();
              }} onValueChange={(v) => {
                if (v === "none") { setTemplateName(""); return; }
                setTemplateName(v);
                const t = templates.find((x) => x.name === v);
                if (t?.language) setTemplateLang(t.language);
              }}>
                <SelectTrigger className="border-white/10 bg-[#0b1416]">
                  <SelectValue placeholder={
                    !accountId ? "Selecione uma conta WhatsApp primeiro"
                    : tplsQ.isFetching ? "Sincronizando templates..."
                    : templates.length === 0 ? "Nenhum template encontrado"
                    : "-- selecione --"
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- selecione --</SelectItem>
                  {templates.map((t) => {
                    const st = (t.status ?? "").toUpperCase();
                    const badge = st && st !== "APPROVED" ? ` [${st}]` : "";
                    return (
                      <SelectItem key={(t.id ?? t._id ?? t.name) as string} value={t.name}>
                        {t.name} ({t.language}){badge}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {tplsQ.isError && (
                <p className="mt-1 text-xs text-red-400">
                  Erro ao buscar templates: {tplsQ.error instanceof Error ? tplsQ.error.message : "falha na API"}
                </p>
              )}
              {accountId && !tplsQ.isFetching && !tplsQ.isError && templates.length === 0 && (
                <p className="mt-1 text-xs text-amber-400">
                  Nenhum template nesta conta. Abra o seletor novamente para sincronizar.
                </p>
              )}
              {templates.length > 0 && (
                <p className="mt-1 text-xs text-emerald-400">
                  {templates.length} template{templates.length === 1 ? "" : "s"} sincronizado{templates.length === 1 ? "" : "s"}.
                </p>
              )}
            </Field>


          </Card>

          <Card title="Envio">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Intervalo entre envios (segundos)">
                <Input type="number" min={0} value={interval}
                  onChange={(e) => setInterval(Math.max(0, Number(e.target.value) || 0))}
                  className="border-white/10 bg-[#0b1416]" />
              </Field>
              <Field label="Agendar disparo (opcional)">
                <Input type="datetime-local" value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="border-white/10 bg-[#0b1416]" />
              </Field>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-2">
                <Button onClick={() => mutation.mutate({ scheduled: false })}
                  disabled={!canSend || mutation.isPending}
                  className="bg-emerald-500 text-[#0b1416] hover:bg-emerald-400">
                  {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="ml-2">Enviar Agora</span>
                </Button>
                <Button onClick={() => mutation.mutate({ scheduled: true })}
                  disabled={!canSend || !scheduledAt || mutation.isPending}
                  variant="ghost" className="text-emerald-400 hover:bg-white/5">
                  <Calendar className="h-4 w-4" /><span className="ml-2">Agendar</span>
                </Button>
              </div>
              <div className="text-sm text-slate-400">{destCount} destinatário{destCount === 1 ? "" : "s"}</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-slate-400">{label}</Label>
      {children}
    </div>
  );
}
