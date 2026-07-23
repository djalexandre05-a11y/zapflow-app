import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate({ to: "/" });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha todos os campos");
      return;
    }
    
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      toast.error("Credenciais inválidas ou erro no servidor");
    } else if (data.user) {
      const token = crypto.randomUUID();
      await supabase.from('user_sessions').upsert({ user_id: data.user.id, session_token: token });
      localStorage.setItem('zapflow.session', token);

      toast.success("Login efetuado com sucesso!");
      navigate({ to: "/" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1416] px-4 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-white/5 bg-[#0f1b1e] p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
            <MessageCircle className="h-6 w-6 text-[#0b1416]" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">ZapFlow</h1>
          <p className="mt-2 text-sm text-slate-400">Entre com sua conta para continuar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">E-mail</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="h-11 border-white/10 bg-[#0b1416] text-slate-100"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Senha</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 border-white/10 bg-[#0b1416] text-slate-100"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-2 h-11 w-full bg-emerald-500 text-base font-semibold text-[#0b1416] transition-colors hover:bg-emerald-400"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar no sistema"}
          </Button>
        </form>
      </div>
    </div>
  );
}
