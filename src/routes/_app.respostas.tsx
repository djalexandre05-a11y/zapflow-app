import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Zap, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Card, EmptyState } from "@/components/app-ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

export const Route = createFileRoute("/_app/respostas")({ component: RespostasPage });

type QuickReply = { id: string; trigger: string; response: string };

function RespostasPage() {
  const [items, setItems] = useState<QuickReply[]>([]);
  const [trigger, setTrigger] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const fetchReplies = async () => {
      const { data, error } = await supabase
        .from("user_quick_replies")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (!error && data) {
        setItems(data.map((d) => ({ id: d.id, trigger: d.trigger, response: d.message })));
      }
      setLoading(false);
    };
    fetchReplies();
  }, [user]);

  const add = async () => {
    if (!trigger.trim() || !response.trim() || !user) return;
    
    const { data, error } = await supabase
      .from("user_quick_replies")
      .insert([{ user_id: user.id, trigger, message: response }])
      .select("*")
      .single();

    if (error) {
      toast.error("Erro ao salvar resposta rápida");
      return;
    }

    setItems([{ id: data.id, trigger: data.trigger, response: data.message }, ...items]);
    setTrigger(""); setResponse("");
    toast.success("Resposta rápida salva");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("user_quick_replies").delete().eq("id", id);
    if (!error) {
      setItems(items.filter((x) => x.id !== id));
      toast.success("Removido com sucesso");
    } else {
      toast.error("Erro ao remover");
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Respostas rápidas" subtitle="Atalhos para respostas automáticas no chat" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[380px_1fr]">
          <Card title="Nova resposta">
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase text-slate-400">Atalho (ex: /ola)</Label>
                <Input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="/ola" className="mt-1 border-white/10 bg-[#0b1416]" />
              </div>
              <div>
                <Label className="text-xs uppercase text-slate-400">Resposta</Label>
                <Textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={5} placeholder="Olá! Como posso ajudar?" className="mt-1 border-white/10 bg-[#0b1416]" />
              </div>
              <Button onClick={add} className="w-full bg-emerald-500 text-[#0b1416] hover:bg-emerald-400"><Plus className="mr-2 h-4 w-4" /> Adicionar</Button>
            </div>
          </Card>
          <Card title={`Atalhos (${items.length})`}>
            {loading ? (
              <div className="flex flex-col items-center justify-center p-8 text-sm text-slate-500">
                <Loader2 className="mb-2 h-6 w-6 animate-spin text-slate-400" />
                Carregando...
              </div>
            ) : items.length === 0 ? (
              <EmptyState icon={<Zap className="h-6 w-6" />} title="Nenhuma resposta" description="Crie atalhos como /ola, /obrigado, /precos para responder mais rápido." />
            ) : (
              <ul className="space-y-2">
                {items.map((r) => (
                  <li key={r.id} className="rounded-lg border border-white/5 bg-[#0b1416] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-emerald-400">{r.trigger}</div>
                        <div className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-400">{r.response}</div>
                      </div>
                      <button onClick={() => remove(r.id)} className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
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
