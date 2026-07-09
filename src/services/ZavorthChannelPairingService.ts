import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class ZavorthChannelPairingService {
  private static instance: ZavorthChannelPairingService | null = null;
  private pairedUsers: Set<string> = new Set(); // format: channelId:userId
  private activeCode: string | null = null;
  private codeExpiresAt: number = 0;
  private readonly storagePath: string;

  constructor() {
    this.storagePath = path.resolve(process.cwd(), 'data', 'runtime', 'channel-pairing.json');
    this.loadPairingData();
  }

  public static getInstance(): ZavorthChannelPairingService {
    if (!ZavorthChannelPairingService.instance) {
      ZavorthChannelPairingService.instance = new ZavorthChannelPairingService();
    }
    return ZavorthChannelPairingService.instance;
  }

  private loadPairingData(): void {
    if (fs.existsSync(this.storagePath)) {
      try {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.paired)) {
          this.pairedUsers = new Set(data.paired);
        }
      } catch (err) {
        console.error(`[PairingService] Error loading pairing data:`, err);
      }
    }
  }

  private savePairingData(): void {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        paired: Array.from(this.pairedUsers),
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error(`[PairingService] Error saving pairing data:`, err);
    }
  }

  public generateCode(durationMs: number = 300000): string { // 5 minutes default
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    this.activeCode = code;
    this.codeExpiresAt = Date.now() + durationMs;
    return code;
  }

  public getActiveCode(): string | null {
    if (this.activeCode && Date.now() < this.codeExpiresAt) {
      return this.activeCode;
    }
    this.activeCode = null;
    return null;
  }

  public isUserPaired(channelId: string, userId: string): boolean {
    const key = `${channelId.toLowerCase()}:${userId}`;
    return this.pairedUsers.has(key);
  }

  public pairUser(channelId: string, userId: string, code: string): boolean {
    const active = this.getActiveCode();
    if (!active) {
      return false;
    }
    if (code.trim().toUpperCase() === active) {
      const key = `${channelId.toLowerCase()}:${userId}`;
      this.pairedUsers.add(key);
      this.savePairingData();
      this.activeCode = null;
      return true;
    }
    return false;
  }

  public addAllowlistedUser(channelId: string, userId: string): void {
    const key = `${channelId.toLowerCase()}:${userId}`;
    this.pairedUsers.add(key);
    this.savePairingData();
  }

  public clearPairings(): void {
    this.pairedUsers.clear();
    this.savePairingData();
  }
}

export function getChannelPairingService(): ZavorthChannelPairingService {
  return ZavorthChannelPairingService.getInstance();
}
