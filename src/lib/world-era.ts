export const CAREER_CATEGORIES = [
  "agriculture",
  "manufacturing",
  "education",
  "healthcare",
  "public_service",
  "business",
  "service",
  "freelance",
] as const;

export type CareerCategory = (typeof CAREER_CATEGORIES)[number];
export type WorldEraKey = "contemporary" | "digital" | "automation";

export interface WorldEra {
  key: WorldEraKey;
  label: string;
  startYear: number;
  incomeMultiplier: number;
  careerWeights: Partial<Record<CareerCategory, number>>;
}

const DEFAULT_WORLD_YEAR = 2025;

const WORLD_ERAS: readonly WorldEra[] = [
  {
    key: "contemporary",
    label: "现代都市",
    startYear: 2025,
    incomeMultiplier: 1,
    careerWeights: {},
  },
  {
    key: "digital",
    label: "数字转型",
    startYear: 2040,
    incomeMultiplier: 1.05,
    careerWeights: { manufacturing: 0.95, education: 1.05, healthcare: 1.05, business: 1.1 },
  },
  {
    key: "automation",
    label: "智能协同",
    startYear: 2055,
    incomeMultiplier: 1.1,
    careerWeights: {
      manufacturing: 0.9,
      education: 1.1,
      healthcare: 1.1,
      business: 1.15,
      freelance: 1.1,
    },
  },
];

export function normalizeWorldYear(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= DEFAULT_WORLD_YEAR
    ? value
    : DEFAULT_WORLD_YEAR;
}

export function getWorldEra(worldYear: number): WorldEra {
  const normalizedYear = normalizeWorldYear(worldYear);
  const era =
    [...WORLD_ERAS].reverse().find((candidate) => normalizedYear >= candidate.startYear) ??
    WORLD_ERAS[0];

  return { ...era, careerWeights: { ...era.careerWeights } };
}
