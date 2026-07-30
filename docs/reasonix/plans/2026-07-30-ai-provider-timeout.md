# AI Provider 超时优化实施计划

> **目标：** 给 `callAI()` 的每个 provider 调用加 15s 超时，避免单个 provider 假死阻塞整个叙事请求。

**改动范围：** 仅 `src/lib/narrative/provider.ts`，不碰路由、不碰 prompt、不碰配置加载。

---

## 实施步骤

### Step 1: 添加 timeout helper

在 `provider.ts` 顶部添加一个轻量工具函数：

```ts
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timer]);
}
```

### Step 2: 给每个 provider 调用包一层 timeout

将三个 case 内部的 SDK 调用分别用 `withTimeout(..., 15_000, "Provider anthropic")` 包裹。

注意各 SDK 的 signal 兼容性：
- **Anthropic:** `messages.create({... , signal})` 支持 AbortSignal，但为了兼容 Node 18+ 且不引入 AbortSignal.timeout 依赖，用 Promise.race 更稳妥
- **OpenAI:** 同上，用 Promise.race
- **Ollama:** `fetch` 支持 signal，同样用 Promise.race 保持一致性

### Step 3: 保留现有 fallback 逻辑

超时抛错后 `catch` 块会 `continue` 到下一个 provider，行为与现有"provider 失败降级"一致，不需要改外层循环。

### Step 4: 验证

```bash
npx tsc --noEmit
npx vitest run src/lib/narrative/__tests__/provider.test.ts
```

确保类型通过、现有 6 个 provider 测试仍然全绿。

---

## 验收标准

- 单个 provider 响应时间超过 15s 时，自动跳过并尝试下一个
- 所有 provider 都超时时，最终仍抛 `ALL_PROVIDERS_FAILED`
- 不改变 `loadProviders`、`syncProviderConfig`、配置加载逻辑
- 零 TypeScript 错误，零测试回归
