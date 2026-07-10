"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SpiritualRoot } from "@/lib";
import { SPIRITUAL_ROOTS } from "@/lib";
import { Sparkles, ArrowLeft, Star } from "lucide-react";

// 灵根测试题目
const QUIZ_QUESTIONS = [
  {
    question: "修炼路上遇到强敌，你会？",
    options: [
      { text: "正面迎战，以力破之", element: "金" },
      { text: "以柔克刚，周旋制胜", element: "水" },
      { text: "烈火燎原，速战速决", element: "火" },
      { text: "扎根防守，以逸待劳", element: "土" },
      { text: "借势而为，灵活应变", element: "木" },
    ],
  },
  {
    question: "在修仙界中，你最看重什么？",
    options: [
      { text: "强大的武力", element: "金" },
      { text: "渊博的知识", element: "水" },
      { text: "无畏的勇气", element: "火" },
      { text: "稳固的根基", element: "土" },
      { text: "自由的灵魂", element: "木" },
    ],
  },
  {
    question: "如果得到一件上古法宝，你会？",
    options: [
      { text: "炼化为本命法宝", element: "火" },
      { text: "研究其中奥秘", element: "水" },
      { text: "融入自身修为", element: "土" },
      { text: "以其为基础创造新术", element: "木" },
      { text: "打磨至完美再使用", element: "金" },
    ],
  },
];

