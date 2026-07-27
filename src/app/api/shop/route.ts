import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getShopItems } from "@/lib";


interface InventoryEntry {
  itemId: string;
  quantity: number;
  equipped: boolean;
}

function parseInventory(raw: string | null | undefined): InventoryEntry[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function GET(request: NextRequest) {
  const realm = new URL(request.url).searchParams.get("realm") || undefined;
  const location = new URL(request.url).searchParams.get("location") || undefined;
  // 坊市（market）允许展示/购买高于当前境界的商品（越阶购买路径）
  const items = location === "market" ? getShopItems() : getShopItems(realm);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, itemId, quantity = 1 } = body;
    if (!userId || !itemId) return NextResponse.json({ error: "缺少必填参数" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { cultivator: true } });
    if (!user?.cultivator) return NextResponse.json({ error: "请先创建修炼者" }, { status: 400 });

    const c = user.cultivator;
    const isMarket = c.location === "market";
    const shopItem = (isMarket ? getShopItems() : getShopItems(c.realm)).find((s) => s.itemId === itemId);
    if (!shopItem) return NextResponse.json({ error: "商品不存在或境界不足" }, { status: 400 });
    const totalCost = shopItem.price * quantity;
    if ((c.gold ?? 0) < totalCost) return NextResponse.json({ error: `金币不足，需要${totalCost}，当前${c.gold ?? 0}` }, { status: 400 });

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
        },
      }),
    ]);

    return NextResponse.json({ cultivator: updated, item: shopItem.item, quantity, totalCost });
  } catch (error) {
    console.error("购买失败:", error);
    return NextResponse.json({ error: "购买失败" }, { status: 500 });
  }
}