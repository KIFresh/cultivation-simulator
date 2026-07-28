"use client";

import React from "react";

interface CliqueInfo {
  key: string;
  name: string;
  description: string;
  bonuses: Record<string, number>;
}

interface SchoolLifePanelProps {
  clique: CliqueInfo | null;
  classEnroll: string | null;
  savings: number | null;
  health: number;
  injuryDebuff: number;
  npcRelations: string | null;
  schoolStage: { name: string; grade: number } | null;
}

export function SchoolLifePanel({
  clique,
  classEnroll,
  savings,
  health,
  injuryDebuff,
  npcRelations,
  schoolStage,
}: SchoolLifePanelProps) {
  // 解析课外班
  const parsedClasses: { optionId: string; name: string }[] = React.useMemo(() => {
    if (!classEnroll) return [];
    try {
      const records = JSON.parse(classEnroll);
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
  }, [classEnroll]);

  // 解析 NPC 关系 → 统计同学+老师数量
  const npcStats = React.useMemo(() => {
    if (!npcRelations) return { classmates: 0, teachers: 0 };
    try {
      const rels = JSON.parse(npcRelations);
      let classmates = 0;
      let teachers = 0;
      for (const val of Object.values(rels) as any[]) {
        if (val.relationType === "classmate") classmates++;
        else if (val.relationType === "teacher") teachers++;
      }
      return { classmates, teachers };
    } catch {
      return { classmates: 0, teachers: 0 };
    }
  }, [npcRelations]);

  const CLASS_NAMES: Record<string, string> = {
    music: "音乐",
    painting: "绘画",
    calligraphy: "书法",
    sports: "体育",
    chess: "棋艺",
    dance: "舞蹈",
    "martial-arts": "武术",
    scholarship: "奥数",
    cooking: "厨艺",
    gardening: "园艺",
  };

  const healthPct = Math.max(0, Math.min(100, health));
  const healthColor =
    healthPct <= 20 ? "text-red-600" : healthPct <= 50 ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="silk-card rounded-3xl p-6 space-y-4">
      <h3 className="text-sm font-bold text-amber-950/80 flex items-center gap-2">
        🏫 校园生活
      </h3>

      {/* 健康值 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">❤️ 健康</span>
        <span className={`text-xs font-bold ${healthColor}`}>
          {healthPct} / 100
          {injuryDebuff > 0 && <span className="text-red-500 ml-1">(受伤 {injuryDebuff} 轮)</span>}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#FAF4EB]">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${healthPct}%`,
            backgroundColor: healthPct <= 20 ? "#DC2626" : healthPct <= 50 ? "#D97706" : "#059669",
          }}
        />
      </div>

      {/* 储蓄 */}
      {savings !== null && savings !== undefined && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">🏦 储蓄</span>
          <span className="font-bold text-[#2C1E1E]">{savings} 金币</span>
        </div>
      )}

      {/* 小团体 */}
      {clique && (
        <div className="border-t border-[#EADCD0] pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">🤝 小团体</span>
            <span className="font-bold text-[#7A1F18]">{clique.name}</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">{clique.description}</p>
          {clique.bonuses && Object.keys(clique.bonuses).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(clique.bonuses).map(([attr, val]) => (
                <span key={attr} className="text-[10px] bg-[#FDF2F0] text-[#7A1F18] px-1.5 py-0.5 rounded">
                  {attr} +{val}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 同学/老师 */}
      {(npcStats.classmates > 0 || npcStats.teachers > 0) && (
        <div className="border-t border-[#EADCD0] pt-3">
          <div className="flex items-center gap-3 text-xs">
            {npcStats.classmates > 0 && (
              <span className="text-gray-500">👥 同学 {npcStats.classmates} 人</span>
            )}
            {npcStats.teachers > 0 && (
              <span className="text-gray-500">👨‍🏫 老师 {npcStats.teachers} 人</span>
            )}
          </div>
        </div>
      )}

      {/* 课外班 */}
      {parsedClasses.length > 0 && (
        <div className="border-t border-[#EADCD0] pt-3">
          <div className="text-xs text-gray-500 mb-1">📚 课外班</div>
          <div className="flex flex-wrap gap-1">
            {parsedClasses.map((cls) => (
              <span
                key={cls.optionId}
                className="text-[10px] bg-[#FDF2F0] text-[#7A1F18] px-2 py-0.5 rounded-full border border-[#B83227]/20"
              >
                {CLASS_NAMES[cls.optionId] || cls.optionId}
              </span>
            ))}
          </div>
        </div>
      )}

      {!clique && npcStats.classmates === 0 && parsedClasses.length === 0 && savings === null && (
        <p className="text-[10px] text-gray-300 italic">学龄前或已毕业</p>
      )}
    </div>
  );
}