"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Settings, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface ProviderConfig {
  type: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDevModeChange?: (next: boolean) => void;
}

const PROVIDER_TYPES = [
  { value: "", label: "不使用" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "ollama", label: "Ollama" },
];

const LABELS = ["主供应方", "备用 ①", "备用 ②"];

export default function SettingsDialog({ open, onOpenChange, onDevModeChange }: SettingsDialogProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([
    { type: "", apiKey: "", model: "", baseUrl: "" },
    { type: "", apiKey: "", model: "", baseUrl: "" },
    { type: "", apiKey: "", model: "", baseUrl: "" },
  ]);
  const [devMode, setDevMode] = useState(false);
  const [showKeys, setShowKeys] = useState<boolean[]>([false, false, false]);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [availableModels, setAvailableModels] = useState<(string[] | null)[]>([null, null, null]);
  const [fetchingModels, setFetchingModels] = useState<boolean[]>([false, false, false]);
  const abortControllers = useRef<(AbortController | null)[]>([null, null, null]);

  // 加载配置
  useEffect(() => {
    if (!open) return;
    setDevMode(localStorage.getItem("devMode") === "true");
    setAvailableModels([null, null, null]);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const s = data.settings || {};
        setProviders([
          {
            type: s.AI_PROVIDER_1 || "",
            apiKey: s.AI_PROVIDER_1_KEY || "",
            model: s.AI_PROVIDER_1_MODEL || "",
            baseUrl: s.AI_PROVIDER_1_BASE_URL || "",
          },
          {
            type: s.AI_PROVIDER_2 || "",
            apiKey: s.AI_PROVIDER_2_KEY || "",
            model: s.AI_PROVIDER_2_MODEL || "",
            baseUrl: s.AI_PROVIDER_2_BASE_URL || "",
          },
          {
            type: s.AI_PROVIDER_3 || "",
            apiKey: s.AI_PROVIDER_3_KEY || "",
            model: s.AI_PROVIDER_3_MODEL || "",
            baseUrl: s.AI_PROVIDER_3_BASE_URL || "",
          },
        ]);
      })
      .catch(() => {});
    setDirty(false);
  }, [open]);

  const updateProvider = useCallback((index: number, field: keyof ProviderConfig, value: string) => {
    setProviders((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setDirty(true);
    if (field === "type" || field === "baseUrl") {
      setAvailableModels((prev) => { const n = [...prev]; n[index] = null; return n; });
    }
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const settings: Record<string, string> = {};
      providers.forEach((p, i) => {
        const idx = i + 1;
        settings[`AI_PROVIDER_${idx}`] = p.type;
        if (p.apiKey) settings[`AI_PROVIDER_${idx}_KEY`] = p.apiKey;
        if (p.model) settings[`AI_PROVIDER_${idx}_MODEL`] = p.model;
        if (p.baseUrl) settings[`AI_PROVIDER_${idx}_BASE_URL`] = p.baseUrl;
      });

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      if (!res.ok) throw new Error("保存失败");

      // 刷新运行时配置
      try {
        const { syncProviderConfig } = await import("@/lib/narrative");
        await syncProviderConfig();
      } catch {}

      toast.success("配置已保存");
      setDirty(false);
    } catch {
      toast.error("保存配置失败");
    } finally {
      setLoading(false);
    }
  };

    const fetchModels = async (index: number) => {
    const p = providers[index];
    if (!p.type) {
      toast.error("请先选择供应方类型");
      return;
    }
    if (p.type === "ollama" && !p.baseUrl) {
      toast.error("Ollama 需要填写接口地址");
      return;
    }
    if (p.type !== "ollama") {
      if (!p.baseUrl) { toast.error("请填写接口地址"); return; }
      if (!p.apiKey) { toast.error("请填写 API Key"); return; }
    }

    // 取消上一次未完成的请求
    if (abortControllers.current[index]) {
      abortControllers.current[index]!.abort();
    }
    const controller = new AbortController();
    abortControllers.current[index] = controller;
    setTimeout(() => controller.abort(), 15000);

    setFetchingModels((prev) => { const n = [...prev]; n[index] = true; return n; });
    try {
      const res = await fetch("/api/settings/list-models", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ baseUrl: p.baseUrl, apiKey: p.apiKey, type: p.type }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || "查询失败");
        return;
      }
      if (data.models && data.models.length > 0) {
        setAvailableModels((prev) => { const n = [...prev]; n[index] = data.models; return n; });
        // 使用 setProviders 函数式更新读取最新模型值，避免闭包陈旧
        setProviders((prev) => {
          if (!prev[index].model) {
            const next = [...prev];
            next[index] = { ...next[index], model: data.models[0] };
            return next;
          }
          return prev;
        });
        if (data.warning) toast.warning(data.warning);
      } else {
        toast.warning("该接口未返回模型列表");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error("网络错误，请检查地址");
    } finally {
      setFetchingModels((prev) => { const n = [...prev]; n[index] = false; return n; });
      if (abortControllers.current[index] === controller) {
        abortControllers.current[index] = null;
      }
    }
  };

const toggleDevMode = () => {
    const next = !devMode;
    setDevMode(next);
    localStorage.setItem("devMode", next ? "true" : "false");
    setDirty(true);
    onDevModeChange?.(next);
  };

  const needsApiKey = (type: string) => type === "anthropic" || type === "openai";

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next && dirty) {
        if (!window.confirm("有未保存的修改，确定关闭吗？")) return;
      }
      onOpenChange(next);
    }}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" /> 设置
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {providers.map((p, i) => (
            <div key={i} className="space-y-3 border-b border-border pb-4 last:border-0">
              <h4 className="text-sm font-semibold text-foreground">
                AI 供应方 {LABELS[i]}
              </h4>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">类型</label>
                <Select
                  value={p.type}
                  onValueChange={(v) => updateProvider(i, "type", v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择供应方">
                      {(v: string) => PROVIDER_TYPES.find(t => t.value === v)?.label || v}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {needsApiKey(p.type) && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">API Key</label>
                  <div className="relative">
                    <Input
                      type={showKeys[i] ? "text" : "password"}
                      value={p.apiKey}
                      onChange={(e) => updateProvider(i, "apiKey", e.target.value)}
                      placeholder="sk-..."
                      className="pr-10"
                    />
                    <button
                      onClick={() => setShowKeys((prev) => {
                        const next = [...prev];
                        next[i] = !next[i];
                        return next;
                      })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showKeys[i] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {p.type && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">模型</label>
                    {availableModels[i] === null ? (
                      <div className="flex gap-1">
                        <Input
                          value={p.model}
                          onChange={(e) => updateProvider(i, "model", e.target.value)}
                          placeholder={p.type === "anthropic" ? "claude-sonnet-4-20250514" : p.type === "openai" ? "gpt-4o" : "qwen2.5"}
                          className="flex-1"
                          disabled={fetchingModels[i]}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 h-8 text-xs gap-1 border-border"
                          disabled={fetchingModels[i]}
                          onClick={() => fetchModels(i)}
                        >
                          {fetchingModels[i] ? (
                            <>获取中...</>
                          ) : (
                            <>🔍 测试并获取</>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Select
                          value={p.model}
                          onValueChange={(v) => updateProvider(i, "model", v ?? "")}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="选择模型" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableModels[i]!.map((model) => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="outline"
                          className="shrink-0 h-8 w-8 border-border"
                          onClick={() => fetchModels(i)}
                          disabled={fetchingModels[i]}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${fetchingModels[i] ? "animate-spin" : ""}`} />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">接口地址</label>
                    <Input
                      value={p.baseUrl}
                      onChange={(e) => updateProvider(i, "baseUrl", e.target.value)}
                      placeholder={p.type === "ollama" ? "http://localhost:11434" : "https://api.deepseek.com/v1"}
                    />
                  </div>
                </>
              )}
            </div>
          ))}

          {/* 开发者模式 */}
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">🛠️ 开发者模式</span>
            </div>
            <button
              onClick={toggleDevMode}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                devMode ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  devMode ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={loading || !dirty}
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? "保存中..." : "保存配置"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}