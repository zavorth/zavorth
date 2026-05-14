import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../config/index.js';

type StoredHostIdentity = {
  fingerprint: string;
  hostname: string;
  authorizedAt: string;
};

export type HostIdentityStatus = {
  authorized: boolean;
  firstRun: boolean;
  currentFingerprint: string;
  storedFingerprint: string | null;
};

export class HostIdentityService {
  constructor(private readonly stateFile = config.hostIdentityFile) {}

  public getStatus(): HostIdentityStatus {
    const currentFingerprint = this.getCurrentFingerprint();
    const stored = this.readStoredIdentity();

    if (!stored) {
      this.authorizeCurrentHost();
      return {
        authorized: true,
        firstRun: true,
        currentFingerprint,
        storedFingerprint: currentFingerprint,
      };
    }

    return {
      authorized: stored.fingerprint === currentFingerprint,
      firstRun: false,
      currentFingerprint,
      storedFingerprint: stored.fingerprint,
    };
  }

  public authorizeCurrentHost(): StoredHostIdentity {
    const payload: StoredHostIdentity = {
      fingerprint: this.getCurrentFingerprint(),
      hostname: os.hostname(),
      authorizedAt: new Date().toISOString(),
    };

    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    fs.writeFileSync(this.stateFile, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  }

  public getCurrentFingerprint(): string {
    const interfaces = os.networkInterfaces();
    const macs = Object.values(interfaces)
      .flat()
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((entry) => entry.mac || '')
      .filter((mac) => mac && mac !== '00:00:00:00:00:00')
      .sort();

    const raw = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.release(),
      macs.join('|'),
    ].join('||');

    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private readStoredIdentity(): StoredHostIdentity | null {
    try {
      if (!fs.existsSync(this.stateFile)) {
        return null;
      }

      return JSON.parse(fs.readFileSync(this.stateFile, 'utf8')) as StoredHostIdentity;
    } catch {
      return null;
    }
  }
}
