import { Link } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import type { ReactNode } from "react";
import { useActiveAccount } from "@/lib/account";

export function ApiGate({ children }: { children: (apiKey: string) => ReactNode }) {
  const account = useActiveAccount();
  if (account?.provider === "meta") {
    return (
      <div className="grid flex-1 place-items-center p-10 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <KeyRound className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-100">Número Meta conectado</h3>
          <p className="mt-1 text-sm text-slate-500">
            Você está usando credenciais diretas da Meta ({account.name}). O inbox unificado requer uma API Key ZapFlow —
            adicione uma em Configuração para carregar conversas, templates e disparos.
          </p>
          <Link
            to="/config"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-[#0b1416] hover:bg-emerald-400"
          >
            Ir para Configuração
          </Link>
        </div>
      </div>
    );
  }
  const apiKey = account?.apiKey?.startsWith("sk_") ? account.apiKey : "";
  if (!apiKey) {
    return (
      <div className="grid flex-1 place-items-center p-10 text-center">
        <div>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <KeyRound className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-100">Conecte sua API ZapFlow</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Adicione uma API Key em Configuração para liberar chat, disparos, templates e dashboard.
          </p>
          <Link
            to="/config"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-[#0b1416] hover:bg-emerald-400"
          >
            Ir para Configuração
          </Link>
        </div>
      </div>
    );
  }
  return <>{children(apiKey)}</>;
}
