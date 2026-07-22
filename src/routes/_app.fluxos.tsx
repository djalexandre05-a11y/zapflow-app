import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/fluxos")({
  component: FluxosPage,
});

function FluxosPage() {
  const { data: flows, isLoading } = useQuery({
    queryKey: ["flows"],
    queryFn: async () => {
      const { data, error } = await supabase.from("flows").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="flex-1 overflow-auto bg-[#0b1416] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fluxos de Automação</h1>
          <p className="text-sm text-slate-400">Crie robôs visuais de atendimento</p>
        </div>
        <Button className="bg-emerald-500 text-black hover:bg-emerald-400">
          <Plus className="mr-2 h-4 w-4" /> Novo Fluxo
        </Button>
      </div>

      {isLoading ? (
        <div className="text-slate-400">Carregando fluxos...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flows?.map((flow) => (
            <div key={flow.id} className="rounded-xl border border-white/10 bg-[#0f1b1e] p-5">
              <h3 className="font-semibold text-slate-200">{flow.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{flow.description || "Sem descrição"}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${flow.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>
                  {flow.status === 'active' ? 'Ativo' : 'Rascunho'}
                </span>
                <Link to="/fluxos/$flowId" params={{ flowId: flow.id }} className="text-sm text-emerald-500 hover:underline">
                  Editar
                </Link>
              </div>
            </div>
          ))}
          {flows?.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-white/10 py-12 text-center text-slate-500">
              Nenhum fluxo criado ainda.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
