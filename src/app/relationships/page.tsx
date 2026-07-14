"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Heart, Sparkles } from "lucide-react";
import BottomNav from "@/components/bottom-nav";
import { toast } from "sonner";

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

  const loadFamily = useCallback(() => {
    try {
      const raw = localStorage.getItem("family");
      if (raw) {
        const data = JSON.parse(raw);
        setFamily((data.members || []).sort(
          (a: FamilyMember, b: FamilyMember) =>
            (relationOrder[a.relation] || 99) - (relationOrder[b.relation] || 99)
        ));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) {
      router.replace("/");
      return;
    }
    setUserId(id);
    setCultivatorName(localStorage.getItem("cultivatorName") || "修行者");
    setCultivatorRealm(localStorage.getItem("realm") || "凡人");
    const age = parseInt(localStorage.getItem("age") || "1");
    setCultivatorAge(age);
    loadFamily();
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

    try {
      const res = await fetch("/api/family-dialogue", {
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

      const data = await res.json();

      if (data.narrative) {
        const finalMembers = family.map(m => {
          if (m.id === talkingTo) {
            const newIntimacy = Math.max(0, Math.min(100, m.intimacy + (data.intimacyDelta || 0)));
            return {
              ...m,
              intimacy: newIntimacy,
              dialogueHistory: [
                ...m.dialogueHistory,
                { role: "player" as const, content: playerMsg, timestamp: Date.now() - 1 },
                { role: "npc" as const, content: data.narrative, timestamp: Date.now() },
              ],
            };
          }
          return m;
        });
        saveFamily(finalMembers);
      }
    } catch {
      toast.error("对话失败，请重试");
    } finally {
      setSending(false);
    }
  };

  const getIntimacyColor = (v: number) => {
    if (v >= 70) return "text-green-600";
    if (v >= 40) return "text-primary";
    return "text-red-500";
  };

  return (
    <main className="flex-1 p-4 max-w-lg mx-auto min-h-screen pb-24 space-y-4">
      <div className="pt-2">
        <h1 className="text-xl font-bold text-primary">人际关系</h1>
        <p className="text-sm text-muted-foreground mt-0.5">修仙之路上的缘分与羁绊</p>
      </div>

      {!talkingTo && family.length > 0 && (
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <span>🏠</span>
              家人
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {family.map((m) => (
              <button
                key={m.id}
                onClick={() => setTalkingTo(m.id)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary transition-all text-left"
              >
                <span className="text-2xl">{relationIcons[m.relation] || "👤"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">{m.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.relation} · {m.age}岁
                    </span>
                    {!m.alive && <span className="text-xs text-destructive">已故</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Heart className={`w-3 h-3 ${getIntimacyColor(m.intimacy)}`} />
                    <span className={`text-xs ${getIntimacyColor(m.intimacy)}`}>
                      亲密度 {m.intimacy}
                    </span>
                  </div>
                </div>
                <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 对话面板 */}
      {talkingTo && talkMember && (
        <Card className="bg-card border border-border flex flex-col h-[70vh]">
          <CardHeader className="pb-2 shrink-0">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setTalkingTo(null)}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                ← 返回列表
              </button>
              <div className="flex items-center gap-2">
                <span className="text-lg">{relationIcons[talkMember.relation]}</span>
                <span className="text-foreground font-medium">{talkMember.name}</span>
                <span className="text-xs text-muted-foreground">{talkMember.relation}</span>
                <Heart className={`w-3 h-3 ${getIntimacyColor(talkMember.intimacy)}`} />
                <span className={`text-xs ${getIntimacyColor(talkMember.intimacy)}`}>
                  {talkMember.intimacy}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 p-3">
            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-3">
                {talkMember.dialogueHistory.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    开始和{talkMember.relation}对话吧
                  </p>
                )}
                {talkMember.dialogueHistory.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex ${entry.role === "player" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        entry.role === "player"
                          ? "bg-primary/20 text-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {entry.content}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex gap-2 mt-3 shrink-0">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={`对${talkMember.relation}说点什么……`}
                disabled={sending}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!message.trim() || sending}
                className="bg-primary hover:bg-primary/90 shrink-0"
              >
                {sending ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {family.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">🤝</p>
          <p>尚未遇到有缘之人……</p>
          <p className="text-xs mt-2">随着修炼深入，你将遇到各种人物</p>
        </div>
      )}

      <BottomNav />
    </main>
  );
}