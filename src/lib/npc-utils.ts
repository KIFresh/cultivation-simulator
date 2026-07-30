/**
 * NPC 工具函数：合并家庭成员与地点 NPC，按 name/relation 去重。
 * 返回的每个条目包含稳定 _key 字段供 React 渲染使用。
 */

export interface NpcLike {
  id?: string;
  name: string;
  relation?: string;
  locationId?: string;
  avatar?: string;
  age?: number;
  [key: string]: unknown;
}

export type MergedNpc<T extends NpcLike, U extends NpcLike> =
  | (T & { _src: "family"; _key: string })
  | (U & { _src: "location"; _key: string });

/**
 * 合并家庭成员与地点 NPC，家庭成员优先，同名/同关系的地点 NPC 自动隐藏。
 * 每个返回条目包含稳定 `_key` 字段供 React key 使用。
 *
 * - 家庭成员 key 格式：`family-${id || name || relation}`
 * - 地点 NPC key 格式：`location-${name || locationId}`，同名时追加 `-1`、`-2` 后缀
 */
export function mergeNpcs<T extends NpcLike, U extends NpcLike>(
  familyMembers: T[],
  currentNPCs: U[],
): MergedNpc<T, U>[] {
  const familyNames = new Set(
    (familyMembers ?? []).map((fm) => fm.name).filter(Boolean),
  );
  const familyRelations = new Set(
    (familyMembers ?? []).map((fm) => fm.relation).filter(Boolean),
  );

  const result: MergedNpc<T, U>[] = (familyMembers ?? []).map((fm, idx) => ({
    ...fm,
    avatar: fm.avatar ?? "👤",
    _src: "family" as const,
    _key: `family-${fm.id || fm.name || fm.relation || "unknown"}`,
  }));

  const seenLocationKeys = new Map<string, number>();

  for (const npc of currentNPCs ?? []) {
    // 跳过：与家庭成员同名、或名称/关系与家庭关系冲突
    if (familyNames.has(npc.name)) continue;
    if (familyRelations.has(npc.name)) continue;
    if (npc.relation && familyRelations.has(npc.relation)) continue;

    let baseKey = `location-${npc.name || npc.locationId || "unknown"}`;
    const count = seenLocationKeys.get(baseKey) ?? 0;
    const key = count > 0 ? `${baseKey}-${count}` : baseKey;
    seenLocationKeys.set(baseKey, count + 1);

    result.push({
      ...npc,
      avatar: npc.avatar ?? "👤",
      _src: "location" as const,
      _key: key,
    });
  }

  return result;
}