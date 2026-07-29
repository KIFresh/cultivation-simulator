"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, KeyRound, RefreshCw, Save, Settings } from "lucide-react";
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

const EMPTY_PROVIDER = (): ProviderConfig => ({ type: "", apiKey: "", keyConfigured: false, clearKey: false, model: "", baseUrl: "" });
const PROVIDER_TYPES = [{ value: "", label: "不使用" }, { value: "anthropic", label: "Anthropic" }, { value: "openai", label: "OpenAI" }, { value: "ollama", label: "Ollama" }];
const LABELS = ["主供应方", "备用 ①", "备用 ②"];

export default function SettingsDialog({ open, onOpenChange, onDevModeChange }: SettingsDialogProps) {
  const [adminKey, setAdminKey] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [providers, setProviders] = useState<ProviderConfig[]>([EMPTY_PROVIDER(), EMPTY_PROVIDER(), EMPTY_PROVIDER()]);
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showKeys, setShowKeys] = useState<boolean[]>([false, false, false]);
  const [availableModels, setAvailableModels] = useState<(string[] | null)[]>([null, null, null]);
  const [fetchingModels, setFetchingModels] = useState<boolean[]>([false, false, false]);
  const [devMode, setDevMode] = useState(false);
  const abortControllers = useRef<(AbortController | null)[]>([null, null, null]);

  const authorizedFetch = useCallback((url: string, init: RequestInit = {}) => fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), "x-admin-key": adminKey },
  }), [adminKey]);

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const response = await authorizedFetch("/api/settings");
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "读取配置失败");
      const settings = data?.settings ?? {};
      setProviders([1, 2, 3].map((index) => ({
        type: settings[`AI_PROVIDER_${index}`] ?? "",
        apiKey: "",
        keyConfigured: Boolean(settings[`AI_PROVIDER_${index}_KEY_CONFIGURED`]),
        clearKey: false,
        model: settings[`AI_PROVIDER_${index}_MODEL`] ?? "",
        baseUrl: settings[`AI_PROVIDER_${index}_BASE_URL`] ?? "",
      })));
      setDirty(false);
      setAvailableModels([null, null, null]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取配置失败");
      throw error;
    } finally {
      setLoadingSettings(false);
    }
  }, [authorizedFetch]);

  useEffect(() => {
    if (!open) return;
    setDevMode(localStorage.getItem("devMode") === "true");
    const cachedKey = sessionStorage.getItem("adminSettingsKey") ?? "";
    setAdminKey(cachedKey);
    setAuthorized(false);
    setDirty(false);
  }, [open]);

  const authorize = async () => {
    if (!adminKey.trim()) return toast.error("请输入管理员密钥");
    setAuthorizing(true);
    try {
      await loadSettings();
      sessionStorage.setItem("adminSettingsKey", adminKey);
      setAuthorized(true);
    } catch {
      sessionStorage.removeItem("adminSettingsKey");
    } finally {
      setAuthorizing(false);
    }
  };

  const updateProvider = (index: number, field: keyof ProviderConfig, value: string | boolean) => {
    setProviders((previous) => previous.map((provider, current) => current === index ? { ...provider, [field]: value } : provider));
    setDirty(true);
    if (field === "type" || field === "baseUrl") setAvailableModels((previous) => previous.map((models, current) => current === index ? null : models));
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
        if (provider.clearKey) settings[`${key}_KEY_ACTION`] = "clear";
        else if (provider.apiKey.trim()) settings[`${key}_KEY`] = provider.apiKey.trim();
      });
      const response = await authorizedFetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "保存配置失败");
      toast.success("配置已保存");
      await loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存配置失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async (index: number) => {
    const provider = providers[index];
    if (!provider.type) return toast.error("请先选择供应方类型");
    if (!provider.baseUrl) return toast.error("请填写接口地址");
    if (provider.type !== "ollama" && !provider.apiKey) return toast.error("为安全起见，请重新输入 API Key 后获取模型");
    abortControllers.current[index]?.abort();
    const controller = new AbortController();
    abortControllers.current[index] = controller;
    setFetchingModels((previous) => previous.map((value, current) => current === index ? true : value));
    try {
      const response = await authorizedFetch("/api/settings/list-models", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ baseUrl: provider.baseUrl, apiKey: provider.apiKey, type: provider.type }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "查询模型列表失败");
      const models: string[] = data?.models ?? [];
      if (!models.length) return toast.warning(data?.warning ?? "该接口未返回模型列表");
      setAvailableModels((previous) => previous.map((value, current) => current === index ? models : value));
      if (!provider.model) updateProvider(index, "model", models[0]);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "连接失败");
    } finally {
      setFetchingModels((previous) => previous.map((value, current) => current === index ? false : value));
    }
  };

  const toggleDevMode = () => {
    const next = !devMode;
    setDevMode(next);
    localStorage.setItem("devMode", next ? "true" : "false");
    onDevModeChange?.(next);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5" /> 设置</DialogTitle></DialogHeader>
      {!authorized ? <div className="space-y-4 py-3">
        <p className="text-sm text-muted-foreground">模型配置仅限管理员。密钥只保存在本次浏览器会话中。</p>
        <Input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} onKeyDown={(event) => event.key === "Enter" && authorize()} placeholder="管理员密钥" autoFocus />
        <Button className="w-full" onClick={authorize} disabled={authorizing}>{authorizing ? "验证中..." : <><KeyRound className="w-4 h-4 mr-2" />验证管理员身份</>}</Button>
      </div> : <div className="space-y-6 py-2">
        {loadingSettings ? <p className="text-sm text-muted-foreground">正在读取配置…</p> : providers.map((provider, index) => <div key={index} className="space-y-3 border-b border-border pb-4 last:border-0">
          <h4 className="text-sm font-semibold">AI 供应方 {LABELS[index]}</h4>
          <Select value={provider.type} onValueChange={(value) => updateProvider(index, "type", value ?? "")}><SelectTrigger><SelectValue placeholder="选择供应方" /></SelectTrigger><SelectContent>{PROVIDER_TYPES.map((type) => <SelectItem key={type.value || "none"} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select>
          {provider.type && <>
            {provider.type !== "ollama" && <div className="space-y-1"><label className="text-xs text-muted-foreground">API Key</label><div className="flex gap-1"><div className="relative flex-1"><Input type={showKeys[index] ? "text" : "password"} value={provider.apiKey} onChange={(event) => updateProvider(index, "apiKey", event.target.value)} placeholder={provider.keyConfigured ? "已配置，留空保持不变" : "sk-..."} className="pr-10" disabled={provider.clearKey} /><button type="button" onClick={() => setShowKeys((previous) => previous.map((value, current) => current === index ? !value : value))} className="absolute right-3 top-1/2 -translate-y-1/2">{showKeys[index] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>{provider.keyConfigured && <Button type="button" size="sm" variant="outline" onClick={() => updateProvider(index, "clearKey", !provider.clearKey)}>{provider.clearKey ? "取消清除" : "清除"}</Button>}</div>{provider.clearKey && <p className="text-xs text-destructive">保存后将永久清除该 API Key。</p>}</div>}
            <div className="space-y-1"><label className="text-xs text-muted-foreground">接口地址</label><Input value={provider.baseUrl} onChange={(event) => updateProvider(index, "baseUrl", event.target.value)} placeholder={provider.type === "ollama" ? "https://ollama.example.com" : "https://api.deepseek.com/v1"} /></div>
            <div className="space-y-1"><label className="text-xs text-muted-foreground">模型</label><div className="flex gap-1">{availableModels[index] ? <Select value={provider.model} onValueChange={(value) => updateProvider(index, "model", value ?? "")}><SelectTrigger className="flex-1"><SelectValue placeholder="选择模型" /></SelectTrigger><SelectContent>{availableModels[index]!.map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}</SelectContent></Select> : <Input value={provider.model} onChange={(event) => updateProvider(index, "model", event.target.value)} placeholder="模型 ID" className="flex-1" />}<Button type="button" size="sm" variant="outline" onClick={() => fetchModels(index)} disabled={fetchingModels[index]}>{fetchingModels[index] ? "获取中..." : <><RefreshCw className="w-3.5 h-3.5 mr-1" />获取</>}</Button></div></div>
          </>}
        </div>)}
        <div className="flex items-center justify-between py-3 border-t border-border"><span className="text-sm font-medium">🛠️ 开发者模式</span><button type="button" onClick={toggleDevMode} className={`relative w-11 h-6 rounded-full ${devMode ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${devMode ? "translate-x-5" : ""}`} /></button></div>
        <Button className="w-full" onClick={handleSave} disabled={loading || loadingSettings || !dirty}><Save className="w-4 h-4 mr-2" />{loading ? "保存中..." : "保存配置"}</Button>
      </div>}
    </DialogContent>
  </Dialog>;
}
