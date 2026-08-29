import {
  type UserModelConfig,
  resolveUserModelConfig,
} from '../../contracts/user-model/UserModelConfigContract.js';
import { UserModelConfidenceEngine } from './UserModelConfidenceEngine.js';
import type { UserModelFactStore } from './UserModelFactStore.js';

export type ContextInjectionDeps = {
  factStore: UserModelFactStore;
  confidenceEngine?: UserModelConfidenceEngine;
  config?: UserModelConfig;
  now?: () => Date;
};

export class UserModelContextInjectionService {
  private readonly factStore: UserModelFactStore;
  private readonly confidenceEngine: UserModelConfidenceEngine;
  private readonly config: UserModelConfig;
  private readonly now: () => Date;

  public constructor(deps: ContextInjectionDeps) {
    this.factStore = deps.factStore;
    this.config = deps.config || resolveUserModelConfig();
    this.confidenceEngine = deps.confidenceEngine || new UserModelConfidenceEngine({ config: this.config });
    this.now = deps.now || (() => new Date());
  }

  public async buildInjectionContext(userId = 'local-user'): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    const facts = await this.factStore.listFactsByUserId(userId);
    const activeFacts = facts.filter((f) => f.status === 'active');

    if (activeFacts.length === 0) {
      return '';
    }

    const scoredFacts = activeFacts
      .map((fact) => {
        const decayedConfidence = this.confidenceEngine.calculateDecayedConfidence(fact, this.now());
        return { fact, decayedConfidence };
      })
      .filter(({ decayedConfidence }) => decayedConfidence >= this.config.activationConfidenceThreshold)
      .sort((a, b) => b.decayedConfidence - a.decayedConfidence || b.fact.occurrences - a.fact.occurrences);

    if (scoredFacts.length === 0) {
      return '';
    }

    const maxChars = this.config.maxInjectionTokens * 4;
    const lines: string[] = ['<user_model_facts>'];
    let currentLength = lines[0].length + '</user_model_facts>'.length + 2;

    for (const { fact } of scoredFacts) {
      const line = `- [${fact.kind}] ${fact.category}: ${fact.content}`;
      if (currentLength + line.length + 1 > maxChars) {
        break;
      }
      lines.push(line);
      currentLength += line.length + 1;
    }

    if (lines.length === 1) {
      return '';
    }

    lines.push('</user_model_facts>');
    return lines.join('\n');
  }

  public buildInjectionContextSync(userId = 'local-user'): string {
    if (!this.config.enabled) {
      return '';
    }

    const facts = this.factStore.listFactsByUserIdSync(userId);
    const activeFacts = facts.filter((f) => f.status === 'active');

    if (activeFacts.length === 0) {
      return '';
    }

    const scoredFacts = activeFacts
      .map((fact) => {
        const decayedConfidence = this.confidenceEngine.calculateDecayedConfidence(fact, this.now());
        return { fact, decayedConfidence };
      })
      .filter(({ decayedConfidence }) => decayedConfidence >= this.config.activationConfidenceThreshold)
      .sort((a, b) => b.decayedConfidence - a.decayedConfidence || b.fact.occurrences - a.fact.occurrences);

    if (scoredFacts.length === 0) {
      return '';
    }

    const maxChars = this.config.maxInjectionTokens * 4;
    const lines: string[] = ['<user_model_facts>'];
    let currentLength = lines[0].length + '</user_model_facts>'.length + 2;

    for (const { fact } of scoredFacts) {
      const line = `- [${fact.kind}] ${fact.category}: ${fact.content}`;
      if (currentLength + line.length + 1 > maxChars) {
        break;
      }
      lines.push(line);
      currentLength += line.length + 1;
    }

    if (lines.length === 1) {
      return '';
    }

    lines.push('</user_model_facts>');
    return lines.join('\n');
  }
}
