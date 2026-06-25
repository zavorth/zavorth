import type {
  IntelligenceFabricInput,
  IntelligenceFabricSnapshot,
} from '../contracts/native/IntelligenceFabricContract.js';
import { ZavorthIntelligenceFabricService } from './ZavorthIntelligenceFabricService.js';

export class ZavorthIntelligenceFabricApiService {
  private readonly fabric: ZavorthIntelligenceFabricService;

  constructor(fabric = new ZavorthIntelligenceFabricService()) {
    this.fabric = fabric;
  }

  public buildSnapshot(input: IntelligenceFabricInput): IntelligenceFabricSnapshot {
    return this.fabric.buildShadowSnapshot(input);
  }

  public renderReply(input: IntelligenceFabricInput): string {
    const snapshot = this.fabric.buildShadowSnapshot(input);
    return [
      snapshot.reply.headline,
      snapshot.reply.body,
      snapshot.reply.nextAction,
      '',
      `Modo: ${snapshot.mode}`,
      `Risco: ${snapshot.classification.riskLevel}`,
      `Trust: ${snapshot.trust.requested}`,
      `Gate: ${snapshot.riskGate.overallDecision}`,
      `Acao live aplicada: ${snapshot.activation.liveActionApplied ? 'sim' : 'nao'}`,
    ].join('\n');
  }
}
