"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CultivatorData, NarrativeDisplay } from "../types";
import { useDashboardActions } from "./use-dashboard-actions";
import { useGameStore } from "@/store";
import {
  getActionsWithLockInfo,
  getActionById,
  isAwakened,
  canBreakthrough,
  getSchoolStage,
  getSchoolGrade,
  getDefaultOccupation,
  getUnlockedLocations,
  calculateMaxStamina,
  getNPCsAtLocation,
  getStarterInventory,
  MORTAL_REALM,
  formatRealmLevel,
} from "@/lib";
import { parseFamily } from "@/lib/family";
import { toast } from "sonner";

const STORAGE_KEYS = {
  attributes: "attributes",
  inventory: "inventory",
  occupation: "occupation",
  schoolRank: "schoolRank",
  unlockedLocations: "unlockedLocations",
  userId: "userId",
  devMode: "devMode",
} as const;

export function useDashboardState() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [cultivator, setCultivator] = useState<CultivatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [narrative, setNarrative] = useState<NarrativeDisplay | null>(null);
  const [narrativeHistory, setNarrativeHistory] = useState<NarrativeDisplay[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [availableActions, setAvailableActions] = useState<any[]>([]);
  const [canBreak, setCanBreak] = useState(false);
  const [awakenEvent, setAwakenEvent] = useState<{ title: string; narrative: string } | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [attributes, setAttributes] = useState<Record<string, number>>({});
  const [inventory, setInventory] = useState<any[]>([]);
  const [occupation, setOccupation] = useState("");
  const [schoolRank, setSchoolRank] = useState("普通");
  const [unlockedLocs, setUnlockedLocs] = useState<string[]>([]);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [actionInput, setActionInput] = useState("");
  const [showItems, setShowItems] = useState(false);
  const [narrativeExpanded, setNarrativeExpanded] = useState(false);
  const [npcChat, setNpcChat] = useState<any>(null);
  const [npcMessage, setNpcMessage] = useState("");
  const [npcChatHistory, setNpcChatHistory] = useState<any[]>([]);
  const [devMode, setDevMode] = useState(false);
  const [memoryEntries, setMemoryEntries] = useState<any[]>([]);
  const [techniquePanelOpen, setTechniquePanelOpen] = useState(false);
  const [daoXiao, setDaoXiao] = useState<{ summary: any; name: string } | null>(null);
  const [warnEarly, setWarnEarly] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [maxAge, setMaxAge] = useState<number | null>(null);
  const [cliqueInfo, setCliqueInfo] = useState<any>(null);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [currentNPCs, setCurrentNPCs] = useState<any[]>([]);

  // ── 全局 store 订阅 ──
  const storeStreamingText = useGameStore((s) => s.streamingText);
  const storeActionLoading = useGameStore((s) => s.actionLoading);
  const storeNarrative = useGameStore((s) => s.narrative);
  const storeNarrativeError = useGameStore((s) => s.narrativeError);
  const storeCultivator = useGameStore((s) => s.cultivator);

  useEffect(() => {
    setStreamingText(storeStreamingText);
  }, [storeStreamingText]);

  useEffect(() => {
    setActionLoading(storeActionLoading);
  }, [storeActionLoading]);

  useEffect(() => {
    if (storeNarrative && storeNarrative !== narrative) {
      setNarrative(storeNarrative);
      setNarrativeExpanded(false);
    }
  }, [storeNarrative]);

  useEffect(() => {
    if (storeNarrativeError) {
      toast.error(storeNarrativeError.message || "叙事生成失败");
    }
  }, [storeNarrativeError]);

  // 以 store 的 cultivator 为准覆盖局部状态
  useEffect(() => {
    if (storeCultivator) {
      setCultivator(storeCultivator);
      if (storeCultivator.storyEntries) {
        try {
          const parsed = typeof storeCultivator.storyEntries === "string" ? JSON.parse(storeCultivator.storyEntries) : storeCultivator.storyEntries;
          setMemoryEntries(Array.isArray(parsed) ? parsed : []);
        } catch {}
      }
      if (storeCultivator.inventory) {
        try {
          const backendInv = typeof storeCultivator.inventory === "string" ? JSON.parse(storeCultivator.inventory) : storeCultivator.inventory;
          const invArray = Array.isArray(backendInv) ? backendInv : [];
          setInventory(invArray);
          localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(invArray));
        } catch {}
      }
      setCurrentNPCs(getNPCsAtLocation(storeCultivator.location || "home"));
      setAvailableActions(getActionsWithLockInfo(storeCultivator.worldId || "earth", storeCultivator.age, storeCultivator.realm, storeCultivator.location || "home"));
      if (isAwakened(storeCultivator.realm)) {
        setCanBreak(canBreakthrough(storeCultivator.realm, storeCultivator.realmLevel, storeCultivator.cultivationExp, storeCultivator.spiritualRoot, storeCultivator.breakthroughBuff || 0));
      }
    }
  }, [storeCultivator]);

  useEffect(() => {
    if (!userId) {
      // 无 userId 时从 localStorage 读取兜底
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("family") : null;
      if (raw) {
        try {
          const parsed = parseFamily(raw);
          setFamilyMembers(parsed.members ?? []);
        } catch { setFamilyMembers([]); }
      } else { setFamilyMembers([]); }
      return;
    }
    // 优先从 API 获取家庭数据
    fetch(`/api/family?userId=${userId}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("API 失败")))
      .then((data) => {
        if (data?.members) {
          setFamilyMembers(data.members);
          // 同步写入 localStorage 作为兼容兜底
          try { localStorage.setItem("family", JSON.stringify({ members: data.members })); } catch {}
        } else {
          setFamilyMembers([]);
        }
      })
      .catch(() => {
        // API 失败时从 localStorage 读取兜底
        const raw = typeof window !== "undefined" ? window.localStorage.getItem("family") : null;
        if (raw) {
          try {
            const parsed = parseFamily(raw);
            setFamilyMembers(parsed.members ?? []);
          } catch { setFamilyMembers([]); }
        } else { setFamilyMembers([]); }
      });
  }, [userId]);

  const loadLocalData = useCallback(() => {
    try {
      const attr = localStorage.getItem(STORAGE_KEYS.attributes);
      if (attr) setAttributes(JSON.parse(attr));
      const inv = localStorage.getItem(STORAGE_KEYS.inventory);
      if (inv) setInventory(JSON.parse(inv));
      else {
        const starter = getStarterInventory();
        setInventory(starter);
        localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(starter));
      }
      const occ = localStorage.getItem(STORAGE_KEYS.occupation);
      if (occ) setOccupation(occ);
      const sr = localStorage.getItem(STORAGE_KEYS.schoolRank);
      if (sr) setSchoolRank(sr);
      const uls = localStorage.getItem(STORAGE_KEYS.unlockedLocations);
      if (uls) setUnlockedLocs(JSON.parse(uls));
    } catch {}
  }, []);

  const loadCultivator = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/cultivator?userId=${userId}`);
      const data = await res.json();
      if (data.user?.cultivator) {
        setCultivator(data.user.cultivator);
        if (data.user.cultivator.storyEntries) {
          try {
            const parsed = typeof data.user.cultivator.storyEntries === "string" ? JSON.parse(data.user.cultivator.storyEntries) : data.user.cultivator.storyEntries;
            setMemoryEntries(Array.isArray(parsed) ? parsed : []);
          } catch {}
        }
        if (data.user.cultivator.maxAge) {
          setMaxAge(data.user.cultivator.maxAge);
          setRemaining(data.user.cultivator.maxAge - data.user.cultivator.age);
        }
        if (data.user.cultivator.inventory) {
          try {
            const backendInv = JSON.parse(data.user.cultivator.inventory);
            setInventory(Array.isArray(backendInv) ? backendInv : []);
            localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(Array.isArray(backendInv) ? backendInv : []));
          } catch {
            setInventory([]);
            localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify([]));
          }
        } else {
          setInventory([]);
          localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify([]));
        }
        const loc = data.user.cultivator.location || "home";
        setCurrentNPCs(getNPCsAtLocation(loc));
        const actions = getActionsWithLockInfo(data.user.cultivator.worldId || "earth", data.user.cultivator.age, data.user.cultivator.realm, loc);
        setAvailableActions(actions);
        if (isAwakened(data.user.cultivator.realm)) {
          setCanBreak(canBreakthrough(data.user.cultivator.realm, data.user.cultivator.realmLevel, data.user.cultivator.cultivationExp, data.user.cultivator.spiritualRoot, data.user.cultivator.breakthroughBuff || 0));
        }
        // 不在这里设置 narrative，避免与 store 订阅冲突
      }
    } catch (err) {
      console.error("加载角色失败:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEYS.userId);
    const dm = localStorage.getItem(STORAGE_KEYS.devMode) === "true";
    setDevMode(dm);
    if (!id && !dm) {
      router.push("/");
      return;
    }
    if (id) setUserId(id);
    if (dm && !id) {
      const tempId = "dev_" + Date.now();
      localStorage.setItem(STORAGE_KEYS.userId, tempId);
      setUserId(tempId);
    }
  }, [router]);

  useEffect(() => {
    if (userId) {
      loadCultivator();
      // 额外加载叙事历史
      fetch(`/api/events?limit=50`)
        .then((r) => r.json())
        .then((evData) => {
          if (evData.events && evData.events.length > 0) {
            const history: NarrativeDisplay[] = evData.events.map((ev: any) => {
              let mood = "静";
              try { const parsed = JSON.parse(ev.reward || "{}"); if (parsed.mood) mood = parsed.mood; } catch {}
              return { title: ev.title, narrative: ev.narrative, mood };
            });
            setNarrativeHistory(history);
          }
        });
    }
  }, [userId]);

  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  const currentLoc = cultivator?.location || "home";

  const actions = useDashboardActions({
    userId,
    cultivator,
    currentLoc,
    attributes,
    schoolRank,
    occupation,
    unlockedLocs,
    actionLoading,
    onNarrative: ({ narrative, cultivator: c, awakenEvent, expGained, techniqueEvents }) => {
      setNarrative(narrative);
      setNarrativeExpanded(false);
      setNarrativeHistory((prev) => [narrative, ...prev].slice(0, 50));
      if (c) {
        setCultivator(c);
        if (c.storyEntries) {
          try {
            const parsed = typeof c.storyEntries === "string" ? JSON.parse(c.storyEntries) : c.storyEntries;
            setMemoryEntries(Array.isArray(parsed) ? parsed : []);
          } catch {}
        }
        if (isAwakened(c.realm)) {
          setCanBreak(canBreakthrough(c.realm, c.realmLevel, c.cultivationExp, c.spiritualRoot, c.breakthroughBuff || 0));
        }
        setAvailableActions(getActionsWithLockInfo(c.worldId || "earth", c.age, c.realm, currentLoc));
        setCurrentNPCs(getNPCsAtLocation(c.location || "home"));
      }
      if (awakenEvent) {
        setAwakenEvent(awakenEvent);
        toast.success("🎉 灵气觉醒！", { duration: 5000 });
      }
      if (expGained) toast.success(`修炼值 +${expGained}`, { duration: 2000 });
      if (techniqueEvents && techniqueEvents.length > 0) {
        techniqueEvents.forEach((te: any) => {
          const profMsg = te.eventNarrative ? te.eventNarrative : `${te.icon} ${te.techniqueName} 熟练度 +${te.profGained}`;
          toast(profMsg, { duration: 3000 });
          if (te.leveledUp) toast.success(`⚡ ${te.icon} ${te.techniqueName} 升级！`, { duration: 4000 });
        });
      }
    },
    onAdvance: (data) => {
      if (data.daoXiao) {
        setDaoXiao({ summary: data.summary, name: cultivator?.name ?? "" });
        return;
      }
      setCultivator(data.cultivator);
      if (data.cultivator) {
        const c = data.cultivator;
        if (c.storyEntries) {
          try {
            const parsed = typeof c.storyEntries === "string" ? JSON.parse(c.storyEntries) : c.storyEntries;
            setMemoryEntries(Array.isArray(parsed) ? parsed : []);
          } catch {}
        }
        if (isAwakened(c.realm)) {
          setCanBreak(canBreakthrough(c.realm, c.realmLevel, c.cultivationExp, c.spiritualRoot, c.breakthroughBuff || 0));
        }
        setAvailableActions(getActionsWithLockInfo(c.worldId || "earth", c.age, c.realm, currentLoc));
        setCurrentNPCs(getNPCsAtLocation(c.location || "home"));
      }
      if (data.warnEarly) {
        setWarnEarly(true);
        setRemaining(data.remaining);
        setMaxAge(data.maxAge);
      }
      if (data.newAttributes) {
        setAttributes(data.newAttributes);
        localStorage.setItem(STORAGE_KEYS.attributes, JSON.stringify(data.newAttributes));
      }
      if (data.schoolRank) {
        setSchoolRank(data.schoolRank);
        localStorage.setItem(STORAGE_KEYS.schoolRank, data.schoolRank);
      }
      if (data.occupation) {
        setOccupation(data.occupation);
        localStorage.setItem(STORAGE_KEYS.occupation, data.occupation);
      }
      if (data.examResult) toast.success(`📝 ${data.examResult.description}`, { duration: 5000 });
      if (data.cliqueInfo) {
        setCliqueInfo(data.cliqueInfo);
      } else if (data.yearWrapped && data.cultivator?.age >= 6 && data.cultivator?.age <= 15) {
        setCliqueInfo(null);
      }
      if (data.healthRecovery !== undefined && data.healthRecovery > 0) {
        toast.success(`❤️ 健康恢复 +${data.healthRecovery}`, { duration: 2000 });
      }
      if (data.pocketMoney) {
        const pm = data.pocketMoney;
        const parts: string[] = [];
        if (pm.granted > 0) parts.push(`零花钱 +${pm.granted}`);
        if (pm.interest > 0) parts.push(`利息 +${pm.interest}`);
        if (parts.length > 0) toast.success(`🏦 ${parts.join('，')}`, { duration: 3000 });
      }
      if (data.classBenefits && data.classBenefits.optionCount > 0) {
        toast.success(`📚 课外班属性加成，年费 -${data.classBenefits.totalCost}`, { duration: 3000 });
      }
      const newLocs = getUnlockedLocations(data.cultivator.age, isAwakened(data.cultivator.realm), unlockedLocs);
      localStorage.setItem(STORAGE_KEYS.unlockedLocations, JSON.stringify(newLocs.map((l: any) => l.id)));
      toast.success(`🌿 ${data.cultivator.name} ${data.yearWrapped ? `${data.newAge}岁` : `第${data.quarter}季`}`, { duration: 3000 });
      if (data.awakenEvent) {
        setAwakenEvent(data.awakenEvent);
        toast.success("🎉 灵气觉醒！", { duration: 5000 });
      }
    },
    onCultivatorUpdate: (c) => setCultivator(c),
    onActionError: (message) => toast.error(message),
    onActionSuccess: () => {},
  });

  const handleUseItem = async (itemId: string) => actions.handleUseItem(itemId);

  const sendNpcMessage = async (msg: string, npcChat: any, npcChatHistory: any[]) => {
    const trimmed = msg.trim();
    if (!trimmed) return;
    const playerEntry = { role: "player", content: trimmed };
    const nextHistory = [...npcChatHistory, playerEntry];
    setNpcChatHistory(nextHistory);
    setNpcMessage("");

    await actions.sendNpcMessage(trimmed, npcChat, nextHistory);
  };

  const handleActionClick = useCallback((actionId: string, selectedNpcIds: string[] = []) => {
    const cost = getActionById(actionId)?.actionPointCost || 0;
    console.log("[useDashboardState] handleActionClick", { actionId, activeActionId, stamina: cultivator?.stamina, cost });
    if (!cultivator) return;
    if (cultivator.stamina < cost) {
      toast.error(`体力不足（需要 ${cost}，当前 ${cultivator.stamina}）`, { duration: 2000 });
      return;
    }
    if (activeActionId === actionId) {
      useGameStore.getState().performAction(actionId, undefined, selectedNpcIds).catch(() => {});
    }
    else {
      setActiveActionId(actionId);
      setActionInput("");
    }
  }, [cultivator, activeActionId]);

  const handleSubmitWithInput = useCallback((actionId: string, input: string, selectedNpcIds: string[] = []) => {
    const cost = getActionById(actionId)?.actionPointCost || 0;
    if (!cultivator) return;
    if (cultivator.stamina < cost) {
      toast.error(`体力不足（需要 ${cost}，当前 ${cultivator.stamina}）`, { duration: 2000 });
      return;
    }
    const trimmed = input?.trim();
    if (trimmed) useGameStore.getState().performAction(actionId, trimmed, selectedNpcIds).catch(() => {});
    else useGameStore.getState().performAction(actionId, undefined, selectedNpcIds).catch(() => {});
  }, [cultivator]);

  const handleBreakthrough = () => actions.handleBreakthrough();
  const advanceSeason = () => actions.advanceSeason();

  const isAwake = cultivator ? isAwakened(cultivator.realm) : false;
  const realmLabel =
    cultivator?.realm === MORTAL_REALM
      ? "凡人"
      : `${cultivator?.realm} ${cultivator ? formatRealmLevel(cultivator.realm, cultivator.realmLevel) : ""}`;
  const schoolStage = cultivator ? getSchoolStage(cultivator.age) : null;
  const schoolGrade = schoolStage && cultivator ? getSchoolGrade(cultivator.age, schoolStage) : 0;
  const displayOccupation = occupation || (cultivator ? getDefaultOccupation(cultivator.age) : "");
  const locs = cultivator ? getUnlockedLocations(cultivator.age, isAwake, unlockedLocs) : [];
  const maxStamina = cultivator ? calculateMaxStamina(cultivator.age, attributes) : 20;

  return {
    userId,
    setUserId,
    cultivator,
    setCultivator,
    loading,
    setLoading,
    actionLoading,
    setActionLoading,
    narrative,
    setNarrative,
    narrativeHistory,
    setNarrativeHistory,
    streamingText,
    setStreamingText,
    availableActions,
    setAvailableActions,
    canBreak,
    setCanBreak,
    awakenEvent,
    setAwakenEvent,
    advancing,
    setAdvancing,
    attributes,
    setAttributes,
    inventory,
    setInventory,
    occupation,
    setOccupation,
    schoolRank,
    setSchoolRank,
    unlockedLocs,
    setUnlockedLocs,
    activeActionId,
    setActiveActionId,
    actionInput,
    setActionInput,
    showItems,
    setShowItems,
    narrativeExpanded,
    setNarrativeExpanded,
    npcChat,
    setNpcChat,
    npcMessage,
    setNpcMessage,
    npcChatHistory,
    setNpcChatHistory,
    devMode,
    setDevMode,
    memoryEntries,
    setMemoryEntries,
    techniquePanelOpen,
    setTechniquePanelOpen,
    daoXiao,
    setDaoXiao,
    warnEarly,
    setWarnEarly,
    remaining,
    setRemaining,
    maxAge,
    setMaxAge,
    cliqueInfo,
    setCliqueInfo,
    isAwake,
    realmLabel,
    schoolStage,
    schoolGrade,
    displayOccupation,
    locs,
    currentLoc,
    currentNPCs,
    familyMembers,
    maxStamina,
    actions,
    handleActionClick,
    handleSubmitWithInput,
    handleBreakthrough,
    advanceSeason,
    handleUseItem,
    sendNpcMessage,
    loadLocalData,
    loadCultivator,
  };
}
