import { openDB } from "idb";

const DB_NAME = "cultivation-cache";
const STORE_NAME = "cultivator";
const CACHE_VERSION = 1;

export async function getCachedCultivator(userId: string) {
  try {
    const db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      },
    });
    const result = await db.get(STORE_NAME, userId);
    if (!result) return null;
    if (result.version !== CACHE_VERSION) return null;
    return result.data ?? null;
  } catch {
    return null;
  }
}

export async function setCachedCultivator(userId: string, data: unknown) {
  try {
    const db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      },
    });
    await db.put(STORE_NAME, {
      id: userId,
      data,
      version: CACHE_VERSION,
      updatedAt: Date.now(),
    });
  } catch {
    // Silent fail - cache is non-critical
  }
}

export async function clearCachedCultivator(userId: string) {
  try {
    const db = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      },
    });
    await db.delete(STORE_NAME, userId);
  } catch {
    // Silent fail
  }
}