"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Send, Heart, Sparkles } from "lucide-react";
import TopNav from "@/components/top-nav";
import { VermilionShell } from "@/components/vermilion";
import { toast } from "sonner";
import { consumeNarrativeStream } from "@/lib/sse-client";

interface FamilyMember {
  id: string;
  relation: string;
  name: string;
  age: number;
  alive: boolean;
  personality?: string;
  intimacy: number;
  dialogueHistory: { role: "player" | "npc"; content: string; timestamp: number }[];
}

const relationIcons: Record<string, string> = {
  "父亲": "👨",
  "母亲": "👩",
  "哥哥": "👦",
  "姐姐": "👧",
  "弟弟": "👶",
  "妹妹": "👶",
};

const relationOrder: Record<string, number> = {
  "父亲": 1,
  "母亲": 2,
  "哥哥": 3,
  "姐姐": 4,
  "弟弟": 5,
  "妹妹": 6,
};

export default function RelationshipsPage() {
  const router = useRouter();
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [userId, setUserId] = useState("");
  const [cultivatorName, setCultivatorName] = useState("");
  const [cultivatorRealm, setCultivatorRealm] = useState("");
  const [cultivatorAge, setCultivatorAge] = useState(1);
  const [talkingTo, setTalkingTo] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);

  const loadFamily = useCallback(async () => {
    const id = localStorage.getItem("userId");
    if (!id) return;
    try {
      const res = await fetch(`/api/family?userId=${id}`);
      if (res.ok) {
        const data = await res.json();
        const sorted = (data.members || []).sort(
          (a: FamilyMember, b: FamilyMember) =>
            (relationOrder[a.relation] || 99) - (relationOrder[b.relation] || 99)
        );
        setFamily(sorted);
      }
    } catch (err) {
      console.warn("加载家庭成员失败:", err);
    }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) {
      router.replace("/");
      return;
    }
    setUserId(id);
    loadFamily();
    // 从 API 加载修炼者信息（名字、年龄、境界）
    fetch(`/api/cultivator?userId=${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.cultivator) {
          setCultivatorName(data.cultivator.name || "修行者");
          setCultivatorAge(data.cultivator.age || 1);
          setCultivatorRealm(data.cultivator.realm || "凡人");
          localStorage.setItem("cultivatorName", data.cultivator.name || "");
          localStorage.setItem("realm", data.cultivator.realm || "凡人");
          localStorage.setItem("age", String(data.cultivator.age || 1));
        }
      })
      .catch(() => {
        setCultivatorName(localStorage.getItem("cultivatorName") || "修行者");
        setCultivatorRealm(localStorage.getItem("realm") || "凡人");
        const age = parseInt(localStorage.getItem("age") || "1");
        setCultivatorAge(age);
      });
  }, [router, loadFamily]);

  // 更新 localStorage 中的家庭数据
  const saveFamily = (members: FamilyMember[]) => {
    localStorage.setItem("family", JSON.stringify({ members }));
    setFamily(members);
  };

  // 获取当前对话对象
  const talkMember = family.find(m => m.id === talkingTo);

  // 发送消息
  const handleSend = async () => {
    if (!message.trim() || !talkMember || sending) return;
    setSending(true);

    const playerMsg = message.trim();
    setMessage("");
    setStreamingText("");

    // 乐观更新：添加玩家消息到历史
    const updatedMembers = family.map(m => {
      if (m.id === talkingTo) {
        return {
          ...m,
          dialogueHistory: [
            ...m.dialogueHistory,
            { role: "player" as const, content: playerMsg, timestamp: Date.now() },
          ],
        };
      }
      return m;
    });
    saveFamily(updatedMembers);

    const commitReply = (narrative?: string, intimacyDelta = 0) => {
      if (!narrative) return;
      const finalMembers = updatedMembers.map(m => {
        if (m.id === talkingTo) {
          const newIntimacy = Math.max(0, Math.min(100, m.intimacy + intimacyDelta));
          return {
            ...m,
            intimacy: newIntimacy,
            dialogueHistory: [
              ...m.dialogueHistory,
              { role: "npc" as const, content: narrative, timestamp: Date.now() },
            ],
          };
        }
        return m;
      });
      saveFamily(finalMembers);
    };

    try {
      const res = await fetch("/api/family-dialogue?stream=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyMemberName: talkMember.name,
          familyMemberRelation: talkMember.relation,
          familyMemberAge: talkMember.age,
          intimacy: talkMember.intimacy,
          cultivatorName,
          cultivatorAge,
          cultivatorRealm,
          cultivatorRealmLevel: 0,
          playerMessage: playerMsg,
          dialogueHistory: talkMember.dialogueHistory.slice(-10),
          worldId: localStorage.getItem("worldId") || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/event-stream")) {
        let final = { narrative: undefined as string | undefined, intimacyDelta: 0 };
        await consumeNarrativeStream(res, {
          onChunk: (c) => setStreamingText((s) => (s || "") + c),
          onDone: (d) => { final = { narrative: d.narrative, intimacyDelta: d.intimacyDelta || 0 }; },
          onError: (e) => { throw e instanceof Error ? e : new Error(String((e as any)?.message || "对话生成失败")); },
        });
        commitReply(final.narrative, final.intimacyDelta);
      } else {
        const data = await res.json();
        commitReply(data.narrative, data.intimacyDelta || 0);
      }
    } catch {
      toast.error("对话失败，请重试");
    } finally {
      setSending(false);
      setStreamingText(null);
    }
  };

  const getIntimacyColor = (v: number) => {
    if (v >= 70) return "text-emerald-700";
    if (v >= 40) return "text-[#B83227]";
    return "text-red-500";
  };

  return (
    <VermilionShell>
      <TopNav />
      <div className="main-container space-y-6">
        <div className="pt-2">
          <h1 className="font-calligraphy text-2xl font-bold text-[#7A1F18]">人际关系</h1>
          <p className="text-sm text-gray-500 mt-0.5">修仙之路上的缘分与羁绊</p>
        </div>

        {!talkingTo && family.length > 0 && (
          <div className="silk-card rounded-3xl p-6">
            <h3 className="text-sm font-bold text-[#2C1E1E] flex items-center gap-2 pb-3 mb-3 border-b border-[#EADCD0]">
              <span>🏠</span> 家人
            </h3>
            <div className="space-y-2">
              {family.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setTalkingTo(m.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-[#EADCD0] bg-white hover:border-[#B83227] hover:bg-[#FDF2F0] transition-all text-left"
                >
                  <span className="text-2xl">{relationIcons[m.relation] || "👤"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[#2C1E1E] font-medium">{m.name}</span>
                      <span className="text-xs text-gray-400">
                        {m.relation} · {m.age}岁
                      </span>
                      {!m.alive && <span className="text-xs text-red-500">已故</span>}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Heart className={`w-3 h-3 ${getIntimacyColor(m.intimacy)}`} />
                      <span className={`text-xs ${getIntimacyColor(m.intimacy)}`}>
                        亲密度 {m.intimacy}
                      </span>
                    </div>
                  </div>
                  <MessageCircle className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 对话面板 */}
        {talkingTo && talkMember && (
          <div className="silk-card rounded-3xl p-0 flex flex-col h-[70vh] overflow-hidden">
            <div className="p-4 pb-3 border-b border-[#EADCD0] shrink-0">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setTalkingTo(null)}
                  className="text-xs text-[#7A1F18] hover:text-[#B83227] transition-colors"
                >
                  ← 返回列表
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{relationIcons[talkMember.relation]}</span>
                  <span className="text-[#2C1E1E] font-medium">{talkMember.name}</span>
                  <span className="text-xs text-gray-400">{talkMember.relation}</span>
                  <Heart className={`w-3 h-3 ${getIntimacyColor(talkMember.intimacy)}`} />
                  <span className={`text-xs ${getIntimacyColor(talkMember.intimacy)}`}>
                    {talkMember.intimacy}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-4 overflow-y-auto">
              <div className="space-y-3">
                {talkMember.dialogueHistory.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-8">
                    开始和{talkMember.relation}对话吧
                  </p>
                )}
                {talkMember.dialogueHistory.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex ${entry.role === "player" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        entry.role === "player"
                          ? "bg-[#B83227] text-white"
                          : "bg-[#FAF4EB] text-[#2C1E1E] border border-[#EADCD0]"
                      }`}
                    >
                      {entry.content}
                    </div>
                  </div>
                ))}

                {streamingText !== null && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed bg-[#FAF4EB] text-[#2C1E1E] border border-[#EADCD0]">
                      {streamingText}
                      <span className="inline-block w-1 h-3 ml-0.5 bg-[#B83227] animate-pulse align-middle" />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-[#EADCD0] shrink-0">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={`对${talkMember.relation}说点什么……`}
                disabled={sending}
                className="flex-1 px-3 py-2 rounded-xl border border-[#EADCD0] bg-white text-sm text-[#2C1E1E] placeholder:text-gray-400 focus:outline-none focus:border-[#B83227] disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || sending}
                className="h-10 w-10 bg-[#B83227] hover:bg-[#7A1F18] text-white rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50 transition-colors"
              >
                {sending ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {family.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🤝</p>
            <p>尚未遇到有缘之人……</p>
            <p className="text-xs mt-2">随着修炼深入，你将遇到各种人物</p>
          </div>
        )}
      </div>
    </VermilionShell>
  );
}
