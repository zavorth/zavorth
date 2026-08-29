import { z } from 'zod';

export const userModelFactKindSchema = z.enum([
  'preference',
  'behavior',
  'expertise',
  'schedule',
  'decision',
  'opinion',
  'skill-lesson',
]);

export type UserModelFactKind = z.infer<typeof userModelFactKindSchema>;

export const userModelFactStatusSchema = z.enum([
  'draft',
  'active',
  'superseded',
  'retracted',
]);

export type UserModelFactStatus = z.infer<typeof userModelFactStatusSchema>;

export const userModelFactSourceSchema = z.enum([
  'explicit',
  'conversation',
  'behavior',
  'llm',
  'question',
  'migration',
]);

export type UserModelFactSource = z.infer<typeof userModelFactSourceSchema>;

export const evidenceReferenceSchema = z.object({
  turnId: z.string().optional(),
  citation: z.string().optional(),
  timestamp: z.string(),
  surface: z.string().optional(),
  contextSnippet: z.string().optional(),
});

export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;

export const userModelFactSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  content: z.string().min(1),
  kind: userModelFactKindSchema,
  category: z.string().min(1),
  status: userModelFactStatusSchema,
  version: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(evidenceReferenceSchema),
  source: userModelFactSourceSchema,
  language: z.string().default('en'),
  surface: z.string().nullable().default(null),
  lastObservedAt: z.string(),
  occurrences: z.number().int().positive().default(1),
  supersededBy: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export type UserModelFact = z.infer<typeof userModelFactSchema>;

export const userModelLifecycleEventTypeSchema = z.enum([
  'created',
  'reinforced',
  'superseded',
  'retracted',
  'decayed',
]);

export type UserModelLifecycleEventType = z.infer<typeof userModelLifecycleEventTypeSchema>;

export const userModelLifecycleEventSchema = z.object({
  id: z.string().min(1),
  factId: z.string().min(1),
  userId: z.string().min(1),
  eventType: userModelLifecycleEventTypeSchema,
  timestamp: z.string(),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export type UserModelLifecycleEvent = z.infer<typeof userModelLifecycleEventSchema>;

export const declarativeFactKinds: ReadonlySet<UserModelFactKind> = new Set([
  'preference',
  'expertise',
  'schedule',
  'opinion',
]);

export const proceduralLessonKinds: ReadonlySet<UserModelFactKind> = new Set([
  'skill-lesson',
]);

export const episodicAnchorKinds: ReadonlySet<UserModelFactKind> = new Set([
  'decision',
  'behavior',
]);

export function isDeclarativeFact(kind: UserModelFactKind): boolean {
  return declarativeFactKinds.has(kind);
}

export function isProceduralLesson(kind: UserModelFactKind): boolean {
  return proceduralLessonKinds.has(kind);
}

export function isEpisodicAnchor(kind: UserModelFactKind): boolean {
  return episodicAnchorKinds.has(kind);
}
