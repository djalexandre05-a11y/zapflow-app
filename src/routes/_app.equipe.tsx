import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Users, Loader2, CloudUpload, CloudDownload, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { 
  getWorkspaces, 
  createWorkspace, 
  addMember, 
  removeMember, 
  getWorkspaceMembers, 
  saveConnection, 
  getConnections 
} from "@/lib/workspace.functions";
import { useAccounts } from "@/lib/account";

export const Route = createFileRoute("/_app/equipe")({
  component: EquipeRoute,
});

function EquipeRoute() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Equipe" subtitle="Gerencie seus atendentes e conexões compartilhadas." />
      <div className="flex-1 overflow-y-auto p-6">
        <EquipeManager user={user} />
      </div>
    </div>
  );
}

function EquipeManager({ user }: { user: any }) {
  const getWsFn = useServerFn(getWorkspaces);
  const createWsFn = useServerFn(createWorkspace);
  const addMemFn = useServerFn(addMember);
  const remMemFn = useServerFn(removeMember);
  const getMemFn = useServerFn(getWorkspaceMembers);
  const saveConnFn = useServerFn(saveConnection);
  const getConnFn = useServerFn(getConnections);

  const { accounts } = useAccounts();

  const wsQ = useQuery({
    queryKey: ["workspaces", user.id],
    queryFn: () => getWsFn({ data: { userId: user.id, email: user.email } }),
  });

  const [wsName, setWsName] = useState("");
  const [emailInput, setEmailInput] = useState("");

  const ws = wsQ.data?.[0];

  const memQ = useQuery({
    queryKey: ["ws-members", ws?.id],
    queryFn: () => getMemFn({ data: { workspaceId: ws!.id } }),
    enabled: !!ws,
  });

  const createMut = useMutation({
    mutationFn: (name: string) => createWsFn({ data: { userId: user.id, name } }),
    onSuccess: () => { wsQ.refetch(); toast.success("Equipe criada!"); },
  });

  const addMut = useMutation({
    mutationFn: (email: string) => addMemFn({ data: { workspaceId: ws!.id, email } }),
    onSuccess: () => { memQ.refetch(); setEmailInput(""); toast.success("Convidado!"); },
  });

  const remMut = useMutation({
    mutationFn: (email: string) => remMemFn({ data: { workspaceId: ws!.id, email } }),
    onSuccess: () => { memQ.refetch(); toast.success("Removido!"); },
  });

  const syncUpMut = useMutation({
    mutationFn: async () => {
      const active = accounts.find(a => a.active) || accounts[0];
      if (!active) throw new Error("Nenhuma conexão local encontrada");
      await saveConnFn({
        data: {
          workspaceId: ws!.id,
          provider: active.provider || "meta",
          name: active.name,
          accessToken: active.accessToken,
          phoneNumberId: active.phoneNumberId,
          wabaId: active.wabaId,
          apiKey: active.apiKey,
        }
      });
    },
    onSuccess: () => toast.success("Conexão salva na nuvem para a equipe!"),
    onError: (e: any) => toast.error(e.message),
  });

  const syncDownMut = useMutation({
    mutationFn: async () => {
      const conns: any = await getConnFn({ data: { workspaceId: ws!.id } });
      if (!conns || conns.length === 0) throw new Error("Nenhuma conexão na nuvem");
      const c = conns[0];
      const local = {
        id: c.id,
        name: c.name,
        provider: c.provider,
        active: true,
        accessToken: c.access_token,
        phoneNumberId: c.phone_number_id,
        wabaId: c.waba_id,
        apiKey: c.api_key,
      };
      localStorage.setItem("zapflow.accounts", JSON.stringify([local]));
      window.dispatchEvent(new Event("storage"));
    },
    onSuccess: () => {
      toast.success("Conexão da equipe baixada!");
      window.location.reload();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (wsQ.isLoading) return <div className="p-4"><Loader2 className="animate-spin text-emerald-500" /></div>;

  if (!ws) {
    return (
      <div className="max-w-md rounded-xl border border-white/10 bg-[#0f1b1e] p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-bold text-white">Criar minha Equipe</h2>
        <p className="mb-4 text-sm text-slate-400">Crie um workspace para convidar seus atendentes.</p>
        <div className="flex gap-2">
          <Input value={wsName} onChange={e => setWsName(e.target.value)} placeholder="Nome da empresa..." className="border-white/10 bg-black/20" />
          <Button onClick={() => createMut.mutate(wsName)} disabled={!wsName || createMut.isPending} className="bg-emerald-500 text-black hover:bg-emerald-400">Criar</Button>
        </div>
      </div>
    );
  }

  const isOwner = ws.owner_id === user.id;

  return (
    <div className="grid max-w-4xl gap-6 md:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-[#0f1b1e] p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
          <Users className="h-5 w-5 text-emerald-400" />
          Equipe: {ws.name}
        </div>

        {isOwner && (
          <div className="mb-6">
            <label className="mb-1 block text-sm font-medium text-slate-300">Convidar Atendente (E-mail)</label>
            <div className="flex gap-2">
              <Input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="email@exemplo.com" className="border-white/10 bg-black/20" />
              <Button onClick={() => addMut.mutate(emailInput)} disabled={!emailInput || addMut.isPending} className="bg-emerald-500 text-black hover:bg-emerald-400">Adicionar</Button>
            </div>
            <p className="mt-1 text-xs text-slate-500">O usuário precisa criar uma conta grátis com este mesmo e-mail.</p>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-400">Membros da Equipe</h3>
          <div className="flex items-center justify-between rounded-md border border-white/5 bg-black/20 p-3">
            <span className="text-sm text-slate-200">Você (Dono)</span>
          </div>
          {memQ.data?.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border border-white/5 bg-black/20 p-3">
              <span className="text-sm text-slate-200">{m.user_email}</span>
              {isOwner && (
                <Button onClick={() => remMut.mutate(m.user_email)} variant="ghost" size="sm" className="h-8 text-rose-400 hover:bg-rose-500/20">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0f1b1e] p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-bold text-white">Conexão Compartilhada</h3>
        <p className="mb-6 text-sm text-slate-400">
          Sincronize a conexão do WhatsApp para que todos os membros da equipe possam enviar e receber mensagens no mesmo número.
        </p>

        <div className="space-y-4">
          {isOwner && (
            <Button onClick={() => syncUpMut.mutate()} disabled={syncUpMut.isPending} className="w-full gap-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" variant="outline">
              <CloudUpload className="h-4 w-4" /> Salvar Conexão Atual na Nuvem
            </Button>
          )}

          <Button onClick={() => syncDownMut.mutate()} disabled={syncDownMut.isPending} className="w-full gap-2 border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" variant="outline">
            <CloudDownload className="h-4 w-4" /> Baixar Conexão da Equipe
          </Button>
        </div>
        
        <p className="mt-4 text-xs text-center text-slate-500">
          Os convidados devem clicar em "Baixar Conexão" para configurar automaticamente seus navegadores.
        </p>
      </div>
    </div>
  );
}
