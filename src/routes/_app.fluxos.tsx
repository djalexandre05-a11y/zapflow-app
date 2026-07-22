import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, Edit2, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";

export const Route = createFileRoute("/_app/fluxos")({
  component: FluxosPage,
});

function FluxosPage() {
  const queryClient = useQueryClient();
  const { data: flows, isLoading } = useQuery({
    queryKey: ["flows"],
    queryFn: async () => {
      const { data, error } = await supabase.from("flows").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { user } = useAuth();
  const navigate = useNavigate();

  const { mutate: createFlow, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("flows")
        .insert({
          name: "Novo Fluxo",
          trigger_type: "keyword",
          trigger_config: {},
          user_id: user?.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      navigate({ to: "/fluxos/$flowId", params: { flowId: data.id } });
    },
  });

  const { mutate: deleteFlow, isPending: isDeleting } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("flows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
    },
  });

  return (
    <div className="flex-1 overflow-auto bg-[#0b1416] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fluxos de Automação</h1>
          <p className="text-sm text-slate-400">Crie robôs visuais de atendimento</p>
        </div>
        <Button 
          className="bg-emerald-500 text-black hover:bg-emerald-400"
          onClick={() => createFlow()}
          disabled={isCreating}
        >
          <Plus className="mr-2 h-4 w-4" /> {isCreating ? "Criando..." : "Novo Fluxo"}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-slate-400">Carregando fluxos...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {flows?.map((flow) => (
            <div key={flow.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0f1b1e] p-4 transition-colors hover:bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Network className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-200">{flow.name}</h3>
                  <p className="text-sm text-slate-500">{flow.description || "Sem descrição"}</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${flow.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                  {flow.status === 'active' ? 'Ativo' : 'Rascunho'}
                </span>
                
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" asChild className="h-8 text-slate-400 hover:text-emerald-500">
                    <Link to="/fluxos/$flowId" params={{ flowId: flow.id }}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      Editar
                    </Link>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-slate-500 hover:bg-red-500/10 hover:text-red-500"
                    onClick={() => {
                      if(window.confirm('Tem certeza que deseja apagar este fluxo?')) {
                        deleteFlow(flow.id);
                      }
                    }}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {flows?.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 py-16 text-center text-slate-500">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/5 mb-4">
                <Network className="h-6 w-6" />
              </div>
              Nenhum fluxo criado ainda.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
