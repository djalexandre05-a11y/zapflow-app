import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Loader2, Send, CheckCheck, Search, MessageCircle } from "lucide-react";

import {
  listAccounts,
  listProfiles,
  listConversations,
  listConversationMessages,
  sendConversationMessage,
  sendConversationTemplate,
  markConversationRead,
  listWhatsAppTemplates,
} from "@/lib/zernio.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-ui";
import { ApiGate } from "@/components/api-gate";
import { ChatMeta } from "@/components/chat-meta";
import { useActiveAccount } from "@/lib/account";


export const Route = createFileRoute("/_app/chat")({
  component: ChatRoute,
});

function ChatRoute() {
  const account = useActiveAccount();
  if (account?.provider === "meta") return <ChatMeta account={account} />;
  return <ApiGate>{(apiKey) => <ChatPage apiKey={apiKey} />}</ApiGate>;
}

type Profile = { _id: string; name: string };
type Account = { _id: string; profileId: string; platform: string; username?: string; displayName?: string };
type Conversation = {
  id: string;
  platform?: string;
  accountId: string;
  accountUsername?: string;
  participantId?: string;
  participantName?: string;
  participantPicture?: string | null;
  lastMessage?: string;
  updatedTime?: string;
  unreadCount?: number | null;
};
type ConvMessage = {
  id: string;
  message?: string;
  createdAt?: string;
  direction?: "incoming" | "outgoing";
  attachments?: Array<{ id: string; type: string; url: string }>;
};
type WATemplate = { id?: string; name: string; language: string; status?: string; category?: string };


