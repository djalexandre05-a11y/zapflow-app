import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "@/components/auth-provider";

export type ZapAccount = {
  id: string;
  name: string;
  profileId?: string;
  apiKey: string;
  active?: boolean;
  provider?: "meta" | "zernio";
  accessToken?: string;
  wabaId?: string;
  phoneNumberId?: string;
};

// Hook to load all accounts for the current user from Supabase
export function useAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<ZapAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    const fetchAccounts = async () => {
      const { data, error } = await supabase
        .from("user_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (!error && data) {
        // Mapear do formato do banco para o ZapAccount do front
        const mapped = data.map((d: any) => ({
          id: d.id,
          name: d.name,
          provider: d.provider,
          apiKey: d.token || "",
          accessToken: d.token || "",
          wabaId: d.waba_id,
          phoneNumberId: d.phone_number_id,
          active: d.active,
        }));
        setAccounts(mapped);
      }
      setLoading(false);
    };

    fetchAccounts();

    // Escutar mudanças no banco para tempo real (opcional)
    const sub = supabase
      .channel("user_accounts_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_accounts", filter: `user_id=eq.${user.id}` }, () => {
        fetchAccounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [user]);

  return { accounts, loading };
}

export function useActiveAccount() {
  const { accounts } = useAccounts();
  const [account, setAccount] = useState<ZapAccount | null>(null);

  useEffect(() => {
    setAccount(accounts.find((a) => a.active) || accounts[0] || null);
  }, [accounts]);

  return account;
}

// Only returns a Zernio-style key (never a Meta access token).
export function useApiKey(): string {
  const a = useActiveAccount();
  if (!a) return "";
  if (a.provider === "meta") return "";
  const k = a.apiKey || "";
  return k.startsWith("sk_") ? k : "";
}

