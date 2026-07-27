"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Zap, Sparkles, Send, SkipForward, Sword, ScrollText, Coins, MapPin } from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  getAvailableActions, getActionById, formatRealmLevel, MORTAL_REALM, isAwakened,
  canBreakthrough, getRootInfo, getStarterInventory, getItemById,
  getEquippedItems, getBackpackItems, getSchoolStage, getSchoolGrade,
  getDefaultOccupation, getUnlockedLocations, ATTR_INFO,
  calculateMaxStamina, getNPCsAtLocation,
} from "@/lib";
import type { Action, InventoryItem, NPC } from "@/lib";
import { toast } from "sonner";
import { consumeNarrativeStream } from "@/lib/sse-client";
import MemoryPanel from "@/components/memory-panel";
import DaoXiaoModal from "@/components/dao-xiao-modal";
import TechniquePanel from "@/components/technique-panel";
import TopNav from "@/components/top-nav";

interface CultivatorData {
  id: string; name: string; spiritualRoot: string; realm: string;
  realmLevel: number; cultivationExp: number; totalExp: number;
  stamina: number; age: number; worldId: string | null;
  title: string | null; breakthroughCount: number; location: string | null;
  gold: number;
  maxAge: number | null;
  bonusAge: number;
  reincarnationCount: number;
  talents: string | null;
}

