"use client";

// 临时自测页 —— 自测后删除
import { useState } from "react";
import BreakthroughCard, { type BreakthroughCardData } from "@/components/breakthrough-card";

const ZHUJI: BreakthroughCardData = {
  name: "清风真人",
  spiritualRoot: "水木双灵根",
  realm: "筑基期",
  fromRealm: "炼气期",
  createdAt: new Date(Date.now() - 47 * 86400000).toISOString(),
  totalExp: 2840,
  breakthroughCount: 1,
};

const JIEDAN: BreakthroughCardData = {
  name: "清风真人",
  spiritualRoot: "水木双灵根",
  realm: "结丹期",
  fromRealm: "筑基期",
  createdAt: new Date(Date.now() - 89 * 86400000).toISOString(),
  totalExp: 18600,
  breakthroughCount: 5,
};

export default function CardPreviewPage() {
  const [data, setData] = useState<BreakthroughCardData | null>(null);
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <button className="rounded bg-green-700 px-4 py-2 text-white" onClick={() => setData(ZHUJI)}>
        预览 筑基卡
      </button>
      <button className="rounded bg-amber-700 px-4 py-2 text-white" onClick={() => setData(JIEDAN)}>
        预览 结丹卡
      </button>
      <BreakthroughCard data={data} onClose={() => setData(null)} />
    </main>
  );
}
