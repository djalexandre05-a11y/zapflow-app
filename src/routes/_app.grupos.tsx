import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { UsersRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Card, EmptyState } from "@/components/app-ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/grupos")({ component: GruposPage });

type Group = { id: string; name: string; numbers: string[] };
const KEY = "zapflow.groups";

function GruposPage() {
  const [items, setItems] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [numbers, setNumbers] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { setItems(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { setItems([]); }
  }, []);

  const persist = (next: Group[]) => { setItems(next); localStorage.setItem(KEY, JSON.stringify(next)); };

  const add = () => {
    const nums = numbers.split(/[\s,;\n]+/).map((n) => n.trim()).filter(Boolean);
    if (!name.trim() || nums.length === 0) return;
    persist([{ id: crypto.randomUUID(), name, numbers: nums }, ...items]);
    setName(""); setNumbers("");
    toast.success("Grupo criado");
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Grupos" subtitle="Organize seus contatos em listas para disparos" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[380px_1fr]">
          <Card title="Novo grupo">
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase text-slate-400">Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Clientes VIP" className="mt-1 border-white/10 bg-[#0b1416]" />
              </div>
              <div>
                <Label className="text-xs uppercase text-slate-400">Números (um por linha)</Label>
                <Textarea value={numbers} onChange={(e) => setNumbers(e.target.value)} rows={7} placeholder="5511999999999" className="mt-1 border-white/10 bg-[#0b1416]" />
              </div>
              <Button onClick={add} className="w-full bg-emerald-500 text-[#0b1416] hover:bg-emerald-400"><Plus className="mr-2 h-4 w-4" /> Criar grupo</Button>
            </div>
          </Card>

          <Card title={`Meus grupos (${items.length})`}>
            {items.length === 0 ? (
              <EmptyState icon={<UsersRound className="h-6 w-6" />} title="Sem grupos" description="Crie grupos para disparar mensagens em massa para listas segmentadas." />
            ) : (
              <ul className="space-y-2">
                {items.map((g) => (
                  <li key={g.id} className="rounded-lg border border-white/5 bg-[#0b1416] p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{g.name}</div>
                        <div className="text-xs text-slate-500">{g.numbers.length} contato(s)</div>
                      </div>
                      <button onClick={() => persist(items.filter((x) => x.id !== g.id))} className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
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
