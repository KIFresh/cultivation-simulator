// ═══════════════════════════════════════════════════════════════════════════
// narrative/provider.ts — AI 供应方配置与调用（唯一真相源）
// ═══════════════════════════════════════════════════════════════════════════

import { logger } from "@/lib/logger";

interface ProviderConfig {
  priority: number;
  type: "anthropic" | "openai" | "ollama";
  apiKey?: string;
  model: string;
  baseUrl?: string;
}

export type ProviderFailureCode =
  | "TIMEOUT"
  | "HTTP_401"
  | "HTTP_403"
  | "HTTP_404"
  | "MODEL_UNSUPPORTED"
  | "EMPTY_RESPONSE"
  | "RESPONSE_PARSE_FAILED"
  | "NETWORK_ERROR"
  | "PROVIDER_ERROR";

export class AllProvidersFailedError extends Error {
  readonly failures: Array<{ provider: string; model: string; code: ProviderFailureCode }>;

  constructor(failures: Array<{ provider: string; model: string; code: ProviderFailureCode }>) {
    super("ALL_PROVIDERS_FAILED");
    this.name = "AllProvidersFailedError";
    this.failures = failures;
  }
}

function classifyProviderError(error: unknown): ProviderFailureCode {
  const message = error instanceof Error ? error.message : String(error);
  const errorCode = String((error as { code?: unknown })?.code || "");
  if (
    message.includes(" timed out after ") ||
    error instanceof Error &&
      (error.name === "APIConnectionTimeoutError" || /request timed out|timeout/i.test(message))
  )
    return "TIMEOUT";
  if (message === "EMPTY_RESPONSE") return "EMPTY_RESPONSE";
  if (
    message === "RESPONSE_PARSE_FAILED" ||
    error instanceof SyntaxError ||
    /unexpected token|invalid json|json parse/i.test(message)
  )
    return "RESPONSE_PARSE_FAILED";
  if (
    message === "MODEL_UNSUPPORTED" ||
    errorCode === "model_not_found" ||
    /model.{0,20}(not found|unsupported|does not exist)/i.test(message)
  )
    return "MODEL_UNSUPPORTED";
  if (message === "NETWORK_ERROR") return "NETWORK_ERROR";
  const status = (error as { status?: number })?.status;
  if (status === 401) return "HTTP_401";
  if (status === 403) return "HTTP_403";
  if (status === 404) return "HTTP_404";
  return "PROVIDER_ERROR";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

let runtimeSettings: Record<string, string> | null = null;

export async function syncProviderConfig(): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const settings = await prisma.appSetting.findMany();
    runtimeSettings = {};
    for (const s of settings) {
      runtimeSettings[s.key] = s.value;
    }
  } catch {
    /* 仅首次加载失败时静默保留上次值 */
  }
}

function readSetting(key: string): string | undefined {
  if (runtimeSettings && Object.prototype.hasOwnProperty.call(runtimeSettings, key)) {
    return runtimeSettings[key];
  }
  return process.env[key];
}

export function getRuntimeProviderConfig(index: number): ProviderConfig | null {
  if (!Number.isInteger(index) || index < 1 || index > 3) return null;
  const type = readSetting(`AI_PROVIDER_${index}`);
  if (!type || !["anthropic", "openai", "ollama"].includes(type)) return null;
  const apiKey = readSetting(`AI_PROVIDER_${index}_KEY`) || undefined;
  const model = readSetting(`AI_PROVIDER_${index}_MODEL`) || "";
  const baseUrl = readSetting(`AI_PROVIDER_${index}_BASE_URL`) || undefined;
  return { priority: index, type: type as ProviderConfig["type"], apiKey, model, baseUrl };
}

function loadProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];
  for (let i = 1; i <= 3; i++) {
    const provider = getRuntimeProviderConfig(i);
    if (!provider) continue;
    if ((provider.type === "anthropic" || provider.type === "openai") && !provider.apiKey) continue;
    if (provider.type === "ollama" && !provider.baseUrl) continue;
    providers.push(provider);
  }
  return providers;
}

const PROVIDER_TIMEOUT_MS = 28_000;


function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timer]);
}

export async function callAI(params: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  await syncProviderConfig().catch((e) => {
    logger.error("callAI: syncProviderConfig 失败", e);
  });
  const providers = loadProviders();
  if (providers.length === 0) throw new Error("NO_PROVIDER_CONFIGURED");

  const failures: AllProvidersFailedError["failures"] = [];
  for (const provider of providers) {
    try {
      const model = provider.model;
      const temperature = params.temperature ?? 0.8;
      const maxTokens = params.maxTokens ?? 500;

      switch (provider.type) {
        case "anthropic": {
          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const client = new Anthropic({ apiKey: provider.apiKey });
          const resp = await withTimeout(
            client.messages.create({
              model,
              max_tokens: maxTokens,
              system: params.systemPrompt,
              messages: [{ role: "user", content: params.userPrompt }],
              temperature,
            }),
            PROVIDER_TIMEOUT_MS,
            `Provider anthropic (${model})`
          );
          const content = (resp.content as Array<{ type: string; text?: string }>)
            .filter((c) => c.type === "text")
            .map((c) => c.text || "")
            .join("");
          if (!isNonEmptyString(content)) throw new Error("EMPTY_RESPONSE");
          return content;
        }
        case "openai": {
          const OpenAI = (await import("openai")).default;
          const client = new OpenAI({
            apiKey: provider.apiKey,
            ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
          });
          const resp = await withTimeout(
            client.chat.completions.create({
              model,
              max_tokens: maxTokens,
              temperature,
              messages: [
                { role: "system", content: params.systemPrompt },
                { role: "user", content: params.userPrompt },
              ],
            }),
            PROVIDER_TIMEOUT_MS,
            `Provider openai (${model})`
          );
          const content = resp.choices[0]?.message?.content;
          if (!isNonEmptyString(content)) throw new Error("EMPTY_RESPONSE");
          return content;
        }
        case "ollama": {
          const baseUrl = (provider.baseUrl || "http://localhost:11434").replace(/\/$/, "");
          const resp = await withTimeout(
            fetch(`${baseUrl}/api/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model,
                stream: false,
                options: { temperature, num_predict: maxTokens },
                messages: [
                  { role: "system", content: params.systemPrompt },
                  { role: "user", content: params.userPrompt },
                ],
              }),
            }),
            PROVIDER_TIMEOUT_MS,
            `Provider ollama (${model})`
          );
          if (!resp.ok) {
            const error = new Error(`Ollama error: ${resp.status}`) as Error & { status?: number };
            error.status = resp.status;
            throw error;
          }
          let data: { message?: { content?: unknown } };
          try {
            data = await resp.json();
          } catch {
            throw new Error("RESPONSE_PARSE_FAILED");
          }
          const content = data.message?.content;
          if (!isNonEmptyString(content)) throw new Error("EMPTY_RESPONSE");
          return content;
        }
      }
    } catch (e) {
      const code = classifyProviderError(e);
      failures.push({ provider: provider.type, model: provider.model || "[未配置]", code });
      console.warn(`Provider ${provider.type} failed:`, code);
      continue;
    }
  }
  throw new AllProvidersFailedError(failures);
}

export async function warmupAI(): Promise<void> {
  try {
    await syncProviderConfig();
    const providers = loadProviders();
    if (providers.length === 0) return;
    await callAI({
      systemPrompt: "你是连接预热助手。",
      userPrompt: "ping",
      maxTokens: 1,
      temperature: 0,
    }).catch(() => {});
  } catch {
    /* 预热失败不影响主流程 */
  }
}
