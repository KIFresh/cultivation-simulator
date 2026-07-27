# 无尽仙途 — 现代都市修仙文字养成游戏

一款基于 Next.js 构建的现代都市修仙文字养成游戏。玩家在修仙世界中经历成长、战斗、社交、突破等丰富的人生历程。

## 技术栈

- **前端框架**: Next.js 16.2.9 (App Router)
- **数据库**: Prisma 7.8.0 + SQLite
- **状态管理**: Zustand
- **测试框架**: Vitest
- **AI 叙事**: 结构化效果契约系统（Zod 校验 + 效果钳制 + 统一持久化）

## 快速开始

```bash
npm install
npx prisma generate
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 开始游戏。

## 构建

```bash
npm run build
```

## 测试

```bash
npm test          # 全量测试（82 文件，929+ 用例）
npx vitest run    # 等效于 npm test
```

## 核心系统

### 叙事引擎
- AI 驱动的叙事生成，输出结构化游戏效果（gold/stamina/health/mindDemon/intimacy/attrExp）
- 效果经 Zod Schema 校验、钳制后统一持久化至数据库
- 支持流式和非流式叙事输出

### 战斗系统
- 差异化掉落池（每个敌人配置专属掉落）
- 战斗评分系统（含气运影响）
- 战败惩罚四级机制（档0-3，含道心受损、扣物、重伤、道消）
- 加权敌人选择算法

### 季节推进系统
- 四季循环（季度→季度→季度→季度→跨年）
- 跨年时触发属性增长、体力恢复、丹毒衰减
- 并发保护（乐观锁）

### 家庭系统
- NPC 关系管理（亲密度、互动）
- 家庭对话叙事生成
- 成员替换效果

## 项目结构

```
src/
├── app/api/              # API 路由（叙事、战斗、推进、家庭等）
│   ├── advance-quarter/
│   ├── combat/
│   ├── narrative/
│   ├── family-dialogue/
│   └── action/
├── components/           # 共享 UI 组件
├── lib/                  # 核心逻辑
│   ├── narrative-effects.ts  # 效果契约系统
│   ├── combat-engine.ts      # 战斗引擎
│   ├── enemy-data.ts         # 敌人数据
│   └── cultivation-data.ts   # 修炼数据
└── store/                # Zustand 状态管理
```

## 质量门禁

每项变更需通过以下检查：
1. `npx tsc --noEmit` — 无类型错误
2. `npm test` — 全部测试通过
3. `npm run build` — 构建成功
4. 独立审查（review）