"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { consumeNarrativeStream } from "@/lib/sse-client";
import {
  ZenStyle,
  ZenBackground,
  ZenBrand,
  ZenCard,
  ZenButton,
  ZenSeal,
} from "@/components/zen-theme";

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
  const [streamingText, setStreamingText] = useState<string | null>(null);

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
      const tempName = `无名_${String(userId || "new").slice(-4)}`;
      const res = await fetch("/api/cultivator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, cultivatorName: tempName, spiritualRoot: rootId, worldId: selectedWorld?.id }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); setLoading(false); return; }
      if (!data?.user) { alert("创建失败：服务器返回异常"); setLoading(false); return; }

      const newUserId = data.user.id;
      localStorage.setItem("userId", newUserId);
      localStorage.setItem("attributes", JSON.stringify(attributes));

      // 生成出生叙事（流式），由叙事决定姓名与家庭；失败时弹重试按钮
      const genNarrative = async (): Promise<{ ok: boolean; suggestedName?: string; family?: any[]; cultivator?: { name: string } }> => {
        setStreamingText("");
        try {
          const birthRes = await fetch("/api/narrative?stream=true", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": newUserId },
            body: JSON.stringify({
              type: "BIRTH", worldName: selectedWorld?.name,
              identityName: selectedIdentity?.name, age: 1, worldId: selectedWorld?.id,
              birthTier: selectedBirth?.name,
            }),
          });
          if (!birthRes.ok) {
            const errData = await birthRes.json().catch(() => ({}));
            throw new Error(errData.error || `出生叙事生成失败 (${birthRes.status})`);
          }
          const ct = birthRes.headers.get("content-type") || "";
          if (ct.includes("text/event-stream")) {
            let result: { suggestedName?: string; family?: any[]; cultivator?: { name: string } } = {};
            await consumeNarrativeStream(birthRes, {
              onChunk: (c) => setStreamingText((s) => (s || "") + c),
              onDone: (d) => { result = { suggestedName: d.suggestedName, family: d.family, cultivator: d.cultivator }; },
              onError: (e) => { throw e instanceof Error ? e : new Error(String(e?.message || "叙事生成失败")); },
            });
            return { ok: true, ...result };
          }
          const json = await birthRes.json();
          return { ok: true, suggestedName: json.suggestedName, family: json.family, cultivator: json.cultivator };
        } catch {
          toast.error("出生叙事生成失败，请重试");
          return new Promise((resolve) => {
            setTimeout(() => resolve(genNarrative()), 1000);
          });
        }
      };
      const birth = await genNarrative();
      if (!birth.ok) { setLoading(false); setStreamingText(null); return; }

      const finalName = birth.cultivator?.name || birth.suggestedName || tempName;
      const family = birth.family || [];

      // 出生叙事路由已服务端落库姓名和家庭成员，此处仅同步本地缓存
      localStorage.setItem("cultivatorName", finalName);
      localStorage.setItem("family", JSON.stringify({ members: family }));

      // 首次进入修炼前预热 AI（不阻塞进入仪表盘）
      try {
        const warmupRes = await fetch("/api/ai/warmup", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": newUserId },
          body: JSON.stringify({ narrative: "预热AI叙事生成" }),
        });
        if (!warmupRes.ok) console.warn("AI 预热失败:", await warmupRes.text());
      } catch (warmupErr) {
        console.warn("AI 预热请求失败:", warmupErr);
      }

      router.replace("/dashboard");
    } catch { alert("创建失败"); setLoading(false); setStreamingText(null); }
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
    <>
      <ZenStyle />
      <main
        className="relative min-h-screen flex flex-col overflow-hidden bg-[#FAF8F5] text-[#1A1A1A]"
        style={{ fontFamily: "'Noto Serif SC', 'Georgia', serif" }}
      >
        <ZenBackground />
        <ZenBrand onBack={() => router.push("/")} />

        <section className="flex-1 flex flex-col items-center px-4 py-6 z-10 w-full">
          <div className="w-full max-w-lg mx-auto space-y-4">
            {/* 标题 */}
            <div className="text-center mb-2">
              <div className="text-[10px] text-gray-400 mb-4 tracking-[0.4em] font-light uppercase flex items-center justify-center space-x-3">
                <span className="w-6 h-[1px] bg-gray-200" />
                <span>塑造化身 · 点化之章</span>
                <span className="w-6 h-[1px] bg-gray-200" />
              </div>
              <h1 className="text-3xl font-bold tracking-[0.25em] calligraphy text-[#1A1A1A]">
                点化<span className="vermilion-underline text-[#8C2D19] font-semibold">仙胎</span>
              </h1>
            </div>

            {/* 步骤指示器 */}
            <div className="flex items-center gap-1 justify-center">
              {steps.map((s, i) => (
                <div key={i} className={`flex items-center gap-1 ${i > 0 ? "ml-0.5" : ""}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    i === step ? "bg-[#8C2D19] text-white" : i < step ? "bg-[#D9A13C]/30 text-[#8C2D19]" : "bg-gray-200 text-gray-400"
                  }`}>{i + 1}</div>
                  {i < steps.length - 1 && <div className={`w-4 h-0.5 ${i < step ? "bg-[#D9A13C]/40" : "bg-gray-200"}`} />}
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-gray-500 mb-2">{stepLabels[step]}</p>

            {/* 天资点余额 */}
            {step >= 1 && (
              <div className="text-center text-sm">
                <span className="text-[#8C2D19] font-bold">天资点：{remaining}</span>
                <span className="text-gray-400 ml-2">/ {birthPoints}</span>
              </div>
            )}

            {/* 步骤 0: 世界 */}
            {step === 0 && (
              <div className="space-y-2">
                {WORLDS.map((w) => (
                  <ZenCard key={w.id} selected={selectedWorld?.id === w.id} onClick={() => setSelectedWorld(w)}>
                    <div className="p-4 flex items-center gap-3">
                      <span className="text-2xl">{w.icon}</span>
                      <div className="flex-1"><p className="font-semibold text-[#1A1A1A]">{w.name}</p><p className="text-xs text-gray-500">{w.desc}</p></div>
                      {selectedWorld?.id === w.id && <Check className="w-5 h-5 text-[#8C2D19]" />}
                    </div>
                  </ZenCard>
                ))}
                <div className="flex gap-2 pt-2">
                  <ZenButton variant="outline" onClick={goBack}>返回</ZenButton>
                  <ZenButton disabled={!selectedWorld} onClick={goNext}>下一步</ZenButton>
                </div>
              </div>
            )}

            {/* 步骤 1: 出生 */}
            {step === 1 && (
              <div className="space-y-2">
                {BIRTHS.map((b) => {
                  const canAfford = true;
                  return (
                    <ZenCard key={b.id} selected={selectedBirth?.id === b.id} disabled={!canAfford} onClick={() => canAfford && setSelectedBirth(b)}>
                      <div className="p-3 flex items-center gap-3">
                        <span className="text-xl">{b.icon}</span>
                        <div className="flex-1"><p className="font-semibold text-[#1A1A1A]">{b.name}</p><p className="text-xs text-gray-500">{b.desc}</p></div>
                        <span className="text-sm font-bold text-[#8C2D19]">{b.points}点</span>
                        {selectedBirth?.id === b.id && <Check className="w-4 h-4 text-[#8C2D19]" />}
                      </div>
                    </ZenCard>
                  );
                })}
                <div className="flex gap-2 pt-2">
                  <ZenButton variant="outline" onClick={goBack}>返回</ZenButton>
                  <ZenButton disabled={!selectedBirth} onClick={goNext}>下一步</ZenButton>
                </div>
              </div>
            )}

            {/* 步骤 2: 身份 */}
            {step === 2 && (
              <div className="space-y-2">
                {IDENTITIES.map((id) => {
                  const canAfford = id.cost <= remaining + (selectedIdentity?.id === id.id ? identityCost : 0);
                  return (
                    <ZenCard key={id.id} selected={selectedIdentity?.id === id.id} disabled={!canAfford} onClick={() => canAfford && setSelectedIdentity(id)}>
                      <div className="p-3 flex items-center gap-3">
                        <span className="text-xl">{id.icon}</span>
                        <div className="flex-1"><p className="font-semibold text-[#1A1A1A]">{id.name}</p><p className="text-xs text-gray-500">{id.desc}</p></div>
                        <span className="text-sm text-gray-500">-{id.cost}点</span>
                        {selectedIdentity?.id === id.id && <Check className="w-4 h-4 text-[#8C2D19]" />}
                      </div>
                    </ZenCard>
                  );
                })}
                <div className="flex gap-2 pt-2">
                  <ZenButton variant="outline" onClick={goBack}>返回</ZenButton>
                  <ZenButton disabled={!selectedIdentity} onClick={goNext}>下一步</ZenButton>
                </div>
              </div>
            )}

            {/* 步骤 3: 灵根 */}
            {step === 3 && (
              <div className="space-y-2">
                {ELEMENTS.map((el) => (
                  <div key={el} className="space-y-1">
                    <p className="text-sm font-semibold" style={{ color: ELEMENT_COLORS[el] }}>{el}灵根</p>
                    <div className="flex gap-1">
                      {QUALITIES.map((q) => {
                        const id = `${el}_${q}`;
                        const isSelected = selectedRoot?.element === el && selectedRoot?.quality === q;
                        const canAfford = 2 <= remaining + (isSelected ? 2 : 0);
                        return (
                          <ZenCard key={id} selected={isSelected} disabled={!canAfford} onClick={() => canAfford && setSelectedRoot({ element: el, quality: q, multiplier: QUALITY_MULT[q] })}>
                            <div className="p-2 text-center">
                              <p className="text-xs font-semibold" style={{ color: QUALITY_COLORS[q] }}>{q}</p>
                              <p className="text-[10px] text-gray-400">{QUALITY_MULT[q]}x</p>
                            </div>
                          </ZenCard>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {/* chaos */}
                <ZenCard selected={selectedRoot?.element === "chaos"} onClick={() => setSelectedRoot({ element: "chaos", quality: "凡品", multiplier: 0.2 })}>
                  <div className="p-3 flex items-center gap-3">
                    <span className="text-xl">🌫️</span>
                    <div className="flex-1"><p className="font-semibold text-[#1A1A1A]">五行杂灵根</p><p className="text-xs text-gray-500">五行俱全，凡品，0.2x</p></div>
                    {selectedRoot?.element === "chaos" && <Check className="w-4 h-4 text-[#8C2D19]" />}
                  </div>
                </ZenCard>
                <div className="flex gap-2 pt-2">
                  <ZenButton variant="outline" onClick={goBack}>返回</ZenButton>
                  <ZenButton disabled={!selectedRoot} onClick={goNext}>下一步</ZenButton>
                </div>
              </div>
            )}

            {/* 步骤 4: 天赋 */}
            {step === 4 && (
              <div className="space-y-2">
                {TALENTS.map((t) => {
                  const isSelected = selectedTalentIds.includes(t.id);
                  const canAfford = t.cost <= remaining + (isSelected ? t.cost : 0);
                  return (
                    <ZenCard key={t.id} selected={isSelected} disabled={!canAfford} onClick={() => toggleTalent(t.id)}>
                      <div className="p-3 flex items-center gap-3">
                        <div className="flex-1"><p className="font-semibold text-[#1A1A1A]">{t.name}</p><p className="text-xs text-gray-500">{t.desc}</p></div>
                        <span className="text-sm text-gray-500">-{t.cost}点</span>
                        {isSelected && <Check className="w-4 h-4 text-[#8C2D19]" />}
                      </div>
                    </ZenCard>
                  );
                })}
                <div className="flex gap-2 pt-2">
                  <ZenButton variant="outline" onClick={goBack}>返回</ZenButton>
                  <ZenButton onClick={goNext}>下一步</ZenButton>
                </div>
              </div>
            )}

            {/* 步骤 5: 属性 */}
            {step === 5 && (
              <ZenCard>
                <div className="p-4 space-y-2">
                  <div className="mb-1">
                    <p className="font-semibold text-[#1A1A1A]">分配属性</p>
                    <p className="text-xs text-gray-500">剩余 {remaining} 点可分配</p>
                  </div>
                  {ATTR_DEFS.map((a) => (
                    <div key={a.key} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
                      <span className="text-lg">{a.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#1A1A1A]">{a.label}</p>
                        <p className="text-[10px] text-gray-500">{a.desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => adjustAttr(a.key, -1)} className="w-7 h-7 flex items-center justify-center rounded bg-[#FAF8F5] border border-gray-200 text-[#1A1A1A] hover:border-[#8C2D19] hover:text-[#8C2D19] transition-colors text-sm">-</button>
                        <span className="w-6 text-center text-sm font-bold text-[#1A1A1A]">{attributes[a.key] || 0}</span>
                        <button onClick={() => adjustAttr(a.key, 1)} className="w-7 h-7 flex items-center justify-center rounded bg-[#FAF8F5] border border-gray-200 text-[#1A1A1A] hover:border-[#8C2D19] hover:text-[#8C2D19] transition-colors text-sm">+</button>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleReset} className="flex-1 py-2 rounded-lg bg-[#FAF8F5] border border-gray-200 text-xs text-gray-500 hover:border-[#8C2D19] hover:text-[#8C2D19] transition-colors">重置</button>
                    <button onClick={handleBalance} className="flex-1 py-2 rounded-lg bg-[#FAF8F5] border border-gray-200 text-xs text-gray-500 hover:border-[#8C2D19] hover:text-[#8C2D19] transition-colors">均衡</button>
                    <button onClick={handleRandom} className="flex-1 py-2 rounded-lg bg-[#FAF8F5] border border-gray-200 text-xs text-gray-500 hover:border-[#8C2D19] hover:text-[#8C2D19] transition-colors">随机</button>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <ZenButton variant="outline" onClick={goBack}>返回</ZenButton>
                    <ZenButton onClick={goNext}>下一步</ZenButton>
                  </div>
                </div>
              </ZenCard>
            )}

            {/* 步骤 6: 确认 / 降生叙事 */}
            {step === 6 && (
              streamingText !== null ? (
                <ZenCard>
                  <div className="p-5 space-y-3">
                    <p className="text-center text-xs tracking-[0.3em] text-gray-400">天地初开 · 降生</p>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-[#1A1A1A] min-h-[8rem]">{streamingText}</div>
                    <p className="text-center text-xs text-gray-400">正在书写你的来处……</p>
                  </div>
                </ZenCard>
              ) : (
              <ZenCard>
                <div className="p-4 space-y-3">
                  <div className="mb-1">
                    <p className="font-semibold text-[#1A1A1A] calligraphy text-lg">确认<span className="vermilion-underline text-[#8C2D19]">道身</span></p>
                  </div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">道号</span><span className="text-[#1A1A1A] font-medium">（降生时由天定）</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">世界</span><span className="text-[#1A1A1A] font-medium">{selectedWorld?.icon} {selectedWorld?.name}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">出生</span><span className="text-[#1A1A1A] font-medium">{selectedBirth?.name} · {selectedBirth?.points}天资点</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">身份</span><span className="text-[#1A1A1A] font-medium">{selectedIdentity?.name}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">灵根</span><span className="text-[#1A1A1A] font-medium">{selectedRoot?.element === "chaos" ? "五行杂灵根 · 凡品 (0.2x)" : `${selectedRoot?.element}灵根 · ${selectedRoot?.quality} (${selectedRoot?.multiplier}x)`}</span></div>
                  {selectedTalentIds.length > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">天赋</span><span className="text-[#1A1A1A] font-medium">{selectedTalentIds.map((id) => TALENTS.find((t) => t.id === id)?.name).join("、")}</span></div>}
                  <div className="flex justify-between text-sm"><span className="text-gray-500">属性</span><span className="text-[#1A1A1A] font-medium">{ATTR_DEFS.map((a) => `${a.icon}${attributes[a.key] || 0}`).join(" · ")}</span></div>
                  <div className="flex justify-between text-sm border-t border-gray-100 pt-2"><span className="text-gray-500">已用天资点</span><span className="text-[#8C2D19] font-bold">{birthPoints - remaining}/{birthPoints}</span></div>
                  <div className="flex gap-2 pt-2">
                    <ZenButton variant="outline" onClick={goBack}>返回</ZenButton>
                    <ZenButton disabled={loading} onClick={handleCreate}>{loading ? "点化中..." : "踏入仙途"}</ZenButton>
                  </div>
                </div>
              </ZenCard>
              )
            )}
          </div>
        </section>

        <footer className="w-full text-center py-6 text-[10px] text-gray-300 tracking-[0.25em] z-10">
          <span>© 贰零贰陆 · 无尽仙途工作室 · 保留所有法理</span>
        </footer>
      </main>
    </>
  );
}
