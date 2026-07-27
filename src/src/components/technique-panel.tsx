"use client";

import { useState, useEffect, useCallback } from "react";
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

interface TechniquePanelProps {
  cultivatorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TechniquePanel({ cultivatorId, open, onOpenChange }: TechniquePanelProps) {
  const [records, setRecords] = useState<TechniqueRecord[]>([]);
  const [allTech, setAllTech] = useState<Record<string, Technique>>({});
  const [loading, setLoading] = useState(false);

  const fetchTechniques = useCallback(async () => {
    try {
      const res = await fetch(`/api/cultivator/techniques?userId=${cultivatorId}`);
      const data = await res.json();
      setRecords(data.techniques || []);
      setAllTech(data.allTechniques || {});
    } catch {
      // ignore
    }
  }, [cultivatorId]);

  useEffect(() => {
    if (open) fetchTechniques();
  }, [open, fetchTechniques]);

  const getTech = (id: string) => allTech[id];

  const equipped = records.filter((r) => r.equipSlot !== null).sort((a, b) => (a.equipSlot || 0) - (b.equipSlot || 0));
  const unequipped = records.filter((r) => r.equipSlot === null);

  const handleEquip = async (techniqueId: string, slot: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/cultivator/techniques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "equip", userId: cultivatorId, techniqueId, slot }),
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
    setLoading(true);
    try {
      const res = await fetch("/api/cultivator/techniques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unequip", userId: cultivatorId, slot, techniqueId }),
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

  const getEffectText = (e: Technique["effects"][0], level: number) => {
    const val = e.value + e.perLevel * (level - 1);
    return e.description.replace("{value}", String(val));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => onOpenChange(false)}>
      <div className="bg-[#FDFBF7] w-full max-w-lg max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-y-auto p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">📖 功法 · 已装备 {equipped.length}/3</h2>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground text-xl">✕</button>
        </div>

        {/* 装备槽位 */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">已装备</p>
          {[1, 2, 3].map((slot) => {
            const record = equipped.find((r) => r.equipSlot === slot);
            const tech = record ? getTech(record.techniqueId) : null;
            return (
              <div key={slot} className="border border-border bg-card rounded-lg p-3 flex items-center gap-3">
                {tech ? (
                  <>
                    <span className="text-2xl">{tech.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{tech.name} <span className="text-xs text-muted-foreground">Lv.{record!.level}</span></p>
                      {tech.effects.map((e, i) => (
                        <p key={i} className="text-xs text-muted-foreground">{getEffectText(e, record!.level)}</p>
                      ))}
                      <div className="flex items-center gap-1 mt-1">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{
                            width: `${(record!.proficiency / (tech.upgradeProficiency[record!.level - 1] || 1)) * 100}%`
                          }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{record!.proficiency}/{tech.upgradeProficiency[record!.level - 1] || "MAX"}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => handleUnequip(slot)} disabled={loading}>卸下</Button>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">□</div>
                    <span className="text-sm text-muted-foreground flex-1">空槽位 {slot}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* 未装备功法 */}
        {unequipped.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">未装备</p>
            {unequipped.map((r) => {
              const tech = getTech(r.techniqueId);
              if (!tech) return null;
              return (
                <div key={r.id} className="border border-border bg-card rounded-lg p-3 flex items-center gap-3">
                  <span className="text-2xl">{tech.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{tech.name} <span className="text-xs text-muted-foreground">Lv.{r.level}</span></p>
                    <p className="text-xs text-muted-foreground">{tech.description}</p>
                    {tech.effects.map((e, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{getEffectText(e, r.level)}</p>
                    ))}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {[1, 2, 3].map((s) => (
                      <Button key={s} size="sm" variant="outline" className="h-7 w-7 text-xs p-0" disabled={loading || !!equipped.find(e => e.equipSlot === s)} onClick={() => handleEquip(r.techniqueId, s)} title={`装备到槽位${s}`}>
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {unequipped.length === 0 && records.length > 0 && (
          <p className="text-center text-xs text-muted-foreground py-4">所有功法都已装备</p>
        )}
        {records.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-4">尚未获得任何功法</p>
        )}
      </div>
    </div>
  );
}