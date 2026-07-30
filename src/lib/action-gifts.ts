import { isFamilyGuardianRelation, type HouseholdIncome } from "./family-career";

/**
 * 行动馈赠规则：所有金币均由服务端确定性结算，AI 只能叙述结算结果。
 */

export type FamilyAllowanceTarget = {
  id: string;
  name: string;
  relation: string;
  intimacy: number;
  incomeLevel?: number | null;
};

export type GiftDecisionCode =
  | "NOT_MONEY_REQUEST"
  | "INVALID_ACTION"
  | "NO_FAMILY_TARGET"
  | "TOO_YOUNG"
  | "RELATION_TOO_LOW"
  | "RUDE_TONE"
  | "ALLOWANCE_EXHAUSTED"
  | "GRANTED"
  | "PARTIAL_GRANT";

export type GiftDecision = {
  givesGold: number;
  givesIntimacyDelta: number;
  reason: string;
  reasonCode: GiftDecisionCode;
  remainingAllowance: number;
};

function isAskingMoney(input: string) {
  return /要钱|给钱|零花|生活费|资助|支援|借(?:点|钱)?|给我钱|快给钱|掏钱|拿钱出来/.test(input);
}

function isAskingItem(input: string) {
  return /给.*(?:东西|物品|法宝|法器|丹药|药|装备|衣服|食物|水|饭)|给我.*(?:东西|物品|法宝|法器|丹药|药|装备|衣服|食物|水|饭)/.test(
    input
  );
}

function isAskingHelp(input: string) {
  return /帮忙|帮我|帮我.*一下|求助|帮个忙|帮我.*忙/.test(input);
}

function isCommanding(input: string) {
  return /^(?:给我|快给|赶紧|马上|立刻|命令|必须|得|要是不给|不然).{0,20}(?:钱|现金|零花|生活费|东西|物品|法宝|法器|丹药|装备|衣服|食物|水|饭)|^(?:叫|让|命令|要求).{0,20}(?:给|掏|拿)/.test(
    input
  );
}

function isGiving(input: string) {
  return /^(?:给|送|赠|递给).{0,10}(?:爸爸|妈妈|父亲|母亲|家长|老师|师傅|师尊|师兄|师姐|师弟|师妹|朋友|伙伴|同门|路人|陌生人|NPC)?$/.test(
    input
  );
}

function isTrading(input: string) {
  return /(?:换|交易|交换|买卖|出售|卖给|买|购买|换取|用).{0,20}(?:钱|金币|银子|银两|铜板|铜钱|物品|东西|装备|丹药|法宝|材料|资源)|(?:钱|金币|银子|银两|铜板|铜钱|物品|东西|装备|丹药|法宝|材料|资源).{0,10}(?:换|交易|交换|买卖|出售|卖给|买|购买|换取)/.test(
    input
  );
}

function isPolite(input: string) {
  return /(?:请|麻烦|能不能|可以|谢谢|感谢|感激|好心|帮帮忙|求|拜托|请求)/.test(input);
}

function parseRequestedAmount(input: string): number | undefined {
  const match = input.match(
    /(?:要|给|借|零花钱?)[^0-9]{0,8}(\d{1,4})\s*(?:元|块|金币)?|(?:\d{1,4})\s*(?:元|块|金币)/
  );
  const amount = Number(match?.[1] ?? match?.[2]);
  return Number.isInteger(amount) && amount > 0 ? amount : undefined;
}

function getAgeRequestCap(age: number): number {
  if (age <= 3) return 1;
  if (age <= 6) return 2;
  if (age <= 12) return 5;
  if (age <= 15) return 10;
  if (age <= 21) return 15;
  return 20;
}

function getIncomeMultiplier(incomeLevel: number | null | undefined): number {
  if ((incomeLevel ?? 1) <= 0) return 0.7;
  if ((incomeLevel ?? 1) >= 2) return 1.5;
  return 1;
}

function getIntimacyMultiplier(intimacy: number): number {
  if (intimacy < 20) return 0;
  if (intimacy < 50) return 0.75;
  if (intimacy >= 80) return 1.2;
  return 1;
}

