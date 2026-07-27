// ═══════════════════════════════════════════════════════════════════════════
// narrative/provider.ts — AI 供应方配置与调用（唯一真相源）
// ═══════════════════════════════════════════════════════════════════════════

interface ProviderConfig {
  priority: number;
  type: "anthropic" | "openai" | "ollama";
  apiKey?: string;
  model: string;
  baseUrl?: string;
}

let runtimeSettings: Record<string, string> | null = null;

export async function syncProviderConfig(): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const settings = await prisma.appSetting.findMany();
    runtimeSettings = {};
    for (const s of settings) { runtimeSettings[s.key] = s.value; }
  } catch {
    /* 仅首次加载失败时静默保留上次值 */
  }
}

function loadProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];
  for (let i = 1; i <= 3; i++) {
    const type = runtimeSettings?.[`AI_PROVIDER_${i}`] || process.env[`AI_PROVIDER_${i}`] as string;
    if (!type) continue;
    const apiKey = runtimeSettings?.[`AI_PROVIDER_${i}_KEY`] || process.env[`AI_PROVIDER_${i}_KEY`] || undefined;
    const model = runtimeSettings?.[`AI_PROVIDER_${i}_MODEL`] || process.env[`AI_PROVIDER_${i}_MODEL`] || "";
    const baseUrl = runtimeSettings?.[`AI_PROVIDER_${i}_BASE_URL`] || process.env[`AI_PROVIDER_${i}_BASE_URL`] || undefined;
    if ((type === "anthropic" || type === "openai") && !apiKey) continue;
    if (type === "ollama" && !baseUrl) continue;
    providers.push({ priority: i, type: type as ProviderConfig["type"], apiKey, model, baseUrl });
  }
  return providers;
}

export async function callAI(params: { systemPrompt: string; userPrompt: string; maxTokens?: number; temperature?: number }): Promise<string> {
  await syncProviderConfig().catch((e) => { console.error("callAI: syncProviderConfig 失败", e); });
  const providers = loadProviders();
  if (providers.length === 0) throw new Error("NO_PROVIDER_CONFIGURED");

  for (const provider of providers) {
    try {
      const model = provider.model;
      const temperature = params.temperature ?? 0.8;
      const maxTokens = params.maxTokens ?? 500;

      switch (provider.type) {
        case "anthropic": {
          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const client = new Anthropic({ apiKey: provider.apiKey });
          const resp = await client.messages.create({
            model, max_tokens: maxTokens, system: params.systemPrompt,
            messages: [{ role: "user", content: params.userPrompt }], temperature,
          });
          return (resp.content as Array<{ type: string; text?: string }>).filter((c) => c.type === "text").map((c) => c.text || "").join("");
        }
        case "openai": {
          const OpenAI = (await import("openai")).default;
          const client = new OpenAI({ apiKey: provider.apiKey, ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}) });
          const resp = await client.chat.completions.create({
            model, max_tokens: maxTokens, temperature,
            messages: [{ role: "system", content: params.systemPrompt }, { role: "user", content: params.userPrompt }],
          });
          return resp.choices[0]?.message?.content || "";
        }
        case "ollama": {
          const baseUrl = (provider.baseUrl || "http://localhost:11434").replace(/\/$/, "");
          const resp = await fetch(`${baseUrl}/api/chat`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, stream: false, options: { temperature, num_predict: maxTokens }, messages: [{ role: "system", content: params.systemPrompt }, { role: "user", content: params.userPrompt }] }),
          });
          if (!resp.ok) throw new Error(`Ollama error: ${resp.status}`);
          const data = await resp.json();
          return data.message?.content || "";
        }
      }
    } catch (e) { console.warn(`Provider ${provider.type} failed:`, (e as Error).message); continue; }
  }
  throw new Error("ALL_PROVIDERS_FAILED");
}

export async function warmupAI(): Promise<void> {
  try {
    await syncProviderConfig();
    const providers = loadProviders();
    if (providers.length === 0) return;
    await callAI({ systemPrompt: "你是连接预热助手。", userPrompt: "ping", maxTokens: 1, temperature: 0 }).catch(() => {});
  } catch {
    /* 预热失败不影响主流程 */
  }
}
