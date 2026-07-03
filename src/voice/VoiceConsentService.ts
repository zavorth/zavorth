import { randomUUID } from 'crypto';

export type ConsentStatus = 'pending' | 'accepted' | 'revoked';

export type ConsentRecord = {
  id: string;
  userId: string;
  status: ConsentStatus;
  acceptedAt: string | null;
  revokedAt: string | null;
  scope: string;
  version: string;
};

export type ConsentRequest = {
  userId: string;
  scope?: string;
  version?: string;
};

export type ConsentServiceStorage = {
  load: (userId: string) => ConsentRecord | null;
  save: (record: ConsentRecord) => void;
};

const DEFAULT_SCOPE = 'voice-capture-local';
const DEFAULT_VERSION = '1.0';

export class VoiceConsentService {
  private readonly storage: ConsentServiceStorage;

  constructor(storage?: ConsentServiceStorage) {
    this.storage = storage || {
      load: () => null,
      save: () => undefined,
    };
  }

  public getStatus(userId: string): ConsentRecord {
    const existing = this.storage.load(userId);
    if (existing) {
      return existing;
    }
    return {
      id: randomUUID(),
      userId,
      status: 'pending',
      acceptedAt: null,
      revokedAt: null,
      scope: DEFAULT_SCOPE,
      version: DEFAULT_VERSION,
    };
  }

  public isConsented(userId: string): boolean {
    return this.getStatus(userId).status === 'accepted';
  }

  public accept(request: ConsentRequest): ConsentRecord {
    const existing = this.getStatus(request.userId);
    const record: ConsentRecord = {
      ...existing,
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      revokedAt: null,
      scope: request.scope || existing.scope,
      version: request.version || existing.version,
    };
    this.storage.save(record);
    return record;
  }

  public revoke(userId: string): ConsentRecord {
    const existing = this.getStatus(userId);
    if (existing.status !== 'accepted') {
      throw new Error('Cannot revoke consent that has not been accepted.');
    }
    const record: ConsentRecord = {
      ...existing,
      status: 'revoked',
      revokedAt: new Date().toISOString(),
    };
    this.storage.save(record);
    return record;
  }

  public ensureConsented(userId: string): void {
    if (!this.isConsented(userId)) {
      throw new Error(
        `Voice consent required for user ${userId}. User must accept voice privacy consent before using voice features.`,
      );
    }
  }
}
