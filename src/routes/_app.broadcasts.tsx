import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-ui";
import { DisparosMeta } from "@/components/disparos-meta";
import { useActiveAccount } from "@/lib/account";

export const Route = createFileRoute("/_app/broadcasts")({
  component: BroadcastsRoute,
});

function BroadcastsRoute() {
  const account = useActiveAccount();

  // Se estiver conectado via Meta, exibe a interface de disparo da Meta (DisparosMeta)
  if (account?.provider === "meta") {
    return <DisparosMeta account={account} />;
  }

  // Se não for Meta, exibe um aviso pedindo para conectar
  return (
    <div className="flex h-full flex-col">
      <PageHeader 
        title="Broadcasts" 
        subtitle="Envio em massa oficial via WhatsApp Business API (Meta)." 
      />
      <div className="flex-1 p-6">
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-6 shadow-xl text-yellow-200">
          <h2 className="text-lg font-semibold mb-2">Conexão Meta Necessária</h2>
          <p className="text-yellow-200/80">
            Para fazer envios por aqui (Broadcasts), você precisa estar conectado a uma conta oficial WABA (Meta).
            Vá até a aba "Conectar WhatsApp" e adicione sua conta Meta.
          </p>
        </div>
      </div>
    </div>
  );
}
