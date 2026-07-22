import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { FlowEditorShell } from '@/components/flows/flow-editor-shell';
import type { FlowRow, FlowNodeRow } from '@/lib/flows/types';

export const Route = createFileRoute('/_app/fluxos/$flowId')({
  component: FlowEditorPage,
});

function FlowEditorPage() {
  const { flowId } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["flow", flowId],
    queryFn: async () => {
      const { data: flow, error: flowError } = await supabase
        .from("flows")
        .select("*")
        .eq("id", flowId)
        .single();
      
      if (flowError) throw flowError;

      const { data: nodes, error: nodesError } = await supabase
        .from("flow_nodes")
        .select("*")
        .eq("flow_id", flowId);

      if (nodesError) throw nodesError;

      return { flow: flow as FlowRow, nodes: nodes as FlowNodeRow[] };
    },
  });

  if (isLoading) {
    return <div className="flex flex-1 items-center justify-center bg-[#0b1416] p-8 text-slate-400">Carregando fluxo...</div>;
  }

  if (error || !data) {
    return <div className="flex flex-1 items-center justify-center bg-[#0b1416] p-8 text-red-500">Erro ao carregar o fluxo.</div>;
  }

  return <FlowEditorShell initialFlow={data.flow} initialNodes={data.nodes} />;
}
