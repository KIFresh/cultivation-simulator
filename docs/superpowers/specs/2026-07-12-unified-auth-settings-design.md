# 统一登录注册 + 设置弹窗 — 设计规范

## 概述

将现有的 `/login`（登录页）和 `/create`（创建角色页）合并为统一流程：用户输入账号密码，有账号则登录，无账号则自动创建账号后进入角色创建向导。同时移除登录页中的管理員后门（admin/123456），在首页新增设置弹窗，提供 AI 供应方 API 配置和开发者模式开关。

---

## 1. 后端 API

### 1.1 新建 `POST /api/auth/auto`

统一登录/注册接口，一次往返完成检测、登录或创建。

**请求：**
```json
{ "name": "账号名", "password": "明文密码" }
```

**处理逻辑：**
1. `prisma.user.findUnique({ where: { name } })` 查重
2. **账号存在** → 验证密码（scrypt hash）→ 成功返回 `action: "login"`, 失败返回 `action: "error", message: "密码错误"`
3. **账号不存在** → 创建 user（name + 密码 hash，**不创建 cultivator**）→ 返回 `action: "created"`

**响应：**
```json
// 成功登录
{ "action": "login", "user": { "id": "...", "name": "..." } }
// 自动创建
{ "action": "created", "user": { "id": "...", "name": "..." } }
// 密码错误
{ "action": "error", "message": "密码错误" }
```

### 1.2 修改 `POST /api/cultivator`

兼容两种调用场景：
- **旧场景**：传 `userName` + `password` + cultivator 数据 → 创建 user + cultivator（保留兼容）
- **新场景**：传 `userId` + cultivator 数据 → 为已有 user 创建 cultivator

### 1.3 删除

- `src/app/api/auth/check-name/route.ts` — 不再需要（由 auto 接口内部处理查重）
- `src/app/api/auth/login/route.ts` — 不再需要（由 auto 接口替代）

---

## 2. 统一登录页（`src/app/login/page.tsx`）

### UI 布局

```
┌──────────────────────────────┐
│         ← 返回首页            │
│                              │
│    ┌──────────────────────┐  │
│    │    🗝️ 踏入仙途       │  │
│    │                      │  │
│    │  账号名               │  │
│    │  ┌────────────────┐  │  │
│    │  │ 输入账号名      │  │  │
│    │  └────────────────┘  │  │
│    │                      │  │
│    │  密码                │  │
│    │  ┌────────────────┐  │  │
│    │  │ •••••••  [👁]   │  │  │
│    │  └────────────────┘  │  │
│    │                      │  │
│    │  ┌────────────────┐  │  │
│    │  │ ✨ 开始修仙      │  │  │
│    │  └────────────────┘  │  │
│    │                      │  │
│    │  · 新道友自动创建    │  │
│    │  · 老道友直接登录    │  │
│    └──────────────────────┘  │
└──────────────────────────────┘
```

### 交互逻辑

1. 用户输入账号名 + 密码，密码输入框有可见切换按钮（👁/👁‍🗨）
2. 点击「开始修仙」→ 按钮显示 loading 「正在感应天道…」
3. 调用 `POST /api/auth/auto`
4. 根据返回 `action`：
   - `"login"` → `toast.success("欢迎回来，XXX 道友！")` → 写入 `localStorage.userId` → 跳转 `/dashboard`
   - `"created"` → `toast.success("道籍已录，塑造你的化身吧")` → 写入 `localStorage.userId` → 跳转 `/create`
   - `"error"` → 表单内显示红色错误提示
5. **删除管理員后门**（移除 admin/123456 判断块）
6. **删除旧版「创建修炼者」底部链接**（已统一）

### 视觉效果

沿用现有古风水墨风格（Card + 背景 CSS 动画），与首页设计语言一致。

---

## 3. 创建角色页改造（`src/app/create/page.tsx`）

### 变更内容

- **移除步骤 0（账号注册）**：删除账号名/密码输入、查重按钮、密码可见切换
- 剩余步骤**前移**：世界（原1）→ 出生（原2）→ 身份（原3）→ 灵根（原4）→ 天赋（原5）→ 属性（原6）→ 确认（原7）
- 进度指示器从 8 步改为 7 步
- `handleCreate` 提交时传入 `userId`（从 `localStorage` 取），不再传 `userName` + `password`
- 密码可见切换**保留**在统一登录页（已覆盖）

### 守卫逻辑

进入 `/create` 时检查 `localStorage` 是否有 `userId`，若无则显示提示「请先创建账号」并引导回登录页。

---

## 4. 设置弹窗（`src/components/settings-dialog.tsx`）

### 新文件

首页右上角齿轮图标点击弹出的 Dialog 组件。

### UI 布局

