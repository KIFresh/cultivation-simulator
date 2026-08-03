"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Star, StarOff, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import TopNav from "@/components/top-nav";
import { VermilionShell } from "@/components/vermilion";

interface MemoryEntry {
  id: string;
  title: string;
  summary: string;
  narrative: string | null;
  important: boolean;
  tags: string | null;
  cultivatorAge: number;
  cultivatorRealm: string | null;
  createdAt: string;
}

export default function MemoryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", summary: "", narrative: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTag, setSearchTag] = useState("");

  useEffect(() => {
    const uid = localStorage.getItem("userId");
    if (!uid) {
      router.push("/login");
      return;
    }
    loadEntries();
  }, []);

  async function loadEntries() {
    const uid = localStorage.getItem("userId");
    if (!uid) return;
    try {
      const res = await fetch(`/api/memory`, {
        headers: { "x-user-id": uid },
      });
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      toast.error("加载记忆失败");
    } finally {
      setLoading(false);
    }
  }

  async function toggleImportant(entry: MemoryEntry) {
    const uid = localStorage.getItem("userId");
    if (!uid) return;
    try {
      const res = await fetch(`/api/memory`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": uid },
        body: JSON.stringify({ id: entry.id, important: !entry.important }),
      });
      if (!res.ok) throw new Error();
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, important: !e.important } : e))
      );
    } catch {
      toast.error("操作失败");
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("确定删除这条记忆？")) return;
    const uid = localStorage.getItem("userId");
    if (!uid) return;
    try {
      const res = await fetch(`/api/memory?id=${id}`, {
        method: "DELETE",
        headers: { "x-user-id": uid },
      });
      if (!res.ok) throw new Error();
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("已删除");
    } catch {
      toast.error("删除失败");
    }
  }

  function startEdit(entry: MemoryEntry) {
    setEditingId(entry.id);
    setEditForm({
      title: entry.title,
      summary: entry.summary,
      narrative: entry.narrative || "",
    });
  }

  async function saveEdit(id: string) {
    const uid = localStorage.getItem("userId");
    if (!uid) return;
    try {
      const res = await fetch(`/api/memory`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": uid },
        body: JSON.stringify({ id, ...editForm }),
      });
      if (!res.ok) throw new Error();
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, title: editForm.title, summary: editForm.summary, narrative: editForm.narrative }
            : e
        )
      );
      setEditingId(null);
      toast.success("已保存");
    } catch {
      toast.error("保存失败");
    }
  }

  const filteredEntries = searchTag
    ? entries.filter((e) => {
        let tags: string[] = [];
        try { tags = e.tags ? JSON.parse(e.tags) : []; } catch {}
        return tags.some((t: string) => t.includes(searchTag));
      })
    : entries;

  if (loading) {
    return (
      <VermilionShell>
        <TopNav />
        <main className="flex-1 flex items-center justify-center min-h-screen bg-[#FAF7F3]">
          <p className="text-[#8a7a72]">加载中…</p>
        </main>
      </VermilionShell>
    );
  }

  return (
    <VermilionShell>
      <TopNav />
      <main className="flex-1 min-h-screen bg-[#FAF7F3] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#2C2C2C]">记忆面板</h1>
          <input
            type="text"
            placeholder="搜索标签…"
            value={searchTag}
            onChange={(e) => setSearchTag(e.target.value)}
            className="px-3 py-1.5 border border-[#D0C8C0] rounded text-sm bg-white"
          />
        </div>

        {filteredEntries.length === 0 ? (
          <p className="text-[#8a7a72] text-center py-12">暂无记忆</p>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="bg-white border border-[#E5E0D0] rounded-lg p-4 shadow-sm">
                {editingId === entry.id ? (
                  <div className="space-y-2">
                    <input
                      className="w-full px-2 py-1 border border-[#D0C8C0] rounded text-sm font-bold"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    />
                    <textarea
                      className="w-full px-2 py-1 border border-[#D0C8C0] rounded text-sm"
                      rows={2}
                      value={editForm.summary}
                      onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                    />
                    <textarea
                      className="w-full px-2 py-1 border border-[#D0C8C0] rounded text-sm"
                      rows={4}
                      value={editForm.narrative}
                      onChange={(e) => setEditForm({ ...editForm, narrative: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(entry.id)}
                        className="px-3 py-1 bg-[#2C2C2C] text-white text-sm rounded"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 border border-[#D0C8C0] text-sm rounded"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-[#2C2C2C]">{entry.title}</h3>
                          <span className="text-xs text-[#8a7a72]">
                            {entry.cultivatorAge}岁 · {entry.cultivatorRealm || "未知"}
                          </span>
                        </div>
                        <p className="text-sm text-[#5C5C5C] mt-1">{entry.summary}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => toggleImportant(entry)}
                          className="p-1 hover:bg-[#F0EBE0] rounded"
                          title={entry.important ? "取消重要" : "标记重要"}
                        >
                          {entry.important ? (
                            <Star className="w-4 h-4 text-yellow-500" />
                          ) : (
                            <StarOff className="w-4 h-4 text-[#8a7a72]" />
                          )}
                        </button>
                        <button
                          onClick={() => startEdit(entry)}
                          className="p-1 hover:bg-[#F0EBE0] rounded"
                          title="编辑"
                        >
                          <Pencil className="w-4 h-4 text-[#5C5C5C]" />
                        </button>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="p-1 hover:bg-[#F0EBE0] rounded"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                        {entry.narrative && (
                          <button
                            onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                            className="p-1 hover:bg-[#F0EBE0] rounded"
                          >
                            {expandedId === entry.id ? (
                              <ChevronUp className="w-4 h-4 text-[#5C5C5C]" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-[#5C5C5C]" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {expandedId === entry.id && entry.narrative && (
                      <div className="mt-3 p-3 bg-[#F5F2E9] rounded text-sm text-[#5C5C5C] whitespace-pre-wrap">
                        {entry.narrative}
                      </div>
                    )}
                    {entry.tags && (() => {
                      let tags: string[] = [];
                      try { tags = JSON.parse(entry.tags); } catch {}
                      if (tags.length === 0) return null;
                      return (
                        <div className="flex gap-1 mt-2">
                          {tags.map((tag: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-[#F0EBE0] text-xs text-[#5C5C5C] rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
    </VermilionShell>
  );
}