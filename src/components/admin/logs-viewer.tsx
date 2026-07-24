"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

interface LogRow {
  id: string;
  createdAt: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string | null;
}

export function LogsViewer({ actions, targetTypes }: { actions: string[]; targetTypes: string[] }) {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<LogRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (action) params.set("action", action);
    if (targetType) params.set("targetType", targetType);
    params.set("page", String(page));
    const res = await fetch(`/api/admin/logs?${params.toString()}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not load logs");
      setRows([]);
      return;
    }
    setError(null);
    setRows(body.logs);
    setTotal(body.total);
    setPages(body.pages);
  }, [q, action, targetType, page]);

  // Debounced load on any filter/page change.
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const hasFilters = useMemo(() => q || action || targetType, [q, action, targetType]);

  const select =
    "rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Search action, detail, actor, target…"
            className={`${select} w-full pl-9`}
          />
        </div>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(0);
          }}
          className={select}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={targetType}
          onChange={(e) => {
            setTargetType(e.target.value);
            setPage(0);
          }}
          className={select}
        >
          <option value="">All targets</option>
          {targetTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setAction("");
              setTargetType("");
              setPage(0);
            }}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-4 card overflow-x-auto p-0">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No matching activity.</td></tr>
            ) : (
              rows.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">{e.actorEmail}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{e.action}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                    {e.targetType} · {e.targetId.slice(0, 10)}
                  </td>
                  <td className="max-w-80 truncate px-4 py-2.5 text-muted" title={e.detail ?? ""}>
                    {e.detail ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-muted">
        <span>{total.toLocaleString()} entries</span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              {page + 1} / {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}
              className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
