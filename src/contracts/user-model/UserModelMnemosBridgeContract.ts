import { z } from 'zod';
import type { ZavorthMnemosProceduralRuleKind, ZavorthMnemosProceduralRisk } from '../memory/ZavorthMnemosProceduralMemoryContract.js';

export const proceduralRuleKindSchema = z.enum([
  'approval-policy',
  'workflow-preference',
  'provider-preference',
  'safety-boundary',
  'communication-preference',
  'general-procedure',
]);

export const proceduralRiskSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const bridgeCandidateAssessmentSchema = z.object({
  factId: z.string().min(1),
  isCandidate: z.boolean(),
  reasons: z.array(z.string()),
  targetKind: proceduralRuleKindSchema,
  scopes: z.array(z.string()),
  risk: proceduralRiskSchema,
  confidence: z.number().min(0).max(1),
});

export type BridgeCandidateAssessment = {
  factId: string;
  isCandidate: boolean;
  reasons: string[];
  targetKind: ZavorthMnemosProceduralRuleKind;
  scopes: string[];
  risk: ZavorthMnemosProceduralRisk;
  confidence: number;
};
