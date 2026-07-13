import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { normalizeZavorthUserId, ZAVORTH_DEFAULT_USER_ID } from './ZavorthDefaultUserId.js';

export type LegacyPreferenceStore = {
  version?: number;
  userId?: string;
  updatedAt?: string;
  preferences?: Array<Record<string, unknown> & { id?: string; userId?: string }>;
};

export type LearningLegacyMigrationResult = {
  ok: boolean;
  legacyPath: string;
  legacyCount: number;
  migratedUsers: string[];
  skippedUsers: string[];
  alreadyDone: boolean;
  markerPath: string;
};

function usersRoot(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), 'data', 'runtime', 'learning', 'users');
}

function legacyPreferencePath(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), 'data', 'runtime', 'learning', 'trusted-preferences.json');
}

function markerPath(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), 'data', 'runtime', 'learning', 'legacy-migration-done.json');
}

function userPreferencePath(projectRoot: string, userId: string): string {
  return path.join(usersRoot(projectRoot), userId, 'trusted-preferences.json');
}

export function listKnownLearningUserIds(projectRoot?: string | null, extraUserIds?: Array<string | null | undefined>): string[] {
  const root = path.resolve(String(projectRoot || process.cwd()));
  const ids = new Set<string>([ZAVORTH_DEFAULT_USER_ID]);

  for (const entry of Array.isArray(config.allowedUserIds) ? config.allowedUserIds : []) {
    const id = normalizeZavorthUserId(String(entry || ''));
    if (id) ids.add(id);
  }
  for (const entry of Array.isArray(config.whatsappAllowedChatIds) ? config.whatsappAllowedChatIds : []) {
    const id = normalizeZavorthUserId(String(entry || ''));
    if (id) ids.add(id);
  }
  for (const entry of extraUserIds || []) {
    const id = normalizeZavorthUserId(entry);
    if (id) ids.add(id);
  }

  const rootUsers = usersRoot(root);
  try {
    if (fs.existsSync(rootUsers)) {
      for (const name of fs.readdirSync(rootUsers)) {
        const full = path.join(rootUsers, name);
        try {
          if (fs.statSync(full).isDirectory()) {
            ids.add(normalizeZavorthUserId(name));
          }
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  return Array.from(ids).filter(Boolean).sort();
}

export function readLegacyHostLearningPreferences(projectRoot?: string | null): LegacyPreferenceStore | null {
  const legacyPath = legacyPreferencePath(String(projectRoot || process.cwd()));
  try {
    if (!fs.existsSync(legacyPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(legacyPath, 'utf8')) as LegacyPreferenceStore;
    if (!parsed || !Array.isArray(parsed.preferences)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Copies host-global trusted-preferences.json into each known operator/user store
 * that does not already have preferences. Idempotent via marker file.
 */
export function migrateLegacyLearningPreferencesToKnownUsers(input: {
  projectRoot?: string | null;
  extraUserIds?: Array<string | null | undefined>;
  force?: boolean;
  now?: () => Date;
}): LearningLegacyMigrationResult {
  const projectRoot = path.resolve(String(input.projectRoot || process.cwd()));
  const legacyPath = legacyPreferencePath(projectRoot);
  const donePath = markerPath(projectRoot);
  const nowIso = (input.now || (() => new Date()))().toISOString();

  if (!input.force && fs.existsSync(donePath)) {
    return {
      ok: true,
      legacyPath,
      legacyCount: 0,
      migratedUsers: [],
      skippedUsers: [],
      alreadyDone: true,
      markerPath: donePath,
    };
  }

  const legacy = readLegacyHostLearningPreferences(projectRoot);
  const legacyCount = legacy?.preferences?.length || 0;
  const targetUsers = listKnownLearningUserIds(projectRoot, input.extraUserIds);
  const migratedUsers: string[] = [];
  const skippedUsers: string[] = [];

  if (!legacy || legacyCount === 0) {
    writeMarker(donePath, {
      migratedAt: nowIso,
      legacyCount: 0,
      migratedUsers: [],
      skippedUsers: targetUsers,
      note: 'no-legacy-preferences',
    });
    return {
      ok: true,
      legacyPath,
      legacyCount: 0,
      migratedUsers: [],
      skippedUsers: targetUsers,
      alreadyDone: false,
      markerPath: donePath,
    };
  }

  for (const userId of targetUsers) {
    const dest = userPreferencePath(projectRoot, userId);
    try {
      if (fs.existsSync(dest)) {
        const existing = JSON.parse(fs.readFileSync(dest, 'utf8')) as LegacyPreferenceStore;
        if (Array.isArray(existing.preferences) && existing.preferences.length > 0) {
          skippedUsers.push(userId);
          continue;
        }
      }
      const payload: LegacyPreferenceStore = {
        version: 2,
        userId,
        updatedAt: nowIso,
        preferences: (legacy.preferences || []).map((entry) => ({
          ...entry,
          userId,
        })),
      };
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const temp = `${dest}.${process.pid}.tmp`;
      fs.writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      fs.renameSync(temp, dest);
      migratedUsers.push(userId);
    } catch {
      skippedUsers.push(userId);
    }
  }

  writeMarker(donePath, {
    migratedAt: nowIso,
    legacyCount,
    migratedUsers,
    skippedUsers,
  });

  return {
    ok: true,
    legacyPath,
    legacyCount,
    migratedUsers,
    skippedUsers,
    alreadyDone: false,
    markerPath: donePath,
  };
}

function writeMarker(filePath: string, payload: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, filePath);
}
