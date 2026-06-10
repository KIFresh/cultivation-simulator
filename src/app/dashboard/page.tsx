"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Home,
  Flame,
} from "lucide-react";
import { SPIRITUAL_ROOTS, TASK_TYPES, REALMS, getCurrentRealm, getNextRealm } from "@/lib";
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

  // 加载用户数据
  const loadData = useCallback(async () => {
    const id = localStorage.getItem("userId");
    if (!id) {
      router.push("/create");
      return;
    }
    setUserId(id);

    try {
      const [userRes, tasksRes] = await Promise.all([
        fetch(`/api/cultivator?userId=${id}`),
        fetch(`/api/tasks?userId=${id}`),
      ]);

      const userData = await userRes.json();
      const tasksData = await tasksRes.json();

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

      setTasks(tasksData.tasks || []);
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
      }
    } catch {
      toast.error("创建任务失败");
    }
  };

  // 完成任务
  const completeTask = async (taskId: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, userId }),
      });
      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      // 更新任务列表
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, completed: true, cultivationBonus: data.expGained } : t
        )
      );

      // 更新修炼值
      if (data.cultivator) {
        setCultivator(data.cultivator);
      }

      toast.success(`+${data.expGained} 修炼值！`);

      // 生成叙事
      await generateNarrative(data.cultivator, taskId);
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
        // 刷新事件列表
        if (data.event) {
          setEvents((prev) => [data.event, ...prev]);
        }
        // 检查是否可以突破
        if (data.canBreakthrough) {
          setCanBreak(true);
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
        setCanBreak(false);
      }

      if (data.narrative) {
        setNarrative(data.narrative.narrative);
      }

      if (data.event) {
        setEvents((prev) => [data.event, ...prev]);
      }

      if (data.isNewRealm) {
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

  if (isLoading) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-4xl animate-bounce">⚔️</div>
          <p className="text-stone-400">正在进入修仙世界...</p>
        </div>
      </main>
    );
  }

  if (!cultivator) return null;

  const realmData = getCurrentRealm(cultivator.realm);
  const nextRealm = getNextRealm(cultivator.realm);
  const expNeeded = realmData?.expRequired || 100;
  const expPercent = Math.min(100, Math.floor((cultivator.cultivationExp / expNeeded) * 100));
  const rootInfo = SPIRITUAL_ROOTS[cultivator.spiritualRoot];

  const incompleteTasks = tasks.filter((t) => !t.completed);

  const taskIcons: Record<string, React.ReactNode> = {
    STUDY: <BookOpen className="w-5 h-5" />,
    EXERCISE: <Dumbbell className="w-5 h-5" />,
    SLEEP: <Moon className="w-5 h-5" />,
    MEDITATE: <Sparkles className="w-5 h-5" />,
    CUSTOM: <Sword className="w-5 h-5" />,
  };

  return (
    <main className="flex-1 p-4 max-w-lg mx-auto min-h-screen space-y-4">
      {/* 顶部状态栏 */}
      <Card className="bg-stone-900/80 border-stone-700 overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-stone-800">
          <div
            className="h-full bg-gradient-to-r from-amber-600 to-yellow-500 transition-all duration-1000"
            style={{ width: `${expPercent}%` }}
          />
        </div>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {cultivator.realm === "渡劫期" ? "👑" :
                 cultivator.realm.includes("大乘") ? "🌟" :
                 cultivator.realm.includes("合体") ? "💫" :
                 cultivator.realm.includes("炼虚") ? "🌌" :
                 cultivator.realm.includes("化神") ? "🔥" :
                 cultivator.realm.includes("元婴") ? "💎" :
                 cultivator.realm.includes("结丹") ? "🟡" :
                 cultivator.realm.includes("筑基") ? "🟢" : "⚪"}
              </span>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
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
                <CardDescription className="text-stone-400">
                  {cultivator.realm} · 第{cultivator.realmLevel}层
                  {nextRealm && ` → ${nextRealm.name}`}
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-amber-400">{cultivator.totalExp}</div>
              <div className="text-xs text-stone-500">累计修炼值</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">
              当前修炼值: {cultivator.cultivationExp}/{expNeeded}
            </span>
            <span className="text-stone-600">{expPercent}%</span>
          </div>
          {/* 灵力值 */}
          <div className="flex items-center gap-2 mt-2 text-xs text-stone-500">
            <Zap className="w-3 h-3 text-blue-400" />
            <span>灵力: {cultivator.stamina}/100</span>
            <span className="text-stone-600">（每日重置）</span>
          </div>
        </CardContent>
      </Card>

      {/* 突破按钮 */}
      {canBreak && (
        <Button
          className="w-full h-12 text-lg bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 animate-pulse"
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
        <Card className="bg-stone-900/50 border-amber-900/30 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400 font-medium">AI 修炼叙事</span>
            </div>
            <p className="text-stone-300 text-sm leading-relaxed italic">
              {narrative}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 每日任务 */}
      <Card className="bg-stone-900/80 border-stone-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-stone-200 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            今日修炼
          </CardTitle>
          <CardDescription className="text-stone-500">
            完成现实任务，获取修炼值
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {incompleteTasks.length === 0 && Object.keys(TASK_TYPES).length > 0 && (
            <p className="text-stone-600 text-sm text-center py-2">
              尚未开始今日修炼，选择一个修炼方式吧
            </p>
          )}

          {/* 已完成任务 */}
          {tasks
            .filter((t) => t.completed)
            .map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 bg-stone-800/30 rounded-lg opacity-50"
              >
                <span className="text-lg">{taskIcons[task.type]}</span>
                <div className="flex-1">
                  <p className="text-sm text-stone-400 line-through">
                    {TASK_TYPES[task.type]?.name || task.type}
                  </p>
                </div>
                <Badge variant="outline" className="border-green-800 text-green-400 text-xs">
                  +{task.cultivationBonus}
                </Badge>
              </div>
            ))}

          <Separator className="bg-stone-800" />

          {/* 未完成任务 */}
          {incompleteTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 bg-stone-800/30 rounded-lg"
            >
              <span className="text-lg">{taskIcons[task.type]}</span>
              <div className="flex-1">
                <p className="text-sm text-stone-300">
                  {TASK_TYPES[task.type]?.name || task.type}
                </p>
                <p className="text-xs text-stone-500">
                  {TASK_TYPES[task.type]?.description}
                </p>
              </div>
              <Button
                size="sm"
                className="bg-amber-700 hover:bg-amber-600 text-xs"
                onClick={() => completeTask(task.id)}
              >
                完成
              </Button>
            </div>
          ))}

          {/* 快捷创建任务 */}
          <div className="flex gap-2 pt-2 flex-wrap">
            {Object.entries(TASK_TYPES).map(([key, taskType]) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                className="border-stone-700 text-stone-400 hover:text-amber-400 hover:border-amber-700"
                onClick={() => createTask(key)}
                disabled={tasks.some((t) => t.type === key && !t.completed)}
              >
                {taskType.icon} {taskType.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 修炼历史 */}
      <Card className="bg-stone-900/80 border-stone-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-stone-200 flex items-center gap-2">
            <History className="w-4 h-4 text-stone-400" />
            修炼记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            {events.length === 0 ? (
              <p className="text-stone-600 text-sm text-center py-4">
                修炼之路方才开始……
              </p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="border-l-2 border-stone-800 pl-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          event.type === "BREAKTHROUGH"
                            ? "border-red-700 text-red-400"
                            : event.type === "RANDOM_ENCOUNTER"
                            ? "border-purple-700 text-purple-400"
                            : "border-stone-700 text-stone-400"
                        }`}
                      >
                        {event.type === "BREAKTHROUGH"
                          ? "突破"
                          : event.type === "RANDOM_ENCOUNTER"
                          ? "奇遇"
                          : "修炼"}
                      </Badge>
                      <span className="text-sm text-stone-300 font-medium">
                        {event.title}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                      {event.narrative}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 底部导航 */}
      <div className="flex justify-between items-center py-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-stone-500"
          onClick={() => router.push("/")}
        >
          <Home className="w-4 h-4 mr-1" />
          首页
        </Button>
        <p className="text-xs text-stone-700">修仙模拟器 · 同人创作</p>
      </div>
    </main>
  );
}
