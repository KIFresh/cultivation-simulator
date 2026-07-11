"use client";

import { useEffect, useState, useCallback } from "react";
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
  calcTravelCost, calculateMaxStamina,
} from "@/lib";
import type { Action, InventoryItem } from "@/lib";
import { toast } from "sonner";

interface CultivatorData {
  id: string; name: string; spiritualRoot: string; realm: string;
  realmLevel: number; cultivationExp: number; totalExp: number;
  stamina: number; age: number; worldId: string | null;
  title: string | null; breakthroughCount: number; location: string | null;
  gold: number;
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
          stamina: Math.min(data.user.cultivator.stamina, calculateMaxStamina(data.user.cultivator.age, attributes)),
        };
        setCultivator(capped);
        const actions = getAvailableActions(capped.worldId || "earth", capped.age);
        setAvailableActions(actions);
        if (isAwakened(capped.realm)) {
          setCanBreak(canBreakthrough(capped.realm, capped.realmLevel, capped.cultivationExp, capped.spiritualRoot));
        }
      }
    } catch (err) {
      console.error("加载角色失败:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) { router.push("/"); return; }
    setUserId(id);
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
        if (isAwakened(c.realm)) setCanBreak(canBreakthrough(c.realm, c.realmLevel, c.cultivationExp, c.spiritualRoot));
        setAvailableActions(getAvailableActions(c.worldId || "earth", c.age));
      }
      if (data.awakenEvent) { setAwakenEvent(data.awakenEvent); toast.success("🎉 灵气觉醒！", { duration: 5000 }); }
      if (data.expGained) toast.success(`修炼值 +${data.expGained}`, { duration: 2000 });
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
      setCultivator(data.cultivator);
      if (data.cultivator) {
        const c = data.cultivator;
        if (isAwakened(c.realm)) setCanBreak(canBreakthrough(c.realm, c.realmLevel, c.cultivationExp, c.spiritualRoot));
        setAvailableActions(getAvailableActions(c.worldId || "earth", c.age));
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
      if (data.cultivator) { setCultivator(data.cultivator); setCanBreak(false); }
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

  if (loading) return <main className="flex-1 flex items-center justify-center min-h-screen bg-transparent"><p className="text-muted-foreground">加载中...</p></main>;
  if (!cultivator) return <main className="flex-1 flex flex-col items-center justify-center min-h-screen bg-transparent p-4"><p className="text-muted-foreground mb-4">尚未创建修炼者</p><Button onClick={() => router.push("/create")}>创建角色</Button></main>;

  return (
    <main className="flex-1 flex flex-col min-h-screen bg-transparent pb-20">
      <div className="relative z-10 max-w-lg w-full mx-auto p-4 space-y-2">

        {/* 顶栏 */}
        <div className="flex items-center py-1 border-b border-border">
          <button onClick={() => router.push("/")} className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors text-sm">
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
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">💰 金币</span>
              <span className="text-foreground font-medium">{cultivator.gold ?? 50}</span>
            </div>
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
                    <TooltipContent side="top" className="bg-white text-foreground border border-border text-xs max-w-48 shadow-md"><p className="font-medium">{item.icon} {item.name}</p><p className="text-muted-foreground mt-0.5">{item.description}</p>{item.effect && <p className="text-amber-600 mt-0.5">✨ {item.effect}</p>}</TooltipContent>
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
              <p className="text-foreground text-sm">{awakenEvent.narrative}</p>
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
      </div>
      <BottomNav />
    </main>
  );
}