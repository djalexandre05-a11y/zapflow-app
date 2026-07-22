import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, Card } from "@/components/app-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Check, Loader2, Copy, Wand2 } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { getWebhookInfo } from "@/lib/incoming.functions";

export const Route = createFileRoute("/_app/config")({ component: ConfigPage });

type ZapAccount = {
  id: string;
  name: string;
  profileId?: string;
  apiKey: string;
  active?: boolean;
  provider?: "meta" | "zernio";
  accessToken?: string;
  wabaId?: string;
  phoneNumberId?: string;
};

const KEY = "zapflow.accounts";

function loadAccounts(): ZapAccount[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function saveAccounts(list: ZapAccount[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

async function detectProfile(apiKey: string) {
  const r = await fetch("https://api.zernio.com/v1/profiles", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const list = Array.isArray(j) ? j : (j.data || j.profiles || []);
  const p = list[0];
  if (!p) throw new Error("Nenhum perfil encontrado para essa chave");
  return { name: p.name || p.title || "Conta ZapFlow", profileId: p._id || p.id };
}

function ConfigPage() {
  const { theme, setTheme } = useTheme();
  const [accounts, setAccounts] = useState<ZapAccount[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  // AI Config State
  const [aiKey, setAiKey] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");

  useEffect(() => { 
    setAccounts(loadAccounts());
    try {
      const aiSettings = JSON.parse(localStorage.getItem("zapflow.ai_settings") || "{}");
      if (aiSettings.openaiKey) setAiKey(aiSettings.openaiKey);
      if (aiSettings.prompt) setAiPrompt(aiSettings.prompt);
    } catch {}
  }, []);

  const persist = (list: ZapAccount[]) => { setAccounts(list); saveAccounts(list); };

  const saveAiSettings = () => {
    localStorage.setItem("zapflow.ai_settings", JSON.stringify({ openaiKey: aiKey.trim(), prompt: aiPrompt.trim() }));
    toast.success("Configurações de IA salvas!");
  };

  const addAccount = async () => {
    if (!apiKey.trim()) { toast.error("Cole sua API Key"); return; }
    setBusy(true);
    try {
      const info = await detectProfile(apiKey.trim());
      const list = [...accounts, {
        id: crypto.randomUUID(),
        name: info.name,
        profileId: info.profileId,
        apiKey: apiKey.trim(),
        active: accounts.length === 0,
      }];
      persist(list);
      setApiKey("");
      toast.success(`Conta "${info.name}" adicionada`);
    } catch (e: any) {
      toast.error("Falha ao reconhecer a conta: " + (e?.message || "erro"));
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = (id: string) => {
    persist(accounts.filter((a) => a.id !== id));
    toast.success("Conta removida");
  };

  const setActive = (id: string) => {
    persist(accounts.map((a) => ({ ...a, active: a.id === id })));
  };

  const testConnection = async (a: ZapAccount) => {
    try {
      if (a.provider === "meta") {
        const r = await fetch(`https://graph.facebook.com/v20.0/${a.phoneNumberId}?fields=display_phone_number,verified_name`, {
          headers: { Authorization: `Bearer ${a.accessToken}` },
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
        toast.success(`Conectado: ${j.verified_name || j.display_phone_number}`);
        return;
      }
      const info = await detectProfile(a.apiKey);
      toast.success(`Conectado: ${info.name}`);
    } catch (e: any) {
      toast.error("Falha: " + (e?.message || "erro"));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Configuração" subtitle="Contas ZapFlow e preferências" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto grid max-w-3xl gap-6">

          <Card title="Integração ZapFlow">
            <p className="mb-4 text-sm text-slate-400">
              Cole sua API Key do ZapFlow — a conta é reconhecida automaticamente. Você pode adicionar várias chaves para trabalhar com mais de uma conta.
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-wide text-slate-400">API Key (Bearer)</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_..."
                  className="mt-1 bg-white/5"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={addAccount} disabled={busy} className="bg-emerald-500 text-[#0b1416] hover:bg-emerald-400">
                  {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                  Adicionar conta
                </Button>
              </div>
            </div>

            {accounts.length > 0 && (
              <div className="mt-6 border-t border-white/5 pt-4">
                <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Contas salvas ({accounts.length})</div>
                <ul className="space-y-2">
                  {accounts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                          {a.name}
                          {a.active && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase text-emerald-400">
                              <Check className="mr-1 inline h-3 w-3" />ativa
                            </span>
                          )}
                        </div>
                        {a.profileId && <div className="truncate text-xs text-slate-500">Profile: {a.profileId}</div>}
                      </div>
                      <div className="flex gap-1">
                        {!a.active && (
                          <Button size="sm" variant="ghost" onClick={() => setActive(a.id)}>Ativar</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => testConnection(a)}>Testar</Button>
                        <Button size="sm" variant="ghost" onClick={() => removeAccount(a.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card title="Como obter a API Key">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
              <li>Acesse o painel ZapFlow → Configurações → API.</li>
              <li>Gere uma chave começando com <code className="rounded bg-white/5 px-1">sk_</code>.</li>
              <li>Cole aqui e clique em Adicionar conta — a conta é reconhecida sozinha.</li>
            </ol>
          </Card>

          <Card title="Copiloto de Inteligência Artificial">
            <p className="mb-4 text-sm text-slate-400">
              Configure sua chave da OpenAI para gerar <b>Rascunhos Mágicos</b> na tela de Chat.
            </p>
            <div className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wide text-slate-400">OpenAI API Key (sk-...)</Label>
                <Input
                  type="password"
                  value={aiKey}
                  onChange={(e) => setAiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="mt-1 bg-white/5"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide text-slate-400">Comportamento da IA (Prompt)</Label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="ex: Somos a loja ZapFlow. Seja caloroso e conciso. Não dê preços."
                  className="mt-1 w-full min-h-[80px] rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-100"
                />
              </div>
              <div className="flex justify-end pt-1">
                <Button onClick={saveAiSettings} className="bg-emerald-500 text-[#0b1416] hover:bg-emerald-400">
                  <Wand2 className="mr-2 h-4 w-4" />
                  Salvar Copiloto
                </Button>
              </div>
            </div>
          </Card>

          <WebhookCard />

          <Card title="Preferências">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2.5">
                <Label className="text-sm text-slate-200">Modo claro</Label>
                <Switch checked={theme === "light"} onCheckedChange={(v) => setTheme(v ? "light" : "dark")} />
              </div>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}

function WebhookCard() {
  const infoFn = useServerFn(getWebhookInfo);
  const q = useQuery({ queryKey: ["webhook-info"], queryFn: () => infoFn() });
  const [origin, setOrigin] = useState("");
  useEffect(() => { if (typeof window !== "undefined") setOrigin(window.location.origin); }, []);
  const url = origin ? `${origin}/api/public/whatsapp/webhook` : "";
  const token = (q.data as any)?.verifyToken || "";
  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copiado"); };
  return (
    <Card title="Webhook — Receber mensagens">
      <p className="mb-3 text-sm text-slate-400">
        Para <b>receber</b> mensagens no chat, configure este webhook no painel da Meta
        (Meta for Developers → seu App → WhatsApp → Configuration → Webhook) e assine o campo <code className="rounded bg-white/5 px-1">messages</code>.
      </p>
      <div className="space-y-3">
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-400">Callback URL</Label>
          <div className="mt-1 flex gap-2">
            <Input readOnly value={url} className="bg-white/5 font-mono text-xs" />
            <Button size="sm" variant="ghost" onClick={() => copy(url)}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-400">Verify Token</Label>
          <div className="mt-1 flex gap-2">
            <Input readOnly value={token} className="bg-white/5 font-mono text-xs" />
            <Button size="sm" variant="ghost" onClick={() => copy(token)}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Depois de verificar, clique em "Manage" e assine o campo <b>messages</b>. As mensagens recebidas aparecem no Chat em até 5s.
        </p>
      </div>
    </Card>
  );
}
