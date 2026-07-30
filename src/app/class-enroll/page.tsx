"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, ArrowLeft, Coins } from "lucide-react";
import TopNav from "@/components/top-nav";
import { toast } from "sonner";
import { ATTR_INFO } from "@/lib";

interface ClassInfo {
  id: string;
  name: string;
  school: string;
  cost: number;
  attr: string;
  desc: string;
}
interface EnrollInfo {
  classId: string;
  name: string;
  school: string;
  enrolledAt: string;
}
interface Cultivator {
  id: string;
  name: string;
  gold: number;
}

const ATTR_LABEL: Record<string, string> = Object.fromEntries(
  ATTR_INFO.map((a) => [a.key, a.label])
);

export default function ClassEnrollPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cultivator, setCultivator] = useState<Cultivator | null>(null);
  const [current, setCurrent] = useState<EnrollInfo | null>(null);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (uid: string) => {
    try {
      const [cRes, eRes] = await Promise.all([
        fetch(`/api/cultivator?userId=${uid}`),
        fetch(`/api/class-enroll`),
      ]);
      const cData = await cRes.json();
      const eData = await eRes.json();
      if (cData.user?.cultivator) {
        const c = cData.user.cultivator;
        setCultivator({ id: c.id, name: c.name, gold: c.gold ?? 0 });
      }
      if (eData.classEnroll) setCurrent(eData.classEnroll);
      if (eData.availableClasses) setClasses(eData.availableClasses);
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) {
      router.push("/");
      return;
    }
    setUserId(id);
    load(id);
  }, [router, load]);

  const enroll = async (cls: ClassInfo) => {
    if (!userId || busy) return;
    if ((cultivator?.gold ?? 0) < cls.cost) {
      toast.error("灵石不足，无法入学");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/class-enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: cls.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "入学失败");
        return;
      }
      setCultivator((c) => (c ? { ...c, gold: data.gold } : c));
      setCurrent(data.classEnroll);
      toast.success(`📚 已入学「${cls.name}」`);
    } catch (e) {
      toast.error("入学失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <main className="flex-1 flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">加载中...</p>
      </main>
    );
  if (!cultivator)
    return (
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-muted-foreground mb-4">尚未创建修炼者</p>
        <Button onClick={() => router.push("/create")}>创建角色</Button>
      </main>
    );

  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <TopNav />
      <div className="relative z-10 max-w-lg w-full mx-auto p-4 space-y-3">
        <button
          onClick={() => router.push("/life")}
          className="flex items-center gap-1 text-muted-foreground hover:text-primary text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> 返回生活
        </button>

        <Card className="border-border bg-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" /> 课外班
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Coins className="w-4 h-4" /> 灵石
              </span>
              <span className="text-foreground font-bold">{cultivator.gold}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              当前修习：{current ? `${current.name}（${current.school}）` : "未报名任何课程"}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {classes.map((cls) => {
            const enrolled = current?.classId === cls.id;
            return (
              <Card key={cls.id} className="border-border bg-card shadow-md">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{cls.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cls.school} · {cls.desc}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      花费 {cls.cost} · 增益 {ATTR_LABEL[cls.attr] ?? cls.attr}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={enrolled ? "outline" : "default"}
                    className={
                      enrolled
                        ? "border-border text-muted-foreground shrink-0"
                        : "bg-primary hover:bg-[#B33A2A] text-white shrink-0"
                    }
                    disabled={busy || enrolled || cultivator.gold < cls.cost}
                    onClick={() => enroll(cls)}
                  >
                    {enrolled ? "在读" : "报名"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
