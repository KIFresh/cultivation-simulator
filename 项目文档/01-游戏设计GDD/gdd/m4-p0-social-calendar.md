# M4 P0#4 社交日历 / 节日 — 系统设计文档（GDD）

> 状态：待主理人裁决 → 已由主理人直接落地（design-strategist 不可用，主理人代写规格+实现）
> 关联：P0#1 日常事件池(7f65c45)、P0#2 饭桌(93de278 + ee0c0a9)、P0#3 好友(918e57b)
> 规划原文：「社交日历/节日 | 节日事件合并到事件池，随机触发 | 随事件池一起」

## 1. 系统目的与玩家价值
凡人阶段的"年味"与社交锚点。节日把日常事件池从"普通一天"升级为"有仪式感的日子"，
增强沉浸与情感连接，与 P0#2 饭桌的"家常年味"呼应。不改变年推进节奏，仅提升事件质量。

## 2. 数据模型
- 在 `src/lib/mortal-events.ts` 新增 `FESTIVAL_EVENTS: MortalEvent[]`。
- `MortalEvent` 接口加可选 `festival?: boolean`（true = 节日事件，供前端打 🎉 标签）。
- 节日事件沿用既有结构：`{ id, ageBand, text, options:[{label, effects, narrative, familyEffects?}] }`。
- 效果走现有白名单 `effects`（root/spirit/insight/luck/charm/mind 叠加 + health clamp 0..100）
  与可选 `familyEffects.parentIntimacy`（节日适合加父母亲密度）。**纯预制文本，禁用 AI。**

## 3. 节日清单（7 个，覆盖 0-3 / 4-6 / 7-12 / 13-15）
| id | 节日 | ageBand | 三选项取向 |
|---|---|---|---|
| evt_fest_zhuazhou | 抓周 | 0-3 | 书(insight+1) / 算盘(luck+1) / 玩具(family+2) |
| evt_fest_winter | 冬至 | 4-6 | 饺子(health+5) / 数九(spirit+1) / 围炉(family+2) |
| evt_fest_spring | 春节 | 7-12 | 春联(spirit+1, family+2) / 压岁钱(luck+1, family+3) / 鞭炮(charm+1, 小风险 mind-1) |
| evt_fest_dragonboat | 端午 | 7-12 | 粽子(insight+1) / 龙舟(spirit+1, family+1) / 艾草(health+5) |
| evt_fest_templefair | 庙会 | 7-12 | 杂耍(charm+1) / 小吃(health+3) / 灯谜(insight+1) |
| evt_fest_birthday | 生日 | 7-12 | 许愿(luck+2) / 礼物(charm+1) / 好友庆生(family+1, insight+1) |
| evt_fest_midautumn | 中秋 | 13-15 | 赏月(spirit+1) / 月饼(charm+1) / 遥寄相思(family+2, mind+1) |

## 4. 集成与触发规则（核心）
- `advance-year/route.ts`：在 `earth && newAge<16` 抽 dailyEvent 处，
  改为"先按概率 `FESTIVAL_CHANCE`(=0.3) 抽 `pickFestivalEvent(newAge)`；若未命中节日或该年龄无节日事件，
  则回退 `pickMortalEvent(newAge)` 作为普通 dailyEvent"。dinnerEvent 逻辑不变。
- `resolve-event/route.ts`：检索数组改为 `[...MORTAL_EVENTS, ...DINNER_EVENTS, ...FESTIVAL_EVENTS].find(...)`。
- `dashboard/page.tsx`：dailyEvent 若为 `festival`，Card 标题加 🎉 前缀（如「🎉 春节」），其余复用现有渲染。
- `pickFestivalEvent(age)`：仿 `pickMortalEvent` 按 age 分层随机抽一条 FESTIVAL_EVENTS；无可用返回 null。

## 5. 边界与异常
- 无存活父母时 `familyEffects` 不写（resolve-event 已有兼容）。
- 转世 `npcRelations:null` 不影响（节日不涉及 npcRelations）。
- 16 岁觉醒后不再触发（`<16` 约束已存在）。
- 概率常量 `FESTIVAL_CHANCE` 可调。

## 6. 非目标（NON-GOALS）
不新建 DB 字段/迁移、不新建路由、不引入 AI、不建真实日历/月份系统、不新建独立节日面板、
不碰 `cultivation-data.ts`/location-panel/schema.prisma/npc-chat。

## 7. 测试计划
- `mortal-events.test.ts` 扩展：FESTIVAL_EVENTS 数据完整性（id 唯一、ageBand∈合法档、
  选项 2–3、effects 白名单、festival 标记可选）+ `pickFestivalEvent` 分层 + 无可用年龄返回 null。
- `resolve-event.test.ts` 扩展：构造节日事件 id 请求，验证 effects/familyEffects 正确结算。
- `advance-year` 节日以约 FESTIVAL_CHANCE 概率出现（mock Math.random 或统计多次调用验证）。

## 8. 实现约束（收紧越权面）
只改 `mortal-events.ts` + `advance-year/route.ts` + `resolve-event/route.ts` + （可选标签）`dashboard/page.tsx` + 测试。
不得改 `cultivation-data.ts`/location-panel/schema.prisma/npc-chat；不调 AI；不引新依赖。

## 设计假设
- 无真实日历系统，"节日"= 年推进时按概率触发的特殊主题事件（设计假设，已与规划"随事件池一起"一致）。
- 0-3 档仅 抓周 一个节日，其余档各有覆盖；某年龄无节日时自动回退普通日常事件。
