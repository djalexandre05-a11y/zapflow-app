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

  useEffect(() => {
    const fetchAccounts = () => {
      try {
        const stored = localStorage.getItem("zapflow.accounts");
        if (stored) {
          setAccounts(JSON.parse(stored));
        } else {
          setAccounts([]);
        }
      } catch (err) {
        console.error("Failed to parse accounts", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
    window.addEventListener("storage", fetchAccounts);
    return () => window.removeEventListener("storage", fetchAccounts);
  }, []);

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

