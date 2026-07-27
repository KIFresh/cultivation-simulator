import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator, apiError } from "@/lib/auth-helpers";
import { parseInventory, hasItemById } from "@/lib/inventory-utils";
import {
  parseSpiritPets,
  hatchPet,
  upgradeCost,
  upkeepCost,
  MAX_PET_LEVEL,
  HATCH_COST_STONE,
  consumeInventoryItem,
} from "@/lib/spirit-pet";

function grassCount(inv: { itemId: string; quantity?: number }[]): number {
  return inv.find((i) => i.itemId === "spirit_grass")?.quantity ?? 0;
}

// GET：当前灵宠列表 + 资源概览 + 各级成本
export async function GET(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const c = auth.cultivator as any;
    const pets = parseSpiritPets(c.petState);
    const inv = parseInventory(c.inventory);
    return NextResponse.json({
      pets,
      hasEgg: hasItemById(inv, "pet_egg"),
      spiritStoneLow: c.spiritStoneLow ?? 0,
      spiritStoneMid: c.spiritStoneMid ?? 0,
      grass: grassCount(inv),
      maxLevel: MAX_PET_LEVEL,
      hatchCost: HATCH_COST_STONE,
      upkeepCosts: pets.map((p) => ({ petId: p.id, level: p.level, cost: upkeepCost(p.level) })),
      upgradeCosts: pets.map((p) => ({
        petId: p.id,
        level: p.level,
        cost: p.level < MAX_PET_LEVEL ? upgradeCost(p.level) : null,
      })),
    });
  } catch {
    return NextResponse.json({ error: "无法加载灵宠" }, { status: 500 });
  }
}

// POST：hatch（孵化）/ upgrade（培育升级）/ upkeep（手动养护）
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const c = auth.cultivator as any;
    const body = await request.json().catch(() => ({}));
    const action = body.action as string;
    const pets = parseSpiritPets(c.petState);
    const inv = parseInventory(c.inventory);
    const low = c.spiritStoneLow ?? 0;
    const mid = c.spiritStoneMid ?? 0;
    const grass = grassCount(inv);

    if (action === "hatch") {
      if (!hasItemById(inv, "pet_egg")) return apiError("没有灵宠蛋");
      if (low < HATCH_COST_STONE.amount) return apiError("下品灵石不足（需20）");
      const nextInv = consumeInventoryItem(inv, "pet_egg", 1);
      if (!nextInv) return apiError("灵宠蛋扣除失败");
      const pet = hatchPet(body.name);
      const nextPets = [...pets, pet];
      const updated = await prisma.cultivator.update({
        where: { id: c.id },
        data: {
          inventory: JSON.stringify(nextInv),
          spiritStoneLow: { decrement: HATCH_COST_STONE.amount },
          petState: JSON.stringify(nextPets),
        },
      });
      return NextResponse.json({ ok: true, pet, pets: parseSpiritPets(updated.petState) });
    }

    if (action === "upgrade") {
      const pet = pets.find((p) => p.id === body.petId);
      if (!pet) return apiError("灵宠不存在");
      if (pet.level >= MAX_PET_LEVEL) return apiError("已达最高等级");
      const cost = upgradeCost(pet.level);
      if (mid < cost.mid) return apiError("中品灵石不足");
      if (grass < cost.grass) return apiError("灵草不足");
      const nextInv = consumeInventoryItem(inv, "spirit_grass", cost.grass);
      if (!nextInv) return apiError("灵草扣除失败");
      const nextPets = pets.map((p) => (p.id === pet.id ? { ...p, level: p.level + 1 } : p));
      const updated = await prisma.cultivator.update({
        where: { id: c.id },
        data: {
          inventory: JSON.stringify(nextInv),
          spiritStoneMid: { decrement: cost.mid },
          petState: JSON.stringify(nextPets),
        },
      });
      return NextResponse.json({ ok: true, pets: parseSpiritPets(updated.petState) });
    }

    if (action === "upkeep") {
      if (pets.length === 0) return apiError("没有灵宠");
      let needLow = 0;
      let needGrass = 0;
      for (const p of pets) {
        const cc = upkeepCost(p.level);
        needLow += cc.low;
        needGrass += cc.grass;
      }
      if (low < needLow) return apiError("下品灵石不足");
      if (grass < needGrass) return apiError("灵草不足");
      const nextInv = consumeInventoryItem(inv, "spirit_grass", needGrass);
      if (!nextInv) return apiError("灵草扣除失败");
      const nextPets = pets.map((p) => ({ ...p, skipQuarters: 0, state: "active" as const }));
      const updated = await prisma.cultivator.update({
        where: { id: c.id },
        data: {
          inventory: JSON.stringify(nextInv),
          spiritStoneLow: { decrement: needLow },
          petState: JSON.stringify(nextPets),
        },
      });
      return NextResponse.json({ ok: true, pets: parseSpiritPets(updated.petState) });
    }

    return apiError("未知操作");
  } catch {
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
