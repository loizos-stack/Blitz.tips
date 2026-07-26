"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, UserPlus, Crown } from "lucide-react";

interface PermDef {
  key: string;
  label: string;
  description: string;
}

interface Admin {
  id: string;
  email: string;
  name: string | null;
  isSuperAdmin: boolean;
  adminPermissions: string[];
  locked: boolean;
  isSelf: boolean;
}

export function PermissionsManager({ permissions }: { permissions: PermDef[] }) {
  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // "Add admin" form state.
  const [email, setEmail] = useState("");
  const [newPerms, setNewPerms] = useState<Set<string>>(new Set());
  const [newSuper, setNewSuper] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/permissions");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not load admins");
      setAdmins([]);
      return;
    }
    setError(null);
    setAdmins(body.admins);
  }

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, []);

  // Local edits to a row before saving.
  function patchRow(id: string, changes: Partial<Admin>) {
    setAdmins((prev) => prev && prev.map((a) => (a.id === id ? { ...a, ...changes } : a)));
  }

  function toggleRowPerm(admin: Admin, key: string) {
    const has = admin.adminPermissions.includes(key);
    patchRow(admin.id, {
      adminPermissions: has
        ? admin.adminPermissions.filter((p) => p !== key)
        : [...admin.adminPermissions, key],
    });
  }

  async function saveRow(admin: Admin) {
    setSavingId(admin.id);
    setError(null);
    const res = await fetch("/api/admin/permissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: admin.id,
        isSuperAdmin: admin.isSuperAdmin,
        permissions: admin.adminPermissions,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSavingId(null);
    if (!res.ok) {
      setError(body.error ?? "Save failed");
      return;
    }
    void load();
  }

  async function revoke(admin: Admin) {
    if (!confirm(`Revoke admin access for ${admin.email}?`)) return;
    setSavingId(admin.id);
    setError(null);
    const res = await fetch(`/api/admin/permissions?id=${encodeURIComponent(admin.id)}`, {
      method: "DELETE",
    });
    const body = await res.json().catch(() => ({}));
    setSavingId(null);
    if (!res.ok) {
      setError(body.error ?? "Revoke failed");
      return;
    }
    void load();
  }

  function toggleNewPerm(key: string) {
    setNewPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function addAdmin() {
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/admin/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        isSuperAdmin: newSuper,
        permissions: [...newPerms],
      }),
    });
    const body = await res.json().catch(() => ({}));
    setAdding(false);
    if (!res.ok) {
      setAddError(body.error ?? "Could not add admin");
      return;
    }
    setEmail("");
    setNewPerms(new Set());
    setNewSuper(false);
    void load();
  }

  const input =
    "rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div>
      <div className="card p-5">
        <p className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-accent" /> Admin permissions
        </p>
        <p className="mt-1 text-xs text-muted">
          Superadmins have full access and manage this page. For everyone else, tick exactly the
          tabs and functions they should reach — they&apos;ll only see those tabs in the admin nav.
        </p>
      </div>

      {/* Add / promote an admin */}
      <div className="card mt-4 p-5">
        <p className="flex items-center gap-2 font-semibold">
          <UserPlus className="h-4 w-4 text-accent" /> Add an admin
        </p>
        <p className="mt-1 text-xs text-muted">
          The person must already have a Blitz.tips account. Enter their email and choose their access.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <span className="text-xs text-muted">Account email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className={`${input} mt-1 block w-64`}
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={newSuper}
              onChange={(e) => setNewSuper(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            <span className="flex items-center gap-1">
              <Crown className="h-3.5 w-3.5 text-gold" /> Superadmin (full access)
            </span>
          </label>
        </div>

        {!newSuper && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {permissions.map((p) => (
              <label
                key={p.key}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-sm hover:border-muted"
              >
                <input
                  type="checkbox"
                  checked={newPerms.has(p.key)}
                  onChange={() => toggleNewPerm(p.key)}
                  className="mt-0.5 h-4 w-4 accent-accent"
                />
                <span>
                  <span className="font-medium">{p.label}</span>
                  <span className="block text-xs text-muted">{p.description}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={addAdmin}
            disabled={adding || !email}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
          >
            {adding ? "Adding…" : "Add admin"}
          </button>
          {addError && <span className="text-sm text-danger">{addError}</span>}
        </div>
      </div>

      {/* Current admins */}
      <h2 className="mb-3 mt-8 font-semibold">Current admins</h2>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {admins === null ? (
        <p className="text-muted">Loading…</p>
      ) : admins.length === 0 ? (
        <p className="text-muted">No admins yet.</p>
      ) : (
        <div className="space-y-4">
          {admins.map((admin) => (
            <div key={admin.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    {admin.name ?? admin.email}
                    {admin.isSuperAdmin && (
                      <span className="flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold">
                        <Crown className="h-3 w-3" /> Superadmin
                      </span>
                    )}
                    {admin.isSelf && (
                      <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">{admin.email}</p>
                </div>
                {admin.locked ? (
                  <span className="text-xs text-muted">Set via env — not editable here</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={admin.isSuperAdmin}
                        disabled={admin.isSelf}
                        onChange={(e) => patchRow(admin.id, { isSuperAdmin: e.target.checked })}
                        className="h-4 w-4 accent-accent disabled:opacity-50"
                      />
                      Superadmin
                    </label>
                    <button
                      type="button"
                      onClick={() => saveRow(admin)}
                      disabled={savingId === admin.id}
                      className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
                    >
                      {savingId === admin.id ? "Saving…" : "Save"}
                    </button>
                    {!admin.isSelf && (
                      <button
                        type="button"
                        onClick={() => revoke(admin)}
                        disabled={savingId === admin.id}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/5 disabled:opacity-60"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!admin.isSuperAdmin && !admin.locked && (
                <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
                  {permissions.map((p) => (
                    <label
                      key={p.key}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-sm hover:border-muted"
                    >
                      <input
                        type="checkbox"
                        checked={admin.adminPermissions.includes(p.key)}
                        onChange={() => toggleRowPerm(admin, p.key)}
                        className="h-4 w-4 accent-accent"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
