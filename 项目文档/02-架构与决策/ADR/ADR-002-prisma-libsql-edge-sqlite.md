# ADR-002 · Prisma 7 + libsql 边缘 SQLite 数据层选型

- **状态**：已采纳（Accepted）
- **日期**：2026-07-21
- **决策者**：工程主程（程基岩）；生产部署形态见「待裁决」

## 背景（Context）

游戏进度需持久化，且项目定位为可部署到边缘/Serverless 环境的文字模拟器。技术栈已选定：

- **Prisma 7**（生成客户端输出至 `src/generated/prisma`）
- **`@prisma/adapter-libsql`**（`PrismaLibSql` 驱动适配器）
- **`@libsql/client`**（边缘 SQLite / Turso 客户端）
- `schema.prisma` 中 `datasource db { provider = "sqlite" }`，URL 由适配器/`prisma.config.ts` 注入（`DATABASE_URL` 或 `file:./prisma/dev.db`）
- `next.config.ts` 的 `serverExternalPackages` 已排除 `@prisma/client` / `@prisma/adapter-libsql` / `@libsql/client`，确保它们不在 Turbopack 打包内、运行于 node runtime
- `src/lib/prisma.ts` 用 `globalThis` 缓存 `PrismaClient` 单例（仅 dev 期缓存，避免热重载连接泄漏）

需要确认：为何选 libsql 而非托管 Postgres；该选型的边界与代价。

## 决策（Decision）

采用 **Prisma 驱动适配器（Driver Adapter）模式 + libsql 边缘 SQLite**：

- 通过 `new PrismaLibSql({ url, ...(authToken?{authToken}:{}) })` 注入适配器，`PrismaClient({ adapter })` 创建客户端。
- `datasource` 仅声明 `provider = "sqlite"`，连接串由适配器与 `prisma.config.ts`（`prisma/config` 的 `defineConfig`，含 `dotenv/config`）在运行时提供。
- 开发用本地文件 `dev.db`；生产切 Turso（libsql 云）只需改 `DATABASE_URL` + `DATABASE_AUTH_TOKEN`，**不改代码**。
- `serverExternalPackages` 与全局单例模式固定为约定，禁止把 prisma 标记为 client bundle。

## 后果（Consequences）

**正向**
- **边缘/Serverless 友好**：libsql 客户端可在边缘运行时工作，Turso 提供全球低延迟只读副本，契合「边缘 SQLite」定位。
- **零代码切换环境**：本地文件 ↔ Turso 仅改环境变量。
- **类型安全**：Prisma 生成的客户端提供编译期查询/模型类型，降低 SQL 注入与字段错配风险。

**负向 / 代价**
- **SQLite 能力上限**：相较 Postgres，缺少原生某些特性（如复杂约束、并发写吞吐、部分原生类型），长期若需强一致/高并发需重新评估。
- **迁移与一致性**：本地 `dev.db` 与云端 Turso 的数据一致性需治理（种子、迁移、备份策略）。
- **密钥管理**：生产需妥善保管 `DATABASE_URL` / `DATABASE_AUTH_TOKEN`，且必须与 AI 供应方 Key 一同纳入环境变量管理。

**待主理人裁决**
- 生产是否真上 Turso（边缘）还是传统托管 Postgres？若后者，应切换为 `@prisma/adapter-pg`（见备选 B）。
- 是否需要读写分离 / 只读副本用于 `GameEvent` 历史查询（随游玩时长 `GameEvent` 行数增长）。

## 备选方案（Alternatives Considered）

- **A. 原生 `better-sqlite3` / `node:sqlite`**：本地最快、零抽象，但**不边缘友好**（需 node 原生模块），且与现有 Prisma 类型体系冲突，否决。
- **B. Postgres + `@prisma/adapter-pg`**：能力最强、生态成熟，但需托管数据库、丧失「边缘 SQLite」零运维优势，列为生产强一致场景的备选。
- **C. Drizzle ORM + libsql**：更轻、edge 友好，但需放弃已落地的 Prisma 代码与生成客户端，重构成本高，否决。
- **D. 纯 JSON 文件持久化**：最简单，但无并发安全、无查询能力，不符合多 model 关系模型，否决。

## 关联
- 关联 ADR-001（边缘部署与 node runtime 一致性）、ADR-004（DB 为持久化权威）。
- 触发评审条件：切换数据库引擎/适配器、新增 Prisma model、变更 `serverExternalPackages`、引入读写分离。
