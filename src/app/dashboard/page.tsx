"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  Dumbbell,
  Moon,
  Sparkles,
  Sword,
  Zap,
  TrendingUp,
  History,
  Flame,
  Briefcase,
  ChevronRight,
} from "lucide-react";
import BottomNav from "@/components/bottom-nav";
import BreakthroughCard, { hasBreakthroughCard, type BreakthroughCardData } from "@/components/breakthrough-card";
import { SPIRITUAL_ROOTS, TASK_TYPES, REALMS, getCurrentRealm, getNextRealm, getRequiredExp, calculateTaskExp, formatRealmLevel } from "@/lib";
import type { SpiritualRoot } from "@/lib";
import { toast } from "sonner";

interface Cultivator {
  id: string;
  name: string;
  spiritualRoot: SpiritualRoot;
  realm: string;
  realmLevel: number;
  cultivationExp: number;
  totalExp: number;
  stamina: number;
  breakthroughCount: number;
  title: string | null;
}

interface Task {
  id: string;
  type: string;
  description: string | null;
  completed: boolean;
  cultivationBonus: number;
}

interface GameEvent {
  id: string;
  type: string;
  title: string;
  narrative: string;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>("");
  const [cultivator, setCultivator] = useState<Cultivator | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [isBreakingThrough, setIsBreakingThrough] = useState(false);
  const [canBreak, setCanBreak] = useState(false);
  const [encounter, setEncounter] = useState<{
    eventId: string;
    title: string;
    narrative: string;
    choices: { riskLevel: string; text: string; hint: string }[];
  } | null>(null);
  const [encounterResult, setEncounterResult] = useState<string | null>(null);
  const [manualClicksToday, setManualClicksToday] = useState(0);
  const [breakthroughCard, setBreakthroughCard] = useState<BreakthroughCardData | null>(null);

  // 每日手动奇遇探索次数（localStorage，防止无限点击）
  const getManualClickKey = () => `encounter_clicks_${new Date().toISOString().slice(0, 10)}`;
  const getManualClicksRemaining = () => Math.max(0, 3 - manualClicksToday);

  // 加载今日手动点击次数
  useEffect(() => {
    const key = getManualClickKey();
    const stored = localStorage.getItem(key);
    setManualClicksToday(stored ? parseInt(stored, 10) : 0);
  }, []);

  const incrementManualClicks = () => {
    const key = getManualClickKey();
    const newCount = manualClicksToday + 1;
    localStorage.setItem(key, String(newCount));
    setManualClicksToday(newCount);
  };

