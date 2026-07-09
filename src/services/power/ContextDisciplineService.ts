/**
 * Context / cost discipline — keep tool and skill prompt surface bounded
 * so long sessions stay cache-friendly and affordable.
 */

import type { ContextDisciplineSnapshot } from '../../contracts/UniversalPowerFabricContract.js';

export type ContextDisciplineInput = {
  visibleToolCount?: number;
  skillBytesInPrompt?: number;
  maxVisibleTools?: number;
  maxSkillBytesInPrompt?: number;
};

const DEFAULT_MAX_TOOLS = 24;
const DEFAULT_MAX_SKILL_BYTES = 12_000;
const TOKENS_PER_BYTE_EST = 0.25;

export class ContextDisciplineService {
  public buildSnapshot(input: ContextDisciplineInput = {}): ContextDisciplineSnapshot {
    const maxVisibleTools = Math.max(4, Number(input.maxVisibleTools || DEFAULT_MAX_TOOLS));
    const maxSkillBytesInPrompt = Math.max(2000, Number(input.maxSkillBytesInPrompt || DEFAULT_MAX_SKILL_BYTES));
    const visibleToolCount = Math.max(0, Number(input.visibleToolCount || 0));
    const skillBytesInPrompt = Math.max(0, Number(input.skillBytesInPrompt || 0));

    const estimatedToolSchemaBudgetTokens = Math.round(maxVisibleTools * 180);
    const estimatedSkillBudgetTokens = Math.round(maxSkillBytesInPrompt * TOKENS_PER_BYTE_EST);

    const recommendations: string[] = [];
    if (visibleToolCount > maxVisibleTools) {
      recommendations.push(
        `Trim visible tools from ${visibleToolCount} to ≤ ${maxVisibleTools}; use progressive tool search.`,
      );
    } else {
      recommendations.push(`Tool surface within budget (≤ ${maxVisibleTools} schemas).`);
    }
    if (skillBytesInPrompt > maxSkillBytesInPrompt) {
      recommendations.push(
        `Skill prompt payload ${skillBytesInPrompt}B exceeds ${maxSkillBytesInPrompt}B; load skill bodies on demand.`,
      );
    } else {
      recommendations.push('Skill progressive disclosure within byte budget.');
    }
    recommendations.push('Keep system prefix stable across turns to preserve prompt cache.');
    recommendations.push('Prefer capability absorb / skill names over inlining full SKILL.md every turn.');

    return {
      maxVisibleTools,
      maxSkillBytesInPrompt,
      progressiveSkillDisclosure: true,
      cacheStableSystemPrefix: true,
      estimatedToolSchemaBudgetTokens,
      estimatedSkillBudgetTokens,
      recommendations,
    };
  }

  public selectToolsForTurn(input: {
    toolIds: string[];
    alwaysInclude?: string[];
    maxVisibleTools?: number;
    hinted?: string[];
  }): { selected: string[]; deferred: string[]; reason: string } {
    const max = Math.max(4, Number(input.maxVisibleTools || DEFAULT_MAX_TOOLS));
    const always = new Set((input.alwaysInclude || []).filter(Boolean));
    const hinted = new Set((input.hinted || []).filter(Boolean));
    const all = [...new Set(input.toolIds.filter(Boolean))];

    const selected: string[] = [];
    for (const id of all) {
      if (always.has(id) || hinted.has(id)) selected.push(id);
      if (selected.length >= max) break;
    }
    for (const id of all) {
      if (selected.includes(id)) continue;
      selected.push(id);
      if (selected.length >= max) break;
    }
    const deferred = all.filter((id) => !selected.includes(id));
    return {
      selected,
      deferred,
      reason: deferred.length
        ? `${deferred.length} tool(s) deferred for progressive disclosure.`
        : 'All tools fit the visible budget.',
    };
  }
}
