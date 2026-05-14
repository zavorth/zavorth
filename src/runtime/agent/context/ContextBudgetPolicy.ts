import { CostBudgetService } from '../../../services/telemetry/CostBudgetService.js';
import { TokenBudgetService } from '../../../services/telemetry/TokenBudgetService.js';
import {
  resolveRunContextProfile,
  type RunContextDepth,
  type RunContextProfile,
} from './RunContextProfile.js';

export type ContextBudgetLayerId = 'hot' | 'warm' | 'cold';

export type ContextBudgetTokenEvaluation = {
  used: number;
  limit: number;
  withinBudget: boolean;
};

export type ContextBudgetCostEvaluation = {
  estimatedCostUsd: number;
  limitUsd: number;
  withinBudget: boolean;
};

export type ContextBudgetTokenEvaluator = Pick<TokenBudgetService, 'evaluateText'>;
export type ContextBudgetCostEvaluator = Pick<CostBudgetService, 'evaluateTokens'>;

export type ContextBudgetPolicyOptions = {
  tokenBudgetService?: ContextBudgetTokenEvaluator | null;
  costBudgetService?: ContextBudgetCostEvaluator | null;
};

export type ContextBudgetPolicyInput = {
  profile?: RunContextProfile | RunContextDepth | null;
  hot?: unknown;
  warm?: unknown;
  cold?: unknown;
  tokenLimit?: number;
  costLimitUsd?: number;
};

export type ContextBudgetLayerEvaluation = {
  layer: ContextBudgetLayerId;
  requested: boolean;
  token: ContextBudgetTokenEvaluation;
  cost: ContextBudgetCostEvaluation;
};

export type ContextBudgetPolicyDecision = {
  requestedDepth: RunContextDepth;
  allowedDepth: RunContextDepth;
  degraded: boolean;
  withinBudget: boolean;
  reason: string;
  layers: ContextBudgetLayerEvaluation[];
  gatesToolExposure: false;
};

const DEPTH_ORDER: ContextBudgetLayerId[] = ['hot', 'warm', 'cold'];

function depthIndex(depth: RunContextDepth): number {
  return DEPTH_ORDER.indexOf(depth);
}

function serializeLayer(value: unknown): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export class ContextBudgetPolicy {
  private readonly tokenBudgetService: ContextBudgetTokenEvaluator;
  private readonly costBudgetService: ContextBudgetCostEvaluator;

  constructor(options: ContextBudgetPolicyOptions = {}) {
    this.tokenBudgetService = options.tokenBudgetService || new TokenBudgetService();
    this.costBudgetService = options.costBudgetService || new CostBudgetService();
  }

  public evaluate(input: ContextBudgetPolicyInput = {}): ContextBudgetPolicyDecision {
    const profile = resolveRunContextProfile(input.profile);
    const requestedDepth = profile.depth;
    let allowedDepth: RunContextDepth = 'hot';
    let lastWithinBudget = true;
    let stoppedAt: ContextBudgetLayerId | null = null;
    const requestedDepthIndex = depthIndex(requestedDepth);
    const layers: ContextBudgetLayerEvaluation[] = [];
    const cumulativeText: string[] = [];

    for (const layer of DEPTH_ORDER) {
      const requested = depthIndex(layer) <= requestedDepthIndex;
      if (requested) {
        cumulativeText.push(serializeLayer(input[layer]));
      }

      const token = this.tokenBudgetService.evaluateText(cumulativeText.filter(Boolean).join('\n'), input.tokenLimit);
      const cost = this.costBudgetService.evaluateTokens(token.used, input.costLimitUsd);
      const withinBudget = token.withinBudget && cost.withinBudget;

      layers.push({
        layer,
        requested,
        token,
        cost,
      });

      if (!requested || stoppedAt) {
        continue;
      }

      if (withinBudget) {
        allowedDepth = layer;
        lastWithinBudget = true;
      } else {
        stoppedAt = layer;
        lastWithinBudget = false;
      }
    }

    const degraded = allowedDepth !== requestedDepth;
    const reason = degraded
      ? `Contexto degradado de ${requestedDepth} para ${allowedDepth} por budget de tokens/custo.`
      : lastWithinBudget
        ? `Contexto ${requestedDepth} dentro do budget configurado.`
        : `Contexto ${requestedDepth} excede o budget minimo; hot permanece obrigatorio e deve ser compactado upstream.`;

    return {
      requestedDepth,
      allowedDepth,
      degraded,
      withinBudget: lastWithinBudget,
      reason,
      layers,
      gatesToolExposure: false,
    };
  }
}
