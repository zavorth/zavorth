/**
 * Bridge: when durable memory is written for a user, also record governed provenance memory.
 */

import { createHash } from 'crypto';
import path from 'path';
import { AgentProvenanceMemoryService } from './AgentProvenanceMemoryService.js';

function workspaceIdFromRoot(root = process.cwd()): string {
  const digest = createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 16);
  return `workspace-${digest}`;
}

function memoryId(userId: string, key: string): string {
  return createHash('sha256').update(`${userId}::${key}`).digest('hex').slice(0, 32);
}

export function writeGovernedMemoryProvenance(input: {
  userId: string;
  key: string;
  value: string;
  category?: string;
  sessionId?: string | null;
  surface?: string | null;
  eventId?: string | null;
  confidence?: number;
  projectRoot?: string;
}): void {
  try {
    const userId = String(input.userId || '').trim();
    const key = String(input.key || '').trim();
    const value = String(input.value || '').trim();
    if (!userId || !key || !value) return;

    const root = input.projectRoot || process.cwd();
    const service = new AgentProvenanceMemoryService({ workspaceRoot: root });
    const eventId = String(input.eventId || `mem-${Date.now()}`).slice(0, 64);
    service.write({
      workspaceId: workspaceIdFromRoot(root),
      memoryId: memoryId(userId, key),
      kind: /prefer|like|want/i.test(key) ? 'preference' : 'fact',
      text: `${key}: ${value}`.slice(0, 16_000),
      confidence: typeof input.confidence === 'number' ? input.confidence : 0.55,
      source: {
        runtimeId: 'zavorth-memory-service',
        sessionId: String(input.sessionId || input.surface || userId).slice(0, 64) || userId,
        eventIds: [eventId],
        references: [
          `user:${userId}`,
          `category:${String(input.category || 'general')}`,
          `surface:${String(input.surface || 'memory')}`,
        ],
      },
      expiresAt: null,
    });
  } catch {
    // Provenance write must never break primary memory path.
  }
}
