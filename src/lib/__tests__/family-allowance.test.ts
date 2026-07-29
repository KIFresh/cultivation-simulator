import { calculateAnnualFamilyAllowance } from "@/lib/family-allowance";
import type { HouseholdIncome } from "@/lib/family-career";

describe("calculateAnnualFamilyAllowance", () => {
  it("按年龄、最高家庭收入与平均亲密度生成年度额度", () => {
    expect(calculateAnnualFamilyAllowance(10, [
      { intimacy: 50, incomeLevel: 1 },
      { intimacy: 90, incomeLevel: 2 },
    ])).toBe(36);
  });

  it("没有在世监护人时不生成额度，幼儿在亲密且宽裕家庭可有象征性额度", () => {
    expect(calculateAnnualFamilyAllowance(10, [])).toBe(0);
    expect(calculateAnnualFamilyAllowance(3, [{ intimacy: 90, incomeLevel: 2 }])).toBeGreaterThanOrEqual(1);
  });

  it("低收入家庭的年度额度更低", () => {
    const lowIncome = calculateAnnualFamilyAllowance(12, [{ intimacy: 60, incomeLevel: 0 }]);
    const standard = calculateAnnualFamilyAllowance(12, [{ intimacy: 60, incomeLevel: 1 }]);
    expect(lowIncome).toBeLessThan(standard);
  });

  it("使用统一 HouseholdIncome 档位而非单个家人的旧收入", () => {
    const household: HouseholdIncome = { monthlyIncome: 9000, contributingMembers: 2, incomeLevel: 2 };
    expect(calculateAnnualFamilyAllowance(12, [{ intimacy: 60, incomeLevel: 0 }], household))
      .toBe(calculateAnnualFamilyAllowance(12, [{ intimacy: 60, incomeLevel: 2 }], household));
  });
});
