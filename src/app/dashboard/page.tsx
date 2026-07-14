"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sparkles, Zap, Send, SkipForward, Sword, ScrollText, Home } from "lucide-react";
import BottomNav from "@/components/bottom-nav";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  getAvailableActions, getActionById, formatRealmLevel, MORTAL_REALM, isAwakened,
  canBreakthrough, getRootInfo, getStarterInventory, getItemById,
  getEquippedItems, getBackpackItems, getSchoolStage, getSchoolGrade,
  getDefaultOccupation, getUnlockedLocations, ATTR_INFO,
  calcTravelCost, calculateMaxStamina, getNPCsAtLocation,
} from "@/lib";
import type { Action, InventoryItem, NPC } from "@/lib";
import { toast } from "sonner";
import MemoryPanel from "@/components/memory-panel";
import DaoXiaoModal from "@/components/dao-xiao-modal";
import TechniquePanel from "@/components/technique-panel";

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
  const [availableActions, setAvailableActions] = useState<Action[]>([]);
  const [canBreak, setCanBreak] = useState(false);
  const [awakenEvent, setAwakenEvent] = useState<{ title: string; narrative: string } | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [attributes, setAttributes] = useState<Record<string, number>>({});
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [occupation, setOccupation] = useState("");
  const [schoolRank, setSchoolRank] = useState("普通");
  const [currentLoc, setCurrentLoc] = useState("home");
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
      const loc = localStorage.getItem("currentLocation");
      if (loc) setCurrentLoc(loc);
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
          setCanBreak(canBreakthrough(capped.realm, capped.realmLevel, capped.cultivationExp, capped.spiritualRoot));
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
    setActionLoading(true); setActiveActionId(null); setActionInput("");
    try {
      let familyData = null;
      try { const raw = localStorage.getItem("family"); if (raw) familyData = JSON.parse(raw); } catch {}
      const res = await fetch("/api/action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, actionId, freeInput: input || undefined, worldId: cultivator.worldId, family: familyData, attributes }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "行动失败"); return; }
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
        if (isAwakened(c.realm)) setCanBreak(canBreakthrough(c.realm, c.realmLevel, c.cultivationExp, c.spiritualRoot));
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
    } catch (err) { console.error("行动失败:", err); toast.error("行动失败，请重试"); }
    finally { setActionLoading(false); }
  };

  const advanceYear = async () => {
    if (!userId || !cultivator || advancing) return;
    setAdvancing(true);
    try {
      let familyData = null;
      try { const raw = localStorage.getItem("family"); if (raw) familyData = JSON.parse(raw); } catch {}
      const res = await fetch("/api/advance-year", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, worldId: cultivator.worldId, family: familyData, attributes, schoolRank, occupation }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "时间推进失败"); return; }
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
        if (isAwakened(c.realm)) setCanBreak(canBreakthrough(c.realm, c.realmLevel, c.cultivationExp, c.spiritualRoot));
        setAvailableActions(getAvailableActions(c.worldId || "earth", c.age, currentLoc));
      }
      if (data.warnEarly) {
        setWarnEarly(true);
        setRemaining(data.remaining);
        setMaxAge(data.maxAge);
      }
      if (data.updatedFamily) localStorage.setItem("family", JSON.stringify(data.updatedFamily));
      if (data.intimacyChanges) {
        const bad = data.intimacyChanges.filter((c: any) => c.delta < 0);
        if (bad.length > 0) toast(bad.map((c: any) => `💔 ${c.relation}${c.name} 疏远${Math.abs(c.delta)}`).join(" "), { duration: 4000 });
      }
      if (data.newAttributes) { setAttributes(data.newAttributes); localStorage.setItem("attributes", JSON.stringify(data.newAttributes)); }
      if (data.schoolRank) { setSchoolRank(data.schoolRank); localStorage.setItem("schoolRank", data.schoolRank); }
      if (data.occupation) { setOccupation(data.occupation); localStorage.setItem("occupation", data.occupation); }
      if (data.examResult) toast.success(`📝 ${data.examResult.description}`, { duration: 5000 });
      const newLocs = getUnlockedLocations(data.cultivator.age, isAwakened(data.cultivator.realm), unlockedLocs);
      localStorage.setItem("unlockedLocations", JSON.stringify(newLocs.map((l: any) => l.id)));
      const yearN: NarrativeDisplay = { title: data.narrative.title, narrative: data.narrative.narrative, mood: data.narrative.mood };
      setNarrative(yearN); setNarrativeExpanded(false); setNarrativeHistory((prev) => [yearN, ...prev].slice(0, 50));
      toast.success(`🎊 ${data.cultivator.name} ${data.newAge}岁！`, { duration: 3000 });
      if (data.awakenEvent) { setAwakenEvent(data.awakenEvent); toast.success("🎉 灵气觉醒！", { duration: 5000 }); }
    } catch (err) { console.error("时间推进失败:", err); toast.error("时间推进失败"); }
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

  const switchLocation = (locId: string, useTaxi = false) => {
    if (!cultivator) return;
    const target = locs.find((l) => l.id === locId);
    if (!target || locId === currentLoc) return;
    const cost = calcTravelCost(currentLoc, locId);
    const taxiStaminaCost = Math.max(1, Math.floor(cost / 3));
    const taxiGoldCost = cost * 3;
    const currentGold = cultivator.gold ?? 50;

    if (!useTaxi) {
      if (cultivator.stamina >= cost) {
        const walk = window.confirm(`前往「${target.name}」\n步行：${cost}行动力\n打车：${taxiStaminaCost}行动力+${taxiGoldCost}金币\n\n确定=步行  取消=打车`);
        if (!walk) {
          if (currentGold >= taxiGoldCost && cultivator.stamina >= taxiStaminaCost) {
            switchLocation(locId, true);
          } else {
            toast.error(currentGold < taxiGoldCost ? `金币不足！需要${taxiGoldCost}` : `行动力不足！需要${taxiStaminaCost}`);
          }
          return;
        }
      } else {
        if (currentGold >= taxiGoldCost && cultivator.stamina >= taxiStaminaCost) {
          if (window.confirm(`行动力不足（需要${cost}/${cultivator.stamina}）\n打车前往需${taxiStaminaCost}行动力+${taxiGoldCost}金币，是否打车？`)) {
            switchLocation(locId, true);
          }
          return;
        }
        toast.error(`行动力不足！需要${cost}点`);
        return;
      }
    }

    const finalStamina = cultivator.stamina - (useTaxi ? taxiStaminaCost : cost);
    const finalGold = useTaxi ? currentGold - taxiGoldCost : currentGold;
    setCultivator({ ...cultivator, stamina: finalStamina, gold: finalGold, location: locId });
    setCurrentLoc(locId);
    localStorage.setItem("currentLocation", locId);
    toast.success(`📍 ${useTaxi ? "打车到" : "来到"}${target.name}${useTaxi ? `(-${taxiGoldCost}金)` : ""}`, { duration: 1500 });

    // 持久化旅行消耗到后端
    if (userId) {
      fetch("/api/travel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, locationId: locId, staminaCost: useTaxi ? taxiStaminaCost : cost, goldCost: useTaxi ? taxiGoldCost : 0, useTaxi }),
      }).catch((err) => console.error("旅行持久化失败:", err));
    }
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

  const moodColor = { "燃": "text-red-600", "悟": "text-amber-600", "静": "text-blue-600", "奇": "text-purple-600", "险": "text-orange-600" }[narrative?.mood || "静"] || "text-stone-600";
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
    // 生成家庭
    const { generateEarthFamily } = await import("@/lib/family");
    const family = generateEarthFamily(1, identity.id);
    localStorage.setItem("family", JSON.stringify(family));
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
          body: JSON.stringify({ userId: data.user.id, type: "BIRTH", worldName: "地球", identityName, age: 1, worldId: "earth", family: family.members }),
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
    if (await genNarrative()) { window.location.reload(); }
  };
  // 开发者模式：重置数据
  const handleReset = async () => {
    if (!window.confirm("确定要重置所有数据吗？此操作不可恢复")) return;
    localStorage.clear();
    try { await fetch("/api/cultivator", { method: "DELETE" }); } catch {}
    window.location.href = "/";
  };

  if (loading) return <main className="flex-1 flex items-center justify-center min-h-screen bg-transparent"><p className="text-muted-foreground">加载中...</p></main>;
  if (!cultivator) return <main className="flex-1 flex flex-col items-center justify-center min-h-screen bg-transparent p-4"><p className="text-muted-foreground mb-4">尚未创建修炼者</p><div className="flex gap-2">{devMode ? <><Button onClick={handleQuickCreate}>快速生成</Button><Button variant="outline" className="border-border" onClick={handleReset}>重置数据</Button></> : <Button onClick={() => router.push("/create")}>创建角色</Button>}</div></main>;

  return (
    <main className="flex-1 flex flex-col min-h-screen bg-transparent pb-20">
      <div className="relative z-10 max-w-lg w-full mx-auto p-4 space-y-2">

        {/* 顶栏 */}
        <div className="flex items-center py-1 border-b border-border">
          <button onClick={() => router.push("/")} className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors text-sm">
          {devMode && <span className="ml-auto text-xs text-orange-500 font-bold">DEV MODE</span>}
            <Home className="w-4 h-4" /> 返回
          </button>
        </div>

        {/* 角色状态 */}
        <Card className="border-border bg-card shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground text-lg font-bold">{cultivator.name}</CardTitle>
                <p className="text-muted-foreground text-xs">{getRootInfo(cultivator.spiritualRoot).name}</p>
              </div>
              <div className="text-right">
                <p className="text-primary font-bold text-base">{realmLabel}</p>
                <p className="text-muted-foreground text-xs">{cultivator.age}岁</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{displayOccupation === "婴儿" ? "🍼" : displayOccupation === "学生" ? "📚" : "👤"} {displayOccupation}</span>
              {schoolStage && <span>📖 {schoolStage.name}{schoolGrade}年级{schoolRank !== "普通" ? `（${schoolRank}）` : ""}</span>}
              {currentLocName && <span>📍 {currentLocName}</span>}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isAwake && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>修炼值</span><span>{cultivator.cultivationExp}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1">
                  <div className="bg-[#5A7A6A] h-1 rounded-full transition-all" style={{ width: `${Math.min(100, (cultivator.cultivationExp / 100) * 100)}%` }} />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-foreground">行动力</span>
              <div className="flex-1 bg-secondary rounded-full h-1.5">
                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${(cultivator.stamina / maxStamina) * 100}%` }} />
              </div>
              <span className="text-muted-foreground text-xs">{cultivator.stamina}/{maxStamina}</span>
            </div>
            {maxAge !== null && maxAge > 0 && (
              <div className="text-xs text-muted-foreground">
                <span>寿元：{cultivator.age} / {maxAge >= 999999 ? "∞" : maxAge} 岁</span>
                <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    remaining <= 5 ? "bg-red-500" : remaining < maxAge * 0.1 ? "bg-yellow-500" : "bg-green-500"
                  }`} style={{ width: `${Math.max(0, (remaining / maxAge) * 100)}%` }} />
                </div>
                <span className="text-[10px]">剩余 {Math.max(0, remaining)} 年</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">💰 金币</span>
              <span className="text-foreground font-medium">{cultivator.gold ?? 50}</span>
            </div>
            {inventory.some((i) => i.itemId === "phone") && (
              <button onClick={() => router.push("/phone")}
                className="w-full flex items-center gap-2 text-xs bg-primary/10 text-primary border border-primary/20 rounded-lg px-3 py-2 hover:bg-primary/20 transition-colors">
                📱 打开手机
              </button>
            )}
            <TooltipProvider delay={0}>
            <div className="flex flex-wrap gap-1">
              {ATTR_INFO.map((a) => (
                <Tooltip key={a.key}>
                  <TooltipTrigger render={<span className="inline-flex items-center gap-1 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded cursor-help" />}>
                    {a.icon}{a.label}{Math.round(attributes[a.key] || 0)}
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-white text-foreground border border-border text-xs max-w-56 shadow-md">
                    <p className="font-medium">{a.icon} {a.label}</p>
                    <p className="text-muted-foreground mt-0.5">{a.description}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            </TooltipProvider>
            {isAwake && <p className="text-muted-foreground text-xs">累计修炼值：{cultivator.totalExp}</p>}
          </CardContent>
        </Card>

        {/* 地点栏 */}
        {locs.length > 1 && (
          <div className="flex gap-1 overflow-x-auto py-1">
            {locs.map((loc) => {
              const cost = currentLoc !== loc.id ? calcTravelCost(currentLoc, loc.id) : 0;
              return (
                <button key={loc.id} onClick={() => switchLocation(loc.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs whitespace-nowrap transition-colors border ${
                    currentLoc === loc.id ? "bg-primary/10 text-primary border-primary/30" : "bg-card text-muted-foreground border-border hover:border-primary/30"
                  }`}>
                  {loc.icon}{loc.name}{cost > 0 && <span className="text-[9px]">({cost})</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* 附近的人 */}
        {currentNPCs.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">👥 附近的人</p>
            <div className="flex gap-1 overflow-x-auto">
              {currentNPCs.map((npc) => (
                <button key={npc.name} onClick={() => { setNpcChat(npc); setNpcChatHistory([]); setNpcMessage(""); }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs whitespace-nowrap border border-border bg-card hover:bg-muted transition-colors">
                  <span>{npc.avatar}</span>
                  <span className="text-foreground">{npc.name}</span>
                  <span className="text-muted-foreground">{npc.realm}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* NPC 对话弹窗 */}
        {npcChat && (
          <Card className="border-primary/30 bg-card shadow-md">
            <CardHeader className="pb-1 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-foreground">{npcChat.avatar} 与{npcChat.name}交谈</CardTitle>
              <button onClick={() => setNpcChat(null)} className="text-muted-foreground hover:text-primary text-xs">✕</button>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="max-h-24 overflow-y-auto space-y-1 text-xs text-foreground">
                {npcChatHistory.length === 0 && <p className="text-muted-foreground italic">{npcChat.greeting}</p>}
                {npcChatHistory.map((h, i) => (
                  <p key={i} className={h.role === "player" ? "text-right text-primary" : "text-foreground"}>{h.content}</p>
                ))}
              </div>
              <div className="flex gap-1">
                <Input value={npcMessage} onChange={(e) => setNpcMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && npcMessage.trim() && cultivator && cultivator.stamina >= 1) sendNpcMessage(npcMessage); }}
                  placeholder="说点什么...（消耗1行动力）" className="flex-1 h-7 text-[11px] bg-white border-border text-foreground" />
                <Button size="icon" className="h-7 w-7 bg-primary hover:bg-[#B33A2A] shrink-0 text-white"
                  disabled={!npcMessage.trim() || !cultivator || cultivator.stamina < 1}
                  onClick={() => sendNpcMessage(npcMessage)}>
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 物品栏（折叠） */}
        <button onClick={() => setShowItems(!showItems)}
          className="flex items-center gap-2 w-full text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors">
          🎒 物品 ({totalItems}件) <span className="ml-auto">{showItems ? "▲" : "▼"}</span>
        </button>
        {showItems && (
          <TooltipProvider delay={0}>
          <Card className="border-border bg-card shadow-md">
            <CardContent className="p-2">
              {getEquippedItems(inventory).map((inv) => {
                const item = getItemById(inv.itemId); if (!item) return null;
                return (
                  <Tooltip key={inv.itemId}>
                    <TooltipTrigger render={<span className="inline-flex items-center gap-1 text-[10px] bg-[#F0E8D8] text-[#8B7355] px-1.5 py-0.5 rounded border border-[#D8C8B0] m-0.5 cursor-help" />}>{item.icon}{item.name}</TooltipTrigger>
                    <TooltipContent side="top" className="bg-white text-foreground border border-border text-xs max-w-48 shadow-md"><p className="font-medium">{item.icon} {item.name}</p><p className="text-muted-foreground mt-0.5">{item.description}</p>{item.effect && <p className="text-amber-600 mt-0.5">✨ {item.effect}</p>}</TooltipContent>
                  </Tooltip>
                );
              })}
              {getBackpackItems(inventory).map((inv) => {
                const item = getItemById(inv.itemId); if (!item) return null;
                return (
                  <Tooltip key={inv.itemId}>
                    <TooltipTrigger render={<span className="inline-flex items-center gap-1 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded m-0.5 cursor-help" />}>{item.icon}{item.name}{inv.quantity > 1 ? `×${inv.quantity}` : ""}</TooltipTrigger>
                    <TooltipContent side="top" className="bg-white text-foreground border border-border text-xs max-w-48 shadow-md"><p className="font-medium">{item.icon} {item.name}</p><p className="text-muted-foreground mt-0.5">{item.description}</p>{item.effect && <p className="text-amber-600 mt-0.5">✨ {item.effect}</p>}
                    {(item as any).useEffect && <button onClick={() => handleUseItem(inv.itemId)} className="mt-1 w-full text-xs bg-primary text-white rounded px-2 py-0.5 hover:bg-primary/90">{(item as any).useLabel || "使用"}</button>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {totalItems === 0 && <span className="text-xs text-muted-foreground">背包为空</span>}
            </CardContent>
          </Card>
          </TooltipProvider>
        )}

        {/* 觉醒事件 */}
        {awakenEvent && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-primary font-bold text-lg mb-2">{awakenEvent.title}</p>
              <p className="text-foreground text-sm whitespace-pre-wrap">{awakenEvent.narrative}</p>
              <Button className="mt-3 w-full bg-primary hover:bg-[#B33A2A] text-white" onClick={() => setAwakenEvent(null)}>踏入仙途</Button>
            </CardContent>
          </Card>
        )}

        {/* 叙事 */}
        {narrative && (
          <Card className="border-border bg-card shadow-md">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-lg ${moodColor}`}>{narrative.mood === "燃" ? "🔥" : narrative.mood === "悟" ? "💡" : narrative.mood === "静" ? "🌊" : narrative.mood === "奇" ? "✨" : "⚡"}</span>
                <p className={`font-semibold ${moodColor}`}>{narrative.title}</p>
              </div>
              <div className={`text-foreground text-sm leading-relaxed whitespace-pre-wrap ${!narrativeExpanded && narrative.narrative.length > 150 ? "line-clamp-3" : ""}`}>
                {narrative.narrative}
              </div>
              {narrative.narrative.length > 150 && (
                <button onClick={() => setNarrativeExpanded(!narrativeExpanded)} className="text-primary text-xs hover:underline">
                  {narrativeExpanded ? "▲ 收起" : "▼ 展开全文"}
                </button>
              )}
              {narrative.hint && <p className="text-muted-foreground text-xs italic">💡 {narrative.hint}</p>}
            </CardContent>
          </Card>
        )}

        {/* 行动面板 */}
        <Card className="border-border bg-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> 行动
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {availableActions.filter((a) => a.id !== "FREE").slice(0, 6).map((action) => {
                const isActive = activeActionId === action.id;
                return (
                  <div key={action.id} className="flex flex-col gap-1">
                    <Button variant="outline"
                      className={`h-auto py-2 px-2 flex flex-col items-center gap-0.5 border-border bg-white overflow-hidden ${
                        cultivator.stamina < action.actionPointCost ? "opacity-40" : isActive ? "border-primary bg-primary/5" : "hover:border-primary/50"
                      }`}
                      disabled={actionLoading || cultivator.stamina < action.actionPointCost}
                      onClick={() => handleActionClick(action.id)}>
                      <span className="text-base leading-none">{action.icon}</span>
                      <span className="text-[11px] text-foreground truncate w-full text-center">{action.name}</span>
                      <span className="text-[9px] text-muted-foreground">-{action.actionPointCost}</span>
                    </Button>
                    {isActive && (
                      <div className="flex gap-1 animate-in slide-in-from-top-1 fade-in duration-150">
                        <Input placeholder="描述你想怎么做…" value={actionInput} onChange={(e) => setActionInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSubmitWithInput(action.id); }}
                          className="flex-1 h-7 text-[11px] bg-white border-border text-foreground" disabled={actionLoading} autoFocus />
                        <Button size="icon" className="h-7 w-7 bg-primary hover:bg-[#B33A2A] shrink-0 text-white" disabled={actionLoading} onClick={() => handleSubmitWithInput(action.id)}>
                          <Send className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {availableActions.filter((a) => a.id !== "FREE").length === 0 && (
              <p className="text-muted-foreground text-xs text-center py-2">当前无可用的行动</p>
            )}
          </CardContent>
        </Card>

        {/* 功能按钮 */}
        <div className="flex gap-2">
          {canBreak && (
            <Button className="flex-1 bg-primary hover:bg-[#B33A2A] text-white h-12 text-base" onClick={handleBreakthrough}>
              <Sword className="w-4 h-4 mr-2" />境界突破
            </Button>
          )}
          <Button variant="outline" className="flex-1 border-border bg-white hover:bg-muted text-foreground h-12 text-base" onClick={advanceYear} disabled={advancing}>
            <SkipForward className="w-4 h-4 mr-2 text-primary" />推进年份
          </Button>
        </div>

        {/* 叙事历史 */}
        {narrativeHistory.length > 1 && (
          <Card className="border-border bg-card shadow-md">
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-xs flex items-center gap-1"><ScrollText className="w-3 h-3" />最近记录</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-32 overflow-y-auto">
              {narrativeHistory.slice(0, 5).map((n, i) => (
                <p key={i} className="text-muted-foreground text-xs border-b border-muted pb-1 last:border-0">{n.title}</p>
              ))}
            </CardContent>
          </Card>
        )}

        <MemoryPanel
          cultivatorId={userId!}
          entries={memoryEntries}
          onEntriesChange={setMemoryEntries}
        />

        <button onClick={() => setTechniquePanelOpen(true)}
          className="w-full flex items-center gap-2 text-xs bg-card border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors text-foreground">
          📖 功法
        </button>
      </div>
      <TechniquePanel
        cultivatorId={userId!}
        open={techniquePanelOpen}
        onOpenChange={setTechniquePanelOpen}
      />
      <BottomNav />

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
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 shadow-lg">
            <p className="text-red-700 text-sm font-medium">⚠️ 大限将至</p>
            <p className="text-red-600 text-xs mt-1">
              仅剩 {remaining} 年寿元。突破境界可延年益寿。
            </p>
            <button
              onClick={() => setWarnEarly(false)}
              className="text-red-500 text-xs underline mt-1"
            >
              知晓了
            </button>
          </div>
        </div>
      )}
    </main>
  );
}