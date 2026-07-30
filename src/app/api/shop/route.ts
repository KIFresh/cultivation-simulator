import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getShopItems, getRealmIndex, isRealmSufficient } from "@/lib";
import { requireCultivator } from "@/lib/auth-helpers";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

const MAX_QUANTITY = 99;

interface InventoryEntry {
  itemId: string;
  quantity: number;
  equipped: boolean;
}

function parseInventory(raw: string | null | undefined): InventoryEntry[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function getHandler(request: NextRequest) {
  const realm = new URL(request.url).searchParams.get("realm") || undefined;
  const location = new URL(request.url).searchParams.get("location") || undefined;
  const isMarket = location === "market";

  // 坊市（market）展示全部商品；普通商店展示所有商品但标注锁定状态
  const allItems = getShopItems(); // 不传 realm 获取全部
  const items = allItems.map((item) => {
    const locked =
      !isMarket && item.minRealm && realm ? !isRealmSufficient(realm, item.minRealm) : false;
    return {
      ...item,
      locked,
      lockReason: locked ? `需要 ${item.minRealm}` : undefined,
    };
  });

  return NextResponse.json({ items });
}

async function postHandler(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;

    const { cultivator: c } = auth;
    const body = await parseJsonBody(request);
    const { itemId, quantity = 1 } = body;

    if (!itemId) return NextResponse.json({ error: "缺少商品 ID" }, { status: 400 });
    const qty = Math.floor(Number(quantity));
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QUANTITY) {
      return NextResponse.json({ error: `数量无效（1-${MAX_QUANTITY}）` }, { status: 400 });
    }

    const isMarket = c.location === "market";
    // 坊市可越境购买；普通商店按境界过滤
    const shopItem = (isMarket ? getShopItems() : getShopItems(c.realm)).find(
      (s) => s.itemId === itemId
    );
    if (!shopItem) return NextResponse.json({ error: "商品不存在或境界不足" }, { status: 400 });
    if (!isMarket && shopItem.minRealm && !isRealmSufficient(c.realm, shopItem.minRealm)) {
      return NextResponse.json({ error: "境界不足，无法购买此商品" }, { status: 400 });
    }

    const totalCost = shopItem.price * qty;
    if ((c.gold ?? 0) < totalCost) {
      return NextResponse.json(
        { error: `金币不足，需要${totalCost}，当前${c.gold ?? 0}` },
        { status: 400 }
      );
    }

    // 读取当前背包，合并新物品
    const inv = parseInventory(c.inventory);
    const existing = inv.find((entry) => entry.itemId === itemId);
    if (existing) {
      existing.quantity += qty;
    } else {
      inv.push({ itemId, quantity: qty, equipped: false });
    }

    // 乐观锁：在事务内二次校验金币
    const [updated] = await prisma.$transaction([
      prisma.cultivator.update({
        where: { id: c.id, gold: c.gold }, // 乐观锁：gold 未变化才更新
        data: {
          gold: { decrement: totalCost },
          inventory: JSON.stringify(inv),
        },
      }),
    ]);

    return NextResponse.json({
      cultivator: updated,
      item: shopItem.item,
      quantity: qty,
      totalCost,
    });
  } catch (error) {
    logger.error("购买失败:", error);
    return NextResponse.json({ error: "购买失败" }, { status: 500 });
  }
}

export const GET = withApiErrorHandling(getHandler);
export const POST = withApiErrorHandling(postHandler);
