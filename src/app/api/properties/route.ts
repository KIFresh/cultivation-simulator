import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PROPERTY_DEFS } from "@/lib/property-data";
import { requireCultivator, apiError } from "@/lib/auth-helpers";
import { json } from "@/lib/json-helper";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) return apiError("缺少 userId", 400);
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ properties: json.properties(auth.cultivator.properties), defs: PROPERTY_DEFS });
}

async function postHandler(request: NextRequest) {
    const body = await parseJsonBody(request);
    const { userId, action, propertyId, propertyType, furnitureId } = body;
    if (!userId || !action) return apiError("缺少参数", 400);

    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const c = auth.cultivator;
    let props: any[] = json.properties(c.properties);

    switch (action) {
      case "buy": {
        const def = PROPERTY_DEFS.find((d) => d.type === propertyType);
        if (!def) return apiError("房产类型不存在", 400);
        if ((c.gold ?? 0) < def.price) return apiError("金币不足", 400);
        const newProp = { id: `prop_${Date.now()}`, type: def.type, name: def.name, owned: true, selfLiving: false, rented: false, rentPrice: def.rentPrice, furniture: [] };
        props.push(newProp);
        await prisma.cultivator.update({ where: { id: c.id }, data: { properties: JSON.stringify(props), gold: { decrement: def.price } } });
        return NextResponse.json({ success: true, properties: props });
      }
      case "sell": {
        const idx = props.findIndex((p: any) => p.id === propertyId);
        if (idx === -1) return apiError("该资产不存在", 400);
        const def = PROPERTY_DEFS.find((d) => d.type === props[idx].type);
        const sellPrice = def ? Math.floor(def.price * 0.6) : 0;
        props.splice(idx, 1);
        await prisma.cultivator.update({ where: { id: c.id }, data: { properties: JSON.stringify(props), gold: { increment: sellPrice } } });
        return NextResponse.json({ success: true, properties: props, goldChange: sellPrice });
      }
      case "place_furniture": {
        const prop = props.find((p: any) => p.id === propertyId);
        if (!prop) return apiError("该房产不存在", 400);
        if (!prop.selfLiving) return apiError("只有自己居住的房产才能放置家具", 400);
        if (!furnitureId) return apiError("缺少家具 ID", 400);
        if (prop.furniture.includes(furnitureId)) return apiError("该家具已放置", 400);
        prop.furniture.push(furnitureId);
        await prisma.cultivator.update({ where: { id: c.id }, data: { properties: JSON.stringify(props) } });
        return NextResponse.json({ success: true, properties: props });
      }
      case "toggle_rent": {
        const prop = props.find((p: any) => p.id === propertyId);
        if (!prop) return apiError("该房产不存在", 400);
        if (prop.selfLiving) return apiError("自己居住的房产不能出租", 400);
        prop.rented = !prop.rented;
        await prisma.cultivator.update({ where: { id: c.id }, data: { properties: JSON.stringify(props) } });
        return NextResponse.json({ success: true, properties: props });
      }
      case "move_in": {
        const prop = props.find((p: any) => p.id === propertyId);
        if (!prop) return apiError("该房产不存在", 400);
        // 迁出当前居住的房产
        props.forEach((p: any) => { if (p.selfLiving) p.selfLiving = false; });
        prop.selfLiving = true;
        prop.rented = false;
        await prisma.cultivator.update({ where: { id: c.id }, data: { properties: JSON.stringify(props) } });
        return NextResponse.json({ success: true, properties: props });
      }
      default:
        return apiError("未知操作", 400);
    }
}

export const POST = withApiErrorHandling(postHandler);