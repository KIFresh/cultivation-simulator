"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, ArrowLeft, Check } from "lucide-react";
import { generateEarthFamily } from "@/lib/family";
import { toast } from "sonner";

// 数据定义
const WORLDS = [
  { id: "earth", name: "地球", icon: "🌍", tag: "现实世界", desc: "灵气复苏的现代世界，16岁后才可觉醒修仙" },
  { id: "crazy", name: "疯狂世界", icon: "💀", tag: "异界修仙", desc: "规则崩坏的扭曲世界，灵气无处不在" },
];

const BIRTHS = [
  { id: "waste", name: "废柴", points: 5, icon: "💩", desc: "天生废材，毫无修炼天赋" },
  { id: "mortal", name: "凡人", points: 8, icon: "👤", desc: "普普通通，毫无特别之处" },
  { id: "elite", name: "俊杰", points: 11, icon: "🌟", desc: "天赋异禀，远超常人" },
  { id: "prodigy", name: "天骄", points: 14, icon: "⭐", desc: "百年难遇的修炼奇才" },
  { id: "monster", name: "妖孽", points: 17, icon: "🔥", desc: "千年不出的妖孽之才" },
  { id: "reborn", name: "谪仙转世", points: 21, icon: "✨", desc: "疑似仙人转世，天生道体" },
  { id: "chosen", name: "大道之子", points: 25, icon: "👑", desc: "天道垂青，气运加身" },
];

const IDENTITIES = [
  { id: "orphan", name: "山野遗孤", cost: 0, icon: "🌄", desc: "无依无靠，自由但也无资源" },
  { id: "scholar", name: "书香门第", cost: 2, icon: "📚", desc: "家学渊源，知识储备丰富" },
  { id: "merchant", name: "商贾之子", cost: 3, icon: "💰", desc: "家境殷实，灵石不愁" },
  { id: "general", name: "将门之后", cost: 4, icon: "⚔️", desc: "武学世家，根基扎实" },
  { id: "sect", name: "散修传人", cost: 5, icon: "🔮", desc: "有师承渊源，起点更高" },
];

const ELEMENTS = ["金", "木", "水", "火", "土"] as const;
const QUALITIES = ["上品", "中品", "下品"] as const;
const ELEMENT_COLORS: Record<string, string> = { "金": "#FFD700", "木": "#4CAF50", "水": "#2196F3", "火": "#FF5722", "土": "#8D6E63" };
const QUALITY_COLORS: Record<string, string> = { "上品": "#FF6B35", "中品": "#4A90D9", "下品": "#9E9E9E" };
const QUALITY_MULT: Record<string, number> = { "上品": 1.6, "中品": 1.3, "下品": 1.0 };

const TALENTS = [
  { id: "protagonist", name: "天命主角", cost: 5, desc: "气运+3，奇遇概率大幅提升" },
  { id: "sword", name: "剑道独尊", cost: 4, desc: "根骨+2，剑法修炼速度翻倍" },
  { id: "pill", name: "丹道圣手", cost: 3, desc: "灵性+2，炼丹成功率提升" },
  { id: "array", name: "阵法大师", cost: 3, desc: "悟性+2，阵法领悟力提升" },
  { id: "forge", name: "炼器鬼手", cost: 3, desc: "根骨+1灵性+1，炼器水平提升" },
  { id: "treasure", name: "多宝童子", cost: 4, desc: "气运+2，初始获得一件宝物" },
  { id: "body", name: "体修奇才", cost: 2, desc: "根骨+2，肉身强度提升" },
  { id: "mind", name: "神识过人", cost: 2, desc: "心性+2，神识强度提升" },
];

const ATTR_DEFS = [
  { key: "root", label: "根骨", icon: "🦴", desc: "影响气血、恢复、炼体" },
  { key: "spirit", label: "灵性", icon: "✨", desc: "影响灵气亲和、法术" },
  { key: "insight", label: "悟性", icon: "🧠", desc: "影响功法领悟、学习" },
  { key: "luck", label: "气运", icon: "🍀", desc: "影响奇遇、宝物获取" },
  { key: "charm", label: "魅力", icon: "💫", desc: "影响NPC好感、社交" },
  { key: "mind", label: "心性", icon: "💎", desc: "影响心魔抵抗、意志" },
];