```
┌──────────────────────────────────┐
│  ⚙️ 设置                    ✕   │
├──────────────────────────────────┤
│                                  │
│  ── AI 供应方 ①（主供应方）──   │
│  类型     [Anthropic ▼]          │
│  API Key  [••••••••••••••] [👁]  │
│  模型     [claude-sonnet-4-...]  │
│  接口地址 [https://api.an...]    │
│                                  │
│  ── AI 供应方 ②（备用）──       │
│  类型     [OpenAI ▼]             │
│  API Key  [••••••••••••••] [👁]  │
│  模型     [gpt-4o]               │
│  接口地址 [https://api.op...]    │
│                                  │
│  ── AI 供应方 ③（备用）──       │
│  类型     [Ollama ▼]             │
│  模型     [qwen2.5]              │
│  接口地址 [http://localho...]    │
│                                  │
│  ─────────────────────────────── │
│                                  │
│  🛠️ 开发者模式    [🔘 开启/关闭]  │
│                                  │
│  [保存配置]                       │
└──────────────────────────────────┘
```

### 配置字段映射

| UI 字段 | 数据库 Key |
|---------|-----------|
| 供应方 ① 类型 | `AI_PROVIDER_1` |
| 供应方 ① API Key | `AI_PROVIDER_1_KEY` |
| 供应方 ① 模型 | `AI_PROVIDER_1_MODEL` |
| 供应方 ① 接口地址 | `AI_PROVIDER_1_BASE_URL` |
| 供应方 ② 类型 | `AI_PROVIDER_2` |
| 供应方 ② API Key | `AI_PROVIDER_2_KEY` |
| 供应方 ② 模型 | `AI_PROVIDER_2_MODEL` |
| 供应方 ② 接口地址 | `AI_PROVIDER_2_BASE_URL` |
| 供应方 ③ 类型 | `AI_PROVIDER_3` |
| 供应方 ③ API Key | `AI_PROVIDER_3_KEY` |
| 供应方 ③ 模型 | `AI_PROVIDER_3_MODEL` |
| 供应方 ③ 接口地址 | `AI_PROVIDER_3_BASE_URL` |

### 交互逻辑

- 3 个供应方独立填写，Ollama 类型不需要 API Key 字段（隐藏）
- API Key/密码字段有可见切换
- 点击「保存配置」→ `POST /api/settings` 批量 upsert 到 DB
- 保存成功后调用 `syncProviderConfig()` 使运行时生效
- 开发者模式开关 → 切换 `localStorage.setItem("devMode", ...)`，即时生效
- 关闭弹窗时若有未保存修改，提示确认

### 关于轮询

现有 `src/lib/narrative.ts` 中的 `callAI()` 函数已按优先级（1→2→3）依次尝试，失败自动切到下一个供应方，全部失败才报错。此设计无需额外开发。

---

## 5. 首页改造（`src/app/page.tsx`）

### 导航栏变更

现有导航栏结构：
```
[无尽仙途]  [仙录登入]  [结缘预约]
```

改为：
```
[无尽仙途]  [⚙️]  [仙录登入]  [结缘预约]
```

- 齿轮图标 `⚙️` 点击弹出设置弹窗（`settings-dialog`）
- 鼠标悬停显示 tooltip「设置」

### 无其他变更

首页的 Hero 区、特色展示区、devMode 横幅均保持不变。

---

## 6. 删除项汇总

| 文件 | 原因 |
|------|------|
| `src/app/api/auth/check-name/route.ts` | 由 auto 接口替代 |
| `src/app/api/auth/login/route.ts` | 由 auto 接口替代 |
| `src/app/login/page.tsx` 中 admin/123456 代码块 | 移除管理員后门 |

---

## 7. 涉及文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/app/api/auth/auto/route.ts` | **新建** | 统一登录/注册接口 |
| `src/app/api/cultivator/route.ts` | **修改** | 兼容 userId 场景 |
| `src/app/api/auth/check-name/route.ts` | **删除** | 不再需要 |
| `src/app/api/auth/login/route.ts` | **删除** | 不再需要 |
| `src/app/login/page.tsx` | **重写** | 统一表单，移除后门 |
| `src/app/create/page.tsx` | **修改** | 移除步骤0，7步，取 userId 从 localStorage |
| `src/app/page.tsx` | **修改** | 导航栏加齿轮图标 |
| `src/components/settings-dialog.tsx` | **新建** | 设置弹窗组件 |

---

## 8. 设计原则

- **YAGNI**：只做合并 + 设置弹窗，不改动现有游戏逻辑
- **向后兼容**：`POST /api/cultivator` 保留旧调用方式
- **最小化改动**：不重构现有组件，不改变数据模型
- **一致视觉**：统一使用现有的古风水墨风格