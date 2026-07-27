"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface DaoXiaoSummary {
  age: number;
  realm: string;
  realmLevel: number;
  breakthroughCount: number;
  reincarnationCount: number;
  totalExp: number;
}

interface DaoXiaoModalProps {
  open: boolean;
  cultivatorName: string;
  userId: string;
  summary: DaoXiaoSummary;
  onClose: () => void;
}

export default function DaoXiaoModal({
  open,
  cultivatorName,
  userId,
  summary,
  onClose,
}: DaoXiaoModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleReincarnate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cultivator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reincarnate", userId }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "轮回失败");
        return;
      }
      toast.success("轮回转世，重新踏上仙途！");
      onClose();
      router.replace("/dashboard");
    } catch {
      toast.error("轮回失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">🌑 道消身殒</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 text-center">
          <p className="text-foreground">
            {cultivatorName}道友，寿元耗尽，
            <br />于 <strong>{summary.age}</strong> 岁坐化于洞府之中。
          </p>
          <div className="bg-muted rounded-lg p-3 text-left text-sm space-y-1">
            <p className="text-muted-foreground">修炼一生回顾：</p>
            <p>· 最终境界：{summary.realm}</p>
            <p>· 突破次数：{summary.breakthroughCount} 次</p>
            <p>· 累计修炼：{summary.totalExp}</p>
            <p>· 轮回次数：{summary.reincarnationCount} 次</p>
          </div>
          <p className="text-xs text-muted-foreground">
            下一世将获得「前世记忆」天赋加成
          </p>
          <Button
            className="w-full"
            onClick={handleReincarnate}
            disabled={loading}
          >
            {loading ? "轮回中..." : "🔄 轮回转世"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}