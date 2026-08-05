import { prisma } from "./prisma";
import { logger } from "./logger";
import * as fs from "fs";
import * as path from "path";

const BACKUP_DIR = path.join(process.cwd(), "prisma", "backups");
const MAX_BACKUPS = 5;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Auto-backup after successful action. Retains last MAX_BACKUPS copies.
 * Non-critical - failures are silently logged.
 */
export async function autoBackup(cultivatorId: string): Promise<void> {
  try {
    ensureBackupDir();

    const [cultivator, familyMembers, events, memoryEntries] = await Promise.all([
      prisma.cultivator.findUnique({ where: { id: cultivatorId } }),
      prisma.familyMember.findMany({ where: { cultivatorId } }),
      prisma.gameEvent.findMany({ where: { cultivatorId } }),
      prisma.memoryEntry.findMany({ where: { cultivatorId } }),
    ]);

    const backupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      cultivator,
      familyMembers,
      events,
      memoryEntries,
    };

    const filename = `backup-${Date.now()}.json`;
    fs.writeFileSync(path.join(BACKUP_DIR, filename), JSON.stringify(backupData, null, 2));

    // Cleanup old backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("backup-") && f.endsWith(".json"))
      .sort()
      .reverse();

    if (files.length > MAX_BACKUPS) {
      for (const oldFile of files.slice(MAX_BACKUPS)) {
        fs.unlinkSync(path.join(BACKUP_DIR, oldFile));
      }
    }
  } catch (err) {
    logger.warn("[auto-backup] failed:", err);
  }
}