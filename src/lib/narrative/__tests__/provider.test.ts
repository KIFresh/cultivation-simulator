import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 通过 vi.hoisted 在模块加载前注入可操控的 mock 引用
const { mockPrismaFindMany, mockAnthropicMessagesCreate, mockOpenAIChatCompletionsCreate } =
  vi.hoisted(() => ({
    mockPrismaFindMany: vi.fn(),
    mockAnthropicMessagesCreate: vi.fn(),
    mockOpenAIChatCompletionsCreate: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appSetting: {
      findMany: mockPrismaFindMany,
    },
  },
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(function Anthropic() {
    return { messages: { create: mockAnthropicMessagesCreate } };
  }),
}));

vi.mock("openai", () => ({
  default: vi.fn(function OpenAI() {
    return { chat: { completions: { create: mockOpenAIChatCompletionsCreate } } };
  }),
}));

const originalEnv = process.env;
const originalFetch = global.fetch;

describe("provider.loadProviders", () => {
  beforeEach(() => {
    // 重置 process.env，避免外部环境变量污染测试
    process.env = { ...originalEnv };
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith("AI_PROVIDER_")) {
        delete process.env[key];
      }
    });

    vi.resetAllMocks();
    vi.resetModules();

    // prisma mock 默认不设置实现，syncProviderConfig 会抛出，
    // 从而 runtimeSettings 保持 null，测试只走环境变量 fallback 逻辑
    mockPrismaFindMany.mockImplementation(() => {
      throw new Error("db unavailable");
    });

    // 默认 AI SDK mock 成功
    mockAnthropicMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "anthropic-ok" }],
    });
    mockOpenAIChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: "openai-ok" } }],
    });

    // 默认 ollama fetch 成功
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ message: { content: "ollama-ok" } }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it("无任何配置时返回空数组", async () => {
    const { callAI } = await import("@/lib/narrative/provider");
    await expect(callAI({ systemPrompt: "", userPrompt: "" })).rejects.toThrow(
      "NO_PROVIDER_CONFIGURED"
    );
  });

  it("runtimeSettings 提供配置时的加载", async () => {
    mockPrismaFindMany.mockImplementation(() =>
      Promise.resolve([
        { key: "AI_PROVIDER_1", value: "openai" },
        { key: "AI_PROVIDER_1_KEY", value: "runtime-key" },
        { key: "AI_PROVIDER_1_MODEL", value: "runtime-model" },
      ])
    );

    const { callAI } = await import("@/lib/narrative/provider");
    const result = await callAI({ systemPrompt: "", userPrompt: "" });
    expect(result).toBe("openai-ok");
    expect(mockPrismaFindMany).toHaveBeenCalledTimes(1);
    expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledWith({
      model: "runtime-model",
      max_tokens: 500,
      temperature: 0.8,
      messages: [
        { role: "system", content: "" },
        { role: "user", content: "" },
      ],
    });
  });

  it("环境变量作为 fallback", async () => {
    process.env.AI_PROVIDER_1 = "openai";
    process.env.AI_PROVIDER_1_KEY = "env-key";
    process.env.AI_PROVIDER_1_MODEL = "env-model";

    const { callAI } = await import("@/lib/narrative/provider");
    const result = await callAI({ systemPrompt: "", userPrompt: "" });
    expect(result).toBe("openai-ok");
    expect(mockPrismaFindMany).toHaveBeenCalled();
    expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledWith({
      model: "env-model",
      max_tokens: 500,
      temperature: 0.8,
      messages: [
        { role: "system", content: "" },
        { role: "user", content: "" },
      ],
    });
  });

  it("anthropic/openai 缺少 apiKey 时跳过", async () => {
    process.env.AI_PROVIDER_1 = "anthropic";
    process.env.AI_PROVIDER_1_MODEL = "some-model";
    // 未设置 AI_PROVIDER_1_KEY

    const { callAI } = await import("@/lib/narrative/provider");
    await expect(callAI({ systemPrompt: "", userPrompt: "" })).rejects.toThrow(
      "NO_PROVIDER_CONFIGURED"
    );
  });

  it("ollama 缺少 baseUrl 时跳过", async () => {
    process.env.AI_PROVIDER_1 = "ollama";
    process.env.AI_PROVIDER_1_MODEL = "ollama-model";
    // 未设置 AI_PROVIDER_1_BASE_URL

    const { callAI } = await import("@/lib/narrative/provider");
    await expect(callAI({ systemPrompt: "", userPrompt: "" })).rejects.toThrow(
      "NO_PROVIDER_CONFIGURED"
    );
  });

  it("SDK timeout 会聚合为 TIMEOUT", async () => {
    process.env.AI_PROVIDER_1 = "openai";
    process.env.AI_PROVIDER_1_KEY = "key-1";
    process.env.AI_PROVIDER_1_MODEL = "model-1";
    const error = new Error("Request timed out.");
    error.name = "APIConnectionTimeoutError";
    mockOpenAIChatCompletionsCreate.mockRejectedValue(error);

    const { callAI } = await import("@/lib/narrative/provider");
    await expect(callAI({ systemPrompt: "", userPrompt: "" })).rejects.toMatchObject({
      name: "AllProvidersFailedError",
      failures: [{ code: "TIMEOUT" }],
    });
  });

  it("空响应会触发备用 provider", async () => {
    process.env.AI_PROVIDER_1 = "openai";
    process.env.AI_PROVIDER_1_KEY = "key-1";
    process.env.AI_PROVIDER_1_MODEL = "model-1";
    process.env.AI_PROVIDER_3 = "openai";
    process.env.AI_PROVIDER_3_KEY = "key-3";
    process.env.AI_PROVIDER_3_MODEL = "model-3";

    mockOpenAIChatCompletionsCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: "" } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: "fallback" } }] });

    const { callAI } = await import("@/lib/narrative/provider");
    await expect(callAI({ systemPrompt: "", userPrompt: "" })).resolves.toBe("fallback");
  });

  it.each([
    [401, "HTTP_401"],
    [403, "HTTP_403"],
    [404, "HTTP_404"],
  ])("聚合 HTTP %s 为稳定失败码", async (status, code) => {
    process.env.AI_PROVIDER_1 = "openai";
    process.env.AI_PROVIDER_1_KEY = "key-1";
    process.env.AI_PROVIDER_1_MODEL = "model-1";
    const error = Object.assign(new Error(`request failed: ${status}`), { status });
    mockOpenAIChatCompletionsCreate.mockRejectedValue(error);

    const { callAI } = await import("@/lib/narrative/provider");
    await expect(callAI({ systemPrompt: "", userPrompt: "" })).rejects.toMatchObject({
      name: "AllProvidersFailedError",
      failures: [{ code }],
    });
  });

  it("provider 优先级排序", async () => {
    process.env.AI_PROVIDER_1 = "openai";
    process.env.AI_PROVIDER_1_KEY = "key-1";
    process.env.AI_PROVIDER_1_MODEL = "model-1";
    process.env.AI_PROVIDER_3 = "openai";
    process.env.AI_PROVIDER_3_KEY = "key-3";
    process.env.AI_PROVIDER_3_MODEL = "model-3";

    // provider 1 失败，provider 3 成功
    mockOpenAIChatCompletionsCreate
      .mockRejectedValueOnce(new Error("provider 1 failed"))
      .mockResolvedValueOnce({
        choices: [{ message: { content: "fallback" } }],
      });

    const { callAI } = await import("@/lib/narrative/provider");
    const result = await callAI({ systemPrompt: "", userPrompt: "" });
    expect(result).toBe("fallback");
    expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledTimes(2);
    expect(mockOpenAIChatCompletionsCreate).toHaveBeenNthCalledWith(1, {
      model: "model-1",
      max_tokens: 500,
      temperature: 0.8,
      messages: [
        { role: "system", content: "" },
        { role: "user", content: "" },
      ],
    });
    expect(mockOpenAIChatCompletionsCreate).toHaveBeenNthCalledWith(2, {
      model: "model-3",
      max_tokens: 500,
      temperature: 0.8,
      messages: [
        { role: "system", content: "" },
        { role: "user", content: "" },
      ],
    });
  });
});
