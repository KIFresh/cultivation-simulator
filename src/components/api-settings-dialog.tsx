"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings } from "lucide-react";
import { toast } from "sonner";

interface ProviderConfig {
  type: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export default function ApiSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [providers, setProviders] = useState<ProviderConfig[]>([
    { type: "anthropic", apiKey: "", model: "claude-sonnet-4-6", baseUrl: "" },
    { type: "openai", apiKey: "", model: "", baseUrl: "" },
    { type: "ollama", apiKey: "", model: "qwen2.5", baseUrl: "http://localhost:11434" },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/settings").then((r) => r.json()).then((data) => {
      if (data.settings) {
        setProviders([
          { type: data.settings.AI_PROVIDER_1 || "anthropic", apiKey: data.settings.AI_PROVIDER_1_KEY || "", model: data.settings.AI_PROVIDER_1_MODEL || "claude-sonnet-4-6", baseUrl: data.settings.AI_PROVIDER_1_BASE_URL || "" },
          { type: data.settings.AI_PROVIDER_2 || "openai", apiKey: data.settings.AI_PROVIDER_2_KEY || "", model: data.settings.AI_PROVIDER_2_MODEL || "gpt-4o-mini", baseUrl: data.settings.AI_PROVIDER_2_BASE_URL || "" },
          { type: data.settings.AI_PROVIDER_3 || "ollama", apiKey: data.settings.AI_PROVIDER_3_KEY || "", model: data.settings.AI_PROVIDER_3_MODEL || "qwen2.5", baseUrl: data.settings.AI_PROVIDER_3_BASE_URL || "http://localhost:11434" },
        ]);
      }
    }).catch(() => {});
  }, [open]);

  const save = async () => {
    setSaving(true);
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
      if (res.ok) {
        toast.success("AI 叙事引擎配置已保存", { duration: 2000 });
        onOpenChange(false);
      } else {
        toast.error("保存失败");
      }
    } catch { toast.error("保存失败"); }
    finally { setSaving(false); }
  };

  const updateProvider = (idx: number, field: keyof ProviderConfig, value: string) => {
    const updated = [...providers];
    updated[idx] = { ...updated[idx], [field]: value };
    setProviders(updated);
  };

  const providerOptions = [
    { value: "anthropic", label: "Anthropic (Claude)" },
    { value: "openai", label: "OpenAI 兼容" },
    { value: "ollama", label: "Ollama 本地" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2"><Settings className="w-4 h-4" /> AI 叙事引擎设置</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {providers.map((p, i) => (
            <Card key={i} className="border-border bg-card shadow-sm">
              <CardHeader className="pb-1"><CardTitle className="text-xs text-foreground">供应方 #{i + 1}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Select value={p.type} onValueChange={(v) => updateProvider(i, "type", v || "")}>
                  <SelectTrigger className="bg-white border-border text-foreground h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {providerOptions.map((o) => <SelectItem key={o.value} value={o.value} className="text-foreground">{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {p.type !== "ollama" && <Input placeholder="API Key" value={p.apiKey} onChange={(e) => updateProvider(i, "apiKey", e.target.value)} className="bg-white border-border text-foreground h-8 text-xs" type="password" />}
                <Input placeholder="模型名称" value={p.model} onChange={(e) => updateProvider(i, "model", e.target.value)} className="bg-white border-border text-foreground h-8 text-xs" />
                <Input placeholder="API Base URL（可选）" value={p.baseUrl} onChange={(e) => updateProvider(i, "baseUrl", e.target.value)} className="bg-white border-border text-foreground h-8 text-xs" />
              </CardContent>
            </Card>
          ))}
          <Button className="w-full bg-primary hover:bg-[#B33A2A] text-white" onClick={save} disabled={saving}>{saving ? "保存中..." : "保存配置"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}