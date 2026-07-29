import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";

interface RealmReward {
  attr?: string;
  value?: number;
  gold?: number;
  item?: string;
}

interface SecretRealm {
  id: string;
  name: string;
  danger: string;
  desc: string;
  reqRealm: string;
  reward: RealmReward;
}

const REALMS: SecretRealm[] = [
  {
    id: "whisper_cave",
    name: "低语洞天",
    danger: "低",
    desc: "洞中灵气充沛，偶有前人遗泽。",
    reqRealm: "凡人",
    reward: { attr: "spirit", value: 5, gold: 10 },
  },
  {
    id: "sword_graveyard",
    name: "万剑冢",
    danger: "中",
    desc: "剑意纵横，唯根骨坚者可取剑心。",
    reqRealm: "炼气期",
    reward: { attr: "root", value: 6, item: "spirit_sword" },
  },
  {
    id: "immortal_pond",
    name: "瑶池仙泉",
    danger: "高",
    desc: "泉眼通灵，凶兽环伺，机缘与凶险并存。",
    reqRealm: "筑基期",
    reward: { attr: "insight", value: 8, gold: 50 },
  },
];

const REALM_ORDER = ["凡人", "炼气期", "筑基期", "金丹期", "元婴期", "化神期"];

function realmIndex(realm: string): number {
  const i = REALM_ORDER.indexOf(realm);
  return i < 0 ? 0 : i;
}

// GET — 列出可探索的秘境
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const accessible = REALMS.filter(
      (r) => realmIndex(r.reqRealm) <= realmIndex(cultivator.realm),
    );

    return NextResponse.json({ realms: accessible, unlockedLocations: cultivator.unlockedLocations });
  } catch (error) {
    console.error("获取秘境失败:", error);
    return NextResponse.json({ error: "获取秘境失败" }, { status: 500 });
  }
}

// POST — 探索秘境
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const body = await request.json();
    const realm = REALMS.find((r) => r.id === body?.realmId);
    if (!realm) {
      return NextResponse.json({ error: "未找到该秘境" }, { status: 404 });
    }
    if (realmIndex(realm.reqRealm) > realmIndex(cultivator.realm)) {
      return NextResponse.json({ error: "修为不足，无法进入该秘境", success: false }, { status: 400 });
    }
    if (cultivator.stamina < 10) {
      return NextResponse.json({ error: "体力不足，无法探索", success: false }, { status: 400 });
    }

    const dangerLevel = realm.danger === "高" ? 0.4 : realm.danger === "中" ? 0.6 : 0.8;
    const success = Math.random() < dangerLevel;

    let attrs: Record<string, number> = {};
    if (cultivator.attributes) {
      try {
        attrs = JSON.parse(cultivator.attributes);
      } catch {
        attrs = {};
      }
    }

    let inventory: { itemId: string; quantity: number; equipped: boolean }[] = [];
    if (cultivator.inventory) {
      try {
        inventory = JSON.parse(cultivator.inventory);
      } catch {
        inventory = [];
      }
    }

    let goldChange = 0;
    let gainedAttr: { attr: string; before: number; after: number } | null = null;

    if (success && realm.reward) {
      if (realm.reward.attr && realm.reward.value) {
        const before = attrs[realm.reward.attr] ?? 0;
        attrs[realm.reward.attr] = before + realm.reward.value;
        gainedAttr = { attr: realm.reward.attr, before, after: attrs[realm.reward.attr] };
      }
      if (realm.reward.gold) goldChange += realm.reward.gold;
      if (realm.reward.item) {
        const existing = inventory.find((s) => s.itemId === realm.reward.item);
        if (existing) existing.quantity += 1;
        else inventory.push({ itemId: realm.reward.item as string, quantity: 1, equipped: false });
      }

      await prisma.cultivator.update({
        where: { id: cultivator.id },
        data: {
          stamina: { decrement: 10 },
          attributes: JSON.stringify(attrs),
          gold: goldChange ? { increment: goldChange } : undefined,
          inventory: JSON.stringify(inventory),
        },
      });

      return NextResponse.json({
        success: true,
        realm: realm.name,
        outcome: "success",
        message: `你在${realm.name}中有所收获！`,
        gainedAttr,
        goldGained: goldChange,
        item: realm.reward.item ?? null,
      });
    }

    await prisma.cultivator.update({
      where: { id: cultivator.id },
      data: { stamina: { decrement: 10 } },
    });

    return NextResponse.json({
      success: true,
      realm: realm.name,
      outcome: "fail",
      message: `探索${realm.name}遭遇不测，只得空手而返。`,
      gainedAttr: null,
      goldGained: 0,
      item: null,
    });
  } catch (error) {
    console.error("探索秘境失败:", error);
    return NextResponse.json({ error: "探索秘境失败" }, { status: 500 });
  }
}
