import { evaluateActionGift } from "@/lib/action-gifts";
import type { HouseholdIncome } from "@/lib/family-career";

const mother = { id: "mother-1", name: "赵母", relation: "母亲", intimacy: 70, incomeLevel: 1 };

function askMoney(overrides: Partial<Parameters<typeof evaluateActionGift>[0]> = {}) {
  return evaluateActionGift({
    actionId: "TALK",
    freeInput: "妈妈，请给我一点零花钱，谢谢",
    cultivatorAge: 10,
    targetFamily: mother,
    allowanceRemaining: 30,
    ...overrides,
  });
}

describe("evaluateActionGift - 家人零花钱", () => {
  it("合格的年幼请求至少获得 1 金，不会因向下取整归零", () => {
    const result = askMoney({ cultivatorAge: 4, targetFamily: { ...mother, intimacy: 20, incomeLevel: 0 }, allowanceRemaining: 10 });
    expect(result.givesGold).toBeGreaterThanOrEqual(1);
    expect(result.reasonCode).toBe("GRANTED");
  });

  it("按年龄、收入和亲密度增加可发金额", () => {
    const young = askMoney({ cultivatorAge: 6, targetFamily: { ...mother, intimacy: 50, incomeLevel: 1 } });
    const olderAndWealthier = askMoney({ cultivatorAge: 15, targetFamily: { ...mother, intimacy: 90, incomeLevel: 2 } });
    expect(olderAndWealthier.givesGold).toBeGreaterThan(young.givesGold);
  });

  it("明确要求高额时受单次上限和年度余额限制", () => {
    const result = askMoney({ freeInput: "妈妈，请给我100元零花钱，谢谢", allowanceRemaining: 3 });
    expect(result.givesGold).toBe(3);
    expect(result.reasonCode).toBe("PARTIAL_GRANT");
    expect(result.remainingAllowance).toBe(0);
  });

  it("幼儿在合格条件下获得象征性零花钱，关系极差、粗暴语气和额度耗尽会拒绝", () => {
    expect(askMoney({ cultivatorAge: 3 }).givesGold).toBeGreaterThanOrEqual(1);
    expect(askMoney({ targetFamily: { ...mother, intimacy: 19 } }).reasonCode).toBe("RELATION_TOO_LOW");
    expect(askMoney({ freeInput: "快给我钱" }).reasonCode).toBe("RUDE_TONE");
    expect(askMoney({ allowanceRemaining: 0 }).reasonCode).toBe("ALLOWANCE_EXHAUSTED");
  });

  it("父母别名和监护人都能发放零花钱，非家人不能", () => {
    expect(askMoney({ targetFamily: { ...mother, relation: "爸爸" } }).reasonCode).toBe("GRANTED");
    expect(askMoney({ targetFamily: { ...mother, relation: "妈妈" } }).reasonCode).toBe("GRANTED");
    expect(askMoney({ targetFamily: { ...mother, relation: "监护人" } }).reasonCode).toBe("GRANTED");
    expect(askMoney({ targetFamily: { ...mother, relation: "同学" } }).reasonCode).toBe("NO_FAMILY_TARGET");
    expect(askMoney({ actionId: "MEDITATE" }).reasonCode).toBe("INVALID_ACTION");
  });

  it("索要上限采用统一 HouseholdIncome 档位而不信任目标家人的收入", () => {
    const household: HouseholdIncome = { monthlyIncome: 9000, contributingMembers: 2, incomeLevel: 2 };
    const result = askMoney({
      targetFamily: { ...mother, incomeLevel: 0 },
      householdIncome: household,
      allowanceRemaining: 30,
    });
    expect(result.givesGold).toBe(8);
  });
});
