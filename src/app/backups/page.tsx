"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/top-nav";
import { Download, Upload, RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";

interface BackupInfo {
  filename: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  age: number | null;
  realm: string | null;
}

export default function BackupsPage() {
  const router = useRouter();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const uid = localStorage.getItem("userId");
    if (!uid) { router.push("/login"); return; }
    loadBackups();
  }, [router]);

  async function loadBackups() {
    const uid = localStorage.getItem("userId");
    if (!uid) return;
    try {
      const res = await fetch("/api/backup/list", { headers: { "x-user-id": uid } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBackups(data.backups || []);
    } catch {
      toast.error("加载备份列表失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    const uid = localStorage.getItem("userId");
    if (!uid) return;
    try {
      const res = await fetch("/api/backup/export", { headers: { "x-user-id": uid } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cultivation-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("存档已导出");
    } catch {
      toast.error("导出失败");
    }
  }

  async function handleImport(backup: BackupInfo) {
    if (!confirm(`确定恢复 ${backup.filename} ？当前数据将被覆盖`)) return;
    const uid = localStorage.getItem("userId");
    if (!uid) return;
    setImporting(true);
    try {
      const res = await fetch("/api/backup/export", {
        headers: { "x-user-id": uid, "x-backup-filename": backup.filename },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      const importRes = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": uid },
        body: JSON.stringify(data),
      });
      if (!importRes.ok) throw new Error();
      toast.success("存档已恢复，请刷新页面");
    } catch {
      toast.error("恢复失败");
    } finally {
      setImporting(false);
    }
  }

  async function handleUploadImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement)?.files?.[0];
      if (!file) return;
      const uid = localStorage.getItem("userId");
      if (!uid) return;
      setImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const res = await fetch("/api/backup/import", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": uid },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error();
        toast.success("存档已恢复，请刷新页面");
      } catch {
        toast.error("导入失败，请检查文件格式");
      } finally {
        setImporting(false);
      }
    };
    input.click();
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <TopNav />
      <main className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#2C2C2C]">存档管理</h1>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="px-3 py-1.5 bg-[#2C2C2C] text-white text-sm rounded flex items-center gap-1 hover:opacity-90 transition-opacity"
            >
              <Download className="w-4 h-4" /> 导出
            </button>
            <button
              onClick={handleUploadImport}
              disabled={importing}
              className="px-3 py-1.5 border border-[#D0C8C0] text-sm rounded flex items-center gap-1 hover:bg-[#F0EBE3] transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" /> 导入
            </button>
            <button
              onClick={loadBackups}
              className="px-3 py-1.5 border border-[#D0C8C0] text-sm rounded hover:bg-[#F0EBE3] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-[#8a7a72] text-center py-12">加载中…</p>
        ) : backups.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-[#D0C8C0] mx-auto mb-3" />
            <p className="text-[#8a7a72]">暂无自动备份</p>
            <p className="text-[#8a7a72] text-sm mt-1">执行游戏操作后会自动生成备份</p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div
                key={b.filename}
                className="bg-[var(--card)] border border-[#E5E0D0] rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-[#2C2C2C]">{b.filename}</p>
                  <p className="text-xs text-[#8a7a72]">
                    {(b.size / 1024).toFixed(1)} KB ·{" "}
                    {new Date(b.createdAt).toLocaleString("zh-CN")}
                    {b.age !== null && (
                      <span> · {b.age}岁{b.realm ? ` · ${b.realm}` : ""}</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleImport(b)}
                  disabled={importing}
                  className="px-3 py-1 bg-[var(--destructive)] text-white text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  恢复
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}