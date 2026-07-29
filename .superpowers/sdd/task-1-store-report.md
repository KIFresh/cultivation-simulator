# Task 1 Store 修复报告

- 在 `src/store/game-store.ts` 的服务端 `Cultivator` 到 `CultivatorData` 映射中加入了 `worldYear`。
- 映射保留服务端返回值，并在旧存档或 API 未提供该字段时使用默认值 `2025`。
