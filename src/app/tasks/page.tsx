"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Dumbbell, Moon, Sparkles, Sword, Briefcase, CheckCircle2, Circle } from "lucide-react";
import { TASK_TYPES, calculateTaskExp } from "@/lib";
import type { SpiritualRoot } from "@/lib";
import { toast } from "sonner";
import BottomNav from "@/components/bottom-nav";

interface Task {
  id: string;
  type: string;
  description: string | null;
  completed: boolean;
  cultivationBonus: number;
}

const taskIcons: Record<string, React.ReactNode> = {
  STUDY:    <BookOpen  className="w-5 h-5" />,
  EXERCISE: <Dumbbell  className="w-5 h-5" />,
  SLEEP:    <Moon      className="w-5 h-5" />,
  MEDITATE: <Sparkles  className="w-5 h-5" />,
  WORK:     <Briefcase className="w-5 h-5" />,
  CUSTOM:   <Sword     className="w-5 h-5" />,
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [userId, setUserId]     = useState("");
  const [spiritualRoot, setSpiritualRoot] = useState<SpiritualRoot>("杂灵根");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const id = localStorage.getItem("userId");
    if (!id) { router.replace("/"); return; }
    setUserId(id);

    const [tasksRes, userRes] = await Promise.all([
      fetch(`/api/tasks?userId=${id}`),
      fetch(`/api/cultivator?userId=${id}`),
    ]);
    const tasksData = await tasksRes.json();
    const userData  = await userRes.json();

    setTasks(tasksData.tasks || []);
    if (userData.user?.cultivator?.spiritualRoot) {
      setSpiritualRoot(userData.user.cultivator.spiritualRoot);
    }
    setIsLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const createTask = async (type: string) => {
    const res  = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, type }),
    });
    const data = await res.json();
    if (data.task) {
      setTasks(prev => [data.task, ...prev]);
      toast.success(`开始${TASK_TYPES[type]?.name}！`);
    } else {
      toast.error(data.error || "创建失败");
    }
  };

  const completeTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const est  = task ? calculateTaskExp(task.type, spiritualRoot) : 0;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true, cultivationBonus: est } : t));

    const res  = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, userId }),
    });
    const data = await res.json();

    if (data.error) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: false, cultivationBonus: 0 } : t));
      toast.error(data.error);
    } else {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true, cultivationBonus: data.expGained } : t));
      toast.success(`+${data.expGained} 修炼值！回修炼面板查看叙事`);
    }
  };

  const incompleteTasks = tasks.filter(t => !t.completed);
  const completedTasks  = tasks.filter(t => t.completed);

  if (isLoading) {
    return (
      <main className="flex-1 p-4 max-w-lg mx-auto min-h-screen pb-24 space-y-3 animate-pulse">
        {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-stone-800 rounded-lg" />)}
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 max-w-lg mx-auto min-h-screen pb-24 space-y-4">
      <div className="pt-2">
        <h1 className="text-xl font-bold text-amber-400">今日修炼任务</h1>
        <p className="text-sm text-stone-400 mt-0.5">
          已完成 {completedTasks.length} / {tasks.length} 项
        </p>
      </div>

      {/* 添加任务 */}
      <Card className="bg-stone-800 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-stone-300">选择修炼方式</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TASK_TYPES).map(([key, taskType]) => {
              const done    = tasks.filter(t => t.type === key && t.completed).length;
              const atLimit = done >= taskType.dailyMax;
              const pending = tasks.some(t => t.type === key && !t.completed);
              return (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  className={`border-white/10 text-white hover:border-amber-700 hover:text-amber-400 h-10 px-3 ${atLimit ? "opacity-40 cursor-not-allowed" : ""}`}
                  onClick={() => createTask(key)}
                  disabled={pending || atLimit}
                >
                  {taskType.icon} <span className="ml-1">{taskType.name}</span>
                  {atLimit && <span className="ml-1 text-xs opacity-70">满</span>}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 待完成 */}
      {incompleteTasks.length > 0 && (
        <Card className="bg-stone-800 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-stone-300 flex items-center gap-2">
              <Circle className="w-4 h-4 text-amber-400" /> 待完成（{incompleteTasks.length}）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {incompleteTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 bg-stone-900/50 rounded-xl">
                <span className="text-amber-400">{taskIcons[task.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{TASK_TYPES[task.type]?.name}</p>
                  <p className="text-xs text-stone-400 truncate">{TASK_TYPES[task.type]?.description}</p>
                </div>
                <Button
                  size="sm"
                  className="bg-amber-700 hover:bg-amber-600 h-9 px-4 shrink-0"
                  onClick={() => completeTask(task.id)}
                >
                  完成
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 已完成 */}
      {completedTasks.length > 0 && (
        <Card className="bg-stone-800 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-stone-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" /> 已完成（{completedTasks.length}）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {completedTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 bg-stone-900/30 rounded-xl opacity-60">
                <span className="text-stone-500">{taskIcons[task.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-400 line-through">{TASK_TYPES[task.type]?.name}</p>
                </div>
                <Badge variant="outline" className="border-green-800 text-green-400 text-xs shrink-0">
                  +{task.cultivationBonus}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tasks.length === 0 && (
        <div className="text-center py-12 text-stone-400">
          <p className="text-4xl mb-3">☀️</p>
          <p>今日尚未开始修炼</p>
          <p className="text-sm mt-1">选择上方的修炼方式，踏入仙途</p>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