export default function CreatePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const uid = localStorage.getItem("userId");
    if (!uid) { router.replace("/login"); return; }
    setUserId(uid);
  }, [router]);

  // 各步骤数据
  const [selectedWorld, setSelectedWorld] = useState<typeof WORLDS[0] | null>(null);
  const [selectedBirth, setSelectedBirth] = useState<typeof BIRTHS[0] | null>(null);
  const [selectedIdentity, setSelectedIdentity] = useState<typeof IDENTITIES[0] | null>(null);
  const [selectedRoot, setSelectedRoot] = useState<{ element: string; quality: string; multiplier: number } | null>(null);
  const [selectedTalentIds, setSelectedTalentIds] = useState<string[]>([]);
  const [attributes, setAttributes] = useState<Record<string, number>>({ root: 0, spirit: 0, insight: 0, luck: 0, charm: 0, mind: 0 });

  const birthPoints = selectedBirth?.points || 0;
  const identityCost = selectedIdentity?.cost || 0;
  const rootCost = selectedRoot ? 2 : 0;
  const talentCost = selectedTalentIds.reduce((sum, id) => sum + (TALENTS.find((t) => t.id === id)?.cost || 0), 0);
  const attrUsed = Object.values(attributes).reduce((a, b) => a + b, 0);
  const remaining = birthPoints - identityCost - rootCost - talentCost - attrUsed;
  const maxAttrPoints = remaining + attrUsed;

  const steps = ["世界", "出生", "身份", "灵根", "天赋", "属性", "确认"];
  const stepLabels = ["选择世界", "先天资质", "身份背景", "灵根", "天赋特长", "分配属性", "确认创建"];

  const goNext = () => { if (step < steps.length - 1) setStep(step + 1); };
  const goBack = () => { if (step > 0) setStep(step - 1); };

  const handleCreate = async () => {
    if (!selectedRoot) return;
    setLoading(true);
    try {
      const rootId = selectedRoot.element === "chaos" ? "chaos" : `${selectedRoot.element}_${selectedRoot.quality}`;
      const cultivatorName = localStorage.getItem("cultivatorName") || userId;
      const res = await fetch("/api/cultivator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, cultivatorName, spiritualRoot: rootId, worldId: selectedWorld?.id }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); setLoading(false); return; }
      if (!data?.user) { alert("创建失败：服务器返回异常"); setLoading(false); return; }

      localStorage.setItem("userId", data.user.id);
      localStorage.setItem("cultivatorName", cultivatorName ?? "");
      localStorage.setItem("attributes", JSON.stringify(attributes));

      if (selectedWorld?.id === "earth") {
        const family = generateEarthFamily(1, selectedIdentity?.id || "scholar");
        localStorage.setItem("family", JSON.stringify(family));
      }

      // 生成出生叙事（失败时弹重试按钮）
      const genNarrative = async (): Promise<boolean> => {
        try {
          const birthRes = await fetch("/api/narrative", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: data.user.id, type: "BIRTH", worldName: selectedWorld?.name,
              identityName: selectedIdentity?.name, age: 1, worldId: selectedWorld?.id,
              birthTier: selectedBirth?.name,
              family: selectedWorld?.id === "earth" ? JSON.parse(localStorage.getItem("family") || "{}").members || [] : [],
            }),
          });
          if (!birthRes.ok) {
            const errData = await birthRes.json().catch(() => ({}));
            throw new Error(errData.error || `出生叙事生成失败 (${birthRes.status})`);
          }
          return true;
        } catch (err) {
          console.error("出生叙事生成失败:", err);
          return new Promise((resolve) => {
            toast.error(`出生叙事生成失败: ${(err as Error).message}`, {
              action: { label: "重试", onClick: () => resolve(genNarrative()) },
              duration: 10000,
            });
          });
        }
      };
      const ok = await genNarrative();
      if (!ok) { setLoading(false); return; }

      router.replace("/dashboard");
    } catch (err) { console.error(err); alert("创建失败"); setLoading(false); }
  };

  // 天赋选择切换
  const toggleTalent = (id: string) => {
    const t = TALENTS.find((t) => t.id === id);
    if (!t) return;
    if (selectedTalentIds.includes(id)) {
      setSelectedTalentIds(selectedTalentIds.filter((i) => i !== id));
    } else if (remaining >= t.cost) {
      setSelectedTalentIds([...selectedTalentIds, id]);
    }
  };

  // 属性调整
  const adjustAttr = (key: string, delta: number) => {
    const cur = attributes[key] || 0;
    const newVal = cur + delta;
    if (newVal < 0) return;
    if (delta > 0 && remaining < delta) return;
    setAttributes({ ...attributes, [key]: newVal });
  };

  const handleReset = () => setAttributes({ root: 0, spirit: 0, insight: 0, luck: 0, charm: 0, mind: 0 });
  const handleBalance = () => {
    const pts = maxAttrPoints;
    const base = Math.floor(pts / 6);
    const rem = pts % 6;
    const keys = ["root", "spirit", "insight", "luck", "charm", "mind"];
    const newAttrs: Record<string, number> = {};
    keys.forEach((k, i) => { newAttrs[k] = base + (i < rem ? 1 : 0); });
    setAttributes(newAttrs);
  };
  const handleRandom = () => {
    let pts = maxAttrPoints;
    const keys = ["root", "spirit", "insight", "luck", "charm", "mind"];
    const newAttrs: Record<string, number> = {};
    for (let i = 0; i < keys.length; i++) {
      if (i === keys.length - 1) { newAttrs[keys[i]] = pts; break; }
      const v = Math.floor(Math.random() * (pts + 1));
      newAttrs[keys[i]] = v;
      pts -= v;
    }
    setAttributes(newAttrs);
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen bg-background">
      <div className="max-w-lg w-full space-y-4">
        <div className="flex justify-start">
          <button onClick={() => router.push("/")} className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> 返回首页
          </button>
        </div>
        {/* 步骤指示器 */}
        <div className="flex items-center gap-1 justify-center">
          {steps.map((s, i) => (
            <div key={i} className={`flex items-center gap-1 ${i > 0 ? "ml-0.5" : ""}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                i === step ? "bg-primary text-white" : i < step ? "bg-primary/30 text-primary" : "bg-muted text-muted-foreground"
              }`}>{i + 1}</div>
              {i < steps.length - 1 && <div className={`w-4 h-0.5 ${i < step ? "bg-primary/30" : "bg-muted"}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mb-2">{stepLabels[step]}</p>

        {/* 天资点余额 */}
        {step >= 1 && (
          <div className="text-center text-sm">
            <span className="text-primary font-bold">天资点：{remaining}</span>
            <span className="text-muted-foreground ml-2">/ {birthPoints}</span>
          </div>
        )}

        {/* 步骤 0: 世界 */}
        {step === 0 && (
          <div className="space-y-2">
            {WORLDS.map((w) => (
              <Card key={w.id} className={`border cursor-pointer transition-all hover:border-primary/50 ${selectedWorld?.id === w.id ? "border-primary bg-primary/5" : "border-border bg-card"} shadow-md`} onClick={() => setSelectedWorld(w)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <span className="text-2xl">{w.icon}</span>
                  <div className="flex-1"><p className="font-semibold text-foreground">{w.name}</p><p className="text-xs text-muted-foreground">{w.desc}</p></div>
                  {selectedWorld?.id === w.id && <Check className="w-5 h-5 text-primary" />}
                </CardContent>
              </Card>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-border" onClick={goBack}>返回</Button>
              <Button className="flex-1 bg-primary hover:bg-[#B33A2A] text-white" disabled={!selectedWorld} onClick={goNext}>下一步</Button>
            </div>
          </div>
        )}

        {/* 步骤 1: 出生 */}
        {step === 1 && (
          <div className="space-y-2">
            {BIRTHS.map((b) => {
              const canAfford = true;
              return (
                <Card key={b.id} className={`border cursor-pointer transition-all ${selectedBirth?.id === b.id ? "border-primary bg-primary/5" : canAfford ? "border-border bg-card hover:border-primary/50" : "border-border/50 bg-muted/30 opacity-50"} shadow-md`} onClick={() => canAfford && setSelectedBirth(b)}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <span className="text-xl">{b.icon}</span>
                    <div className="flex-1"><p className="font-semibold text-foreground">{b.name}</p><p className="text-xs text-muted-foreground">{b.desc}</p></div>
                    <span className="text-sm font-bold text-primary">{b.points}点</span>
                    {selectedBirth?.id === b.id && <Check className="w-4 h-4 text-primary" />}
                  </CardContent>
                </Card>
              );
            })}
            <div className="flex gap-2"><Button variant="outline" className="flex-1 border-border" onClick={goBack}>返回</Button><Button className="flex-1 bg-primary hover:bg-[#B33A2A] text-white" disabled={!selectedBirth} onClick={goNext}>下一步</Button></div>
          </div>
        )}

        {/* 步骤 2: 身份 */}
        {step === 2 && (
          <div className="space-y-2">
            {IDENTITIES.map((id) => {
              const canAfford = id.cost <= remaining + (selectedIdentity?.id === id.id ? identityCost : 0);
              return (
                <Card key={id.id} className={`border cursor-pointer transition-all ${selectedIdentity?.id === id.id ? "border-primary bg-primary/5" : canAfford ? "border-border bg-card hover:border-primary/50" : "border-border/50 opacity-40"} shadow-md`} onClick={() => canAfford && setSelectedIdentity(id)}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <span className="text-xl">{id.icon}</span>
                    <div className="flex-1"><p className="font-semibold text-foreground">{id.name}</p><p className="text-xs text-muted-foreground">{id.desc}</p></div>
                    <span className="text-sm text-muted-foreground">-{id.cost}点</span>
                    {selectedIdentity?.id === id.id && <Check className="w-4 h-4 text-primary" />}
                  </CardContent>
                </Card>
              );
            })}
            <div className="flex gap-2"><Button variant="outline" className="flex-1 border-border" onClick={goBack}>返回</Button><Button className="flex-1 bg-primary hover:bg-[#B33A2A] text-white" disabled={!selectedIdentity} onClick={goNext}>下一步</Button></div>
          </div>
        )}

        {/* 步骤 3: 灵根 */}
        {step === 3 && (
          <div className="space-y-2">
            {ELEMENTS.map((el) => (
              <div key={el} className="space-y-1">
                <p className="text-sm font-semibold text-foreground" style={{ color: ELEMENT_COLORS[el] }}>{el}灵根</p>
                <div className="flex gap-1">
                  {QUALITIES.map((q) => {
                    const id = `${el}_${q}`;
                    const isSelected = selectedRoot?.element === el && selectedRoot?.quality === q;
                    const canAfford = 2 <= remaining + (isSelected ? 2 : 0);
                    return (
                      <Card key={id} className={`flex-1 border cursor-pointer transition-all ${isSelected ? "border-primary bg-primary/5" : canAfford ? "border-border bg-card hover:border-primary/50" : "border-border/50 opacity-30"} shadow-sm`} onClick={() => canAfford && setSelectedRoot({ element: el, quality: q, multiplier: QUALITY_MULT[q] })}>
                        <CardContent className="p-2 text-center">
                          <p className="text-xs font-semibold" style={{ color: QUALITY_COLORS[q] }}>{q}</p>
                          <p className="text-[10px] text-muted-foreground">{QUALITY_MULT[q]}x</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* chaos */}
            <Card className={`border cursor-pointer transition-all ${selectedRoot?.element === "chaos" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"} shadow-md`} onClick={() => setSelectedRoot({ element: "chaos", quality: "凡品", multiplier: 0.2 })}>
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-xl">🌫️</span>
                <div className="flex-1"><p className="font-semibold text-foreground">五行杂灵根</p><p className="text-xs text-muted-foreground">五行俱全，凡品，0.2x</p></div>
                {selectedRoot?.element === "chaos" && <Check className="w-4 h-4 text-primary" />}
              </CardContent>
            </Card>
            <div className="flex gap-2"><Button variant="outline" className="flex-1 border-border" onClick={goBack}>返回</Button><Button className="flex-1 bg-primary hover:bg-[#B33A2A] text-white" disabled={!selectedRoot} onClick={goNext}>下一步</Button></div>
          </div>
        )}

        {/* 步骤 4: 天赋 */}
        {step === 4 && (
          <div className="space-y-2">
            {TALENTS.map((t) => {
              const isSelected = selectedTalentIds.includes(t.id);
              const canAfford = t.cost <= remaining + (isSelected ? t.cost : 0);
              return (
                <Card key={t.id} className={`border cursor-pointer transition-all ${isSelected ? "border-primary bg-primary/5" : canAfford ? "border-border bg-card hover:border-primary/50" : "border-border/50 opacity-30"} shadow-md`} onClick={() => toggleTalent(t.id)}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1"><p className="font-semibold text-foreground">{t.name}</p><p className="text-xs text-muted-foreground">{t.desc}</p></div>
                    <span className="text-sm text-muted-foreground">-{t.cost}点</span>
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                  </CardContent>
                </Card>
              );
            })}
            <div className="flex gap-2"><Button variant="outline" className="flex-1 border-border" onClick={goBack}>返回</Button><Button className="flex-1 bg-primary hover:bg-[#B33A2A] text-white" onClick={goNext}>下一步</Button></div>
          </div>
        )}

        {/* 步骤 5: 属性 */}
        {step === 5 && (
          <Card className="border-border bg-card shadow-md">
            <CardHeader><CardTitle className="text-foreground">分配属性</CardTitle><CardDescription className="text-muted-foreground">剩余 {remaining} 点可分配</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {ATTR_DEFS.map((a) => (
                <div key={a.key} className="flex items-center gap-3 py-1.5 border-b border-muted last:border-0">
                  <span className="text-lg">{a.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{a.label}</p>
                    <p className="text-[10px] text-muted-foreground">{a.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => adjustAttr(a.key, -1)} className="w-7 h-7 flex items-center justify-center rounded bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-30 text-sm">-</button>
                    <span className="w-6 text-center text-sm font-bold text-foreground">{attributes[a.key] || 0}</span>
                    <button onClick={() => adjustAttr(a.key, 1)} className="w-7 h-7 flex items-center justify-center rounded bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-30 text-sm">+</button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={handleReset} className="flex-1 py-2 rounded-lg bg-muted border border-border text-sm text-muted-foreground hover:bg-muted/80">重置</button>
                <button onClick={handleBalance} className="flex-1 py-2 rounded-lg bg-muted border border-border text-sm text-muted-foreground hover:bg-muted/80">均衡</button>
                <button onClick={handleRandom} className="flex-1 py-2 rounded-lg bg-muted border border-border text-sm text-muted-foreground hover:bg-muted/80">随机</button>
              </div>
            </CardContent>
            <div className="flex gap-2 p-4 pt-0">
              <Button variant="outline" className="flex-1 border-border" onClick={goBack}>返回</Button>
              <Button className="flex-1 bg-primary hover:bg-[#B33A2A] text-white" onClick={goNext}>下一步</Button>
            </div>
          </Card>
        )}

        {/* 步骤 6: 确认 */}
        {step === 6 && (
          <Card className="border-border bg-card shadow-md">
            <CardHeader><CardTitle className="text-foreground">确认创建</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">道号</span><span className="text-foreground font-medium">{localStorage.getItem("cultivatorName") || "未知"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">世界</span><span className="text-foreground font-medium">{selectedWorld?.icon} {selectedWorld?.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">出生</span><span className="text-foreground font-medium">{selectedBirth?.name} · {selectedBirth?.points}天资点</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">身份</span><span className="text-foreground font-medium">{selectedIdentity?.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">灵根</span><span className="text-foreground font-medium">{selectedRoot?.element === "chaos" ? "五行杂灵根 · 凡品 (0.2x)" : `${selectedRoot?.element}灵根 · ${selectedRoot?.quality} (${selectedRoot?.multiplier}x)`}</span></div>
              {selectedTalentIds.length > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">天赋</span><span className="text-foreground font-medium">{selectedTalentIds.map((id) => TALENTS.find((t) => t.id === id)?.name).join("、")}</span></div>}
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">属性</span><span className="text-foreground font-medium">{ATTR_DEFS.map((a) => `${a.icon}${attributes[a.key] || 0}`).join(" · ")}</span></div>
              <div className="flex justify-between text-sm border-t border-muted pt-2"><span className="text-muted-foreground">已用天资点</span><span className="text-primary font-bold">{birthPoints - remaining}/{birthPoints}</span></div>
            </CardContent>
            <div className="flex gap-2 p-4 pt-0">
              <Button variant="outline" className="flex-1 border-border" onClick={goBack}>返回</Button>
              <Button className="flex-1 bg-primary hover:bg-[#B33A2A] text-white" disabled={loading} onClick={handleCreate}>{loading ? "创建中..." : "踏入仙途"}</Button>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}