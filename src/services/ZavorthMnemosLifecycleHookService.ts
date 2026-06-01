import crypto from 'node:crypto';
import { config } from '../config/index.js';
import {
  ZAVORTH_MNEMOS_LIFECYCLE_HOOK_VERSION,
  type ZavorthMnemosLifecycleHookInput,
  type ZavorthMnemosLifecycleHookSnapshot,
  type ZavorthMnemosLifecycleHookSource,
  type ZavorthMnemosLifecycleHookTrust,
} from '../contracts/ZavorthMnemosLifecycleHookContract.js';
import { ZavorthMnemosCompilerService } from './ZavorthMnemosCompilerService.js';

export class ZavorthMnemosLifecycleHookService {
  private readonly now: () => Date;
  private readonly compiler: Pick<ZavorthMnemosCompilerService, 'ingestSessionEvent'>;

  constructor(runtime: {
    now?: () => Date;
    compiler?: Pick<ZavorthMnemosCompilerService, 'ingestSessionEvent'>;
  } = {}) {
    this.now = runtime.now || (() => new Date());
    this.compiler = runtime.compiler || new ZavorthMnemosCompilerService();
  }

  public capture(input: ZavorthMnemosLifecycleHookInput): ZavorthMnemosLifecycleHookSnapshot {
    const generatedAt = this.now().toISOString();
    const sessionId = String(input.sessionId || '').trim();
    if (!sessionId) {
      throw new Error('Mnemos lifecycle hook requires sessionId');
    }
    const source = this.normalizeSource(input.source);
    const trust = this.normalizeTrust(input.trust);
    const eventId = `mnemos-hook-${crypto.randomBytes(8).toString('hex')}`;
    this.compiler.ingestSessionEvent(input.workspaceRoot || config.projectRoot, {
      id: eventId,
      timestamp: input.createdAt || generatedAt,
      sessionId,
      type: input.type,
      payload: input.payload || {},
      source,
      trust,
    });

    return {
      version: ZAVORTH_MNEMOS_LIFECYCLE_HOOK_VERSION,
      generatedAt,
      status: 'captured',
      eventId,
      eventType: input.type,
      sessionId,
      source,
      trust,
      safety: {
        providerCall: false,
        networkCall: false,
        durableSemanticMutation: false,
        rawEventOnly: true,
        promotionRequiresApproval: true,
      },
      receipt: {
        id: `mnemos-lifecycle-${eventId.slice('mnemos-hook-'.length)}`,
        providerCall: false,
        durableMutation: false,
      },
    };
  }

  private normalizeSource(input: Partial<ZavorthMnemosLifecycleHookSource> | undefined): ZavorthMnemosLifecycleHookSource {
    return {
      surface: input?.surface || 'unknown',
      agent: input?.agent || null,
      provider: input?.provider || null,
      channel: input?.channel || null,
    };
  }

  private normalizeTrust(input: Partial<ZavorthMnemosLifecycleHookTrust> | undefined): ZavorthMnemosLifecycleHookTrust {
    const level = input?.level || 'raw';
    return {
      level,
      durableTruth: input?.durableTruth === true && level === 'operator-approved',
      approvalId: input?.approvalId || null,
      receiptId: input?.receiptId || null,
    };
  }
}
