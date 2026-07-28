"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CultivatorData, NarrativeDisplay } from "../types";
import { useDashboardActions } from "./use-dashboard-actions";
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

  const attributesRef = useRef(attributes);
  attributesRef.current = attributes;

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
        const capped = {
          ...data.user.cultivator,
          stamina: Math.min(data.user.cultivator.stamina, calculateMaxStamina(data.user.cultivator.age, attributesRef.current)),
        };
        setCultivator(capped);
        if (capped.storyEntries) {
          try {
            setMemoryEntries(Array.isArray(capped.storyEntries) ? capped.storyEntries : []);
          } catch {}
        }
        if (capped.maxAge) {
          setMaxAge(capped.maxAge);
          setRemaining(capped.maxAge - capped.age);
        }
        if (capped.inventory) {
          try {
            const backendInv = JSON.parse(capped.inventory);
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
        const actions = getActionsWithLockInfo(capped.worldId || "earth", capped.age, capped.realm);
        setAvailableActions(actions);
        if (isAwakened(capped.realm)) {
          setCanBreak(canBreakthrough(capped.realm, capped.realmLevel, capped.cultivationExp, capped.spiritualRoot, capped.breakthroughBuff || 0));
        }
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
              if (history.length > 0 && !narrative) {
                setNarrative({ title: history[0].title, narrative: history[0].narrative, mood: history[0].mood });
              }
            }
          });
      }
    } catch (err) {
      console.error("加载角色失败:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, narrative]);

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
    if (userId) loadCultivator();
  }, [userId, loadCultivator]);

  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  const currentLoc = cultivator?.location || "home";
  const currentNPCs = cultivator ? getNPCsAtLocation(currentLoc) : [];

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

  const sendNpcMessage = async (msg: string, npcChat: any, npcChatHistory: any[]) =>
    actions.sendNpcMessage(msg, npcChat, npcChatHistory);

  const handleActionClick = (actionId: string) => {
    if (!cultivator || cultivator.stamina < (getActionById(actionId)?.actionPointCost || 0)) return;
    if (activeActionId === actionId) actions.performAction(actionId);
    else {
      setActiveActionId(actionId);
      setActionInput("");
    }
  };

  const handleSubmitWithInput = (actionId: string) => {
    if (actionInput.trim()) actions.performAction(actionId, actionInput.trim());
    else actions.performAction(actionId);
  };

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
  const maxStamina = cultivator ? calculateMaxStamina(cultivator.age) : 20;

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
    isAwake,
    realmLabel,
    schoolStage,
    schoolGrade,
    displayOccupation,
    locs,
    currentLoc,
    currentNPCs,
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

