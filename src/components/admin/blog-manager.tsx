"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bold, Italic, List, Link2, Heading2, Plus, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  coverImageUrl: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  updatedAt: string;
}

const BLANK = { id: "", title: "", slug: "", excerpt: "", coverImageUrl: "", contentHtml: "" };

export function BlogManager({ initialPosts }: { initialPosts: AdminBlogPost[] }) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState(initialPosts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const selected = posts.find((p) => p.id === selectedId) ?? null;

  // Load the chosen post (or a blank draft) into the editor. Driven from the
  // click handlers rather than an effect so the editor's innerHTML and the form
  // stay in sync in one place.
  function selectPost(id: string | null) {
    const p = id ? posts.find((x) => x.id === id) ?? null : null;
    setSelectedId(id);
    setMsg(null);
    if (p) {
      setForm({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        coverImageUrl: p.coverImageUrl ?? "",
        contentHtml: p.contentHtml,
      });
      if (editorRef.current) editorRef.current.innerHTML = p.contentHtml;
    } else {
      setForm(BLANK);
      if (editorRef.current) editorRef.current.innerHTML = "";
    }
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  async function save(status: "DRAFT" | "PUBLISHED") {
    const contentHtml = editorRef.current?.innerHTML ?? "";
    const isEmpty = !editorRef.current?.textContent?.trim();
    if (!form.title.trim() || !form.excerpt.trim() || isEmpty) {
      setMsg({ tone: "err", text: "Title, excerpt, and body are all required." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id || undefined,
        title: form.title,
        slug: form.slug || undefined,
        excerpt: form.excerpt,
        coverImageUrl: form.coverImageUrl || undefined,
        contentHtml,
        status,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ tone: "err", text: body.error ?? "Save failed" });
      return;
    }
    const saved: AdminBlogPost = {
      ...body.post,
      publishedAt: body.post.publishedAt ? new Date(body.post.publishedAt).toISOString() : null,
      updatedAt: new Date(body.post.updatedAt).toISOString(),
    };
    setPosts((prev) => {
      const rest = prev.filter((p) => p.id !== saved.id);
      return [saved, ...rest];
    });
    setSelectedId(saved.id);
    setMsg({ tone: "ok", text: status === "PUBLISHED" ? "Published." : "Saved as draft." });
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this post permanently?")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/blog?id=${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      if (selectedId === id) selectPost(null);
      router.refresh();
    }
  }

  const toolBtn = "rounded p-1.5 text-muted hover:bg-surface-raised hover:text-foreground";
  const input =
    "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      {/* Post list */}
      <div>
        <button
          type="button"
          onClick={() => selectPost(null)}
          className={cn(
            "mb-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold",
            selectedId === null ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-muted"
          )}
        >
          <Plus className="h-4 w-4" /> New post
        </button>
        <div className="space-y-1.5">
          {posts.length === 0 && <p className="px-2 text-sm text-muted">No posts yet.</p>}
          {posts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPost(p.id)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left",
                selectedId === p.id ? "border-accent bg-accent/5" : "border-border hover:border-muted"
              )}
            >
              <p className="truncate text-sm font-medium">{p.title}</p>
              <p className="mt-0.5 flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-semibold",
                    p.status === "PUBLISHED" ? "bg-accent/15 text-accent" : "bg-surface-raised text-muted"
                  )}
                >
                  {p.status === "PUBLISHED" ? "Published" : "Draft"}
                </span>
                <span className="truncate text-muted">/{p.slug}</span>
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{selected ? "Edit post" : "New post"}</h2>
          <div className="flex items-center gap-2">
            {selected?.status === "PUBLISHED" && (
              <a
                href={`/blog/${selected.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                <ExternalLink className="h-4 w-4" /> View
              </a>
            )}
            {selected && (
              <button
                type="button"
                onClick={() => remove(selected.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="How we verify every record"
              className={`${input} mt-1`}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Slug (optional — auto from title)</label>
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="how-we-verify-every-record"
              className={`${input} mt-1`}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Excerpt (listing + meta description)</label>
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              rows={2}
              placeholder="A one or two sentence summary that appears on the blog index and in search results."
              className={`${input} mt-1`}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Cover image URL (optional)</label>
            <input
              value={form.coverImageUrl}
              onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
              placeholder="https://…"
              className={`${input} mt-1`}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted">Body</label>
            <div className="mt-1 overflow-hidden rounded-lg border border-border">
              <div className="flex items-center gap-1 border-b border-border bg-surface-raised px-2 py-1.5">
                <button type="button" onClick={() => exec("formatBlock", "<h2>")} className={toolBtn} aria-label="Heading">
                  <Heading2 className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => exec("bold")} className={toolBtn} aria-label="Bold">
                  <Bold className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => exec("italic")} className={toolBtn} aria-label="Italic">
                  <Italic className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => exec("insertUnorderedList")} className={toolBtn} aria-label="Bullet list">
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt("Link URL (https://…)");
                    if (url) exec("createLink", url);
                  }}
                  className={toolBtn}
                  aria-label="Insert link"
                >
                  <Link2 className="h-4 w-4" />
                </button>
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="prose-blog min-h-64 px-4 py-3 text-sm leading-relaxed outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => save("PUBLISHED")}
            disabled={busy}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
          >
            {selected?.status === "PUBLISHED" ? "Update & keep live" : "Publish"}
          </button>
          <button
            type="button"
            onClick={() => save("DRAFT")}
            disabled={busy}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold hover:border-muted disabled:opacity-60"
          >
            {selected?.status === "PUBLISHED" ? "Unpublish (save draft)" : "Save draft"}
          </button>
          {msg && <p className={cn("text-sm", msg.tone === "err" ? "text-danger" : "text-accent")}>{msg.text}</p>}
        </div>
      </div>
    </div>
  );
}
