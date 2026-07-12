import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getShopItems, getItemById } from "@/lib";
import { Prisma } from "@/generated/prisma/client";

interface InventoryEntry {
  itemId: string;
  quantity: number;
  equipped: boolean;
}

function parseInventory(raw: string | null | undefined): InventoryEntry[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function GET() {
  return NextResponse.json({ items: getShopItems() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, itemId, quantity = 1 } = body;
    if (!userId || !itemId) return NextResponse.json({ error: "缺少必填参数" }, { status: 400 });

    const shopItem = getShopItems().find((s) => s.itemId === itemId);
    if (!shopItem) return NextResponse.json({ error: "商品不存在" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { cultivator: true } });
    if (!user?.cultivator) return NextResponse.json({ error: "请先创建修炼者" }, { status: 400 });

    const c = user.cultivator;
    const totalCost = shopItem.price * quantity;
    if ((c.gold ?? 50) < totalCost) return NextResponse.json({ error: `金币不足，需要${totalCost}，当前${c.gold ?? 50}` }, { status: 400 });

    // 读取当前背包，合并新物品
    const inv = parseInventory(c.inventory);
    const existing = inv.find((entry) => entry.itemId === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      inv.push({ itemId, quantity, equipped: false });
    }

    // 更新金币和背包
    const [updated] = await prisma.$transaction([
      prisma.cultivator.update({
        where: { id: c.id },
        data: {
          gold: { decrement: totalCost },
          inventory: JSON.stringify(inv),
        } as Prisma.CultivatorUpdateInput,
      }),
    ]);

    return NextResponse.json({ cultivator: updated, item: shopItem.item, quantity, totalCost });
  } catch (error) {
    console.error("购买失败:", error);
    return NextResponse.json({ error: "购买失败" }, { status: 500 });
  }
}