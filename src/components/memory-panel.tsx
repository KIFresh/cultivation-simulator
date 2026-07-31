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

  const summaryText = entries
    .map((e) => `${e.important ? "⭐ " : ""}【${e.title}】${e.summary}`)
    .join("\n");

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.createdAt < b.createdAt) return 1;
    if (a.createdAt > b.createdAt) return -1;
    return 0;
  });

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

  const toggleImportant = async (id: string) => {
    const next = entries.map((e) => (e.id === id ? { ...e, important: !e.important } : e));
    await saveEntries(next);
  };

  const startEdit = (entry: StoryEntry) => {
    setEditingId(entry.id);
    setEditText(entry.summary);
  };

  const saveEdit = (id: string) => {
    const next = entries.map((e) => (e.id === id ? { ...e, summary: editText } : e));
    saveEntries(next);
    setEditingId(null);
  };

  const deleteEntry = async (id: string) => {
    if (!window.confirm("确定删除这条记忆吗？")) return;
    const next = entries.filter((e) => e.id !== id);
    await saveEntries(next);
  };

  const saveFullEdit = async () => {
    const newEntry: StoryEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      title: "📝 玩家记述",
      summary: fullEdit.slice(0, 500),
      important: false,
      createdAt: new Date().toISOString(),
    };
    await saveEntries([...entries, newEntry]);
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
      if (!res.ok) {
        const ed = await res.json().catch(() => ({}));
        throw new Error(ed.error || "压缩失败");
      }
      const data = await res.json();
      if (data.entries) {
        onEntriesChange(data.entries);
        if (data.compressed === false) {
          toast.success(data.message || "没有可压缩的普通记忆");
        } else {
          toast.success(data.message || "记忆已压缩");
        }
      }
    } catch {
      toast.error("压缩失败");
    } finally {
      setCompressing(false);
    }
  };

  return (
    <div className="border border-border bg-card rounded-lg shadow-sm">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-foreground hover:bg-muted/50"
      >
        <span>📖 道心明镜</span>
        <span>{collapsed ? "▶" : "▼"}</span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-2">
          <div className="space-y-1 max-h-[10rem] overflow-y-auto">
            {sortedEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">暂无记忆</p>
            ) : (
              sortedEntries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="text-xs py-1 border-b border-[#EADCD0] last:border-0">
                  <span className="text-[#2C1E1E] font-medium">{entry.title}</span>
                  {entry.summary && <span className="text-[#8B7355] ml-2 truncate">{entry.summary}</span>}
                </div>
              ))
            )}
          </div>

          {sortedEntries.length > 5 && (
            <p className="text-[10px] text-[#8B7355] text-center">
              共 {sortedEntries.length} 条记忆，向上滚动查看更多
            </p>
          )}

          {sortedEntries.length > 0 && (
            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground border-t border-[#EADCD0]">
              <span>共 {sortedEntries.length} 条</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={handleCompress}
                disabled={compressing || entries.filter((e) => !e.important).length === 0}
              >
                {compressing ? "压缩中..." : "🔄 压缩"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}