function getIntimacyDelta(input: string, intimacy: number): number {
  if (isCommanding(input)) return -1;
  if (isPolite(input)) return intimacy >= 80 ? 2 : 1;
  return 1;
}

function emptyDecision(
  reason: string,
  reasonCode: GiftDecisionCode,
  remainingAllowance: number,
  intimacy = 0
): GiftDecision {
  return { givesGold: 0, givesIntimacyDelta: intimacy, reason, reasonCode, remainingAllowance };
}

export function evaluateActionGift(params: {
  actionId: string;
  freeInput: string | undefined;
  cultivatorAge: number;
  targetFamily?: FamilyAllowanceTarget | null;
  householdIncome?: HouseholdIncome;
  allowanceRemaining?: number;
}): GiftDecision {
  const input = (params.freeInput ?? "").trim();
  const remainingAllowance = Math.max(0, params.allowanceRemaining ?? 0);

  if (!isAskingMoney(input)) {
    return emptyDecision("本次行动不涉及向家人请求零花钱", "NOT_MONEY_REQUEST", remainingAllowance);
  }
  if (params.actionId !== "TALK") {
    return emptyDecision("只有与家人交谈时才能请求零花钱", "INVALID_ACTION", remainingAllowance);
  }

  const target = params.targetFamily;
  if (!target || !isFamilyGuardianRelation(target.relation)) {
    return emptyDecision("未选择可提供零花钱的在世家人", "NO_FAMILY_TARGET", remainingAllowance);
  }
  if (target.intimacy < 20) {
    return emptyDecision(
      "与家人关系过于疏远，对方暂时没有答应",
      "RELATION_TOO_LOW",
      remainingAllowance
    );
  }
  if (isCommanding(input)) {
    return emptyDecision("态度强硬，家人拒绝了这次索要", "RUDE_TONE", remainingAllowance, -1);
  }
  if (remainingAllowance <= 0) {
    return emptyDecision("本年度可支配的零花钱已经用完", "ALLOWANCE_EXHAUSTED", 0);
  }

  const requestedAmount = parseRequestedAmount(input);
  const toneMultiplier = isPolite(input) ? 1.1 : 1;
  const approvedCap = Math.max(
    1,
    Math.floor(
      getAgeRequestCap(params.cultivatorAge) *
        getIncomeMultiplier(params.householdIncome?.incomeLevel ?? target.incomeLevel) *
        getIntimacyMultiplier(target.intimacy) *
        toneMultiplier
    )
  );
  const desired = requestedAmount ?? approvedCap;
  const givesGold = Math.min(desired, approvedCap, remainingAllowance);
  const reasonCode: GiftDecisionCode = givesGold < desired ? "PARTIAL_GRANT" : "GRANTED";
  const reason =
    reasonCode === "PARTIAL_GRANT"
      ? "家人按年龄、家庭经济和本年度剩余额度酌情给了一部分零花钱"
      : "家人结合年龄、家庭经济、关系与请求方式给了适量零花钱";

  return {
    givesGold,
    givesIntimacyDelta: getIntimacyDelta(input, target.intimacy),
    reason,
    reasonCode,
    remainingAllowance: remainingAllowance - givesGold,
  };
}

/** 非金钱互动的轻量关系判定，供保留既有叙事用例。 */
export function evaluateNonMoneyInteraction(
  input: string,
  intimacy = 50
): Pick<GiftDecision, "givesIntimacyDelta" | "reason"> {
  if (isGiving(input))
    return {
      givesIntimacyDelta: intimacy >= 80 ? 3 : 2,
      reason: "主动表达心意，对方可能接受并记下人情",
    };
  if (isTrading(input))
    return {
      givesIntimacyDelta: intimacy >= 70 ? 2 : 1,
      reason: "交易是否成立取决于物品价值与双方意愿",
    };
  if (isAskingItem(input) || isAskingHelp(input))
    return { givesIntimacyDelta: 1, reason: "对方会结合关系与当下情境回应请求" };
  return { givesIntimacyDelta: 0, reason: "" };
}
