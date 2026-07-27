// 秘境钥匙：以灵石灵草为门票，入秘境搏灵草、残页与机缘。
// 该模块对应的 API 路由由其他流程维护；此处提供自洽数据。

export interface SecretRealm {
  id: string;
  name: string;
  desc: string;
  minAge: number;
  ticketCost: { stones: number; grass: number };
  rewards: string[];
}

export const SECRET_REALMS: SecretRealm[] = [
  {
    id: "realm_mist",
    name: "雾隐谷",
    desc: "终年白雾，传闻谷底有灵泉。",
    minAge: 8,
    ticketCost: { stones: 5, grass: 10 },
    rewards: ["灵草", "残页", "灵泉露"],
  },
  {
    id: "realm_flame",
    name: "熔火洞",
    desc: "地火熊熊，宜炼器淬体。",
    minAge: 12,
    ticketCost: { stones: 10, grass: 5 },
    rewards: ["玄铁", "火属残页", "火精"],
  },
  {
    id: "realm_star",
    name: "星陨原",
    desc: "夜可见陨星划落，藏着天外之物。",
    minAge: 14,
    ticketCost: { stones: 20, grass: 20 },
    rewards: ["星铁", "高阶残页", "星髓"],
  },
];

export function getSecretRealmById(id: string): SecretRealm | undefined {
  return SECRET_REALMS.find((r) => r.id === id);
}

/** 按年龄从可达秘境里摇一个（确定性：同 seed 同结果）。 */
export function rollSecretRealm(age: number, seed: string): SecretRealm | null {
  const reachable = SECRET_REALMS.filter((r) => r.minAge <= age);
  if (reachable.length === 0) return null;
  const idx = Math.abs(hashCode(`${seed}|${age}`)) % reachable.length;
  return reachable[idx];
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}