  // 加载用户数据
  const loadData = useCallback(async () => {
    const id = localStorage.getItem("userId");
    if (!id) {
      router.push("/create");
      return;
    }
    setUserId(id);

    try {
      // 只调一次 /api/cultivator —— 它已带回今日 dailyTasks，无需再单独请求 /api/tasks
      const userRes = await fetch(`/api/cultivator?userId=${id}`);
      const userData = await userRes.json();

      if (userData.user?.cultivator) {
        setCultivator(userData.user.cultivator);
        setEvents(userData.user.cultivator.events || []);

        // 检查是否可以突破
        const c = userData.user.cultivator;
        const { canBreakthrough } = await import("@/lib");
        setCanBreak(
          canBreakthrough(c.realm, c.realmLevel, c.cultivationExp, c.spiritualRoot as SpiritualRoot)
        );
      } else {
        router.push("/create");
        return;
      }

      // 今日任务直接取自 cultivator 接口返回（user.dailyTasks，已按 date 倒序）
      setTasks((userData.user.dailyTasks || []) as Task[]);
    } catch (err) {
      console.error("加载数据失败:", err);
      toast.error("加载失败，请刷新重试");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 创建任务
  const createTask = async (type: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, type }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks((prev) => [data.task, ...prev]);
        toast.success(`开始${TASK_TYPES[type]?.name || "修炼"}！`);
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch {
      toast.error("创建任务失败");
    }
  };

  // 完成任务
  const completeTask = async (taskId: string) => {
    // 乐观更新：找到任务类型，预估修炼值，前端先加上
    const task = tasks.find((t) => t.id === taskId);
    const estimatedExp = task && cultivator
      ? calculateTaskExp(task.type, cultivator.spiritualRoot as SpiritualRoot)
      : 0;

    // 标记任务完成 + 预估修炼值增加
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, completed: true, cultivationBonus: estimatedExp } : t
      )
    );
    // 乐观更新修炼值
    if (estimatedExp > 0 && cultivator) {
      setCultivator((prev) =>
        prev ? { ...prev, cultivationExp: prev.cultivationExp + estimatedExp, totalExp: prev.totalExp + estimatedExp } : prev
      );
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, userId }),
      });
      const data = await res.json();

      if (data.error) {
        // 回滚
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, completed: false, cultivationBonus: 0 } : t
          )
        );
        if (estimatedExp > 0 && cultivator) {
          setCultivator((prev) =>
            prev ? { ...prev, cultivationExp: prev.cultivationExp - estimatedExp, totalExp: prev.totalExp - estimatedExp } : prev
          );
        }
        toast.error(data.error);
        return;
      }

      // 以实际返回值修正
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, completed: true, cultivationBonus: data.expGained } : t
        )
      );
      if (data.cultivator) {
        setCultivator(data.cultivator);
      }

      toast.success(`+${data.expGained} 修炼值！`);

      // 生成叙事
      await generateNarrative(data.cultivator, taskId);

      // 随机触发奇遇（概率由 API 控制：30% + 每日上限 3 次）
      (async () => {
        try {
          const encRes = await fetch(`/api/encounter?userId=${userId}`);
          const encData = await encRes.json();
          if (encData.triggered && encData.encounter) {
            setEncounter({
              eventId: encData.eventId,
              title: encData.encounter.title,
              narrative: encData.encounter.narrative,
              choices: encData.encounter.choices,
            });
            toast(" 修炼途中忽遇机缘！", {
              description: encData.encounter.title,
            });
          }
        } catch {
          // 静默失败
        }
      })();
    } catch {
      toast.error("操作失败");
    }
  };

  // 生成修炼叙事
  const generateNarrative = async (updatedCultivator: Cultivator, taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      const res = await fetch("/api/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          type: "DAILY_CULTIVATION",
          taskType: task.type,
          taskDescription: task.description,
        }),
      });

      const data = await res.json();

      if (data.narrative) {
        setNarrative(data.narrative.narrative);
        if (data.event) {
          setEvents((prev) => [data.event, ...prev]);
        }
        // 根据最新修炼值重新计算是否可突破
        if (updatedCultivator) {
          const { canBreakthrough } = await import("@/lib");
          setCanBreak(
            canBreakthrough(
              updatedCultivator.realm,
              updatedCultivator.realmLevel,
              updatedCultivator.cultivationExp,
              updatedCultivator.spiritualRoot as SpiritualRoot
            )
          );
        }
        // 修炼后刚达标的首次提醒
        if (data.canBreakthrough) {
          toast("境界突破的契机出现了！", {
            description: "修炼值已满，可以尝试突破",
            action: {
              label: "突破",
              onClick: () => handleBreakthrough(),
            },
          });
        }
      }
    } catch {
      // 叙事生成失败不阻断流程
    }
  };

  // 境界突破
  const handleBreakthrough = async () => {
    setIsBreakingThrough(true);
    setNarrative(null);
    const prevRealm = cultivator?.realm ?? "";

    try {
      const res = await fetch("/api/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, type: "BREAKTHROUGH" }),
      });

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.cultivator) {
        setCultivator(data.cultivator);
        // 突破后重新判断是否还能继续突破（修炼值溢出可连破）
        const { canBreakthrough } = await import("@/lib");
        setCanBreak(
          canBreakthrough(
            data.cultivator.realm,
            data.cultivator.realmLevel,
            data.cultivator.cultivationExp,
            data.cultivator.spiritualRoot as SpiritualRoot
          )
        );
      }

      if (data.narrative) {
        setNarrative(data.narrative.narrative);
      }

      if (data.event) {
        setEvents((prev) => [data.event, ...prev]);
      }

      // 大境界突破 + 该境界有卡片素材 → 弹突破分享卡片（不再弹 toast，避免重复）
      if (data.isNewRealm && data.cultivator && hasBreakthroughCard(data.cultivator.realm)) {
        setBreakthroughCard({
          name: data.cultivator.name,
          spiritualRoot: data.cultivator.spiritualRoot,
          realm: data.cultivator.realm,
          fromRealm: prevRealm,
          createdAt: data.cultivator.createdAt,
          totalExp: data.cultivator.totalExp,
          breakthroughCount: data.cultivator.breakthroughCount,
        });
      } else if (data.isNewRealm) {
        toast.success("🔥 大境界突破成功！", {
          description: `踏入 ${data.cultivator.realm}！`,
        });
      } else {
        toast.success("境界突破成功！");
      }
    } catch {
      toast.error("突破失败，请重试");
    } finally {
      setIsBreakingThrough(false);
    }
  };

  // 奇遇探索（手动点击，每日最多 3 次）
  const triggerEncounter = async () => {
    if (getManualClicksRemaining() <= 0) {
      toast.info("今日机缘已尽，明日再寻访仙缘");
      return;
    }

    setEncounter(null);
    setEncounterResult(null);
    incrementManualClicks();

    try {
      const res = await fetch(`/api/encounter?userId=${userId}&source=manual`);
      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.triggered && data.encounter) {
        setEncounter({
          eventId: data.eventId,
          title: data.encounter.title,
          narrative: data.encounter.narrative,
          choices: data.encounter.choices,
        });
        toast.success("⚡ 仙缘乍现！");
      } else {
        toast.info("天地寂寥，未感仙缘。道法自然，继续修炼吧。");
      }
    } catch {
      toast.error("探索失败，请重试");
    }
  };

  // 选择奇遇选项
  const chooseEncounter = async (choiceIndex: number) => {
    if (!encounter) return;

    try {
      const res = await fetch("/api/encounter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: encounter.eventId, userId, choiceIndex }),
      });

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      // 构建结果文本
      const lines: string[] = [];
      lines.push(data.message);
      if (data.outcomeMessage) {
        lines.push(data.outcomeMessage);
      }

      setEncounterResult(lines.join("。"));

      // 刷新修炼值
      if (data.cultivator) {
        setCultivator((prev) =>
          prev
            ? {
                ...prev,
                cultivationExp: data.cultivator.cultivationExp,
                totalExp: data.cultivator.totalExp,
                stamina: data.cultivator.stamina,
              }
            : prev
        );
      }
    } catch {
      toast.error("选择失败");
    }
  };

  if (isLoading) {
    return (
      <main className="flex-1 p-4 max-w-lg mx-auto min-h-screen space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded-lg" />
        <div className="h-40 bg-muted rounded-xl" />
        <div className="h-6 bg-muted rounded w-1/3" />
        <div className="space-y-2">
          <div className="h-12 bg-muted rounded-lg" />
          <div className="h-12 bg-muted rounded-lg" />
          <div className="h-12 bg-muted rounded-lg" />
        </div>
      </main>
    );
  }

  if (!cultivator) return null;

  const realmData = getCurrentRealm(cultivator.realm);
  const nextRealm = getNextRealm(cultivator.realm);
  const expNeeded = getRequiredExp(cultivator.realm, cultivator.realmLevel);
  const expPercent = Math.min(100, Math.floor((cultivator.cultivationExp / expNeeded) * 100));
  const rootInfo = SPIRITUAL_ROOTS[cultivator.spiritualRoot];

  const incompleteTasks = tasks.filter((t) => !t.completed);

  const taskIcons: Record<string, React.ReactNode> = {
    STUDY: <BookOpen className="w-5 h-5" />,
    EXERCISE: <Dumbbell className="w-5 h-5" />,
    SLEEP: <Moon className="w-5 h-5" />,
    MEDITATE: <Sparkles className="w-5 h-5" />,
    WORK: <Briefcase className="w-5 h-5" />,
    CUSTOM: <Sword className="w-5 h-5" />,
  };

  return (
    <main className="flex-1 p-4 max-w-lg mx-auto min-h-screen pb-24 space-y-4">
      {/* BETA 测试声明 */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5 text-center">
        <p className="text-primary text-xs">
          🧪 测试阶段 · 数据后续可能清零 ·
          <span className="font-medium">道友的反馈正在塑造这个世界</span>
        </p>
      </div>
      {/* 顶部状态栏 */}
      <Card className="bg-card border border-border overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-1000"
            style={{ width: `${expPercent}%` }}
          />
        </div>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {cultivator.realm === "渡劫期" ? "👑" :
                 cultivator.realm.includes("大乘") ? "" :
                 cultivator.realm.includes("合体") ? "💫" :
                 cultivator.realm.includes("炼虚") ? "🌌" :
                 cultivator.realm.includes("化神") ? "🔥" :
                 cultivator.realm.includes("元婴") ? "💎" :
                 cultivator.realm.includes("结丹") ? "" :
                 cultivator.realm.includes("筑基") ? "🟢" : "⚪"}
              </span>
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                  {cultivator.name}
                  <Badge
                    className="text-xs"
                    style={{
                      backgroundColor: rootInfo.color + "30",
                      color: rootInfo.color,
                      borderColor: rootInfo.color + "50",
                    }}
                    variant="outline"
                  >
                    {cultivator.spiritualRoot}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {cultivator.realm} · {formatRealmLevel(cultivator.realm, cultivator.realmLevel)}
                  {nextRealm && ` → ${nextRealm.name}`}
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{cultivator.totalExp}</div>
              <div className="text-xs text-muted-foreground">累计修炼值</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">
              当前修炼值：{cultivator.cultivationExp}/{expNeeded}
            </span>
            <span className="text-foreground">{expPercent}%</span>
          </div>
          {/* 灵力值 */}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Zap className="w-3 h-3 text-blue-500" />
            <span>灵力：<span className="text-foreground font-semibold">{cultivator.stamina}</span>/100</span>
            <span>（每日重置）</span>
          </div>
        </CardContent>
      </Card>

      {/* 突破按钮 */}
      {canBreak && (
        <Button
          className="w-full h-12 text-lg bg-destructive hover:bg-destructive/90"
          onClick={handleBreakthrough}
          disabled={isBreakingThrough}
        >
          {isBreakingThrough ? (
            <>突破中...</>
          ) : (
            <>
              <Flame className="w-5 h-5 mr-2" />
              境界突破！
              <Flame className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      )}

      {/* AI 修炼叙事 */}
      {narrative && (
        <Card className="bg-card border border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs text-primary font-medium">AI 修炼叙事</span>
            </div>
            <p className="text-foreground text-sm leading-relaxed italic">
              {narrative}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 每日任务（最多 3 条，更多去任务页） */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              今日修炼
            </CardTitle>
            <button
              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              onClick={() => router.push("/tasks")}
            >
              全部 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* 有未处理奇遇时提示，防止再次触发覆盖 */}
          {encounter && !encounterResult && (
            <div className="flex items-center gap-2 rounded-lg bg-purple-100 border border-purple-200 px-3 py-2 text-xs text-purple-700">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-purple-500" />
              请先处理下方奇遇，再继续修炼
            </div>
          )}

          {tasks.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-2">
              尚未开始今日修炼
            </p>
          )}

          {tasks.slice(0, 3).map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-3 p-3 rounded-xl ${task.completed ? "bg-muted/30 opacity-60" : "bg-muted/50"}`}
            >
              <span className={task.completed ? "text-muted-foreground" : "text-primary"}>
                {taskIcons[task.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${task.completed ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>
                  {TASK_TYPES[task.type]?.name || task.type}
                </p>
              </div>
              {task.completed ? (
                <Badge variant="outline" className="border-green-300 text-green-700 text-xs shrink-0">
                  +{task.cultivationBonus}
                </Badge>
              ) : (
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90 h-8 px-3 text-xs shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => completeTask(task.id)}
                  disabled={!!(encounter && !encounterResult)}
                >
                  完成
                </Button>
              )}
            </div>
          ))}

          {tasks.length > 3 && (
            <button
              className="w-full text-center py-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              onClick={() => router.push("/tasks")}
            >
              还有 {tasks.length - 3} 条 · 查看全部任务
            </button>
          )}

          <Separator className="bg-border my-1" />

          {/* 快捷添加 */}
          <div className="flex gap-2 flex-wrap pt-1">
            {Object.entries(TASK_TYPES).map(([key, taskType]) => {
              const atLimit  = tasks.filter(t => t.type === key && t.completed).length >= taskType.dailyMax;
              const pending  = tasks.some(t => t.type === key && !t.completed);
              const encounterPending = !!(encounter && !encounterResult);
              return (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  className={`border-border text-foreground hover:text-primary hover:border-primary h-9 ${atLimit || encounterPending ? "opacity-40" : ""}`}
                  onClick={() => createTask(key)}
                  disabled={pending || atLimit || encounterPending}
                >
                  {taskType.icon} <span className="ml-1">{taskType.name}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 奇遇探索 */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            奇遇探索
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!encounter && !encounterResult && (
            <div className="text-center">
              <p className="text-foreground text-base mb-3">
                修炼途中机缘莫测，或偶遇古修洞府，或撞见灵兽渡劫。
              </p>
              <p className="text-muted-foreground text-sm mb-2">
                今日剩余寻缘次数：<span className="text-foreground font-semibold">{getManualClicksRemaining()}</span> / 3
              </p>
              <Button
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={triggerEncounter}
                disabled={getManualClicksRemaining() <= 0}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {getManualClicksRemaining() <= 0 ? "机缘已尽" : "外出寻缘"}
              </Button>
            </div>
          )}

          {encounter && !encounterResult && (
            <div className="space-y-3">
              <div className="bg-card rounded-lg p-3 border border-purple-200">
                <p className="text-purple-700 text-base font-semibold mb-1">
                  ⚡ {encounter.title}
                </p>
                <p className="text-foreground text-base leading-relaxed">
                  {encounter.narrative}
                </p>
              </div>
              <p className="text-muted-foreground text-sm">面临抉择——</p>
              <div className="space-y-2">
                {encounter.choices.map((choice, i) => (
                  <button
                    key={i}
                    className={`w-full text-left p-2.5 rounded-lg border text-sm transition-all hover:scale-[1.02] ${
                      choice.riskLevel === "high"
                        ? "border-red-300 bg-red-50 hover:bg-red-100 text-red-700"
                        : choice.riskLevel === "medium"
                        ? "border-yellow-300 bg-yellow-50 hover:bg-yellow-100 text-yellow-700"
                        : "border-green-300 bg-green-50 hover:bg-green-100 text-green-700"
                    }`}
                    onClick={() => chooseEncounter(i)}
                  >
                    <span className="text-xs opacity-70">
                      {choice.riskLevel === "high" ? " 高风险" : choice.riskLevel === "medium" ? "⚡ 中风险" : "🍃 低风险"}
                    </span>
                    <span className="ml-2">{choice.text}</span>
                  </button>
                ))}
              </div>
              <button
                className="w-full text-center p-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setEncounter(null)}
              >
                暂不处理，继续修炼
              </button>
            </div>
          )}

          {encounterResult && (
            <div className="bg-card rounded-lg p-4 border border-green-200">
              <p className="text-green-700 text-sm font-semibold mb-2">✅ 奇遇结束</p>
              <p className="text-foreground text-base leading-relaxed">{encounterResult}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-border text-foreground"
                onClick={() => {
                  setEncounter(null);
                  setEncounterResult(null);
                }}
              >
                继续修炼
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 修炼历史（最多 3 条，更多去记录页） */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              修炼记录
            </CardTitle>
            <button
              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              onClick={() => router.push("/history")}
            >
              全部 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">修炼之路方才开始……</p>
          ) : (
            <div className="space-y-3">
              {events.slice(0, 3).map((event) => (
                <div key={event.id} className="border-l-2 border-border pl-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        event.type === "BREAKTHROUGH"
                          ? "border-red-300 text-red-700"
                          : event.type === "ENCOUNTER" || event.type === "RANDOM_ENCOUNTER"
                          ? "border-purple-300 text-purple-700"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {event.type === "BREAKTHROUGH" ? "突破" : event.type.includes("ENCOUNTER") ? "奇遇" : "修炼"}
                    </Badge>
                    <span className="text-sm text-foreground font-medium">{event.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.narrative}</p>
                </div>
              ))}
              <button
                className="w-full text-center pt-2 text-xs text-muted-foreground hover:text-primary transition-colors border-t border-border"
                onClick={() => router.push("/history")}
              >
                查看全部修炼记录 →
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <BottomNav />

      {/* 突破分享卡片 */}
      <BreakthroughCard data={breakthroughCard} onClose={() => setBreakthroughCard(null)} />
    </main>
  );
}
