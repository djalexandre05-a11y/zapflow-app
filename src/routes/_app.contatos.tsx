import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Send } from "lucide-react";
import { PageHeader } from "@/components/app-ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/contatos")({ component: ContatosPage });

type Contact = { id: string; name: string; phone: string; tags: string[] };
const KEY = "zapflow.contacts";

function ContatosPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [tags, setTags] = useState("");
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { setItems(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { setItems([]); }
  }, []);

  const persist = (next: Contact[]) => {
    setItems(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const add = () => {
    const digits = phone.replace(/\D/g, "");
    if (!digits) { toast.error("Informe um número válido"); return; }
    const c: Contact = {
      id: crypto.randomUUID(),
      name: name.trim() || digits,
      phone: digits,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    persist([c, ...items]);
    setName(""); setPhone(""); setTags("");
    toast.success("Contato adicionado");
  };

  const remove = (id: string) => persist(items.filter((c) => c.id !== id));

  const importCsv = async (file: File) => {
    try {
      const text = (await file.text()).replace(/^\uFEFF/, "");
      const rows = parseCSV(text);
      if (!rows.length) { toast.error("CSV vazio"); return; }

      // Detecta separador (Google usa vírgula, planilhas BR usam ;)
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const findCol = (patterns: RegExp[]) => header.findIndex((h) => patterns.some((p) => p.test(h)));

      const nameIdx = findCol([/^name$/, /full ?name/, /nome completo/, /^nome$/, /first name/, /display name/]);
      const firstIdx = findCol([/^first ?name$/, /given name/, /primeiro nome/]);
      const lastIdx = findCol([/^last ?name$/, /family name/, /sobrenome/]);
      const phoneCols: number[] = [];
      header.forEach((h, i) => {
        if (/(phone|telefone|celular|whatsapp|mobile|número|numero|tel\b)/.test(h) && !/type|label|tipo/.test(h)) {
          phoneCols.push(i);
        }
      });
      const tagIdx = findCol([/labels?/, /tags?/, /grupos?/, /categoria/, /group membership/]);

      const hasHeader = nameIdx >= 0 || firstIdx >= 0 || phoneCols.length > 0;
      const dataRows = hasHeader ? rows.slice(1) : rows;

      const parsed: Contact[] = [];
      const seen = new Set<string>();
      for (const cells of dataRows) {
        if (!cells || cells.every((c) => !c?.trim())) continue;

        // Nome
        let nm = "";
        if (nameIdx >= 0) nm = (cells[nameIdx] || "").trim();
        if (!nm && (firstIdx >= 0 || lastIdx >= 0)) {
          nm = [cells[firstIdx] || "", cells[lastIdx] || ""].join(" ").trim();
        }
        if (!nm && !hasHeader) nm = (cells[0] || "").trim();

        // Telefone: tenta colunas mapeadas; senão qualquer célula com dígitos
        let digits = "";
        for (const i of phoneCols) {
          const raw = (cells[i] || "").split(/[:;/|]/)[0];
          const d = raw.replace(/\D/g, "");
          if (d.length >= 8) { digits = d; break; }
        }
        if (!digits) {
          for (const c of cells) {
            const d = (c || "").replace(/\D/g, "");
            if (d.length >= 10 && d.length <= 15) { digits = d; break; }
          }
        }
        if (!digits) continue;
        if (seen.has(digits)) continue;
        seen.add(digits);

        const tagsRaw = tagIdx >= 0 ? (cells[tagIdx] || "") : "";
        parsed.push({
          id: crypto.randomUUID(),
          name: nm || digits,
          phone: digits,
          tags: tagsRaw.split(/[|,;/]/).map((t) => t.trim()).filter(Boolean),
        });
      }

      if (!parsed.length) { toast.error("Nenhum contato encontrado no CSV"); return; }
      persist([...parsed, ...items]);
      toast.success(`${parsed.length} contato(s) importado(s)`);
    } catch (e) {
      toast.error("Falha ao ler CSV: " + (e as Error).message);
}

// Parser CSV com suporte a aspas e quebras de linha dentro de campos
function parseCSV(text: string): string[][] {
  // detecta separador
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === sep) { cur.push(field); field = ""; }
      else if (ch === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

  };


  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const s = q.toLowerCase();
    return items.filter((c) =>
      c.name.toLowerCase().includes(s) ||
      c.phone.includes(s) ||
      c.tags.some((t) => t.toLowerCase().includes(s)),
    );
  }, [items, q]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Contatos" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          {/* Top actions */}
          <div className="flex items-center justify-end gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100"
            >
              <FileText className="h-4 w-4" /> Importar CSV
            </button>
            <a
              href="https://contacts.google.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
            >
              Abrir Google Contatos
            </a>
          </div>

          {/* Novo contato */}
          <section className="rounded-xl border border-white/5 bg-[#0f1b1e] p-5">
            <h2 className="mb-4 text-base font-bold text-slate-100">Novo contato</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome"
                className="h-11 border-white/10 bg-[#0b1416]"
              />
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="5511999999999"
                className="h-11 border-white/10 bg-[#0b1416]"
              />
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tags separadas por vírgula"
                className="h-11 border-white/10 bg-[#0b1416]"
              />
              <Button onClick={add} className="h-11 bg-emerald-500 px-6 text-[#0b1416] hover:bg-emerald-400">
                Adicionar
              </Button>
            </div>
          </section>

          {/* Search */}
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, número ou tag…"
            className="h-12 border-white/10 bg-[#0f1b1e] text-sm"
          />

          {/* Table */}
          <div className="overflow-hidden rounded-xl">
            <div className="grid grid-cols-[2fr_1.5fr_1.5fr_180px] gap-4 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <div>Nome</div>
              <div>Número</div>
              <div>Tags</div>
              <div />
            </div>
            {filtered.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                Nenhum contato. Adicione acima ou importe um CSV.
              </div>
            ) : (
              filtered.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[2fr_1.5fr_1.5fr_180px] items-center gap-4 border-t border-white/5 px-4 py-4 text-sm"
                >
                  <div className="truncate font-medium text-slate-100">{c.name}</div>
                  <div className="truncate text-sky-400">{c.phone}</div>
                  <div className="flex flex-wrap gap-1">
                    {c.tags.length === 0 ? (
                      <span className="text-slate-600">—</span>
                    ) : (
                      c.tags.map((t) => (
                        <span key={t} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
                          {t}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-5 text-sm">
                    <button
                      onClick={() => nav({ to: "/disparos" })}
                      className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                    >
                      <Send className="h-3.5 w-3.5" /> Enviar
                    </button>
                    <button onClick={() => remove(c.id)} className="text-rose-400 hover:text-rose-300">
                      Excluir
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
