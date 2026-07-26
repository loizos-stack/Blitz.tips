import type { ReactNode } from "react";

// Shared shell for policy / long-form content pages, so About, FAQ, Terms,
// Privacy and Refunds all read as one consistent document style.
export function LegalShell({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro?: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">{title}</h1>
        {updated && <p className="mt-2 text-sm text-muted">Last updated: {updated}</p>}
        {intro && <p className="mt-5 text-muted">{intro}</p>}
        <div className="mt-10 space-y-9">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="ml-5 list-disc space-y-1.5 text-sm leading-relaxed text-muted">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
