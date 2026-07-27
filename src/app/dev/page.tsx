"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Trash2, Sparkles, Database, RefreshCw, Eye, EyeOff, Wrench } from "lucide-react";
import TopNav from "@/components/top-nav";
import { VermilionShell } from "@/components/vermilion";
import { toast } from "sonner";

export default function DevPage() {
  const router = useRouter();
  const [dbStatus, setDbStatus] = useState<{ status: string; db: string; latencyMs?: number } | null>(null);
  const [localData, setLocalData] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState(false);

  useEffect(() => {
    // 检查 dev mode
    if (localStorage.getItem("devMode") !== "true") {
      router.push("/");
      return;
    }
    // 加载 localStorage 数据
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) data[key] = localStorage.getItem(key) || "";
    }
    setLocalData(data);
    // 检查数据库
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setDbStatus(d))
      .catch(() => setDbStatus({ status: "error", db: "down" }));
  }, [router]);

  const handleQuickCreate = async () => {
    // 随机出生资质
    const births = [{id:"waste",p:5},{id:"mortal",p:8},{id:"elite",p:11},{id:"prodigy",p:14},{id:"monster",p:17},{id:"reborn",p:21},{id:"chosen",p:25}];
    const birth = births[Math.floor(Math.random() * births.length)];
    // 随机身份背景
    const identities = [{id:"orphan",c:0},{id:"scholar",c:2},{id:"merchant",c:3},{id:"general",c:4},{id:"sect",c:5}];
    const identity = identities[Math.floor(Math.random() * identities.length)];
    // 随机灵根
    const els = ["金","木","水","火","土"]; const qs = ["上品","中品","下品"];
    const root = Math.random() > 0.1 ? `${els[Math.floor(Math.random()*5)]}_${qs[Math.floor(Math.random()*3)]}` : "chaos";
    // 随机天赋（在剩余预算内选取）
    const talents = [{id:"protagonist",c:5},{id:"sword",c:4},{id:"pill",c:3},{id:"array",c:3},{id:"forge",c:3},{id:"treasure",c:4},{id:"body",c:2},{id:"mind",c:2}];
    let budget = birth.p - identity.c - 2;
    const selectedTalentIds: string[] = [];
    for (const t of talents.sort(() => Math.random() - 0.5)) {
      if (t.c <= budget) { selectedTalentIds.push(t.id); budget -= t.c; }
    }
    // 平均分配剩余属性点
    const attrKeys = ["root","spirit","insight","luck","charm","mind"];
    const attr: Record<string, number> = {};
    const base = Math.floor(budget / 6);
    const rem = budget % 6;
    attrKeys.forEach((k, i) => { attr[k] = base + (i < rem ? 1 : 0); });
    // 家庭由出生叙事生成，不预创建
    // 创建角色
    const res = await fetch("/api/cultivator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: `dev_${Date.now()}`, cultivatorName: `测试_${Date.now()}`, spiritualRoot: root, worldId: "earth" }) });
    const data = await res.json();
    if (!data.user) { toast.error("生成失败"); return; }
    localStorage.setItem("userId", data.user.id);
    localStorage.setItem("cultivatorName", data.user.cultivator.name);
    localStorage.setItem("attributes", JSON.stringify(attr));
    // 生成出生叙事（失败时弹重试按钮，不跳转）
    const identityName = { orphan:"山野遗孤", scholar:"书香门第", merchant:"商贾之子", general:"将门之后", sect:"散修传人" }[identity.id];
    const genNarrative = async (): Promise<boolean> => {
      try {
        const r = await fetch("/api/narrative", {
          method: "POST", headers: { "Content-Type": "application/json", "x-user-id": data.user.id },
          body: JSON.stringify({ type: "BIRTH", worldName: "地球", identityName, age: 1, worldId: "earth" }),
        });
        if (!r.ok) { const ed = await r.json().catch(() => ({})); throw new Error(ed.error || "出生叙事生成失败"); }
        return true;
      } catch (err) {
        console.error("出生叙事生成失败:", err);
        return new Promise((resolve) => {
          toast.error(`出生叙事生成失败: ${(err as Error).message}`, {
            action: { label: "重试", onClick: () => resolve(genNarrative()) },
            duration: 10000,
          });
        });
      }
    };
    if (await genNarrative()) { window.location.href = "/dashboard"; }
  };

  const handleReset = async () => {
    if (!window.confirm("确定要重置所有数据吗？此操作不可恢复")) return;
    localStorage.clear();
    // DELETE API 可能不存在，容错
    try { await fetch("/api/cultivator", { method: "DELETE" }); } catch {}
    toast.success("数据已重置");
    window.location.href = "/";
  };

  const handleClearLocal = () => {
    if (!window.confirm("确定要清空 localStorage 吗？")) return;
    localStorage.clear();
    setLocalData({});
    toast.success("localStorage 已清空");
  };

  const handleRefresh = () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) data[key] = localStorage.getItem(key) || "";
    }
    setLocalData(data);
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setDbStatus(d))
      .catch(() => setDbStatus({ status: "error", db: "down" }));
    toast.success("已刷新");
  };

  return (
    <VermilionShell>
      <TopNav />
      <div className="main-container space-y-6">
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1 text-sm text-[#7A1F18] hover:text-[#B83227] transition-colors"
          >
            <Home className="w-4 h-4" /> 返回
          </button>
          <span className="text-xs font-bold text-[#B83227] bg-[#FDF2F0] px-2 py-0.5 rounded border border-[#B83227]/30">
            DEV MODE
          </span>
        </div>

        <h1 className="font-calligraphy text-2xl font-bold text-[#7A1F18] flex items-center gap-2">
          <Wrench className="w-6 h-6 text-[#D49B4B]" /> 调试面板
        </h1>

        {/* 快速操作 */}
        <div className="silk-card rounded-3xl p-6">
          <h3 className="text-sm font-bold text-[#2C1E1E] flex items-center gap-2 pb-3 mb-3 border-b border-[#EADCD0]">
            <Sparkles className="w-4 h-4 text-[#D49B4B]" /> 快速操作
          </h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleQuickCreate} className="px-4 py-2 rounded-xl bg-[#B83227] hover:bg-[#7A1F18] text-white text-sm font-medium transition-colors flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> 快速生成角色
            </button>
            <button onClick={handleReset} className="px-4 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> 重置所有数据
            </button>
            <button onClick={handleClearLocal} className="px-4 py-2 rounded-xl bg-white text-[#B83227] border border-[#B83227]/30 hover:bg-[#FDF2F0] text-sm font-medium transition-colors flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> 清空 localStorage
            </button>
            <button onClick={handleRefresh} className="px-4 py-2 rounded-xl bg-white text-[#B83227] border border-[#B83227]/30 hover:bg-[#FDF2F0] text-sm font-medium transition-colors flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> 刷新
            </button>
          </div>
        </div>

        {/* 数据库状态 */}
        <div className="silk-card rounded-3xl p-6">
          <h3 className="text-sm font-bold text-[#2C1E1E] flex items-center gap-2 pb-3 mb-3 border-b border-[#EADCD0]">
            <Database className="w-4 h-4 text-blue-500" /> 数据库状态
          </h3>
          {dbStatus ? (
            <div className="text-xs space-y-1 text-gray-500">
              <p>
                状态：{" "}
                <span className={dbStatus.status === "ok" ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                  {dbStatus.status === "ok" ? "✅ 正常" : "❌ 异常"}
                </span>
              </p>
              <p>数据库：{dbStatus.db === "up" ? "✅ 已连接" : "❌ 断开"}</p>
              {dbStatus.latencyMs !== undefined && <p>延迟：{dbStatus.latencyMs}ms</p>}
            </div>
          ) : (
            <p className="text-xs text-gray-400">检测中...</p>
          )}
        </div>

        {/* localStorage 数据 */}
        <div className="silk-card rounded-3xl p-6">
          <h3 className="text-sm font-bold text-[#2C1E1E] flex items-center gap-2 justify-between pb-3 mb-3 border-b border-[#EADCD0]">
            <span className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" /> localStorage
            </span>
            <button onClick={() => setShowValues(!showValues)} className="text-gray-400 hover:text-[#2C1E1E] transition-colors">
              {showValues ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </h3>
          {Object.keys(localData).length === 0 ? (
            <p className="text-xs text-gray-400">无数据</p>
          ) : (
            <div className="text-xs space-y-1 max-h-60 overflow-y-auto">
              {Object.entries(localData).map(([key, value]) => (
                <div key={key} className="flex gap-2 border-b border-[#EADCD0]/50 pb-1 last:border-0">
                  <span className="font-medium text-[#2C1E1E] shrink-0 w-28 truncate">{key}</span>
                  <span className="text-gray-500 truncate">
                    {showValues ? value : value.length > 50 ? `${value.slice(0, 50)}...` : value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </VermilionShell>
  );
}
