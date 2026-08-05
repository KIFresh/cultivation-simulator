"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ZenStyle, ZenBackground, ZenBrand, ZenSeal } from "@/components/zen-theme";

export default function UnifiedLoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password }),
      });
      const data = await res.json();

      if (!data.user) {
        setError(data.message || "服务器返回异常");
        return;
      }

      if (data.action === "login") {
        localStorage.setItem("userId", data.user.id);
        localStorage.setItem("cultivatorName", data.user.name);
        toast.success(`欢迎回来，${data.user.name}道友！`);
        router.replace("/dashboard");
      } else if (data.action === "created") {
        localStorage.setItem("userId", data.user.id);
        localStorage.setItem("cultivatorName", data.user.name);
        toast.success("道籍已录，塑造你的化身吧");
        router.replace("/create");
      } else {
        setError(data.message || "操作失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ZenStyle />

      <main
        className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-[#FAF8F5] text-[#1A1A1A] select-none"
        style={{ fontFamily: "'Noto Serif SC', 'Georgia', serif" }}
      >
        <ZenBackground />
        <ZenBrand onBack={() => router.push("/")} />

        {/* 核心卡片 */}
        <section className="flex-1 flex flex-col justify-center items-center px-4 py-6 md:py-12 text-center max-w-md mx-auto w-full z-10">
          <div className="text-[10px] text-gray-400 mb-6 tracking-[0.4em] font-light uppercase flex items-center justify-center space-x-3">
            <span className="w-6 h-[1px] bg-gray-200" />
            <span>修仙道籍 · 刻录之章</span>
            <span className="w-6 h-[1px] bg-gray-200" />
          </div>

          <div className="w-full bg-[var(--card)]/95 backdrop-blur-md rounded-2xl p-8 border border-gray-200/50 shadow-sm relative overflow-hidden transition-all duration-500 hover:shadow-xl hover:border-gray-300/40">
            <div className="absolute w-3 h-3 fret-corner-tl" />
            <div className="absolute w-3 h-3 fret-corner-tr" />
            <div className="absolute w-3 h-3 fret-corner-bl" />
            <div className="absolute w-3 h-3 fret-corner-br" />
            <div className="absolute inset-0 pointer-events-none border-[6px] border-double border-[#D2C6B2]/15 rounded-2xl m-2" />

            <div className="absolute top-5 right-5 select-none">
              <ZenSeal>契约已立</ZenSeal>
            </div>

            <div className="text-center mb-8 pt-2">
              <h2 className="text-2xl font-bold tracking-[0.25em] text-[#1A1A1A] calligraphy mb-2">
                踏入<span className="vermilion-underline text-[#8C2D19] font-semibold">仙途</span>
              </h2>
              <p className="text-[10px] text-gray-400 tracking-widest mt-1">
                新道友自动创建道籍，老道友直接登录
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-6 relative z-10 text-left"
            >
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-2 flex items-center">
                  <span className="w-1 h-1 rounded-full bg-[#8C2D19]/80 mr-1.5" />
                  账号名 (道号)
                </label>
                <input
                  type="text"
                  required
                  placeholder="请输入您的修仙道号"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className="w-full px-4 py-2.5 rounded text-xs text-[#1A1A1A] placeholder-gray-400 bg-[rgba(250,248,245,0.6)] border border-[rgba(26,26,26,0.08)] transition-all duration-300 focus:outline-none focus:border-[rgba(140,45,25,0.6)] focus:bg-[var(--card)] focus:shadow-[0_10px_30px_rgba(140,45,25,0.03)] focus:-translate-y-px"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 tracking-widest mb-2 flex items-center">
                  <span className="w-1 h-1 rounded-full bg-[#8C2D19]/80 mr-1.5" />
                  密印 (密码)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="请输入灵犀密印"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    className="w-full pl-4 pr-10 py-2.5 rounded text-xs text-[#1A1A1A] placeholder-gray-400 bg-[rgba(250,248,245,0.6)] border border-[rgba(26,26,26,0.08)] transition-all duration-300 focus:outline-none focus:border-[rgba(140,45,25,0.6)] focus:bg-[var(--card)] focus:shadow-[0_10px_30px_rgba(140,45,25,0.03)] focus:-translate-y-px"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#8C2D19] transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-xs text-[#8C2D19]">{error}</p>}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={!name.trim() || !password || loading}
                  className="group relative w-full inline-flex items-center justify-center space-x-3 py-3 border border-[#1A1A1A] bg-[#FAF8F5] hover:bg-[var(--card)] hover:border-[#8C2D19] transition-all duration-300 rounded shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="text-xs font-semibold tracking-[0.3em] text-[#1A1A1A] group-hover:text-[#8C2D19]">
                    {loading ? "正在感应天道..." : "开始修仙"}
                  </span>
                  <Sparkles className="w-4 h-4 text-[#8C2D19]" />
                </button>
              </div>
            </form>

            <div className="mt-8 text-center">
              <p className="text-[10px] text-gray-300 tracking-widest italic">
                “凡尘一念，可达天听。灵约已定，不负长生。”
              </p>
            </div>
          </div>
        </section>

        <footer className="w-full text-center py-6 text-[10px] text-gray-300 tracking-[0.25em] z-10">
          <span>© 贰零贰陆 · 无尽仙途工作室 · 保留所有法理</span>
        </footer>
      </main>
    </>
  );
}