// 根据元素分布决定灵根
function determineSpiritualRoot(elements: string[]): SpiritualRoot {
  const count: Record<string, number> = {};
  elements.forEach((e) => {
    count[e] = (count[e] || 0) + 1;
  });

  const uniqueElements = Object.keys(count).length;

  if (uniqueElements === 1) return "天灵根";
  if (uniqueElements === 5) return "杂灵根";
  if (uniqueElements === 4) return "四灵根";
  if (uniqueElements === 3) return "三灵根";

  // 双灵根 — 有一定概率变异
  if (Math.random() < 0.15) return "异灵根";
  return "双灵根";
}

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<"name" | "quiz" | "result">("name");
  const [userName, setUserName] = useState("");
  const [cultivatorName, setCultivatorName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [quizIndex, setQuizIndex] = useState(0);
  const [elements, setElements] = useState<string[]>([]);
  const [spiritualRoot, setSpiritualRoot] = useState<SpiritualRoot | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleNameSubmit = () => {
    if (!userName.trim() || !cultivatorName.trim()) return;
    if (!password || password.length < 4) {
      const { toast } = require("sonner");
      toast.error("密码至少 4 位");
      return;
    }
    if (password !== passwordConfirm) {
      const { toast } = require("sonner");
      toast.error("两次密码不一致");
      return;
    }
    setStep("quiz");
  };

  const handleQuizAnswer = (element: string) => {
    const newElements = [...elements, element];
    if (quizIndex < QUIZ_QUESTIONS.length - 1) {
      setElements(newElements);
      setQuizIndex(quizIndex + 1);
    } else {
      const root = determineSpiritualRoot(newElements);
      setSpiritualRoot(root);
      setStep("result");
    }
  };

  const handleCreate = async () => {
    if (!spiritualRoot) return;
    setIsCreating(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userName.trim(),
          password,
          cultivatorName: cultivatorName.trim(),
          spiritualRoot,
        }),
      });

      const data = await res.json();
      if (data.user) {
        localStorage.setItem("userId", data.user.id);
        router.replace("/dashboard");
      } else if (data.error) {
        const { toast } = await import("sonner");
        toast.error(data.error);
      }
    } catch (err) {
      console.error("创建失败:", err);
      setIsCreating(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen">
      <div className="relative z-10 max-w-lg w-full space-y-6">
        {/* 顶部导航：result 步骤不显示返回按钮，防止重测灵根 */}
        {step !== "result" && (
          <Button
            variant="ghost"
            className="text-foreground"
            onClick={() => {
              if (step === "quiz") setStep("name");
              else router.replace("/");
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
        )}

        {step === "name" && (
          <Card className="bg-card border border-border">
            <CardHeader>
              <CardTitle className="text-xl text-primary flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                创建修炼者
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                在修仙世界中，道号即是你的身份。取一个响亮的道号吧！
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">账号名（唯一，登录用）</label>
                <Input
                  placeholder="例如：zhangsan123"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">修仙道号（展示给道友看的）</label>
                <Input
                  placeholder="例如：青雲真人"
                  value={cultivatorName}
                  onChange={(e) => setCultivatorName(e.target.value)}
                  maxLength={12}
                />
                <p className="text-sm text-muted-foreground">道号可重名，取个响亮的吧</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">密码</label>
                <Input
                  type="password"
                  placeholder="至少 4 位"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">确认密码</label>
                <Input
                  type="password"
                  placeholder="再次输入密码"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  maxLength={50}
                />
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!userName.trim() || !cultivatorName.trim()}
                onClick={handleNameSubmit}
              >
                下一步：灵根测试
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "quiz" && (
          <Card className="bg-card border border-border">
            <CardHeader>
              <CardTitle className="text-xl text-primary">
                灵根测试 ({quizIndex + 1}/{QUIZ_QUESTIONS.length})
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                回答以下问题，天道将根据你的本心判定灵根资质
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg text-foreground font-semibold font-medium">
                {QUIZ_QUESTIONS[quizIndex].question}
              </p>
              <div className="space-y-2">
                {QUIZ_QUESTIONS[quizIndex].options.map((opt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-3 border-border hover:border-primary hover:bg-muted text-foreground"
                    onClick={() => handleQuizAnswer(opt.element)}
                  >
                    <span className="mr-2 text-primary font-mono">
                      {["甲", "乙", "丙", "丁", "戊"][i]}.
                    </span>
                    {opt.text}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {step === "result" && spiritualRoot && (
          <Card className="bg-card border border-border">
            <CardHeader className="text-center">
              <div className="text-4xl mb-2">
                {spiritualRoot === "天灵根" ? "🌟" :
                 spiritualRoot === "异灵根" ? "💎" :
                 spiritualRoot === "双灵根" ? "✨" :
                 spiritualRoot === "三灵根" ? "🔮" :
                 spiritualRoot === "四灵根" ? "🍃" : "🌱"}
              </div>
              <CardTitle
                className="text-2xl font-bold"
                style={{ color: SPIRITUAL_ROOTS[spiritualRoot].color }}
              >
                {spiritualRoot}
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                {SPIRITUAL_ROOTS[spiritualRoot].description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center gap-4 text-sm">
                <Badge variant="outline" className="border-primary text-primary">
                  <Star className="w-3 h-3 mr-1" />
                  稀有度: {"★".repeat(SPIRITUAL_ROOTS[spiritualRoot].rarity)}
                </Badge>
                <Badge variant="outline" className="border-border text-muted-foreground">
                  修炼速度: x{SPIRITUAL_ROOTS[spiritualRoot].speedBonus}
                </Badge>
                <Badge variant="outline" className="border-border text-muted-foreground">
                  {SPIRITUAL_ROOTS[spiritualRoot].element}
                </Badge>
              </div>

              <div className="bg-muted rounded-lg p-4 text-base text-foreground space-y-2">
                <p><span className="text-muted-foreground">道号：</span>{cultivatorName}</p>
                <p><span className="text-muted-foreground">灵根：</span>
                  <span style={{ color: SPIRITUAL_ROOTS[spiritualRoot].color }}>
                    {spiritualRoot}
                  </span>
                </p>
                <p><span className="text-muted-foreground">初始境界：</span>炼气期 第一层</p>
              </div>

              <Button
                className="w-full bg-primary hover:bg-primary/90 h-12 text-lg"
                onClick={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? "正在踏入修仙之路..." : "踏入仙途！"}
                <Sparkles className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
