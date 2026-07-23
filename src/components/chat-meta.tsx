import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Search, MessageCircle, Plus, RefreshCw, Paperclip, Wand2, Mic, Trash2 } from "lucide-react";

import { metaSendText, metaSendTemplate, metaListTemplates, metaSendMedia, metaSendMediaById } from "@/lib/meta.functions";
import { fetchIncomingMessages, deleteIncomingConversation } from "@/lib/incoming.functions";
import { generateDraft } from "@/lib/ai.functions";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-ui";
import type { ZapAccount } from "@/lib/account";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Msg = {
  id: string;
  direction: "incoming" | "outgoing";
  message: string;
  createdAt: string;
};
type Conv = {
  id: string; // phone number sem sinais
  name: string;
  messages: Msg[];
  updatedAt: string;
  unread: number;
};

const storeKey = (phoneNumberId: string) => `zapflow.meta.chats.${phoneNumberId}`;

function loadConvs(phoneNumberId: string): Conv[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(storeKey(phoneNumberId)) || "[]"); } catch { return []; }
}
function saveConvs(phoneNumberId: string, list: Conv[]) {
  localStorage.setItem(storeKey(phoneNumberId), JSON.stringify(list));
}

export function ChatMeta({ account, allAccounts, onSwitchAccount }: { account: ZapAccount; allAccounts?: ZapAccount[]; onSwitchAccount?: (id: string) => void }) {
  const phoneNumberId = account.phoneNumberId!;
  const accessToken = account.accessToken!;
  const wabaId = account.wabaId!;
  const { user } = useAuth();

  const sendTextFn = useServerFn(metaSendText);
  const sendTplFn = useServerFn(metaSendTemplate);
  const listTplFn = useServerFn(metaListTemplates);
  const fetchInFn = useServerFn(fetchIncomingMessages);
  const sendMediaFn = useServerFn(metaSendMedia);
  const sendMediaByIdFn = useServerFn(metaSendMediaById);
  const aiDraftFn = useServerFn(generateDraft);
  const delConvFn = useServerFn(deleteIncomingConversation);

  const [convs, setConvs] = useState<Conv[]>(() => loadConvs(phoneNumberId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [tplPick, setTplPick] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [contacts, setContacts] = useState<{ id: string, name: string, phone: string }[]>([]);
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("user_contacts").select("*").eq("user_id", user.id);
      if (data) setContacts(data);
    };
    load();
  }, [user]);

  useEffect(() => { setConvs(loadConvs(phoneNumberId)); setSelectedId(null); }, [phoneNumberId]);
  useEffect(() => { saveConvs(phoneNumberId, convs); }, [phoneNumberId, convs]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [selectedId, convs]);

  // Poll incoming messages every 5s
  useEffect(() => {
    if (!phoneNumberId) return;
    let alive = true;
    const sinceKey = `zapflow.meta.since.${phoneNumberId}`;
    const tick = async () => {
      try {
        const since = localStorage.getItem(sinceKey) || undefined;
        const res: any = await fetchInFn({ data: { phoneNumberId, sinceIso: since } });
        const rows: Array<{ id: string; from_number: string; from_name: string | null; message_text: string | null; wa_message_id: string; received_at: string }> = res?.messages ?? [];
        if (!alive || rows.length === 0) return;
        setConvs((prev) => {
          const map = new Map(prev.map((c) => [c.id, c] as const));
          for (const r of rows) {
            const phone = r.from_number.replace(/\D/g, "");
            const existing = map.get(phone);
            const isOut = r.wa_message_id.startsWith("OUT_");
            const msg: Msg = {
              id: r.wa_message_id.replace(/^OUT_/, ""),
              direction: isOut ? "outgoing" : "incoming",
              message: r.message_text || "",
              createdAt: r.received_at,
            };
            if (existing) {
              if (existing.messages.some((m) => m.id === msg.id)) continue;
              const isOpen = selectedIdRef.current === phone;
              map.set(phone, {
                ...existing,
                name: existing.name === existing.id ? (r.from_name || existing.name) : existing.name,
                messages: [...existing.messages, msg].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
                updatedAt: r.received_at,
                unread: isOpen ? 0 : (existing.unread || 0) + 1,
              });
            } else {
              const isOpen = selectedIdRef.current === phone;
              map.set(phone, {
                id: phone,
                name: r.from_name || phone,
                messages: [msg],
                updatedAt: r.received_at,
                unread: isOpen ? 0 : 1,
              });
            }
          }
          return Array.from(map.values());
        });
        const last = rows[rows.length - 1].received_at;
        localStorage.setItem(sinceKey, last);
      } catch (e: any) {
        console.error("fetchIncomingMessages error:", e);
        if (e?.message?.includes("fetch")) {
          toast.error("Erro ao carregar mensagens: " + e.message);
        }
      }
    };
    tick();
    const iv = window.setInterval(tick, 5000);
    return () => { alive = false; window.clearInterval(iv); };
  }, [phoneNumberId, fetchInFn]);

  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const tplQ = useQuery({
    queryKey: ["meta-tpl", wabaId],
    queryFn: () => listTplFn({ data: { accessToken, wabaId } }),
    enabled: !!wabaId,
    staleTime: 60_000,
  });
  const templates = useMemo(() => {
    const raw: any = tplQ.data;
    const list: any[] = raw?.data ?? [];
    return list
      .filter((t: any) => String(t.status || "").toUpperCase() === "APPROVED")
      .map((t: any) => {
        const body = t.components?.find((c: any) => c.type === "BODY")?.text || `[template] ${t.name}`;
        return { name: t.name as string, language: t.language as string, body };
      });
  }, [tplQ.data]);

  const selected = convs.find((c) => c.id === selectedId) || null;

  const updateConv = (id: string, patch: (c: Conv) => Conv) => {
    setConvs((prev) => prev.map((c) => (c.id === id ? patch(c) : c)));
  };

  const openConv = (id: string) => {
    setSelectedId(id);
    updateConv(id, (c) => ({ ...c, unread: 0 }));
  };

  const createConv = () => {
    const phone = newPhone.replace(/\D/g, "");
    if (!phone) return toast.error("Informe um número");
    if (convs.some((c) => c.id === phone)) {
      setSelectedId(phone); setNewOpen(false); setNewPhone(""); setNewName(""); return;
    }
    const now = new Date().toISOString();
    setConvs((prev) => [{ id: phone, name: newName || phone, messages: [], updatedAt: now, unread: 0 }, ...prev]);
    setSelectedId(phone);
    setNewOpen(false); setNewPhone(""); setNewName("");
  };

  const startContactConv = (c: { phone: string, name: string }) => {
    const phone = c.phone.replace(/\D/g, "");
    if (!phone) return;
    if (convs.some((conv) => conv.id === phone)) {
      setSelectedId(phone); setNewOpen(false); return;
    }
    const now = new Date().toISOString();
    setConvs((prev) => [{ id: phone, name: c.name || phone, messages: [], updatedAt: now, unread: 0 }, ...prev]);
    setSelectedId(phone);
    setNewOpen(false);
  };

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione uma conversa");
      const text = reply.trim();
      if (!text) throw new Error("Mensagem vazia");
      return sendTextFn({ data: { accessToken, phoneNumberId, to: selected.id, message: text } });
    },
    onSuccess: (res: any) => {
      const now = new Date().toISOString();
      const text = reply.trim();
      const metaId = res?.messages?.[0]?.id || `${Date.now()}`;
      updateConv(selected!.id, (c) => ({
        ...c,
        updatedAt: now,
        messages: [...c.messages, { id: metaId, direction: "outgoing", message: text, createdAt: now }],
      }));
      setReply("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mediaMut = useMutation({
    mutationFn: async (file: File) => {
      if (!selected) throw new Error("Selecione uma conversa");
      const isImage = file.type.startsWith("image/");
      
      // Imagens vão pelo backend (como era antes, onde funcionava perfeitamente).
      // Vídeos vão pelo frontend (para evitar o limite do Vercel).
      if (isImage) {
        const formData = new FormData();
        formData.append("accessToken", accessToken);
        formData.append("phoneNumberId", phoneNumberId);
        formData.append("to", selected.id);
        formData.append("file", file);

        const res: any = await sendMediaFn({ data: formData as any });

        const now = new Date().toISOString();
        const typeStr = res._type ? `[${res._type}]` : "[document]";
        const metaId = res?.messages?.[0]?.id || `${Date.now()}`;
        
        updateConv(selected.id, (c) => ({
          ...c,
          updatedAt: now,
          messages: [...c.messages, { id: metaId, direction: "outgoing", message: `${typeStr}|${res._mediaId}|${file.name}`, createdAt: now }],
        }));
      } else {
        const formData = new FormData();
        formData.append("messaging_product", "whatsapp");
        formData.append("file", file, file.name);

        const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/media`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        });

        const uploadBody = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(`Upload direto falhou: ${uploadBody.error?.message || "Erro desconhecido"}`);
        }

        const mediaId = uploadBody.id;

        let type = "document";
        if (file.type.startsWith("image/")) type = "image";
        if (file.type.startsWith("video/")) type = "video";
        if (file.type.startsWith("audio/")) type = "audio";

        const res: any = await sendMediaByIdFn({ 
          data: { 
            accessToken, 
            phoneNumberId, 
            to: selected.id, 
            mediaId, 
            type, 
            filename: file.name 
          } 
        });

        const now = new Date().toISOString();
        const typeStr = res._type ? `[${res._type}]` : "[document]";
        const metaId = res?.messages?.[0]?.id || `${Date.now()}`;
        
        updateConv(selected.id, (c) => ({
          ...c,
          updatedAt: now,
          messages: [...c.messages, { id: metaId, direction: "outgoing", message: `${typeStr}|${res._mediaId}|${file.name}`, createdAt: now }],
        }));
      }
    },
    onSuccess: () => toast.success("Arquivo enviado"),
    onError: (e: Error) => toast.error(e.message),
  });

  const draftMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione uma conversa");
      let aiSettings;
      try { aiSettings = JSON.parse(localStorage.getItem("zapflow.ai_settings") || "{}"); } catch {}
      
      if (!aiSettings?.openaiKey) {
        throw new Error("Chave da OpenAI não configurada. Acesse Configurações.");
      }

      // Grab last 10 messages for context
      const history = selected.messages.slice(-10).map(m => ({
        role: m.direction, // "incoming" or "outgoing"
        content: m.message
      }));

      return aiDraftFn({ data: { apiKey: aiSettings.openaiKey, systemPrompt: aiSettings.prompt || "", history } });
    },
    onSuccess: (res: any) => {
      setReply(res?.text || "");
      toast.success("Rascunho gerado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delConvMut = useMutation({
    mutationFn: async (phone: string) => {
      await delConvFn({ data: { phoneNumberId, fromNumber: phone } });
      return phone;
    },
    onSuccess: (phone) => {
      setConvs((prev) => prev.filter((c) => c.id !== phone));
      if (selectedId === phone) setSelectedId(null);
      toast.success("Conversa apagada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          // Meta API only accepts specific mime types. WebM is not supported, 
          // so we fake it as mp4 which Meta's transcoder handles fine.
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
          const file = new File([audioBlob], 'audio.mp4', { type: 'audio/mp4' });
          mediaMut.mutate(file);
        }
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error("Erro ao acessar o microfone. Verifique as permissões.");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
      if (timerRef.current) window.clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 16 * 1024 * 1024) {
        toast.error("O tamanho máximo de arquivo é 16MB.");
        return;
      }
      mediaMut.mutate(file);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const tplMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione uma conversa");
      const t = templates.find((x) => x.name === tplPick);
      if (!t) throw new Error("Escolha um template");
      return sendTplFn({ data: { accessToken, phoneNumberId, to: selected.id, templateName: t.name, language: t.language } });
    },
    onSuccess: (res: any) => {
      const now = new Date().toISOString();
      const t = templates.find((x) => x.name === tplPick)!;
      const metaId = res?.messages?.[0]?.id || `${Date.now()}`;
      updateConv(selected!.id, (c) => ({
        ...c,
        updatedAt: now,
        messages: [...c.messages, { id: metaId, direction: "outgoing", message: t.body, createdAt: now }],
      }));
      setTplPick("");
      toast.success("Template enviado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lastIncoming = useMemo(() => {
    if (!selected) return null;
    for (let i = selected.messages.length - 1; i >= 0; i--) {
      if (selected.messages[i].direction === "incoming") return selected.messages[i];
    }
    return null;
  }, [selected]);
  const outOfWindow = !lastIncoming || (Date.now() - new Date(lastIncoming.createdAt).getTime()) > 24 * 3600 * 1000;

  const filtered = convs
    .filter((c) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.id.includes(q);
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Chat"
        subtitle={`WhatsApp · ${account.name}`}
        right={
          <div className="flex items-center gap-3">
            {allAccounts && allAccounts.length > 1 && onSwitchAccount && (
              <Select value={account.id} onValueChange={onSwitchAccount}>
                <SelectTrigger className="h-9 w-[200px] border-white/10 bg-[#0f1a1c] text-xs">
                  <SelectValue placeholder="Selecione o número" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0f1a1c] text-white">
                  {allAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 gap-2 bg-emerald-500 text-[#0b1416] hover:bg-emerald-400">
                  <Plus className="h-4 w-4" /> Nova conversa
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Iniciar conversa</DialogTitle></DialogHeader>
              
              <Tabs defaultValue="manual" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual">Digitar Número</TabsTrigger>
                  <TabsTrigger value="contacts">Meus Contatos</TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Número (com DDI, ex: 5521999998888)</label>
                      <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="5521999998888" className="border-white/10 bg-[#0b1416]" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Nome (opcional)</label>
                      <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="João" className="border-white/10 bg-[#0b1416]" />
                    </div>
                  </div>
                  <Button onClick={createConv} className="mt-2 w-full bg-emerald-500 text-[#0b1416] hover:bg-emerald-400">Iniciar</Button>
                </TabsContent>

                <TabsContent value="contacts" className="pt-4">
                  {contacts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">Nenhum contato salvo ainda.</div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                      {contacts.map(c => (
                        <div key={c.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-[#0f1b1e] p-3 hover:bg-white/5 cursor-pointer" onClick={() => startContactConv(c)}>
                          <div>
                            <div className="text-sm font-semibold text-slate-200">{c.name}</div>
                            <div className="text-xs text-slate-400">{c.phone}</div>
                          </div>
                          <Button variant="ghost" size="sm" className="h-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">Conversar</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr]">
        {/* Lista */}
        <div className="flex min-h-0 flex-col border-r border-white/5 bg-[#0f1b1e]">
          <div className="space-y-2 border-b border-white/5 p-3">
            <div className="flex gap-2">
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Digite o número"
                className="h-9 flex-1 border-white/10 bg-[#0b1416] text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") createConv();
                }}
              />
              <Button onClick={() => createConv()} className="h-9 bg-emerald-500 px-4 font-semibold text-[#0b1416] hover:bg-emerald-400">
                Abrir
              </Button>
              <button
                onClick={() => { localStorage.removeItem(`zapflow.meta.since.${phoneNumberId}`); window.location.reload(); }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded border border-white/10 bg-[#0b1416] text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                title="Recarregar"
              >
                <RefreshCw className={`h-4 w-4 ${tplQ.isFetching ? "animate-spin" : ""}`} />
              </button>
            </div>
            
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="Buscar conversa..." 
                className="h-9 border-white/10 bg-[#0b1416] pl-8 text-sm" 
              />
            </div>

            {contacts.length > 0 && (
              <Select onValueChange={(val) => {
                const c = contacts.find(x => x.id === val);
                if (c) startContactConv(c);
              }}>
                <SelectTrigger className="h-9 border-white/10 bg-[#0b1416] text-sm text-slate-300">
                  <SelectValue placeholder="+ Escolher contato salvo..." />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} · {c.phone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="text-[11px] text-slate-500">
              {filtered.length} conversa(s) ativa(s)
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">Nenhuma conversa. Clique em "Nova conversa" para começar.</div>
            ) : filtered.map((c) => {
              const active = selectedId === c.id;
              const last = c.messages[c.messages.length - 1];
              return (
                <div
                  key={c.id}
                  onClick={() => openConv(c.id)}
                  className={`group flex w-full cursor-pointer items-start gap-3 border-b border-white/5 px-3 py-3 text-left transition ${active ? "bg-emerald-500/10" : "hover:bg-white/5"}`}
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-sm font-bold text-[#0b1416]">
                    {(c.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="truncate text-sm font-semibold text-slate-100">{c.name}</div>
                      <span className="ml-auto shrink-0 text-[10px] text-slate-500">{relTime(c.updatedAt)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <div className="truncate text-xs text-slate-400">
                        <span>{(() => {
                          const msg = last?.message;
                          if (!msg) return "—";
                          if (msg.startsWith("[image]|")) return "📷 Imagem";
                          if (msg.startsWith("[video]|")) return "🎥 Vídeo";
                          if (msg.startsWith("[audio]|")) return "🎵 Áudio";
                          if (msg.startsWith("[document]|")) return "📄 Documento";
                          return msg;
                        })()}</span>
                      </div>
                      {c.unread ? (
                        <Badge className="ml-auto shrink-0 bg-emerald-500 px-1.5 py-0 text-[10px] text-[#0b1416] hover:bg-emerald-500">{c.unread}</Badge>
                      ) : null}
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Deseja apagar definitivamente o histórico desta conversa?")) {
                        delConvMut.mutate(c.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                    title="Apagar conversa"
                  >
                    {delConvMut.isPending && delConvMut.variables === c.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-col bg-[#0b1416]">
          {!selected ? (
            <div className="grid flex-1 place-items-center text-center">
              <div>
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <MessageCircle className="h-8 w-8" />
                </div>
                <p className="mt-4 text-sm text-slate-500">Selecione uma conversa ou crie uma nova.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col min-h-0">
                <div className="flex items-center justify-between border-b border-white/5 bg-[#0f1b1e] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-sm font-bold text-[#0b1416]">
                    {(selected.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{selected.name}</div>
                    <div className="text-xs text-slate-500">+{selected.id}</div>
                  </div>
                </div>
                {outOfWindow && (
                  <Badge className="border border-amber-500/30 bg-amber-500/20 text-amber-300 hover:bg-amber-500/20">
                    Fora da janela 24h — use template
                  </Badge>
                )}
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {selected.messages.length === 0 ? (
                  <div className="text-sm text-slate-500">Sem mensagens ainda. Envie um template para iniciar.</div>
                ) : selected.messages.map((m) => {
                  const mine = m.direction === "outgoing";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-emerald-600/90 text-white" : "bg-[#1a2b2e] text-slate-100"}`}>
                        <div className="whitespace-pre-wrap break-words">
                          {/^(?:\[image\]|\[video\]|\[audio\]|\[document\])\|/.test(m.message) ? (
                            <MediaMessage text={m.message} accessToken={accessToken} />
                          ) : (
                            <span>{m.message}</span>
                          )}
                        </div>
                        <div className={`mt-1 text-right text-[10px] ${mine ? "text-emerald-50/70" : "text-slate-500"}`}>
                          {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
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
                            <SelectItem key={`${t.name}-${t.language}`} value={t.name}>{t.name} ({t.language})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => tplMut.mutate()} disabled={tplMut.isPending || !tplPick} className="h-11 bg-emerald-500 px-5 text-[#0b1416] hover:bg-emerald-400">
                      {tplMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col w-full">
                    {isRecording ? (
                      <div className="flex w-full items-center gap-2">
                        <Button onClick={cancelRecording} variant="ghost" className="h-[52px] border border-white/10 px-4 text-rose-500 hover:bg-rose-500/10 hover:text-rose-400">
                          <Trash2 className="h-5 w-5" />
                        </Button>
                        <div className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-md border border-white/10 bg-[#0b1416] text-emerald-500">
                          <span className="relative flex h-3 w-3">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
                          </span>
                          <span className="font-mono text-sm">{formatTime(recordingTime)}</span>
                        </div>
                        <Button onClick={stopRecording} className="h-[52px] bg-emerald-500 px-5 text-[#0b1416] hover:bg-emerald-400">
                          <Send className="h-5 w-5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button onClick={() => draftMut.mutate()} disabled={draftMut.isPending || !selected} className="border border-indigo-500/30 bg-indigo-500/10 px-3 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300" title="Rascunho Mágico com IA">
                          {draftMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        </Button>
                        <input
                          type="file"
                          ref={fileRef}
                          className="hidden"
                          onChange={handleFileChange}
                          accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mp3,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                        />
                        <Button onClick={() => fileRef.current?.click()} disabled={mediaMut.isPending} className="border border-white/10 bg-[#0b1416] px-3 text-slate-400 hover:bg-white/5 hover:text-white" title="Anexar arquivo">
                          {mediaMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                        </Button>
                        <Textarea
                          rows={2}
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="Escreva uma resposta…"
                          className="min-h-[52px] border-white/10 bg-[#0b1416]"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (reply.trim()) sendMut.mutate();
                            }
                          }}
                        />
                        {reply.trim() ? (
                          <Button onClick={() => sendMut.mutate()} disabled={sendMut.isPending} className="bg-emerald-500 px-4 text-[#0b1416] hover:bg-emerald-400">
                            {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        ) : (
                          <Button onClick={startRecording} className="bg-emerald-500 px-4 text-[#0b1416] hover:bg-emerald-400">
                            <Mic className="h-5 w-5" />
                          </Button>
                        )}
                      </div>
                    )}
                    {!isRecording && <div className="mt-1 text-[10px] text-slate-500">Enter para enviar, Shift + Enter para quebrar linha</div>}
                  </div>
                )}
              </div>
            </div>
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

function MediaMessage({ text, accessToken }: { text: string; accessToken: string }) {
  const [loading, setLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const parts = text.split("|");
  const typeStr = parts[0];
  const mediaId = parts[1];
  const caption = parts.slice(2).join("|");
  const type = typeStr.replace(/\[|\]/g, "");

  useEffect(() => {
    if (!mediaId) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (!data.url) throw new Error("URL de mídia não encontrada");

        const fileRes = await fetch(data.url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!fileRes.ok) throw new Error("Erro ao baixar o arquivo");
        const blob = await fileRes.blob();

        if (!alive) return;
        setBlobUrl(URL.createObjectURL(blob));
      } catch (err: any) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [mediaId, accessToken]);

  if (!mediaId) return <div>{text}</div>;

  return (
    <div className="flex flex-col gap-2">
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Baixando...
        </div>
      ) : error ? (
        <div className="text-red-400 text-xs">Erro: {error}</div>
      ) : blobUrl ? (
        <div className="max-w-[240px]">
          {type === "image" && <img src={blobUrl} alt={caption} className="max-w-full rounded-lg" />}
          {type === "video" && <video src={blobUrl} controls className="max-w-full rounded-lg" />}
          {type === "audio" && <audio src={blobUrl} controls className="max-w-full" />}
          {type === "document" && (
            <a href={blobUrl} download={caption || "documento"} className="flex items-center gap-2 text-emerald-400 underline">
              <Paperclip className="h-4 w-4" /> {caption || "Baixar documento"}
            </a>
          )}
        </div>
      ) : null}
      {caption && <div className="mt-1 text-sm">{caption}</div>}
    </div>
  );
}
