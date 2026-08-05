"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Eye, EyeOff, RefreshCw, Save, Settings, Upload } from "lucide-react";
import { toast } from "sonner";

interface ProviderConfig {
  type: string;
  apiKey: string;
  keyConfigured: boolean;
  clearKey: boolean;
  model: string;
  baseUrl: string;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDevModeChange?: (next: boolean) => void;
}

const EMPTY_PROVIDER = (): ProviderConfig => ({
  type: "",
  apiKey: "",
  keyConfigured: false,
  clearKey: false,
  model: "",
  baseUrl: "",
});
const PROVIDER_TYPES = [
  { value: "", label: "不使用" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "ollama", label: "Ollama" },
];
const LABELS = ["主供应方", "备用 ①", "备用 ②"];

export default function SettingsDialog({
  open,
  onOpenChange,
  onDevModeChange,
}: SettingsDialogProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([
    EMPTY_PROVIDER(),
    EMPTY_PROVIDER(),
    EMPTY_PROVIDER(),
  ]);
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showKeys, setShowKeys] = useState<boolean[]>([false, false, false]);
  const [availableModels, setAvailableModels] = useState<(string[] | null)[]>([null, null, null]);
  const [fetchingModels, setFetchingModels] = useState<boolean[]>([false, false, false]);
  const [devMode, setDevMode] = useState(false);
  const abortControllers = useRef<(AbortController | null)[]>([null, null, null]);

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const response = await fetch("/api/settings");
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "读取配置失败");
      const settings = data?.settings ?? {};
      setProviders(
        [1, 2, 3].map((index) => ({
          type: settings[`AI_PROVIDER_${index}`] ?? "",
          apiKey: "",
          keyConfigured: Boolean(settings[`AI_PROVIDER_${index}_KEY_CONFIGURED`]),
          clearKey: false,
          model: settings[`AI_PROVIDER_${index}_MODEL`] ?? "",
          baseUrl: settings[`AI_PROVIDER_${index}_BASE_URL`] ?? "",
        }))
      );
      setDirty(false);
      setAvailableModels([null, null, null]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取配置失败");
      throw error;
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setDevMode(localStorage.getItem("devMode") === "true");
    setDirty(false);
    loadSettings().catch(() => {});
  }, [open, loadSettings]);

  const updateProvider = (index: number, field: keyof ProviderConfig, value: string | boolean) => {
    setProviders((previous) =>
      previous.map((provider, current) =>
        current === index ? { ...provider, [field]: value } : provider
      )
    );
    setDirty(true);
    if (field === "type" || field === "baseUrl")
      setAvailableModels((previous) =>
        previous.map((models, current) => (current === index ? null : models))
      );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const settings: Record<string, string> = {};
      providers.forEach((provider, i) => {
        const key = `AI_PROVIDER_${i + 1}`;
        settings[key] = provider.type;
        settings[`${key}_MODEL`] = provider.model;
        settings[`${key}_BASE_URL`] = provider.baseUrl;
        if (provider.apiKey) settings[`${key}_KEY`] = provider.apiKey;
        if (provider.clearKey) settings[`${key}_KEY_ACTION`] = "clear";
      });
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "保存失败");
      toast.success("配置已保存");
      // 重新读取脱敏配置，确保保存/清除后的 API Key 状态与 SQLite 一致。
      await loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async (index: number) => {
    const provider = providers[index];
    if (!provider.type) return;
    if (provider.type === "anthropic" && !provider.baseUrl) {
      toast.error("Anthropic 原生 API 不支持模型列表查询，请手动输入模型 ID");
      return;
    }
    if (!provider.baseUrl && provider.type !== "anthropic") {
      toast.error("请填写接口地址");
      return;
    }
    setFetchingModels((previous) => previous.map((v, i) => (i === index ? true : v)));
    try {
      const response = await fetch("/api/settings/list-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey || undefined,
          type: provider.type,
          providerIndex: index + 1,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "获取模型列表失败");
      setAvailableModels((previous) => previous.map((v, i) => (i === index ? data.models : v)));
      if (data.models?.length === 1) {
        updateProvider(index, "model", data.models[0]);
      }
      if (data.warning) toast.warning(data.warning);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "获取模型列表失败");
    } finally {
      setFetchingModels((previous) => previous.map((v, i) => (i === index ? false : v)));
    }
  };

  const handleDevModeToggle = (next: boolean) => {
    setDevMode(next);
    localStorage.setItem("devMode", String(next));
    onDevModeChange?.(next);
  };

  const handleBackupExport = async () => {
    const uid = localStorage.getItem("userId");
    if (!uid) { toast.error("请先登录"); return; }
    try {
      const res = await fetch("/api/backup/export", { headers: { "x-user-id": uid } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cultivation-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("存档已导出");
    } catch {
      toast.error("导出失败");
    }
  };

  const handleBackupImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement)?.files?.[0];
      if (!file) return;
      const uid = localStorage.getItem("userId");
      if (!uid) { toast.error("请先登录"); return; }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const res = await fetch("/api/backup/import", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": uid },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error();
        toast.success("存档已恢复，请刷新页面");
      } catch {
        toast.error("导入失败，请检查文件格式");
      }
    };
    input.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            AI 供应方配置
          </DialogTitle>
        </DialogHeader>

        {loadingSettings ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {providers.map((provider, index) => (
              <div
                key={index}
                className="space-y-3 rounded-lg border p-4"
              >
                <div className="text-sm font-medium text-muted-foreground">
                  {LABELS[index]}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">供应方</label>
                    <Select
                      value={provider.type}
                      onValueChange={(value) => updateProvider(index, "type", value ?? "")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择供应方" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDER_TYPES.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">模型</label>
                    <div className="flex gap-1">
                      <div className="flex-1 relative">
                        <Input
                          placeholder={
                            provider.type === "anthropic"
                              ? "claude-sonnet-4-20250514"
                              : provider.type === "openai"
                                ? "gpt-4o"
                                : provider.type === "ollama"
                                  ? "qwen2.5"
                                  : ""
                          }
                          value={provider.model}
                          onChange={(e) => updateProvider(index, "model", e.target.value)}
                          list={availableModels[index] ? `models-${index}` : undefined}
                        />
                        {availableModels[index] && (
                          <datalist id={`models-${index}`}>
                            {availableModels[index]!.map((model) => (
                              <option key={model} value={model} />
                            ))}
                          </datalist>
                        )}
                      </div>
                      {provider.type && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => fetchModels(index)}
                          disabled={fetchingModels[index]}
                          title="获取模型列表"
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${fetchingModels[index] ? "animate-spin" : ""}`}
                          />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">
                      API Key{provider.keyConfigured ? "（已配置）" : ""}
                    </label>
                    <div className="flex gap-1">
                      <div className="flex-1 relative">
                        <Input
                          type={showKeys[index] ? "text" : "password"}
                          placeholder={provider.keyConfigured ? "留空则保持原值" : "输入 API Key"}
                          value={provider.apiKey}
                          onChange={(e) => updateProvider(index, "apiKey", e.target.value)}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setShowKeys((previous) =>
                            previous.map((v, i) => (i === index ? !v : v))
                          )
                        }
                      >
                        {showKeys[index] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    {provider.keyConfigured && (
                      <label className="flex items-center gap-2 mt-1">
                        <input
                          type="checkbox"
                          checked={provider.clearKey}
                          onChange={(e) => updateProvider(index, "clearKey", e.target.checked)}
                        />
                        <span className="text-xs text-muted-foreground">清除已保存的 Key</span>
                      </label>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">接口地址（可选）</label>
                    <Input
                      placeholder={
                        provider.type === "ollama"
                          ? "http://localhost:11434"
                          : provider.type === "openai"
                            ? "https://api.openai.com/v1"
                            : ""
                      }
                      value={provider.baseUrl}
                      onChange={(e) => updateProvider(index, "baseUrl", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground cursor-pointer" htmlFor="devMode">
                  🛠 开发者模式
                </label>
                <input
                  id="devMode"
                  type="checkbox"
                  checked={devMode}
                  onChange={(e) => handleDevModeToggle(e.target.checked)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBackupExport}
                  className="px-2 py-1 text-xs border border-[#D0C8C0] rounded flex items-center gap-1 hover:bg-[#F0EBE3] transition-colors"
                >
                  <Download className="w-3 h-3" /> 导出存档
                </button>
                <button
                  onClick={handleBackupImport}
                  className="px-2 py-1 text-xs border border-[#D0C8C0] rounded flex items-center gap-1 hover:bg-[#F0EBE3] transition-colors"
                >
                  <Upload className="w-3 h-3" /> 导入存档
                </button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button onClick={handleSave} disabled={loading || !dirty}>
                  <Save className="w-4 h-4 mr-1" />
                  {loading ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}