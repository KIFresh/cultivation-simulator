"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface StoryEntry {
  id: string;
  title: string;
  summary: string;
  important: boolean;
  createdAt: string;
}

interface MemoryPanelProps {
  cultivatorId: string;
  entries: StoryEntry[];
  onEntriesChange: (entries: StoryEntry[]) => void;
}

export default function MemoryPanel({ cultivatorId, entries, onEntriesChange }: MemoryPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [fullEdit, setFullEdit] = useState("");
  const [showFullEdit, setShowFullEdit] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const summaryText = entries.map(e =>
    `${e.important ? "⭐ " : ""}【${e.title}】${e.summary}`
  ).join("\n");

  const saveEntries = async (newEntries: StoryEntry[]) => {
    try {
      const res = await fetch("/api/cultivator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateMemory", userId: cultivatorId, storyEntries: newEntries }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onEntriesChange(data.entries);
      toast.success("记忆已更新");
    } catch {
      toast.error("保存失败");
    }
  };

  const toggleImportant = (id: string) => {
    const next = entries.map(e =>
      e.id === id ? { ...e, important: !e.important } : e
    );
    saveEntries(next);
  };

  const startEdit = (entry: StoryEntry) => {
    setEditingId(entry.id);
    setEditText(entry.summary);
  };

  const saveEdit = (id: string) => {
    const next = entries.map(e =>
      e.id === id ? { ...e, summary: editText.slice(0, 60) + (editText.length > 60 ? "…" : "") } : e
    );
    saveEntries(next);
    setEditingId(null);
  };

  const deleteEntry = (id: string) => {
    if (!window.confirm("确定删除这条记忆吗？")) return;
    const next = entries.filter(e => e.id !== id);
    saveEntries(next);
  };

  const saveFullEdit = () => {
    const importantEntries = entries.filter(e => e.important);
    const newEntry: StoryEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      title: "📝 玩家记述",
      summary: fullEdit.slice(0, 500),
      important: false,
      createdAt: new Date().toISOString(),
    };
    saveEntries([...importantEntries, newEntry]);
    setShowFullEdit(false);
  };

  const handleCompress = async () => {
    setCompressing(true);
    try {
      const res = await fetch("/api/cultivator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "compressMemory", userId: cultivatorId }),
      });
      const data = await res.json();
      if (data.entries) {
        onEntriesChange(data.entries);
        toast.success(data.message || "记忆已压缩");
      }
    } catch {
      toast.error("压缩失败");
    } finally {
      setCompressing(false);
    }
  };

  if (!entries || entries.length === 0) return null;

  return (
    <div className="border border-border bg-card rounded-lg shadow-sm">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-foreground hover:bg-muted/50"
      >
        <span>📖 道心明镜 · AI 记住了这些事</span>
        <span>{collapsed ? "▶" : "▼"}</span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 text-sm py-1 border-b border-muted last:border-0">
              <button
                onClick={() => toggleImportant(entry.id)}
                className="text-base shrink-0"
                title={entry.important ? "取消重要标记" : "标记为重要"}
              >
                {entry.important ? "⭐" : "☆"}
              </button>

              <span className="text-foreground font-medium shrink-0">{entry.title}</span>

              {editingId === entry.id ? (
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit(entry.id)}
                  className="flex-1 h-7 text-xs"
                  autoFocus
                />
              ) : (
                <span className="text-muted-foreground flex-1 truncate text-xs">{entry.summary}</span>
              )}

              <div className="flex gap-1 shrink-0">
                {editingId === entry.id ? (
                  <button onClick={() => saveEdit(entry.id)} className="text-xs text-primary hover:underline">保存</button>
                ) : (
                  <button onClick={() => startEdit(entry)} className="text-xs text-muted-foreground hover:text-foreground" title="编辑">✏️</button>
                )}
                <button onClick={() => deleteEntry(entry.id)} className="text-xs text-muted-foreground hover:text-red-500" title="删除">🗑️</button>
              </div>
            </div>
          ))}

          {showFullEdit ? (
            <div className="space-y-1 pt-2">
              <textarea
                value={fullEdit}
                onChange={(e) => setFullEdit(e.target.value)}
                className="w-full h-24 text-xs p-2 border border-border rounded bg-white text-foreground resize-none"
                placeholder="编辑完整的记忆文本…"
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-7 text-xs" onClick={saveFullEdit}>保存</Button>
                <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setShowFullEdit(false)}>取消</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setFullEdit(summaryText); setShowFullEdit(true); }}
              className="text-xs text-muted-foreground hover:text-primary pt-1"
            >
              📝 编辑全文概要
            </button>
          )}

          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
            <span>共 {entries.length} 条 · {summaryText.length} 字</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleCompress}
              disabled={compressing}
            >
              {compressing ? "压缩中..." : "🔄 压缩记忆"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}