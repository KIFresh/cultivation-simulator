/**
 * 服务端启动钩子：周期性预热 AI 连接，减少玩家首次行动冷启动延迟。
 * 每 8 分钟 ping 一次（maxTokens=1，成本≈0），连接保持热状态。
 * 仅在 Node 运行时执行（webpack edge 运行时跳过）。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // dev 下 instrumentation 热重载会重复 register，防多个 setInterval 累积
  const g = globalThis as { __aiWarmupStarted?: boolean };
  if (g.__aiWarmupStarted) return;
  g.__aiWarmupStarted = true;
  try {
    const { warmupAI } = await import("@/lib/narrative");
    const run = () => warmupAI().catch(() => {});
    // 启动 30s 后首轮预热（等 DB/依赖就绪），之后每 8 分钟一次
    setTimeout(run, 30_000);
    setInterval(run, 8 * 60_000);
  } catch {
    // 预热失败不影响主流程
  }
}
