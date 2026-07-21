import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between border-b border-white/5 bg-[#0f1b1e] px-6 py-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

const ACCENTS: Record<string, string> = {
  emerald: "text-emerald-400 bg-emerald-500/10",
  sky: "text-sky-400 bg-sky-500/10",
  violet: "text-violet-400 bg-violet-500/10",
  amber: "text-amber-400 bg-amber-500/10",
};

export function StatCard({ label, value, icon, accent = "emerald" }: { label: string; value: ReactNode; icon: ReactNode; accent?: keyof typeof ACCENTS | string }) {
  const a = ACCENTS[accent] ?? ACCENTS.emerald;
  return (
    <div className="rounded-xl border border-white/5 bg-[#0f1b1e] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${a}`}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-100">{value}</div>
    </div>
  );
}

export function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/5 bg-[#0f1b1e] p-4">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-sm font-semibold text-slate-200">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="grid flex-1 place-items-center p-10 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400">
          {icon}
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-100">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}
