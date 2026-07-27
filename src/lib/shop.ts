// 地点商铺：不同地点售卖不同货色。
// 被 src/app/api/__tests__/shop.test.ts（getShopItemsForLocation）使用；
// 也供 src/app/api/shop/route.ts（getShopItems）引用。

export interface ShopItem {
  itemId: string;
  price: number;
  item: { id: string; name: string; type: string };
  location: string;
}

const SHOP_CATALOG: ShopItem[] = [
  {
    itemId: "herb_qi",
    price: 10,
    location: "general",
    item: { id: "herb_qi", name: "聚气草", type: "herb" },
  },
  {
    itemId: "spirit_grass",
    price: 25,
    location: "general",
    item: { id: "spirit_grass", name: "灵草", type: "herb" },
  },
  {
    itemId: "pet_egg",
    price: 200,
    location: "general",
    item: { id: "pet_egg", name: "灵宠蛋", type: "egg" },
  },
  {
    itemId: "snack",
    price: 5,
    location: "market",
    item: { id: "snack", name: "糖葫芦", type: "food" },
  },
  {
    itemId: "toy",
    price: 15,
    location: "market",
    item: { id: "toy", name: "竹蜻蜓", type: "toy" },
  },
  {
    itemId: "ore_iron",
    price: 40,
    location: "mountain",
    item: { id: "ore_iron", name: "玄铁", type: "ore" },
  },
  {
    itemId: "water_dew",
    price: 8,
    location: "mountain",
    item: { id: "water_dew", name: "晨露", type: "herb" },
  },
];

export function getShopItems(): ShopItem[] {
  return SHOP_CATALOG;
}

/** 返回某地点在售的商品；无专属货色时回落到通用货架。 */
export function getShopItemsForLocation(locationId: string): ShopItem[] {
  const at = SHOP_CATALOG.filter((s) => s.location === locationId);
  if (at.length > 0) return at;
  return SHOP_CATALOG.filter((s) => s.location === "general");
}
