"use client";

import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store";
import { deriveSkillLevels } from "@/app/dashboard/hooks/use-data-sync";
import type { SkillLevel } from "@/app/dashboard/hooks/use-data-sync";
import { Button } from "@/components/ui/button";
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
}

/* ─── 功法标签页 ─── */
function TechniquesTab() {
  const userId = useGameStore((s) => s.userId);
  const [records, setRecords] = useState<TechniqueRecord[]>([]);
  const [allTech, setAllTech] = useState<Record<string, Technique>>({});
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTechniques = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cultivator/techniques?userId=${userId}`);
      const data = await res.json();
      setRecords(data.techniques || []);
      setAllTech(data.allTechniques || {});
    } catch {
      // ignore
    } finally {
      setLoading(false);
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

  const handleEquip = async (techniqueId: string, slot: number) => {
    setActionLoading(true);
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
      setActionLoading(false);
    }
  };

  const handleUnequip = async (slot?: number, techniqueId?: string) => {
    setActionLoading(true);
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
      setActionLoading(false);
    }
  };

  const getEffectText = (e: Technique["effects"][0], level: number) => {
    const val = e.value + e.perLevel * (level - 1);
    return e.description.replace("{value}", String(val));
  };

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">
        加载中...
      </p>
    );
  }

  if (records.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">
        尚未获得任何功法
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* 已装备 */}
      <div>
        <h3 className="text-sm font-semibold text-[#5A5040] mb-2">
          已装备 ({equipped.length}/3)
        </h3>
        <div className="space-y-2">
          {[1, 2, 3].map((slot) => {
            const record = equipped.find((r) => r.equipSlot === slot);
            const tech = record ? getTech(record.techniqueId) : null;
            return (
              <div
                key={slot}
                className="border border-[#EADCD0] bg-white rounded-lg p-3 flex items-center gap-3"
              >
                {tech ? (
                  <>
                    <span className="text-2xl">{tech.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#2C1E1E]">
                        {tech.name}{" "}
                        <span className="text-xs text-[#8B7355]">
                          Lv.{record!.level}
                        </span>
                      </p>
                      {tech.effects.map((e, i) => (
                        <p key={i} className="text-xs text-[#8B7355]">
                          {getEffectText(e, record!.level)}
                        </p>
                      ))}
                      <div className="flex items-center gap-1 mt-1">
                        <div className="flex-1 h-1 bg-[#F0E8D8] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#B83227] rounded-full"
                            style={{
                              width: `${(record!.proficiency / (tech.upgradeProficiency[record!.level - 1] || 1)) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-[#8B7355]">
                          {record!.proficiency}/
                          {tech.upgradeProficiency[record!.level - 1] || "MAX"}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0"
                      onClick={() => handleUnequip(slot)}
                      disabled={actionLoading}
                    >
                      卸下
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-lg bg-[#F0E8D8] flex items-center justify-center text-[#8B7355]">
                      □
                    </div>
                    <span className="text-sm text-[#8B7355] flex-1">
                      空槽位 {slot}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 未装备 */}
      {unequipped.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#5A5040] mb-2">未装备</h3>
          <div className="space-y-2">
            {unequipped.map((r) => {
              const tech = getTech(r.techniqueId);
              if (!tech) return null;
              return (
                <div
                  key={r.id}
                  className="border border-[#EADCD0] bg-white rounded-lg p-3 flex items-center gap-3"
                >
                  <span className="text-2xl">{tech.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#2C1E1E]">
                      {tech.name}{" "}
                      <span className="text-xs text-[#8B7355]">
                        Lv.{r.level}
                      </span>
                    </p>
                    <p className="text-xs text-[#8B7355]">{tech.description}</p>
                    {tech.effects.map((e, i) => (
                      <p key={i} className="text-xs text-[#8B7355]">
                        {getEffectText(e, r.level)}
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {[1, 2, 3].map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 text-xs p-0"
                        disabled={
                          actionLoading ||
                          !!equipped.find((e) => e.equipSlot === s)
                        }
                        onClick={() => handleEquip(r.techniqueId, s)}
                        title={`装备到槽位${s}`}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {unequipped.length === 0 && records.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          所有功法都已装备
        </p>
      )}
    </div>
  );
}

/* ─── 技艺标签页 ─── */
function SkillsTab() {
  const cultivator = useGameStore((s) => s.cultivator);

  const skills: SkillLevel[] = deriveSkillLevels(
    cultivator?.attributeExp ?? null,
    cultivator?.subjectExp ?? null,
  );

  if (skills.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">
        尚未习得任何技艺
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {skills.map((sk) => {
        const percent =
          sk.expToNext > 0
            ? Math.min(100, (sk.exp / sk.expToNext) * 100)
            : 0;
        return (
          <div
            key={sk.id}
            className="border border-[#EADCD0] bg-white rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-[#2C1E1E]">
                {sk.name}
              </span>
              <span className="text-xs text-[#8B7355]">
                Lv.{sk.level} · {sk.exp}/{sk.expToNext}
              </span>
            </div>
            <div className="h-2 bg-[#F0E8D8] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#D49B4B] rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-[10px] text-[#8B7355] mt-1">
              进度 {Math.round(percent)}%
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ─── 技能页面 ─── */
export default function SkillsPage() {
  const [activeTab, setActiveTab] = useState<"techniques" | "skills">(
    "techniques",
  );

  return (
    <main className="min-h-screen bg-[#FAF7F3]">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-xl font-bold text-[#2C1E1E]">📖 功法与技艺</h1>
          <p className="text-xs text-[#8B7355] mt-1">
            修炼功法、精进技艺，提升实力
          </p>
        </div>

        {/* 标签切换 */}
        <div className="flex gap-1 bg-[#F0E8D8] rounded-lg p-1">
          <button
            onClick={() => setActiveTab("techniques")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              activeTab === "techniques"
                ? "bg-white text-[#2C1E1E] shadow-sm"
                : "text-[#8B7355] hover:text-[#5A5040]"
            }`}
          >
            功法
          </button>
          <button
            onClick={() => setActiveTab("skills")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
              activeTab === "skills"
                ? "bg-white text-[#2C1E1E] shadow-sm"
                : "text-[#8B7355] hover:text-[#5A5040]"
            }`}
          >
            技艺
          </button>
        </div>

        {/* 内容区 */}
        <div>
          {activeTab === "techniques" ? <TechniquesTab /> : <SkillsTab />}
        </div>
      </div>
    </main>
  );
}