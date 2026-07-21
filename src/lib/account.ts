import { useEffect, useState } from "react";

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

const KEY = "zapflow.accounts";

export function loadAccounts(): ZapAccount[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function useActiveAccount() {
  const [account, setAccount] = useState<ZapAccount | null>(null);

  useEffect(() => {
    const read = () => {
      const list = loadAccounts();
      setAccount(list.find((a) => a.active) || list[0] || null);
    };
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) read(); };
    window.addEventListener("storage", onStorage);
    const i = setInterval(read, 1500);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(i); };
  }, []);

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
