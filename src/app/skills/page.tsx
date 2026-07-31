"use client";

import { useCallback, useEffect, useState } from "react";
import TopNav from "@/components/top-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface TechniqueRecord {
  id: string;
  techniqueId: string;
  equipSlot: number | null;
  level: number;
  proficiency: number;
}

interface Technique {
  id: string;
  name: string;
  icon: string;
  description: string;
  grade: string;
  realm: string;
  maxLevel: number;
  upgradeProficiency: number[];
  effects: { type: string; value: number; perLevel: number; description: string }[];
  category: "功法" | "技艺";
}

export default function SkillsPage() {
  const [records, setRecords] = useState<TechniqueRecord[]>([]);
  const [allTech, setAllTech] = useState<Record<string, Technique>>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"功法" | "技艺">("功法");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (id) setUserId(id);
  }, []);

  const fetchTechniques = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/cultivator/techniques?userId=${userId}`);
      const data = await res.json();
      setRecords(data.techniques || []);
      setAllTech(data.allTechniques || {});
    } catch {
      // ignore
    }
  }, [userId]);

  useEffect(() => {
    fetchTechniques();
  }, [fetchTechniques]);

  const getTech = (id: string) => allTech[id];

  const equipped = records
    .filter((r) => r.equipSlot !== null)
    .sort((a, b) => (a.equipSlot || 0) - (b.equipSlot || 0));

  const unequipped = records.filter((r) => r.equipSlot === null);

  const getEffectText = (e: Technique["effects"][0], level: number) => {
    const val = e.value + e.perLevel * (level - 1);
    return e.description.replace("{value}", String(val));
  };

  const handleEquip = async (techniqueId: string, slot: number) => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/cultivator/techniques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "equip", userId, techniqueId, slot }),
      });
      const data = await res.json();
      if (data.techniques) setRecords(data.techniques);
      toast.success("装备成功");
    } catch {
      toast.error("装备失败");
    } finally {
      setLoading(false);
    }
  };

  const handleUnequip = async (slot?: number, techniqueId?: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/cultivator/techniques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unequip", userId, slot, techniqueId }),
      });
      const data = await res.json();
      if (data.techniques) setRecords(data.techniques);
      toast.success("已卸下");
    } catch {
      toast.error("卸下失败");
    } finally {
      setLoading(false);
    }
  };

  const filteredEquipped = equipped.filter((r) => {
    const tech = getTech(r.techniqueId);
    return tech?.category === activeTab;
  });

  const filteredUnequipped = unequipped.filter((r) => {
    const tech = getTech(r.techniqueId);
    return tech?.category === activeTab;
  });

  const emptySlots = [1, 2, 3].filter(
    (slot) => !filteredEquipped.some((r) => r.equipSlot === slot)
  );

  if (records.length === 0) {
    return (
      <main className="min-h-screen bg-[#FAF7F3]">
        <TopNav />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>📖 技能</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                你还没有学会任何功法或技艺
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF7F3]">
      <TopNav />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#2C1E1E]">📖 技能</h1>
          <p className="text-xs text-[#8B7355] mt-1">功法和技艺，提升修为与生活的能力</p>
        </div>

        {/* 标签切换 */}
        <div className="flex gap-2">
          {(["功法", "技艺"] as const).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </Button>
          ))}
        </div>

        {/* 已装备 */}
        <section>
          <h2 className="text-sm font-semibold text-[#5A5040] mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B83227]" />
            已装备 ({filteredEquipped.length}/3)
          </h2>
          <div className="space-y-2">
            {filteredEquipped.map((record) => {
              const tech = getTech(record.techniqueId);
              if (!tech) return null;
              return (
                <div
                  key={record.id}
                  className="border border-[#EADCD0] bg-white rounded-lg p-3 flex items-center gap-3"
                >
                  <span className="text-2xl">{tech.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#2C1E1E]">
                      {tech.name}{" "}
                      <span className="text-xs text-[#8B7355]">Lv.{record.level}</span>
                    </p>
                    <p className="text-xs text-[#8B7355]">{tech.description}</p>
                    {tech.effects.map((e, i) => (
                      <p key={i} className="text-xs text-[#D49B4B]">
                        ✨ {getEffectText(e, record.level)}
                      </p>
                    ))}
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex-1 h-1 bg-[#EADCD0] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#B83227] rounded-full"
                          style={{
                            width: `${(record.proficiency / (tech.upgradeProficiency[record.level - 1] || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-[#8B7355]">
                        {record.proficiency}/
                        {tech.upgradeProficiency[record.level - 1] || "MAX"}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs shrink-0"
                    onClick={() => handleUnequip(record.equipSlot ?? undefined)}
                    disabled={loading}
                  >
                    卸下
                  </Button>
                </div>
              );
            })}
            {emptySlots.map((slot) => (
              <div
                key={`empty-${slot}`}
                className="border border-dashed border-[#D2C6B2] bg-[#FAF7F3] rounded-lg p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-[#EADCD0] flex items-center justify-center text-[#8B7355]">
                  □
                </div>
                <span className="text-sm text-[#8B7355] flex-1">空槽位 {slot}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 未装备 */}
        {filteredUnequipped.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-[#5A5040] mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4A90D9]" />
              未装备
            </h2>
            <div className="space-y-2">
              {filteredUnequipped.map((record) => {
                const tech = getTech(record.techniqueId);
                if (!tech) return null;
                return (
                  <div
                    key={record.id}
                    className="border border-[#EADCD0] bg-white rounded-lg p-3 flex items-center gap-3"
                  >
                    <span className="text-2xl">{tech.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#2C1E1E]">
                        {tech.name}{" "}
                        <span className="text-xs text-[#8B7355]">Lv.{record.level}</span>
                      </p>
                      <p className="text-xs text-[#8B7355]">{tech.description}</p>
                      {tech.effects.map((e, i) => (
                        <p key={i} className="text-xs text-[#D49B4B]">
                          ✨ {getEffectText(e, record.level)}
                        </p>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs shrink-0"
                      onClick={() =>
                        handleEquip(record.techniqueId, emptySlots[0] || 1)
                      }
                      disabled={loading || emptySlots.length === 0}
                    >
                      装备
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}