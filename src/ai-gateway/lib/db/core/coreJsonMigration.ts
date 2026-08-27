import fs from "fs";
import path from "path";
import { asZavorthSettingsBackup } from "../jsonBackupAdapters";
import { runJsonMigration } from "../jsonMigration";
import type { SqliteDatabase } from "./coreTypes";
import { logger } from "@/shared/utils/logger";function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function migrateFromJson(
  db: SqliteDatabase,
  jsonPath: string,
  options: { dataDir: string }
): void {
  try {
    const raw = fs.readFileSync(jsonPath, "utf-8");
    const data = asZavorthSettingsBackup(JSON.parse(raw));

    const connCount = (data.providerConnections || []).length;
    const nodeCount = (data.providerNodes || []).length;
    const keyCount = (data.apiKeys || []).length;
    const comboCount = (data.combos || []).length;

    if (connCount === 0 && nodeCount === 0 && keyCount === 0 && comboCount === 0) {
      logger.info("[DB] db.json has no data to migrate, skipping");
      fs.renameSync(jsonPath, `${jsonPath}.empty`);
      return;
    }

    logger.info(
      `[DB] Migrating db.json -> SQLite (${connCount} connections, ${nodeCount} nodes, ${comboCount} combos, ${keyCount} keys)...`
    );

    runJsonMigration(db, data);

    const migratedPath = `${jsonPath}.migrated`;
    fs.renameSync(jsonPath, migratedPath);
    logger.info(`[DB] ✓ Migration complete. Original saved as ${migratedPath}`);

    const legacyBackupDir = path.join(options.dataDir, "db_backups");
    if (fs.existsSync(legacyBackupDir)) {
      const jsonBackups = fs.readdirSync(legacyBackupDir).filter((file) => file.endsWith(".json"));
      if (jsonBackups.length > 0) {
        logger.info(
          `[DB] Note: ${jsonBackups.length} compatibility .json backups remain in ${legacyBackupDir}`
        );
      }
    }
  } catch (error: unknown) {logger.error("[DB] Migration from db.json failed:", getErrorMessage(error));
  }
}
