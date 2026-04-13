import { Database, ShieldCheck, Table2, TerminalSquare } from "lucide-react";

const modules = [
  { name: "Server Management", icon: Database },
  { name: "Explorer", icon: Table2 },
  { name: "SQL Runner", icon: TerminalSquare },
  { name: "Roles & Backup", icon: ShieldCheck },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col p-8">
      <h1 className="text-3xl font-semibold tracking-tight">EasyPostgre Console</h1>
      <p className="mt-2 text-slate-400">Next.js App Router baseline with feature-oriented architecture.</p>
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {modules.map(({ name, icon: Icon }) => (
          <article key={name} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <Icon className="mb-3 h-5 w-5 text-cyan-400" />
            <h2 className="font-medium">{name}</h2>
          </article>
        ))}
      </section>
    </main>
  );
}