interface NarrativeDisplay {
  title: string; narrative: string; mood: string; hint?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [cultivator, setCultivator] = useState<CultivatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [narrative, setNarrative] = useState<NarrativeDisplay | null>(null);
  const [narrativeHistory, setNarrativeHistory] = useState<NarrativeDisplay[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [availableActions, setAvailableActions] = useState<Action[]>([]);
  const [canBreak, setCanBreak] = useState(false);
  const [awakenEvent, setAwakenEvent] = useState<{ title: string; narrative: string } | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [attributes, setAttributes] = useState<Record<string, number>>({});
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [occupation, setOccupation] = useState("");
  const [schoolRank, setSchoolRank] = useState("普通");
  const [unlockedLocs, setUnlockedLocs] = useState<string[]>([]);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [actionInput, setActionInput] = useState("");
  const [showItems, setShowItems] = useState(false);
  const [narrativeExpanded, setNarrativeExpanded] = useState(false);
  const [npcChat, setNpcChat] = useState<NPC | null>(null);
  const [npcMessage, setNpcMessage] = useState("");
  const [npcChatHistory, setNpcChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [devMode, setDevMode] = useState(false);
  const [memoryEntries, setMemoryEntries] = useState<any[]>([]);
  const [techniquePanelOpen, setTechniquePanelOpen] = useState(false);
  const [daoXiao, setDaoXiao] = useState<{ summary: any; name: string } | null>(null);
  const [warnEarly, setWarnEarly] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [maxAge, setMaxAge] = useState<number | null>(null);
  const currentLoc = cultivator?.location || "home";
  const currentNPCs = cultivator ? getNPCsAtLocation(currentLoc) : [];
  const attributesRef = useRef(attributes);
  attributesRef.current = attributes;

  const loadLocalData = useCallback(() => {
    try {
      const attr = localStorage.getItem("attributes");
      if (attr) setAttributes(JSON.parse(attr));
      const inv = localStorage.getItem("inventory");
      if (inv) setInventory(JSON.parse(inv));
      else { const s = getStarterInventory(); setInventory(s); localStorage.setItem("inventory", JSON.stringify(s)); }
      const occ = localStorage.getItem("occupation");
      if (occ) setOccupation(occ);
      const sr = localStorage.getItem("schoolRank");
      if (sr) setSchoolRank(sr);
      const uls = localStorage.getItem("unlockedLocations");
      if (uls) setUnlockedLocs(JSON.parse(uls));
    } catch {}
  }, []);

  const loadCultivator = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/cultivator?userId=${userId}`);
      const data = await res.json();
      if (data.user?.cultivator) {
        const capped = {
          ...data.user.cultivator,
          stamina: Math.min(data.user.cultivator.stamina, calculateMaxStamina(data.user.cultivator.age, attributesRef.current)),
        };
        setCultivator(capped);
        // 读取记忆条目
        if (capped.storyEntries) {
          try {
            setMemoryEntries(Array.isArray(capped.storyEntries) ? capped.storyEntries : []);
          } catch {}
        }
        // 初始化寿元
        if (capped.maxAge) {
          setMaxAge(capped.maxAge);
          setRemaining(capped.maxAge - capped.age);
        }
        // 从后端同步背包数据（始终以服务端为唯一数据源）
        if (capped.inventory) {
          try {
            const backendInv = JSON.parse(capped.inventory);
            setInventory(Array.isArray(backendInv) ? backendInv : []);
            localStorage.setItem("inventory", JSON.stringify(Array.isArray(backendInv) ? backendInv : []));
          } catch {
            setInventory([]);
            localStorage.setItem("inventory", JSON.stringify([]));
          }
        } else {
          setInventory([]);
          localStorage.setItem("inventory", JSON.stringify([]));
        }
        const actions = getAvailableActions(capped.worldId || "earth", capped.age);
        setAvailableActions(actions);
        if (isAwakened(capped.realm)) {
          setCanBreak(canBreakthrough(capped.realm, capped.realmLevel, capped.cultivationExp, capped.spiritualRoot, capped.breakthroughBuff || 0));
        }
        // 从 API 拉取历史记录
        fetch(`/api/events?userId=${userId}&limit=50`)
          .then((r) => r.json())
          .then((evData) => {
            if (evData.events && evData.events.length > 0) {
              const history: NarrativeDisplay[] = evData.events.map((ev: any) => {
                let mood = "静";
                try { const r = JSON.parse(ev.reward || "{}"); if (r.mood) mood = r.mood; } catch {}
                return { title: ev.title, narrative: ev.narrative, mood };
              });
              setNarrativeHistory(history);
              // 如果尚未设置主叙事（快速生成时已设置），则取最新事件
              if (history.length > 0 && !narrative) {
                setNarrative(history[0]);
              }
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error("加载角色失败:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const id = localStorage.getItem("userId");
    const dm = localStorage.getItem("devMode") === "true";
    setDevMode(dm);
    if (!id && !dm) { router.push("/"); return; }
    if (id) setUserId(id);
    if (dm && !id) {
      const tempId = "dev_" + Date.now();
      localStorage.setItem("userId", tempId);
      setUserId(tempId);
    }
  }, [router]);
  useEffect(() => { if (userId) loadCultivator(); }, [userId, loadCultivator]);
  useEffect(() => { loadLocalData(); }, [loadLocalData]);

  const isAwake = cultivator ? isAwakened(cultivator.realm) : false;
  const realmLabel = cultivator?.realm === MORTAL_REALM ? "凡人" : `${cultivator?.realm} ${cultivator ? formatRealmLevel(cultivator.realm, cultivator.realmLevel) : ""}`;
  const schoolStage = cultivator ? getSchoolStage(cultivator.age) : null;
  const schoolGrade = schoolStage && cultivator ? getSchoolGrade(cultivator.age, schoolStage) : 0;
  const displayOccupation = occupation || (cultivator ? getDefaultOccupation(cultivator.age) : "");
  const locs = cultivator ? getUnlockedLocations(cultivator.age, isAwake, unlockedLocs) : [];
  const maxStamina = cultivator ? calculateMaxStamina(cultivator.age) : 20;

  const performAction = async (actionId: string, input?: string) => {
    if (!userId || !cultivator || actionLoading) return;
    setActionLoading(true); setActiveActionId(null); setActionInput(""); setStreamingText("");
    try {
      let familyData = null;
      try { const raw = localStorage.getItem("family"); if (raw) familyData = JSON.parse(raw); } catch {}
      const res = await fetch("/api/action?stream=true", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, actionId, freeInput: input || undefined, worldId: cultivator.worldId, family: familyData, attributes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "行动失败");
        return;
      }
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/event-stream")) {
        // 流式叙事：逐段回填，不暴露 JSON 骨架
        await consumeNarrativeStream(res, {
          onChunk: (c) => setStreamingText((prev) => (prev || "") + c),
          onDone: (d: any) => {
            if (!d) return;
            const data = d;
            const newN: NarrativeDisplay = { title: data.narrative.title, narrative: data.narrative.narrative, mood: data.narrative.mood, hint: data.narrative.hint };
            setNarrative(newN); setNarrativeExpanded(false); setNarrativeHistory((prev) => [newN, ...prev].slice(0, 50));
            if (data.cultivator) {
              setCultivator(data.cultivator);
              const c = data.cultivator;
              if (c.storyEntries) {
                try { const parsed = typeof c.storyEntries === "string" ? JSON.parse(c.storyEntries) : c.storyEntries; setMemoryEntries(Array.isArray(parsed) ? parsed : []); } catch {}
              }
              if (isAwakened(c.realm)) setCanBreak(canBreakthrough(c.realm, c.realmLevel, c.cultivationExp, c.spiritualRoot, c.breakthroughBuff || 0));
              setAvailableActions(getAvailableActions(c.worldId || "earth", c.age, currentLoc));
            }
            if (data.awakenEvent) { setAwakenEvent(data.awakenEvent); toast.success("🎉 灵气觉醒！", { duration: 5000 }); }
            if (data.expGained) toast.success(`修炼值 +${data.expGained}`, { duration: 2000 });
            if (data.techniqueEvents && data.techniqueEvents.length > 0) {
              data.techniqueEvents.forEach((te: any) => {
                const profMsg = te.eventNarrative ? te.eventNarrative : `${te.icon} ${te.techniqueName} 熟练度 +${te.profGained}`;
                toast(profMsg, { duration: 3000 });
                if (te.leveledUp) toast.success(`⚡ ${te.icon} ${te.techniqueName} 升级！`, { duration: 4000 });
              });
            }
          },
          onError: (e: any) => { toast.error(e?.message || "行动叙事生成失败，请重试"); },
        });
      } else {
        const data = await res.json();
        if (data.updatedFamily) localStorage.setItem("family", JSON.stringify(data.updatedFamily));
        if (data.intimacyChanges) data.intimacyChanges.forEach((c: any) => {
          if (c.delta > 0) toast(`💕 与${c.relation}${c.name} 亲近${c.delta}`, { duration: 3000 });
          else if (c.delta < 0) toast(`💔 与${c.relation}${c.name} 疏远${Math.abs(c.delta)}`, { duration: 3000 });
        });
        const newN: NarrativeDisplay = { title: data.narrative.title, narrative: data.narrative.narrative, mood: data.narrative.mood, hint: data.narrative.hint };
        setNarrative(newN); setNarrativeExpanded(false); setNarrativeHistory((prev) => [newN, ...prev].slice(0, 50));
        if (data.cultivator) {
          setCultivator(data.cultivator);
          const c = data.cultivator;
          if (c.storyEntries) {
            try { const parsed = typeof c.storyEntries === "string" ? JSON.parse(c.storyEntries) : c.storyEntries; setMemoryEntries(Array.isArray(parsed) ? parsed : []); } catch {}
          }
          if (isAwakened(c.realm)) setCanBreak(canBreakthrough(c.realm, c.realmLevel, c.cultivationExp, c.spiritualRoot, c.breakthroughBuff || 0));
          setAvailableActions(getAvailableActions(c.worldId || "earth", c.age, currentLoc));
        }
        if (data.awakenEvent) { setAwakenEvent(data.awakenEvent); toast.success("🎉 灵气觉醒！", { duration: 5000 }); }
        if (data.expGained) toast.success(`修炼值 +${data.expGained}`, { duration: 2000 });
        if (data.techniqueEvents && data.techniqueEvents.length > 0) {
          data.techniqueEvents.forEach((te: any) => {
            const profMsg = te.eventNarrative ? te.eventNarrative : `${te.icon} ${te.techniqueName} 熟练度 +${te.profGained}`;
            toast(profMsg, { duration: 3000 });
            if (te.leveledUp) toast.success(`⚡ ${te.icon} ${te.techniqueName} 升级！`, { duration: 4000 });
          });
        }
      }
    } catch (err) { console.error("行动失败:", err); toast.error("行动失败，请重试"); }
    finally { setStreamingText(null); setActionLoading(false); }
  };

  const advanceSeason = async () => {
    if (!userId || !cultivator || advancing) return;
    setAdvancing(true);
    try {
      const res = await fetch("/api/advance-quarter", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, worldId: cultivator.worldId, attributes, schoolRank, occupation }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "季节推进失败"); return; }
      if (data.daoXiao) {
        setDaoXiao({ summary: data.summary, name: cultivator.name });
        return;
      }
      setCultivator(data.cultivator);
      if (data.cultivator) {
        const c = data.cultivator;
        if (c.storyEntries) {
          try { const parsed = typeof c.storyEntries === "string" ? JSON.parse(c.storyEntries) : c.storyEntries; setMemoryEntries(Array.isArray(parsed) ? parsed : []); } catch {}
        }
        if (isAwakened(c.realm)) setCanBreak(canBreakthrough(c.realm, c.realmLevel, c.cultivationExp, c.spiritualRoot, c.breakthroughBuff || 0));
        setAvailableActions(getAvailableActions(c.worldId || "earth", c.age, currentLoc));
      }
      if (data.warnEarly) {
        setWarnEarly(true);
        setRemaining(data.remaining);
        setMaxAge(data.maxAge);
      }
      if (data.newAttributes) { setAttributes(data.newAttributes); localStorage.setItem("attributes", JSON.stringify(data.newAttributes)); }
      if (data.schoolRank) { setSchoolRank(data.schoolRank); localStorage.setItem("schoolRank", data.schoolRank); }
      if (data.occupation) { setOccupation(data.occupation); localStorage.setItem("occupation", data.occupation); }
      if (data.examResult) toast.success(`📝 ${data.examResult.description}`, { duration: 5000 });
      const newLocs = getUnlockedLocations(data.cultivator.age, isAwakened(data.cultivator.realm), unlockedLocs);
      localStorage.setItem("unlockedLocations", JSON.stringify(newLocs.map((l: any) => l.id)));
      // 季节推进不生成叙事（按需求删除）
      toast.success(`🌿 ${data.cultivator.name} ${data.yearWrapped ? `${data.newAge}岁` : `第${data.quarter}季`}`, { duration: 3000 });
      if (data.awakenEvent) { setAwakenEvent(data.awakenEvent); toast.success("🎉 灵气觉醒！", { duration: 5000 }); }
    } catch (err) { console.error("季节推进失败:", err); toast.error("季节推进失败"); }
    finally { setAdvancing(false); }
  };

  const handleBreakthrough = async () => {
    if (!userId || !cultivator) return;
    try {
      const res = await fetch("/api/narrative", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, type: "BREAKTHROUGH", worldId: cultivator.worldId }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "突破失败"); return; }
      if (data.cultivator) { setCultivator(data.cultivator); setCanBreak(false);
        if (data.cultivator.storyEntries) {
          try { const parsed = typeof data.cultivator.storyEntries === "string" ? JSON.parse(data.cultivator.storyEntries) : data.cultivator.storyEntries; setMemoryEntries(Array.isArray(parsed) ? parsed : []); } catch {}
        }
      }
      const bn: NarrativeDisplay = { title: data.narrative.title, narrative: data.narrative.narrative, mood: "燃" };
      setNarrative(bn); setNarrativeExpanded(false); setNarrativeHistory((prev) => [bn, ...prev].slice(0, 50));
      toast.success(`⚡ 突破成功！${data.narrative.title}`, { duration: 5000 });
    } catch (err) { console.error("突破失败:", err); toast.error("突破失败"); }
  };


  const sendNpcMessage = async (msg: string) => {
    if (!userId || !cultivator || !npcChat || cultivator.stamina < 1) return;
    setNpcChatHistory((prev) => [...prev, { role: "player", content: msg }]);
    setNpcMessage("");
    toast(`💬 对${npcChat.name}说：${msg}`, { duration: 2000 });
    try {
      const res = await fetch("/api/npc-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, message: msg }),
      });
      const data = await res.json();
      if (data.cultivator) setCultivator(data.cultivator);
    } catch { /* 静默失败，下次同步会修正 */ }
  };

  const handleActionClick = (actionId: string) => {
    if (!cultivator || cultivator.stamina < (getActionById(actionId)?.actionPointCost || 0)) return;
    if (activeActionId === actionId) performAction(actionId);
    else { setActiveActionId(actionId); setActionInput(""); }
  };

  const handleSubmitWithInput = (actionId: string) => {
    if (actionInput.trim()) performAction(actionId, actionInput.trim());
    else performAction(actionId);
  };

  const moodColor = { "燃": "text-[#B83227]", "悟": "text-[#D49B4B]", "静": "text-blue-600", "奇": "text-purple-600", "险": "text-orange-600" }[narrative?.mood || "静"] || "text-stone-600";
  const currentLocName = locs.find((l) => l.id === currentLoc)?.name || "";
  const totalItems = getEquippedItems(inventory).length + getBackpackItems(inventory).length;

  const handleUseItem = async (itemId: string) => {
    if (!userId) return;
    try {
      const res = await fetch("/api/cultivator/use-item", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, itemId, quantity: 1 }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "使用失败"); return; }
      if (data.cultivator) setCultivator(data.cultivator);
      if (data.message) toast.success(data.message);
    } catch { toast.error("使用失败"); }
  };

  // 开发者模式：快速生成角色
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
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: data.user.id, type: "BIRTH", worldName: "地球", identityName, age: 1, worldId: "earth" }),
        });
        if (!r.ok) { const ed = await r.json().catch(() => ({})); throw new Error(ed.error || "出生叙事生成失败"); }
        const birthData = await r.json().catch(() => ({}));
        if (birthData.suggestedName || birthData.cultivator?.name) {
          localStorage.setItem("cultivatorName", birthData.cultivator?.name || birthData.suggestedName);
        }
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
    if (await genNarrative()) { window.location.reload(); }
  };
  // 开发者模式：重置数据
  const handleReset = async () => {
    if (!window.confirm("确定要重置所有数据吗？此操作不可恢复")) return;
    localStorage.clear();
    try { await fetch("/api/cultivator", { method: "DELETE" }); } catch {}
    window.location.href = "/";
  };

  if (loading) return (
    <main className="flex-1 flex items-center justify-center min-h-screen bg-[#FAF7F3]" style={{ fontFamily: "'Noto Serif SC','Songti SC','STSong','SimSun','宋体',Georgia,serif" }}>
      <p className="text-[#8a7a72]">加载中…</p>
    </main>
  );
  if (!cultivator) return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#FAF7F3] p-4" style={{ fontFamily: "'Noto Serif SC','Songti SC','STSong','SimSun','宋体',Georgia,serif" }}>
      <p className="text-[#8a7a72] mb-4">尚未创建修炼者</p>
      <div className="flex gap-2">
        {devMode ? (
          <>
            <button onClick={handleQuickCreate} className="px-4 py-2 rounded-xl bg-[#B83227] text-white text-sm font-medium tracking-widest shadow-sm hover:bg-[#7A1F18] transition-colors">快速生成</button>
            <button onClick={handleReset} className="px-4 py-2 rounded-xl border border-[#EADCD0] bg-white text-[#2C1E1E] text-sm font-medium hover:border-[#B83227] transition-colors">重置数据</button>
          </>
        ) : (
          <button onClick={() => router.push("/create")} className="px-4 py-2 rounded-xl bg-[#B83227] text-white text-sm font-medium tracking-widest shadow-sm hover:bg-[#7A1F18] transition-colors">创建角色</button>
        )}
      </div>
    </main>
  );

  return (
    <main
      className="min-h-screen bg-[#FAF7F3] text-[#2C1E1E]"
      style={{ fontFamily: "'Noto Serif SC','Songti SC','STSong','SimSun','宋体',Georgia,serif" }}
    >
      <TopNav />

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 左栏：命脉道基 */}
        <section className="lg:col-span-5 space-y-6">
          <div className="silk-card rounded-3xl p-8 relative overflow-hidden">
            {/* 朱砂盖印章 */}
            <div className="absolute top-6 right-8 text-center select-none">
              <div className="seal-mark border-2 border-[#B83227] text-[#B83227] px-3 py-1 text-sm font-bold calligraphy bg-white inline-block rounded-sm">
                {realmLabel}
              </div>
              <div className="text-[10px] text-amber-900/60 mt-1 font-mono">{cultivator.age} 岁</div>
            </div>

            {/* 基本信息 */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold calligraphy mb-1 tracking-wider text-[#7A1F18]">{cultivator.name}</h2>
              <div className="flex items-center space-x-3 text-xs">
                <span className="text-[#D49B4B] font-bold">{getRootInfo(cultivator.spiritualRoot).name}</span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">{displayOccupation === "婴儿" ? "🍼" : displayOccupation === "学生" ? "📚" : "👤"} {displayOccupation}</span>
              </div>
              <div className="flex items-center space-x-2 mt-1 text-[11px] text-gray-400">
                {schoolStage && <span>📖 {schoolStage.name}{schoolGrade}年级{schoolRank !== "普通" ? `（${schoolRank}）` : ""}</span>}
                {currentLocName && <span>📍 {currentLocName}</span>}
              </div>
            </div>

            {/* 核心资源 */}
            <div className="space-y-6 border-t border-b border-[#EADCD0] py-6 mb-6">
              {isAwake && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>修炼值</span><span className="font-mono font-bold text-[#7A1F18]">{cultivator.cultivationExp}</span>
                  </div>
                  <div className="h-2.5 w-full bg-[#F3EBE1] rounded-full overflow-hidden border border-[#EADCD0]">
                    <div className="vermilion-progress-solid h-full transition-all duration-300" style={{ width: `${Math.min(100, (cultivator.cultivationExp / 100) * 100)}%` }} />
                  </div>
                </div>
              )}

              {/* 行动力 */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold text-gray-500"><Zap className="w-3 h-3 inline mr-1 text-[#D49B4B]" /> 行动力</span>
                  <span className="font-mono text-sm font-bold text-[#7A1F18]">{cultivator.stamina} / {maxStamina}</span>
                </div>
                <div className="h-2.5 w-full bg-[#F3EBE1] rounded-full overflow-hidden border border-[#EADCD0]">
                  <div className="vermilion-progress-solid h-full transition-all duration-300" style={{ width: `${(cultivator.stamina / maxStamina) * 100}%` }} />
                </div>
              </div>

              {/* 寿元 */}
              {maxAge !== null && maxAge > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-500">寿元：{cultivator.age} / {maxAge >= 999999 ? "∞" : maxAge} 岁</span>
                  <div className="w-full h-2 bg-[#F3EBE1] rounded-full overflow-hidden border border-[#EADCD0]">
                    <div className={`h-full rounded-full transition-all ${
                      remaining <= 5 ? "bg-red-500" : remaining < maxAge * 0.1 ? "bg-[#D49B4B]" : "bg-[#7FA97F]"
                    }`} style={{ width: `${Math.max(0, (remaining / maxAge) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400">剩余 {Math.max(0, remaining)} 年</span>
                </div>
              )}

              {/* 金币存余 */}
              <div className="flex justify-between items-center p-3 bg-[#FAF4EB] rounded-2xl border border-[#D49B4B]/40">
                <span className="text-xs font-bold text-amber-900/80"><Coins className="w-3.5 h-3.5 inline mr-1 text-[#D49B4B]" /> 金币存余</span>
                <span className="font-mono font-bold text-lg text-[#7A1F18]">{cultivator.gold ?? 50}</span>
              </div>
            </div>

            {/* 六大基础属性框 */}
            <div className="grid grid-cols-3 gap-3">
              {ATTR_INFO.map((a) => (
                <div key={a.key} className="bg-white p-3 rounded-2xl border border-[#EADCD0] text-center hover:border-[#B83227] transition-colors group shadow-sm">
                  <p className="text-[10px] text-gray-400 group-hover:text-[#B83227] transition-colors">{a.label}</p>
                  <p className="font-mono font-bold text-sm text-[#2C1E1E]">{Math.round(attributes[a.key] || 0)}</p>
                </div>
              ))}
            </div>

            {inventory.some((i) => i.itemId === "phone") && (
              <button onClick={() => router.push("/phone")}
                className="mt-4 w-full flex items-center gap-2 text-xs bg-[#FDF2F0] text-[#7A1F18] border border-[#B83227]/20 rounded-lg px-3 py-2 hover:bg-[#B83227]/10 transition-colors">
                📱 打开手机
              </button>
            )}
            {isAwake && <p className="text-gray-400 text-xs mt-3">累计修炼值：{cultivator.totalExp}</p>}
          </div>
        </section>

        {/* 右栏：境域 · 剧情 · 抉择 */}
        <section className="lg:col-span-7 space-y-6">
          {/* 觉醒事件 */}
          {awakenEvent && (
            <div className="silk-card border-[#B83227]/40 bg-[#FDF2F0] rounded-3xl p-6">
              <p className="text-[#B83227] font-bold text-lg mb-2">{awakenEvent.title}</p>
              <p className="text-[#2C1E1E] text-sm whitespace-pre-wrap">{awakenEvent.narrative}</p>
              <button onClick={() => setAwakenEvent(null)} className="mt-3 w-full py-2.5 rounded-xl bg-[#B83227] text-white text-sm font-medium tracking-widest shadow-sm hover:bg-[#7A1F18] transition-colors">踏入仙途</button>
            </div>
          )}

          {/* 境域与人脉 */}
          <div className="silk-card rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-[#B83227]" />
                <h3 className="text-sm font-bold text-amber-950/80">当前境域：<span>{currentLocName}</span></h3>
              </div>
            </div>

            {currentNPCs.length > 0 && (
              <div className="flex flex-wrap gap-3 items-center text-xs">
                <span className="text-gray-400">附近的人：</span>
                <div className="flex flex-wrap gap-2">
                  {currentNPCs.map((npc) => (
                    <button key={npc.name} onClick={() => { setNpcChat(npc); setNpcChatHistory([]); setNpcMessage(""); }}
                      className="bg-[#FDF2F0] text-[#7A1F18] px-3 py-1.5 rounded-xl border border-[#B83227]/20 flex items-center space-x-2 cursor-pointer hover:scale-105 transition-transform">
                      <span>{npc.avatar}</span>
                      <span className="font-bold">{npc.name} {isAwake && npc.realm ? <span className="font-normal opacity-70 text-[9px]">({npc.realm})</span> : null}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 物品包袱 */}
            <div className="mt-4 pt-4 border-t border-[#EADCD0]">
              <button onClick={() => setShowItems(!showItems)}
                className="w-full flex justify-between items-center text-xs text-gray-500 hover:text-[#B83227] transition-colors">
                <span className="font-bold">🎒 物品包袱 ({totalItems}件)</span>
                <span className={`transition-transform ${showItems ? "rotate-180" : ""}`}>▾</span>
              </button>
              {showItems && (
                <TooltipProvider delay={0}>
                  <div className="mt-3 p-3 text-[11px] text-gray-400 bg-[#FAF4EB] rounded-xl border border-[#EADCD0] flex flex-wrap gap-1">
                    {getEquippedItems(inventory).map((inv) => {
                      const item = getItemById(inv.itemId); if (!item) return null;
                      return (
                        <Tooltip key={inv.itemId}>
                          <TooltipTrigger render={<span className="inline-flex items-center gap-1 text-[10px] bg-[#F0E8D8] text-[#8B7355] px-1.5 py-0.5 rounded border border-[#D8C8B0] m-0.5 cursor-help" />}>{item.icon}{item.name}</TooltipTrigger>
                          <TooltipContent side="top" className="bg-white text-[#2C1E1E] border border-[#EADCD0] text-xs max-w-48 shadow-md"><p className="font-medium">{item.icon} {item.name}</p><p className="text-gray-400 mt-0.5">{item.description}</p>{item.effect && <p className="text-[#D49B4B] mt-0.5">✨ {item.effect}</p>}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                    {getBackpackItems(inventory).map((inv) => {
                      const item = getItemById(inv.itemId); if (!item) return null;
                      return (
                        <Tooltip key={inv.itemId}>
                          <TooltipTrigger render={<span className="inline-flex items-center gap-1 text-[10px] bg-[#FAF4EB] text-gray-500 px-1.5 py-0.5 rounded m-0.5 cursor-help" />}>{item.icon}{item.name}{inv.quantity > 1 ? `×${inv.quantity}` : ""}</TooltipTrigger>
                          <TooltipContent side="top" className="bg-white text-[#2C1E1E] border border-[#EADCD0] text-xs max-w-48 shadow-md"><p className="font-medium">{item.icon} {item.name}</p><p className="text-gray-400 mt-0.5">{item.description}</p>{item.effect && <p className="text-[#D49B4B] mt-0.5">✨ {item.effect}</p>}
                          {(item as any).useEffect && <button onClick={() => handleUseItem(inv.itemId)} className="mt-1 w-full text-xs bg-[#B83227] text-white rounded px-2 py-0.5 hover:bg-[#7A1F18]">{(item as any).useLabel || "使用"}</button>}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    {totalItems === 0 && <span className="text-gray-400">袖里乾坤空空如也，尚无灵材入账。</span>}
                  </div>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* NPC 对话弹窗 */}
          {npcChat && (
            <div className="silk-card rounded-3xl p-6">
              <div className="flex flex-row items-center justify-between pb-2">
                <p className="text-xs text-[#2C1E1E] font-bold">{npcChat.avatar} 与{npcChat.name}交谈</p>
                <button onClick={() => setNpcChat(null)} className="text-gray-400 hover:text-[#B83227] text-xs">✕</button>
              </div>
              <div className="space-y-2">
                <div className="max-h-24 overflow-y-auto space-y-1 text-xs text-[#2C1E1E]">
                  {npcChatHistory.length === 0 && <p className="text-gray-400 italic">{npcChat.greeting}</p>}
                  {npcChatHistory.map((h, i) => (
                    <p key={i} className={h.role === "player" ? "text-right text-[#B83227]" : "text-[#2C1E1E]"}>{h.content}</p>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input value={npcMessage} onChange={(e) => setNpcMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && npcMessage.trim() && cultivator && cultivator.stamina >= 1) sendNpcMessage(npcMessage); }}
                    placeholder="说点什么...（消耗1行动力）" className="flex-1 h-7 text-[11px] bg-white border border-[#EADCD0] text-[#2C1E1E] rounded-lg px-2 focus:outline-none focus:border-[#B83227]" />
                  <button className="h-7 w-7 bg-[#B83227] hover:bg-[#7A1F18] shrink-0 text-white rounded-lg flex items-center justify-center disabled:opacity-50"
                    disabled={!npcMessage.trim() || !cultivator || cultivator.stamina < 1}
                    onClick={() => sendNpcMessage(npcMessage)}>
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 主线剧情与抉择 */}
          {(narrative || streamingText !== null) && (
            <div className="silk-card rounded-3xl p-8">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-[#EADCD0]">
                <div className="w-8 h-8 rounded-full bg-[#FDF2F0] flex items-center justify-center text-[#B83227]">
                  <ScrollText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="calligraphy text-xl font-bold tracking-widest text-[#2C1E1E]">{streamingText !== null ? "✍️ 叙事流转中…" : narrative?.title}</h3>
                  <p className="text-[10px] text-[#D49B4B] font-bold uppercase tracking-widest">{streamingText !== null ? "Streaming" : "Main Event"}</p>
                </div>
              </div>

              <div className="relative group">
                {streamingText !== null ? (
                  <p className="text-sm leading-relaxed text-amber-950/80 tracking-wide whitespace-pre-wrap">
                    {streamingText}<span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-[#B83227] animate-pulse" />
                  </p>
                ) : (
                  <p className={`text-sm leading-relaxed text-amber-950/80 tracking-wide ${!narrativeExpanded && (narrative?.narrative?.length || 0) > 150 ? "line-clamp-4" : ""}`}>
                    {narrative?.narrative}
                  </p>
                )}
                {streamingText === null && (narrative?.narrative?.length || 0) > 150 && (
                  <button onClick={() => setNarrativeExpanded(!narrativeExpanded)} className="mt-3 text-xs text-[#B83227] font-bold flex items-center space-x-1 hover:underline">
                    <span>{narrativeExpanded ? "▲ 收起全文" : "▼ 展开全文"}</span>
                  </button>
                )}
              </div>

              {streamingText === null && narrative?.hint && <p className="text-gray-400 text-xs italic mt-3">💡 {narrative.hint}</p>}

              {/* 抉择按钮 */}
              <div className="mt-8">
                <p className="text-[10px] font-bold text-gray-400 tracking-widest mb-4 flex items-center">
                  <span className="w-4 h-[1px] bg-red-300 mr-2"></span> 当下抉择
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {availableActions.filter((a) => a.id !== "FREE").slice(0, 6).map((action) => {
                    const isActive = activeActionId === action.id;
                    const cant = cultivator.stamina < action.actionPointCost;
                    return (
                      <div key={action.id} className="flex flex-col gap-1">
                        <button
                          disabled={actionLoading || cant}
                          onClick={() => handleActionClick(action.id)}
                          className={`group p-4 bg-white border border-[#EADCD0] rounded-2xl hover:border-[#B83227] hover:bg-[#FDF2F0] transition-all text-left flex items-center justify-between shadow-sm ${cant ? "opacity-40" : isActive ? "border-[#B83227] bg-[#FDF2F0]" : ""}`}>
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-[#FAF4EB] group-hover:bg-[#B83227] group-hover:text-white flex items-center justify-center transition-colors text-amber-900/70">
                              <span className="text-base leading-none">{action.icon}</span>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-[#2C1E1E]">{action.name}</h4>
                              <p className="text-[9px] text-gray-400 mt-0.5">尝试行动</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-[#D49B4B]">-{action.actionPointCost}</span>
                        </button>
                        {isActive && (
                          <div className="flex gap-1 animate-in slide-in-from-top-1 fade-in duration-150">
                            <input placeholder="描述你想怎么做…" value={actionInput} onChange={(e) => setActionInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleSubmitWithInput(action.id); }}
                              className="flex-1 h-7 text-[11px] bg-white border border-[#EADCD0] text-[#2C1E1E] rounded-lg px-2 focus:outline-none focus:border-[#B83227]" disabled={actionLoading} autoFocus />
                            <button className="h-7 w-7 bg-[#B83227] hover:bg-[#7A1F18] shrink-0 text-white rounded-lg flex items-center justify-center disabled:opacity-50" disabled={actionLoading} onClick={() => handleSubmitWithInput(action.id)}>
                              <Send className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {availableActions.filter((a) => a.id !== "FREE").length === 0 && (
                  <p className="text-gray-400 text-xs text-center py-2">当前无可用的行动</p>
                )}
              </div>
            </div>
          )}

          {/* 功能按钮 */}
          <div className="flex gap-2">
            {canBreak && (
              <button className="flex-1 bg-[#B83227] hover:bg-[#7A1F18] text-white h-12 text-base rounded-xl shadow-sm transition-colors flex items-center justify-center" onClick={handleBreakthrough}>
                <Sword className="w-4 h-4 mr-2" />境界突破
              </button>
            )}
            <button className="flex-1 border border-[#EADCD0] bg-white hover:bg-[#FDF2F0] text-[#2C1E1E] h-12 text-base rounded-xl transition-colors flex items-center justify-center" onClick={advanceSeason} disabled={advancing}>
              <SkipForward className="w-4 h-4 mr-2 text-[#B83227]" />推进季节
            </button>
          </div>

          {/* 叙事历史 */}
          {narrativeHistory.length > 1 && (
            <div className="silk-card rounded-3xl p-6">
              <p className="text-gray-400 text-xs font-bold flex items-center gap-1 mb-3"><ScrollText className="w-3 h-3" />最近记录</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {narrativeHistory.slice(0, 5).map((n, i) => (
                  <p key={i} className="text-gray-400 text-xs border-b border-[#EADCD0] pb-1 last:border-0">{n.title}</p>
                ))}
              </div>
            </div>
          )}

          <MemoryPanel
            cultivatorId={userId!}
            entries={memoryEntries}
            onEntriesChange={setMemoryEntries}
          />

          {isAwake && (
            <button onClick={() => setTechniquePanelOpen(true)}
              className="w-full flex items-center gap-2 text-xs bg-white border border-[#EADCD0] rounded-lg px-3 py-2 hover:bg-[#FDF2F0] hover:border-[#B83227] transition-colors text-[#2C1E1E]">
              📖 功法
            </button>
          )}
        </section>
      </div>


      <TechniquePanel
        cultivatorId={userId!}
        open={techniquePanelOpen}
        onOpenChange={setTechniquePanelOpen}
      />

      {daoXiao && (
        <DaoXiaoModal
          open={true}
          cultivatorName={daoXiao.name}
          userId={userId || ""}
          summary={daoXiao.summary}
          onClose={() => setDaoXiao(null)}
        />
      )}

      {warnEarly && (
        <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto z-50">
          <div className="bg-[#FDF2F0] border border-[#B83227]/30 rounded-lg p-3 shadow-lg">
            <p className="text-[#B83227] text-sm font-medium">⚠️ 大限将至</p>
            <p className="text-[#7A1F18] text-xs mt-1">
              仅剩 {remaining} 年寿元。突破境界可延年益寿。
            </p>
            <button
              onClick={() => setWarnEarly(false)}
              className="text-[#B83227] text-xs underline mt-1"
            >
              知晓了
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .silk-card {
          background-color: #FFFFFF;
          border: 1px solid #EADCD0;
          box-shadow: 0 4px 20px -2px rgba(122, 31, 24, 0.05);
          transition: all 0.25s ease;
        }
        .silk-card:hover {
          box-shadow: 0 8px 25px -2px rgba(122, 31, 24, 0.1);
          border-color: rgba(184, 50, 39, 0.35);
        }
        .vermilion-progress-solid { background-color: #B83227; }
        .nav-tag {
          transition: all 0.2s ease;
        }
        .nav-tag.active {
          background-color: #B83227 !important;
          color: #FFFFFF !important;
          border-color: #B83227 !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(184, 50, 39, 0.25);
        }
        .calligraphy {
          font-family: 'Ma Shan Zheng', 'STKaiti', 'KaiTi', '楷体', '华文行楷', cursive, serif;
        }
        @keyframes sealDrop {
          0% { transform: scale(1.4) rotate(8deg); opacity: 0; }
          100% { transform: scale(1) rotate(-3deg); opacity: 0.95; }
        }
        .seal-mark {
          animation: sealDrop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.2) forwards;
        }
      `}</style>
    </main>
  );
}
