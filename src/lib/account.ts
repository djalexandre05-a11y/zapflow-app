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
  const [accounts, setAccounts] = useState<ZapAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        let dbAccounts: ZapAccount[] = [];
        
        if (user) {
          const { data, error } = await supabase
            .from("user_meta_accounts")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
            
          if (!error && data && data.length > 0) {
            dbAccounts = data.map((d: any) => ({
              id: d.id,
              name: d.name,
              provider: "meta",
              apiKey: "",
              active: d.active,
              accessToken: d.access_token,
              wabaId: d.waba_id,
              phoneNumberId: d.phone_number_id,
            }));
          }
        }

        const stored = localStorage.getItem("zapflow.accounts");
        let localAccounts: ZapAccount[] = [];
        if (stored) {
          localAccounts = JSON.parse(stored);
        }

        const zernioAccounts = localAccounts.filter((a) => a.provider === "zernio");
        const metaLocalAccounts = localAccounts.filter((a) => a.provider !== "zernio");

        // Hybrid approach: prefer DB accounts, fallback to localStorage if DB is empty for Meta
        if (dbAccounts.length > 0) {
          setAccounts([...dbAccounts, ...zernioAccounts]);
        } else {
          setAccounts([...metaLocalAccounts, ...zernioAccounts]);
        }
      } catch (err) {
        console.error("Failed to fetch accounts", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
    window.addEventListener("storage", fetchAccounts);
    return () => window.removeEventListener("storage", fetchAccounts);
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

