/**
 * Tier C channel synthesis — generate a governed protocol pack draft from
 * a channel name + optional notes/docs. Never live-ready until doctor + proof.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type {
  ReachChannelFamily,
  ReachChannelSynthesisDraft,
  ReachFabricReceipt,
} from '../../contracts/UniversalReachFabricContract.js';
import { createProtocolPack } from './ProtocolPackBase.js';

export type ChannelSynthesisInput = {
  channelId?: string;
  label?: string;
  notes?: string;
  family?: ReachChannelFamily;
  apply?: boolean;
  projectRoot?: string;
  quarantineRoot?: string;
};

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  readdirSync?: typeof fs.readdirSync;
  readFileSync?: typeof fs.readFileSync;
};

function slugify(value: string): string {
  return String(value || 'channel')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'channel';
}

function inferFamily(notes: string, explicit?: ReachChannelFamily): ReachChannelFamily {
  if (explicit && explicit !== 'unknown') return explicit;
  const text = notes.toLowerCase();
  if (text.includes('webhook')) return 'webhook';
  if (text.includes('bot') || text.includes('token')) return 'bot-api';
  if (text.includes('bridge') || text.includes('relay')) return 'relay';
  if (text.includes('graph') || text.includes('oauth')) return 'graph-api';
  if (text.includes('mail') || text.includes('smtp') || text.includes('imap')) return 'mail';
  return 'synthesized';
}

function inferEnvKeys(channelId: string, family: ReachChannelFamily, notes: string): string[] {
  const upper = channelId.replace(/[^a-z0-9]+/gi, '_').toUpperCase();
  const keys = new Set<string>();
  if (family === 'webhook' || family === 'synthesized') keys.add(`${upper}_WEBHOOK_URL`);
  if (family === 'bot-api') {
    keys.add(`${upper}_BOT_TOKEN`);
    keys.add(`${upper}_ALLOWED_IDS`);
  }
  if (family === 'relay' || family === 'local-bridge') {
    keys.add(`${upper}_BRIDGE_URL`);
    keys.add(`${upper}_ALLOWED_RECIPIENTS`);
  }
  if (family === 'graph-api') {
    keys.add(`${upper}_TENANT_ID`);
    keys.add(`${upper}_CLIENT_ID`);
    keys.add(`${upper}_CLIENT_SECRET_REF`);
  }
  if (family === 'mail') {
    keys.add(`${upper}_SMTP_URL`);
    keys.add(`${upper}_IMAP_URL`);
  }
  // Extract ENV-looking tokens from notes
  for (const match of notes.matchAll(/\b([A-Z][A-Z0-9_]{3,})\b/g)) {
    if (match[1].includes('_')) keys.add(match[1]);
  }
  return [...keys].slice(0, 8);
}

export class ChannelSynthesisService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: Runtime = {}) {
    this.projectRoot = runtime.projectRoot || process.cwd();
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public quarantineRoot(override?: string): string {
    return path.resolve(override || path.join(this.projectRoot, '.zavorth', 'channel-synthesis'));
  }

  public listDrafts(quarantineRoot?: string): ReachChannelSynthesisDraft[] {
    const root = this.quarantineRoot(quarantineRoot);
    if (!this.existsSync(root)) return [];
    const drafts: ReachChannelSynthesisDraft[] = [];
    for (const name of this.readdirSync(root)) {
      const manifest = path.join(root, name, 'SYNTHESIS.json');
      if (!this.existsSync(manifest)) continue;
      try {
        drafts.push(JSON.parse(this.readFileSync(manifest, 'utf8')) as ReachChannelSynthesisDraft);
      } catch {
        // skip corrupt
      }
    }
    return drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public synthesize(input: ChannelSynthesisInput): {
    draft: ReachChannelSynthesisDraft;
    receipt: ReachFabricReceipt;
    filesWritten: string[];
  } {
    const apply = input.apply === true;
    const channelId = slugify(input.channelId || input.label || 'custom-channel');
    const label = String(input.label || channelId).trim() || channelId;
    const notes = String(input.notes || '').trim() || `Synthesized protocol pack for ${label}`;
    const family = inferFamily(notes, input.family);
    const requiredEnvKeys = inferEnvKeys(channelId, family, notes);
    const pack = createProtocolPack({
      id: channelId,
      label,
      transport: family === 'bot-api'
        ? 'bot-http'
        : family === 'relay' || family === 'local-bridge'
          ? 'relay'
          : family === 'graph-api'
            ? 'graph-api'
            : family === 'mail'
              ? 'mail'
              : 'webhook',
      requiredEnvKeys,
      webhookPath: `/api/webhooks/${channelId}`,
    });

    const draftId = `syn_${crypto.randomBytes(4).toString('hex')}`;
    const packDir = path.join(this.quarantineRoot(input.quarantineRoot), `${channelId}-${draftId}`);
    const files: string[] = [];

    const draft: ReachChannelSynthesisDraft = {
      id: draftId,
      channelId,
      label,
      family,
      trustState: apply ? 'quarantined' : 'draft',
      sourceNotes: notes.slice(0, 4000),
      packDir,
      files: [],
      requiredEnvKeys,
      webhookPath: pack.webhookPath,
      doctorSteps: pack.doctorSteps,
      liveReady: false,
      createdAt: this.now().toISOString(),
    };

    if (!apply) {
      return {
        draft,
        filesWritten: [],
        receipt: {
          id: `rcpt_${crypto.randomBytes(6).toString('hex')}`,
          kind: 'channel-synthesis-preview',
          status: 'preview',
          summary: `Preview synthesis for ${channelId} (${family}); not written.`,
          subjectId: channelId,
          createdAt: this.now().toISOString(),
          rawSecretsSerialized: false,
        },
      };
    }

    this.mkdirSync(packDir, { recursive: true });

    const write = (rel: string, content: string) => {
      const full = path.join(packDir, rel);
      this.mkdirSync(path.dirname(full), { recursive: true });
      this.writeFileSync(full, content, 'utf8');
      files.push(rel);
    };

    write('protocol-pack.json', JSON.stringify(pack, null, 2));
    write('SYNTHESIS.json', JSON.stringify({ ...draft, files, trustState: 'quarantined' }, null, 2));
    write('README.md', [
      `# ${label} (Tier C synthesized pack)`,
      '',
      'This pack was generated by Zavorth Reach Fabric.',
      'It is **not live-ready**. Configure env, run doctor, then live proof.',
      '',
      '## Required env',
      ...requiredEnvKeys.map((k) => `- \`${k}\``),
      '',
      '## Webhook path',
      `\`${pack.webhookPath}\``,
      '',
      '## Notes',
      notes,
      '',
      '## Doctor steps',
      ...pack.doctorSteps.map((s, i) => `${i + 1}. ${s}`),
      '',
    ].join('\n'));

    write('adapter.stub.ts', [
      `/** Auto-generated Tier C adapter stub for ${channelId} */`,
      `export const channelId = ${JSON.stringify(channelId)};`,
      `export const webhookPath = ${JSON.stringify(pack.webhookPath)};`,
      `export const requiredEnvKeys = ${JSON.stringify(requiredEnvKeys)} as const;`,
      `export const liveReady = false as const;`,
      '',
      'export function describe() {',
      `  return { id: channelId, tier: 'C' as const, liveReady: false, webhookPath };`,
      '}',
      '',
      'export function extractInbound(payload: Record<string, unknown>) {',
      "  const rawText = String(payload.text || payload.body || payload.message || '').trim();",
      "  const userId = String(payload.userId || payload.user_id || payload.sender || 'unknown').trim();",
      "  const chatId = String(payload.chatId || payload.chat_id || payload.room_id || channelId).trim();",
      '  if (!rawText) return null;',
      '  return { userId, chatId, rawText, isGroup: false };',
      '}',
      '',
    ].join('\n'));

    write('allowlist.policy.json', JSON.stringify({
      channelId,
      mode: 'allowlist',
      allowed: [],
      blocked: [],
      openAccess: false,
    }, null, 2));

    const finalDraft: ReachChannelSynthesisDraft = {
      ...draft,
      files,
      trustState: 'quarantined',
      packDir,
    };
    write('SYNTHESIS.json', JSON.stringify(finalDraft, null, 2));

    return {
      draft: finalDraft,
      filesWritten: files,
      receipt: {
        id: `rcpt_${crypto.randomBytes(6).toString('hex')}`,
        kind: 'channel-synthesis-materialize',
        status: 'pass',
        summary: `Synthesized Tier C pack for ${channelId} into quarantine (not live).`,
        subjectId: channelId,
        createdAt: this.now().toISOString(),
        rawSecretsSerialized: false,
      },
    };
  }
}
