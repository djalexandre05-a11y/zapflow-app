import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Loader2, ShieldCheck, Smartphone, Copy, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/app-ui";
import { connectWhatsAppCredentials } from "@/lib/zernio.functions";
import { useAccounts, type ZapAccount } from "@/lib/account";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

export const Route = createFileRoute("/_app/conectar")({
  component: NumbersPage,
});

type Num = ZapAccount & {
  displayName?: string;
  phone?: string;
  status?: string;
  quality?: string;
  messagingLimit?: string | number;
  phoneNumberId?: string;
};

function NumbersPage() {
  const { accounts: nums, loading } = useAccounts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Num | null>(null);

  const { user } = useAuth();

  const remove = async (id: string) => {
    try {
      if (user) {
        await supabase.from("user_meta_accounts").delete().eq("phone_number_id", id);
      }

      const stored = localStorage.getItem("zapflow.accounts");
      let list = stored ? JSON.parse(stored) : [];
      list = list.filter((a: any) => a.id !== id && a.phoneNumberId !== id);
      localStorage.setItem("zapflow.accounts", JSON.stringify(list));
      window.dispatchEvent(new Event("storage"));
      
      toast.success("Número removido");
    } catch (e) {
      toast.error("Erro ao remover número");
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-8">
      <PageHeader
        title="WhatsApp Business Numbers"
        subtitle="Conecte, registre e verifique números associados à sua conta WhatsApp Business (WABA)."
        right={
          <button
            onClick={() => { setEditing(null); setOpen(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#0b1416] hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" /> Connect WhatsApp Number
          </button>
        }
      />

      <div className="mt-4 overflow-hidden rounded-xl border border-white/5 bg-[#0f1a1c]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3">Display Name</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Quality Rating</th>
              <th className="px-5 py-3">Messaging Limit</th>
              <th className="px-5 py-3">Phone Number ID</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                  <div className="mt-2">Carregando seus números...</div>
                </td>
              </tr>
            ) : nums.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                  Nenhum número conectado ainda. Clique em <span className="text-slate-300">Connect WhatsApp Number</span> para começar.
                </td>
              </tr>
            ) : (
              nums.map((n) => (
              <tr key={n.id} className="text-slate-200">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Smartphone className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="font-semibold text-slate-100">{(n as any).displayName || n.name}</div>
                      {(n as any).phone && <div className="text-xs text-slate-500">{(n as any).phone}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> {(n as any).status || "Active"}
                  </span>
                </td>
                <td className="px-5 py-4 font-medium text-emerald-400">{(n as any).quality || "GREEN"}</td>
                <td className="px-5 py-4">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200">
                    {(n as any).messagingLimit || "250"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0b1416] px-3 py-1.5 text-xs text-slate-300">
                    <span className="font-mono">{n.phoneNumberId || n.id}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(n.phoneNumberId || n.id); toast.success("Copiado"); }}
                      className="text-slate-500 hover:text-slate-200"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => { setEditing(n); setOpen(true); }}
                      className="rounded-md border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(n.id)}
                      className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500/20"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>

      {open && (
        <ConnectModal
          initial={editing}
          onClose={() => setOpen(false)}
          onDone={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function ConnectModal({ initial, onClose, onDone }: { initial: Num | null; onClose: () => void; onDone: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accessToken, setAccessToken] = useState((initial as any)?.accessToken || "");
  const [wabaId, setWabaId] = useState((initial as any)?.wabaId || "");
  const [phoneNumberId, setPhoneNumberId] = useState(initial?.phoneNumberId || "");
  const connect = useServerFn(connectWhatsAppCredentials);

  const mut = useMutation({
    mutationFn: async () => connect({ data: { apiKey: "", profileId: "", accessToken, wabaId, phoneNumberId } }),
    onSuccess: async (res: any) => {
      const acc = res?.account || {};
      const id = initial?.id || acc.id || phoneNumberId;
      
      const newAccount = {
        id,
        name: acc.name || `WhatsApp ${phoneNumberId}`,
        provider: "meta",
        token: accessToken,
        apiKey: accessToken,
        accessToken,
        wabaId,
        phoneNumberId,
        active: true,
      };

      try {
        if (user) {
          // Deactivate others
          await supabase.from("user_meta_accounts").update({ active: false }).eq("user_id", user.id);
          // Insert or update this one
          await supabase.from("user_meta_accounts").upsert({
            user_id: user.id,
            name: newAccount.name,
            phone_number_id: phoneNumberId,
            waba_id: wabaId,
            access_token: accessToken,
            active: true
          }, { onConflict: "user_id, phone_number_id" });
        }

        const stored = localStorage.getItem("zapflow.accounts");
        let list = stored ? JSON.parse(stored) : [];
        list = list.map((a: any) => ({ ...a, active: false })); // deactivate others
        
        // Remove if exists
        list = list.filter((a: any) => a.id !== id && a.phoneNumberId !== phoneNumberId);
        list.push(newAccount);
        
        localStorage.setItem("zapflow.accounts", JSON.stringify(list));
        window.dispatchEvent(new Event("storage"));
        toast.success(`Conectado: ${acc.name || phoneNumberId} — abrindo chat`);
        onDone();
        navigate({ to: "/chat" });
      } catch (err: any) {
        console.error("Erro ao salvar conta:", err);
        toast.error("Erro ao salvar conta.");
      }
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao conectar"),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f1a1c] p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {initial ? "Editar número" : "Conectar WhatsApp Business"}
            </h2>
            <p className="text-xs text-slate-400">Informe as credenciais da Meta — o nome e telefone são detectados sozinhos.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200/80">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
          <div>
            Após conectar, o chat é liberado com <strong>coexistência</strong> — mensagens do app oficial WhatsApp e do ZapFlow ficam sincronizadas.
          </div>
        </div>

        <div className="space-y-3">
          <Field label="Access Token" value={accessToken} set={setAccessToken} ph="EAABsbCS…" type="password" />
          <Field label="WABA ID" value={wabaId} set={setWabaId} ph="123456789012345" />
          <Field label="Phone Number ID" value={phoneNumberId} set={setPhoneNumberId} ph="987654321098765" />
        </div>


        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">
            Cancelar
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !accessToken.trim() || !wabaId.trim() || !phoneNumberId.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#0b1416] hover:bg-emerald-400 disabled:opacity-50"
          >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {initial ? "Salvar" : "Conectar número"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, set, ph, type = "text" }: { label: string; value: string; set: (v: string) => void; ph: string; type?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={ph}
        className="w-full rounded-lg border border-white/10 bg-[#0b1416] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
      />
    </div>
  );
}
