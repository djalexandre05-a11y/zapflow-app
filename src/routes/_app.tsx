import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  MessageCircle,
  LayoutDashboard,
  Users,
  FileText,
  Megaphone,
  UsersRound,
  Zap,
  Settings,
  Sun,
  Moon,
  PlugZap,
  Radio,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

type NavItem = { to: string; label: string; icon: ReactNode };

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/chat", label: "Chat", icon: <MessageCircle className="h-4 w-4" /> },
  { to: "/conectar", label: "Conectar WhatsApp", icon: <PlugZap className="h-4 w-4" /> },
  { to: "/contatos", label: "Contatos", icon: <Users className="h-4 w-4" /> },
  { to: "/templates", label: "Templates", icon: <FileText className="h-4 w-4" /> },
  { to: "/disparos", label: "Disparos", icon: <Megaphone className="h-4 w-4" /> },
  { to: "/broadcasts", label: "Broadcasts", icon: <Radio className="h-4 w-4" /> },
  { to: "/grupos", label: "Grupos", icon: <UsersRound className="h-4 w-4" /> },
  { to: "/respostas", label: "Respostas", icon: <Zap className="h-4 w-4" /> },
  { to: "/config", label: "Configuração", icon: <Settings className="h-4 w-4" /> },
];

function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const [connected, setConnected] = useState(false);
  const [activeName, setActiveName] = useState<string>("");

  useEffect(() => {
    const check = () => {
      try {
        const list = JSON.parse(localStorage.getItem("zapflow.accounts") || "[]");
        setConnected(Array.isArray(list) && list.length > 0);
        const active = list.find((a: any) => a.active) || list[0];
        setActiveName(active?.name || "");
      } catch { setConnected(false); }
    };
    check();
    window.addEventListener("storage", check);
    const i = setInterval(check, 1500);
    return () => { window.removeEventListener("storage", check); clearInterval(i); };
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0b1416] text-slate-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/5 bg-[#0f1b1e]">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
            <MessageCircle className="h-5 w-5 text-[#0b1416]" />
          </div>
          <div className="text-lg font-bold tracking-tight">ZapFlow</div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2">
          {NAV.map((it) => {
            const active = it.to === "/" ? path === "/" : path.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
              >
                <span className={active ? "text-emerald-400" : "text-slate-500"}>{it.icon}</span>
                <span className="font-medium">{it.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-white/5 px-3 py-3">
          <button
            onClick={toggle}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </button>
          <div className="px-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400 shadow-[0_0_8px_theme(colors.emerald.400)]" : "bg-slate-500"}`} />
              <span className={connected ? "text-slate-300" : "text-slate-500"}>
                {connected ? "Conectado" : "Desconectado"}
              </span>
            </div>
            <div className="mt-1 truncate">{connected ? (activeName || "API ZapFlow") : "Adicione uma API Key"}</div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
