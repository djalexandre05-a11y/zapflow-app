import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAccounts, listProfiles, listConversations } from "@/lib/zernio.functions";
import { fetchIncomingMessages } from "@/lib/incoming.functions";
import { PageHeader, StatCard, Card } from "@/components/app-ui";
import { MessageCircle, Users, Radio, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { ApiGate } from "@/components/api-gate";
import { useActiveAccount, type ZapAccount } from "@/lib/account";

function DashboardRoute() {
  const account = useActiveAccount();
  if (account?.provider === "meta") return <MetaDashboard account={account} />;
  return <ApiGate>{(apiKey) => <Dashboard apiKey={apiKey} />}</ApiGate>;
}

export const Route = createFileRoute("/_app/")({ component: DashboardRoute });

function MetaDashboard({ account }: { account: ZapAccount }) {
  const incomingFn = useServerFn(fetchIncomingMessages);
  const incQ = useQuery({
    queryKey: ["meta", "incoming", account.phoneNumberId],
    queryFn: () => incomingFn({ data: { phoneNumberId: account.phoneNumberId! } }),
    enabled: !!account.phoneNumberId,
    refetchInterval: 10000,
  });
  const rows = (incQ.data as { messages?: Array<{ from_number: string; from_name: string | null }> } | undefined)?.messages ?? [];
  const uniqueContacts = new Set(rows.map((r) => r.from_number)).size;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Dashboard" subtitle={`WhatsApp · ${account.name}`} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Mensagens recebidas" value={rows.length} icon={<MessageCircle className="h-5 w-5" />} accent="emerald" />
          <StatCard label="Contatos únicos" value={uniqueContacts} icon={<Users className="h-5 w-5" />} accent="sky" />
          <StatCard label="Número conectado" value={1} icon={<CheckCircle2 className="h-5 w-5" />} accent="emerald" />
          <StatCard label="Provedor" value={"Meta"} icon={<Radio className="h-5 w-5" />} accent="violet" />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Conta Meta">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"><span>Nome</span><span className="text-slate-400">{account.name}</span></li>
              <li className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"><span>Phone Number ID</span><span className="text-slate-400">{account.phoneNumberId}</span></li>
              <li className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"><span>WABA ID</span><span className="text-slate-400">{account.wabaId}</span></li>
            </ul>
          </Card>
          <Card title="Ações rápidas">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Link to="/chat" className="rounded-lg bg-emerald-500/10 px-3 py-3 text-center text-emerald-300 hover:bg-emerald-500/20">Abrir Chat</Link>
              <Link to="/templates" className="rounded-lg bg-white/5 px-3 py-3 text-center hover:bg-white/10">Templates</Link>
              <Link to="/disparos" className="rounded-lg bg-white/5 px-3 py-3 text-center hover:bg-white/10">Disparos</Link>
              <Link to="/contatos" className="rounded-lg bg-white/5 px-3 py-3 text-center hover:bg-white/10">Contatos</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

type Profile = { _id: string; name: string };
type Account = { _id: string; profileId: string; platform: string; username?: string; displayName?: string };

function Dashboard({ apiKey }: { apiKey: string }) {
  const profilesFn = useServerFn(listProfiles);
  const accountsFn = useServerFn(listAccounts);
  const convsFn = useServerFn(listConversations);

  const profilesQ = useQuery({ queryKey: ["z", "profiles", apiKey], queryFn: () => profilesFn({ data: { apiKey } }) });
  const accountsQ = useQuery({ queryKey: ["z", "accounts", apiKey], queryFn: () => accountsFn({ data: { apiKey } }) });

  const profiles: Profile[] = (profilesQ.data as { profiles?: Profile[] } | undefined)?.profiles ?? [];
  const accounts: Account[] = (accountsQ.data as { accounts?: Account[] } | undefined)?.accounts ?? [];
  const firstProfile = profiles[0]?._id;

  const convsQ = useQuery({
    queryKey: ["z", "dash-convs", apiKey, firstProfile],
    queryFn: () => convsFn({ data: { apiKey, profileId: firstProfile, sortOrder: "desc", limit: 100 } }),
    enabled: !!firstProfile,
  });
  const convs = ((convsQ.data as { data?: Array<{ unreadCount?: number }> } | undefined)?.data) ?? [];

  const unread = useMemo(() => convs.reduce((n, c) => n + (c.unreadCount || 0), 0), [convs]);
  const waAccounts = accounts.filter((a) => a.platform === "whatsapp");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Dashboard" subtitle="Visão geral das suas contas e conversas" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Conversas" value={convs.length} icon={<MessageCircle className="h-5 w-5" />} accent="emerald" />
          <StatCard label="Não lidas" value={unread} icon={<Radio className="h-5 w-5" />} accent="sky" />
          <StatCard label="Contas conectadas" value={accounts.length} icon={<Users className="h-5 w-5" />} accent="violet" />
          <StatCard label="WhatsApp" value={waAccounts.length} icon={<CheckCircle2 className="h-5 w-5" />} accent="emerald" />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Perfis ZapFlow">
            {profiles.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum perfil encontrado.</p>
            ) : (
              <ul className="space-y-2">
                {profiles.map((p) => (
                  <li key={p._id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <span>{p.name}</span>
                    <span className="text-xs text-slate-500">{p._id.slice(-6)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Contas conectadas">
            {accounts.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma conta.</p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {accounts.map((a) => (
                  <li key={a._id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <span className="truncate">{a.displayName || a.username || a._id}</span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase text-emerald-400">
                      {a.platform}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
