// 房产与家具数据。
// 被 src/app/api/properties/route.ts 使用。

export interface PropertyDef {
  type: string;
  name: string;
  price: number;
  rentPrice: number;
  description?: string;
}

export interface FurnitureItem {
  id: string;
  name: string;
  price: number;
  comfort: number;
}

export const PROPERTY_DEFS: PropertyDef[] = [
  {
    type: "apartment",
    name: "蜗居小公寓",
    price: 5000,
    rentPrice: 800,
    description: "城里最小的一间，好歹有个遮风挡雨处。",
  },
  {
    type: "house",
    name: "温馨小院",
    price: 20000,
    rentPrice: 2000,
    description: "带一方小院，可种花养草。",
  },
  {
    type: "villa",
    name: "临湖别墅",
    price: 80000,
    rentPrice: 6000,
    description: "临湖而居，灵气更盛。",
  },
  {
    type: "shop",
    name: "街角商铺",
    price: 30000,
    rentPrice: 3000,
    description: "可做生意，也可囤货。",
  },
  {
    type: "warehouse",
    name: "城郊仓库",
    price: 12000,
    rentPrice: 1200,
    description: "空间巨大，适合存放物资。",
  },
];

export const FURNITURE_ITEMS: FurnitureItem[] = [
  { id: "furniture_desk", name: "书桌", price: 300, comfort: 2 },
  { id: "furniture_bed", name: "软床", price: 500, comfort: 3 },
  { id: "furniture_tea", name: "茶案", price: 400, comfort: 2 },
  { id: "furniture_bonsai", name: "盆景", price: 200, comfort: 1 },
  { id: "furniture_cauldron", name: "小丹炉", price: 1500, comfort: 1 },
];

export function getPropertyDef(type: string): PropertyDef | undefined {
  return PROPERTY_DEFS.find((d) => d.type === type);
}

export function getFurnitureItem(id: string): FurnitureItem | undefined {
  return FURNITURE_ITEMS.find((f) => f.id === id);
}
