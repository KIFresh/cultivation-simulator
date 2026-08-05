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
    /signal timed out|request timed out|timeout/i.test(message) ||
    error instanceof Error && error.name === "APIConnectionTimeoutError"
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

  // Configure embedding service (independent provider, e.g. SiliconFlow BGE-M3)
  try {
    const { configureEmbedding } = await import("@/lib/embedding");
    const embedBaseUrl = readSetting("EMBEDDING_BASE_URL");
    const embedApiKey = readSetting("EMBEDDING_API_KEY");
    if (embedBaseUrl && embedApiKey) {
      configureEmbedding({
        baseUrl: embedBaseUrl,
        apiKey: embedApiKey,
        model: readSetting("EMBEDDING_MODEL") || undefined,
      });
      return;
    }
    // 未配置独立 embedding 时，退回叙事 provider 根域名（仅当该 provider 支持 embeddings）
    const provider = getRuntimeProviderConfig(1);
    if (provider?.baseUrl && provider?.apiKey) {
      let fallbackBase = provider.baseUrl;
      try {
        fallbackBase = new URL(provider.baseUrl).origin;
      } catch {
        // keep as-is
      }
      configureEmbedding({
        baseUrl: fallbackBase,
        apiKey: provider.apiKey,
        model: readSetting("EMBEDDING_MODEL") || undefined,
      });
    }
  } catch {
    // Embedding config is non-critical
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


function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  controller?: AbortController
): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  const timer = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      controller?.abort();
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timer]).finally(() => {
    if (timerId) clearTimeout(timerId);
  });
}

export async function callAI(params: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  /** 可选：流式回调，收到增量文本时调用（仅 openai 兼容 provider 支持） */
  onDelta?: (delta: string) => void;
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
          const controller = new AbortController();
          const resp = await withTimeout(
            client.messages.create({
              model,
              max_tokens: maxTokens,
              system: params.systemPrompt,
              messages: [{ role: "user", content: params.userPrompt }],
              temperature,
            }, { signal: controller.signal }),
            PROVIDER_TIMEOUT_MS,
            `Provider anthropic (${model})`,
            controller
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
          const clientOptions: Record<string, unknown> = {
            apiKey: provider.apiKey,
            ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
          };
          // 若配置了 AI_PROXY（如本地 Clash），注入 undici ProxyAgent，解决被墙域名不可达
          const proxyUrl = readSetting("AI_PROXY");
          if (proxyUrl) {
            try {
              const undici = await import("undici");
              const dispatcher = new undici.ProxyAgent(proxyUrl);
              clientOptions.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
                undici.fetch(
                  input as Parameters<typeof undici.fetch>[0],
                  { ...(init || {}), dispatcher } as Parameters<typeof undici.fetch>[1]
                );
            } catch {
              // 代理注入失败则直连
            }
          }
          const client = new OpenAI(clientOptions as ConstructorParameters<typeof OpenAI>[0]);
          const controller = new AbortController();
          if (params.onDelta) {
            // 流式模式：边生成边回调增量（仅当调用方需要流式）
            const stream = await withTimeout(
              client.chat.completions.create(
                {
                  model,
                  max_tokens: maxTokens,
                  temperature,
                  stream: true,
                  messages: [
                    { role: "system", content: params.systemPrompt },
                    { role: "user", content: params.userPrompt },
                  ],
                },
                { signal: controller.signal }
              ),
              PROVIDER_TIMEOUT_MS,
              `Provider openai (${model})`,
              controller
            );
            // 空闲超时：20s 无新 chunk 视为挂起（长叙事生成期间重置）
            let acc = "";
            let idleTimer: NodeJS.Timeout | null = null;
            const armIdle = () => {
              if (idleTimer) clearTimeout(idleTimer);
              idleTimer = setTimeout(() => controller.abort(), 20_000);
            };
            armIdle();
            try {
              for await (const chunk of stream) {
                armIdle();
                const d = chunk.choices?.[0]?.delta?.content;
                if (d) {
                  acc += d;
                  params.onDelta(d);
                }
              }
            } finally {
              if (idleTimer) clearTimeout(idleTimer);
            }
            if (!isNonEmptyString(acc)) throw new Error("EMPTY_RESPONSE");
            return acc;
          }
          const resp = await withTimeout(
            client.chat.completions.create({
              model,
              max_tokens: maxTokens,
              temperature,
              messages: [
                { role: "system", content: params.systemPrompt },
                { role: "user", content: params.userPrompt },
              ],
            }, { signal: controller.signal }),
            PROVIDER_TIMEOUT_MS,
            `Provider openai (${model})`,
            controller
          );
          const content = resp.choices[0]?.message?.content;
          if (!isNonEmptyString(content)) throw new Error("EMPTY_RESPONSE");
          return content;
        }
        case "ollama": {
          const baseUrl = (provider.baseUrl || "http://localhost:11434").replace(/\/$/, "");
          const controller = new AbortController();
          const resp = await withTimeout(
            fetch(`${baseUrl}/api/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
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
            `Provider ollama (${model})`,
            controller
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
      maxTokens: 8,
      temperature: 0,
    }).catch(() => {});
  } catch {
    /* 预热失败不影响主流程 */
  }
}