function ChatPage({ apiKey }: { apiKey: string }) {
  const profilesFn = useServerFn(listProfiles);
  const accountsFn = useServerFn(listAccounts);
  const listConvsFn = useServerFn(listConversations);
  const listMsgsFn = useServerFn(listConversationMessages);
  const sendMsgFn = useServerFn(sendConversationMessage);
  const sendTplFn = useServerFn(sendConversationTemplate);
  const readFn = useServerFn(markConversationRead);
  const templatesFn = useServerFn(listWhatsAppTemplates);


  const profilesQ = useQuery({ queryKey: ["z", "profiles", apiKey], queryFn: () => profilesFn({ data: { apiKey } }) });
  const accountsQ = useQuery({ queryKey: ["z", "accounts", apiKey], queryFn: () => accountsFn({ data: { apiKey } }) });
  const profiles: Profile[] = (profilesQ.data as { profiles?: Profile[] } | undefined)?.profiles ?? [];
  const accounts: Account[] = (accountsQ.data as { accounts?: Account[] } | undefined)?.accounts ?? [];

  const [profileId, setProfileId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [selected, setSelected] = useState<{ id: string; accountId: string } | null>(null);
  const [reply, setReply] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "unread">("newest");

  // auto-select first profile
  useMemo(() => {
    if (!profileId && profiles.length > 0) setProfileId(profiles[0]._id);
  }, [profiles, profileId]);

  const profileAccounts = useMemo(
    () => accounts.filter((a) => !profileId || a.profileId === profileId),
    [accounts, profileId],
  );

  const convsQ = useQuery({
    queryKey: ["z", "convs", profileId, accountId],
    queryFn: () =>
      listConvsFn({
        data: { apiKey,
          profileId: profileId || undefined,
          accountId: accountId || undefined,
          sortOrder: "desc",
          limit: 100,
        },
      }),
    enabled: !!profileId,
    refetchInterval: 15000,
  });
  const conversations: Conversation[] = (convsQ.data as { data?: Conversation[] } | undefined)?.data ?? [];

  const msgsQ = useQuery({
    queryKey: ["z", "msgs", selected?.id, selected?.accountId],
    queryFn: () => listMsgsFn({ data: { apiKey, conversationId: selected!.id, accountId: selected!.accountId } }),
    enabled: !!selected,
    refetchInterval: 8000,
  });
  const messages: ConvMessage[] = (msgsQ.data as { messages?: ConvMessage[] } | undefined)?.messages ?? [];

  const sendMut = useMutation({
    mutationFn: () =>
      sendMsgFn({ data: { apiKey, conversationId: selected!.id, accountId: selected!.accountId, message: reply } }),
    onSuccess: () => {
      setReply("");
      msgsQ.refetch();
      convsQ.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const readMut = useMutation({
    mutationFn: () => readFn({ data: { apiKey, conversationId: selected!.id, accountId: selected!.accountId } }),
    onSuccess: () => convsQ.refetch(),
    onError: (e: Error) => toast.error(e.message),
  });

  // ===== template send (fora janela 24h) =====
  const activeConv = conversations.find((c) => c.id === selected?.id);
  const isWhatsApp = (activeConv?.platform || "").toLowerCase() === "whatsapp";

  const tplQ = useQuery({
    queryKey: ["z", "wa-tpl", selected?.accountId],
    queryFn: () => templatesFn({ data: { apiKey, accountId: selected!.accountId } }),
    enabled: !!selected && isWhatsApp,
  });
  const templates: WATemplate[] = useMemo(() => {
    const raw: any = tplQ.data;
    const list: any[] = raw?.data ?? raw?.templates ?? raw?.items ?? (Array.isArray(raw) ? raw : []);
    return list
      .map((t) => ({ id: t.id ?? t._id, name: t.name, language: t.language ?? t.languageCode ?? "pt_BR", status: t.status, category: t.category }))
      .filter((t) => t.name && (!t.status || String(t.status).toUpperCase() === "APPROVED"));
  }, [tplQ.data]);

  const lastIncoming = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].direction === "incoming" && messages[i].createdAt) return messages[i];
    }
    return null;
  }, [messages]);
  const outOfWindow = isWhatsApp && (!lastIncoming || (Date.now() - new Date(lastIncoming.createdAt!).getTime()) > 24 * 3600 * 1000);

  const [tplPick, setTplPick] = useState("");
  const tplMut = useMutation({
    mutationFn: () => {
      const t = templates.find((x) => x.name === tplPick);
      if (!t) throw new Error("Escolha um template");
      return sendTplFn({
        data: { apiKey,
          conversationId: selected!.id,
          accountId: selected!.accountId,
          templateName: t.name,
          language: t.language,
        },
      });
    },
    onSuccess: () => {
      setTplPick("");
      msgsQ.refetch();
      convsQ.refetch();
      toast.success("Template enviado");
    },
    onError: (e: Error) => toast.error(e.message),
  });



  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Chat"
        subtitle="Inbox WhatsApp"
        right={
          <div className="flex items-center gap-2">
            <div className="w-44">
              <Select value={profileId} onValueChange={(v) => { setProfileId(v); setAccountId(""); setSelected(null); }}>
                <SelectTrigger className="h-9 border-white/10 bg-[#0b1416]"><SelectValue placeholder="Perfil" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-52">
              <Select value={accountId || "all"} onValueChange={(v) => { setAccountId(v === "all" ? "" : v); setSelected(null); }} disabled={!profileId}>
                <SelectTrigger className="h-9 border-white/10 bg-[#0b1416]"><SelectValue placeholder="Todas as contas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {profileAccounts.map((a) => (
                    <SelectItem key={a._id} value={a._id}>{a.platform} · {a.displayName || a.username || a._id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr]">
        {/* Conversation list */}
        <div className="flex min-h-0 flex-col border-r border-white/5 bg-[#0f1b1e]">
          <div className="space-y-2 border-b border-white/5 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar conversa…"
                className="h-9 border-white/10 bg-[#0b1416] pl-8 text-sm"
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{convsQ.data ? `${conversations.length} conversas` : ""}</span>
              <div className="flex items-center gap-1.5">
                <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                  <SelectTrigger className="h-7 border-white/10 bg-[#0b1416] px-2 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Recentes</SelectItem>
                    <SelectItem value="oldest">Antigas</SelectItem>
                    <SelectItem value="unread">Não lidas</SelectItem>
                  </SelectContent>
                </Select>
                <button onClick={() => convsQ.refetch()} className="rounded p-1 text-slate-400 hover:bg-white/5">
                  <RefreshCw className={`h-3.5 w-3.5 ${convsQ.isFetching ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {convsQ.isLoading ? (
              <div className="p-4 text-sm text-slate-500">Carregando…</div>
            ) : (() => {
              const filtered = conversations
                .filter((c) => {
                  if (!search.trim()) return true;
                  const q = search.toLowerCase();
                  return (
                    (c.participantName || "").toLowerCase().includes(q) ||
                    (c.participantId || "").toLowerCase().includes(q) ||
                    (c.lastMessage || "").toLowerCase().includes(q)
                  );
                })
                .sort((a, b) => {
                  if (sort === "unread") return (b.unreadCount || 0) - (a.unreadCount || 0);
                  const ta = new Date(a.updatedTime || 0).getTime();
                  const tb = new Date(b.updatedTime || 0).getTime();
                  return sort === "newest" ? tb - ta : ta - tb;
                });
              if (filtered.length === 0) return <div className="p-4 text-sm text-slate-500">Nenhuma conversa.</div>;
              return filtered.map((c) => {
                const label = c.participantName || c.participantId || "(sem nome)";
                const active = selected?.id === c.id;
                const initial = label.trim().charAt(0).toUpperCase() || "?";
                const via = c.accountUsername || accounts.find((a) => a._id === c.accountId)?.username;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelected({ id: c.id, accountId: c.accountId })}
                    className={`flex w-full items-start gap-3 border-b border-white/5 px-3 py-3 text-left transition ${
                      active ? "bg-emerald-500/10" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="relative shrink-0">
                      {c.participantPicture ? (
                        <img src={c.participantPicture} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500 text-sm font-bold text-[#0b1416]">
                          {initial}
                        </div>
                      )}
                      {c.platform && (
                        <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border border-[#0f1b1e] bg-emerald-400 text-[8px] font-bold uppercase text-[#0b1416]">
                          {c.platform.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className="truncate text-sm font-semibold text-slate-100">{label}</div>
                        {via && <span className="shrink-0 truncate text-[11px] text-slate-500">· via {via}</span>}
                        <span className="ml-auto shrink-0 text-[10px] text-slate-500">{c.updatedTime ? relTime(c.updatedTime) : ""}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <div className="truncate text-xs text-slate-400">{c.lastMessage || "—"}</div>
                        {c.unreadCount ? (
                          <Badge className="ml-auto shrink-0 bg-emerald-500 px-1.5 py-0 text-[10px] text-[#0b1416] hover:bg-emerald-500">{c.unreadCount}</Badge>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              });
            })()}
          </div>
        </div>

        {/* Thread */}
        <div className="flex min-h-0 flex-col bg-[#0b1416]">
          {!selected ? (
            <div className="grid flex-1 place-items-center text-center">
              <div>
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <MessageCircle className="h-8 w-8" />
                </div>
                <p className="mt-4 text-sm text-slate-500">Selecione uma conversa para abrir.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-white/5 bg-[#0f1b1e] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-sm font-bold text-[#0b1416]">
                    {(activeConv?.participantName || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{activeConv?.participantName || "Conversa"}</div>
                    <div className="text-xs text-slate-500">{activeConv?.participantId || ""}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {outOfWindow && (
                    <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20">
                      Fora da janela 24h — use template
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 text-xs text-slate-400 hover:text-slate-100"
                    onClick={() => readMut.mutate()}
                    disabled={readMut.isPending}
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Marcar lida
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {msgsQ.isLoading ? (
                  <div className="text-sm text-slate-500">Carregando mensagens…</div>
                ) : messages.length === 0 ? (
                  <div className="text-sm text-slate-500">Sem mensagens ainda.</div>
                ) : messages.map((m) => {
                  const mine = m.direction === "outgoing";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-emerald-600/90 text-white" : "bg-[#1a2b2e] text-slate-100"}`}>
                        <div className="whitespace-pre-wrap break-words">{m.message || <span className="opacity-60">(sem texto)</span>}</div>
                        {m.attachments?.map((a) => (
                          <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="mt-1 block text-xs underline opacity-80">
                            {a.type} anexo
                          </a>
                        ))}
                        {m.createdAt && (
                          <div className={`mt-1 text-right text-[10px] ${mine ? "text-emerald-50/70" : "text-slate-500"}`}>
                            {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-white/5 bg-[#0f1b1e] p-3">
                {outOfWindow ? (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select value={tplPick} onValueChange={setTplPick}>
                        <SelectTrigger className="h-11 border-white/10 bg-[#0b1416]">
                          <SelectValue placeholder={tplQ.isLoading ? "Carregando templates…" : templates.length ? "-- template --" : "Nenhum template aprovado"} />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={`${t.name}-${t.language}`} value={t.name}>
                              {t.name} ({t.language})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => tplMut.mutate()}
                      disabled={tplMut.isPending || !tplPick}
                      className="h-11 bg-emerald-500 px-5 text-[#0b1416] hover:bg-emerald-400"
                    >
                      {tplMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Textarea
                        rows={2}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Escreva uma resposta…"
                        className="min-h-[52px] border-white/10 bg-[#0b1416]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && reply.trim()) {
                            e.preventDefault();
                            sendMut.mutate();
                          }
                        }}
                      />
                      <Button
                        onClick={() => sendMut.mutate()}
                        disabled={sendMut.isPending || !reply.trim()}
                        className="bg-emerald-500 px-4 text-[#0b1416] hover:bg-emerald-400"
                      >
                        {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">Ctrl/⌘ + Enter para enviar</div>
                  </>
                )}
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
