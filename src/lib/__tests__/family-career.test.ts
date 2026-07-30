import { describe, expect, it } from "vitest";
import {
  CAREER_CATEGORIES,
  calculateHouseholdIncome,
  evolveFamilyCareer,
  getCareerDisplayName,
  getIncomeLevel,
  initializeFamilyCareer,
  isFamilyGuardianRelation,
  type FamilyCareer,
} from "../family-career";

describe("family career rules", () => {
  it.each(CAREER_CATEGORIES)(
    "provides a valid name and income for %s at every level",
    (category) => {
      for (const level of [0, 1, 2, 3, 4]) {
        const career = initializeFamilyCareer({
          relation: "父亲",
          age: 40,
          worldYear: 2025,
          familyBackground: 2,
          categoryHint: category,
          levelHint: level,
        });

        expect(getCareerDisplayName(category, level, 2025)).not.toHaveLength(0);
        expect(career.monthlyIncome).toBeGreaterThan(0);
        expect(
          getIncomeLevel(career.monthlyIncome, { contributingMembers: 1 })
        ).toBeGreaterThanOrEqual(0);
        expect(career.incomeLevel).toBeLessThanOrEqual(4);
      }
    }
  );

  it("initializes wealthier backgrounds with no less income than ordinary and struggling ones", () => {
    const input = {
      relation: "母亲",
      age: 38,
      worldYear: 2025,
      categoryHint: "education" as const,
    };
    const struggling = initializeFamilyCareer({ ...input, familyBackground: 0 });
    const ordinary = initializeFamilyCareer({ ...input, familyBackground: 2 });
    const wealthy = initializeFamilyCareer({ ...input, familyBackground: 4 });

    expect(ordinary.monthlyIncome).toBeGreaterThanOrEqual(struggling.monthlyIncome);
    expect(wealthy.monthlyIncome).toBeGreaterThanOrEqual(ordinary.monthlyIncome);
  });

  it("evolves the same career identically for the same seed and year", () => {
    const career = initializeFamilyCareer({
      relation: "父亲",
      age: 42,
      worldYear: 2025,
      familyBackground: 2,
    });
    const input = { career, memberAge: 42, worldYear: 2030, seed: "cultivator-1|father-1|2030" };

    expect(evolveFamilyCareer(input)).toEqual(evolveFamilyCareer(input));
  });

  it("keeps minors unemployed, retires people at 65, and excludes deceased members", () => {
    const minor = initializeFamilyCareer({ relation: "父亲", age: 17, worldYear: 2025 });
    const retired = evolveFamilyCareer({
      career: initializeFamilyCareer({ relation: "母亲", age: 64, worldYear: 2025 }),
      memberAge: 65,
      worldYear: 2026,
      seed: "cultivator-1|mother-1|2026",
    });
    const deceased: FamilyCareer = {
      ...retired,
      alive: false,
      careerStatus: "employed",
      monthlyIncome: 9999,
    };

    expect(minor.careerStatus).toBe("unemployed");
    expect(minor.monthlyIncome).toBe(0);
    expect(retired.careerStatus).toBe("retired");
    expect(retired.monthlyIncome).toBe(0);
    expect(calculateHouseholdIncome([deceased])).toMatchObject({
      monthlyIncome: 0,
      contributingMembers: 0,
    });
  });

  it("changes income at the 2039 to 2040 era boundary without making it negative", () => {
    const base = initializeFamilyCareer({
      relation: "父亲",
      age: 40,
      worldYear: 2039,
      categoryHint: "business",
      levelHint: 2,
    });
    const in2039 = evolveFamilyCareer({
      career: base,
      memberAge: 40,
      worldYear: 2039,
      seed: "cultivator-1|father-1|2039",
    });
    const in2040 = evolveFamilyCareer({
      career: base,
      memberAge: 40,
      worldYear: 2040,
      seed: "cultivator-1|father-1|2040",
    });

    expect(in2040.monthlyIncome).not.toBe(in2039.monthlyIncome);
    expect(in2040.monthlyIncome).toBeGreaterThanOrEqual(0);
  });

  it("normalizes parent aliases and guardians as family guardians", () => {
    expect(isFamilyGuardianRelation("父亲")).toBe(true);
    expect(isFamilyGuardianRelation("爸爸")).toBe(true);
    expect(isFamilyGuardianRelation("母亲")).toBe(true);
    expect(isFamilyGuardianRelation("妈妈")).toBe(true);
    expect(isFamilyGuardianRelation("监护人")).toBe(true);
    expect(isFamilyGuardianRelation("姐姐")).toBe(false);
  });

  it("aggregates only living employed parents and guardians", () => {
    const employed = (relation: string, income: number): FamilyCareer => ({
      relation,
      age: 40,
      alive: true,
      careerCategory: "service",
      careerLevel: 1,
      careerStatus: "employed",
      monthlyIncome: income,
      incomeLevel: 1,
      careerUpdatedYear: 2025,
    });
    const child = employed("姐姐", 1000);
    const deceasedParent = { ...employed("父亲", 2000), alive: false };

    expect(calculateHouseholdIncome([employed("母亲", 3000)])).toMatchObject({
      monthlyIncome: 3000,
      contributingMembers: 1,
    });
    expect(
      calculateHouseholdIncome([employed("父亲", 2000), employed("母亲", 3000)])
    ).toMatchObject({ monthlyIncome: 5000, contributingMembers: 2 });
    expect(calculateHouseholdIncome([employed("监护人", 4000), child])).toMatchObject({
      monthlyIncome: 4000,
      contributingMembers: 1,
    });
    expect(
      calculateHouseholdIncome([employed("爸爸", 2000), employed("妈妈", 3000)])
    ).toMatchObject({ monthlyIncome: 5000, contributingMembers: 2 });
    expect(calculateHouseholdIncome([deceasedParent, child])).toMatchObject({
      monthlyIncome: 0,
      contributingMembers: 0,
    });
  });
});
