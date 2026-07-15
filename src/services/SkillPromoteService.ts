/**
 * Promote experience skill drafts → SkillIR packs and optional Plugin OS scaffolds.
 * Always explicit (never auto-promote). Receipts link draftId → skillId → pluginId.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { SkillIrNormalizerService } from '../skills/SkillIrNormalizerService.js';
import { PluginScaffoldService } from './PluginScaffoldService.js';
import type { ZavorthPluginModuleKind } from '../contracts/PluginManifestContract.js';
import {
  redact,
  slugify,
  type ExperienceSkillDraftSummary,
} from './experience-skill-learning/ExperienceSkillLearningModel.js';

export type SkillPromoteKind = 'skill' | 'plugin' | 'both';

export type SkillPromoteReceipt = {
  schemaVersion: 'zavorth.skill-promote-receipt.v1';
  id: string;
  generatedAt: string;
  draftId: string;
  skillId: string | null;
  pluginId: string | null;
  kind: SkillPromoteKind;
  skillPath: string | null;
  agentsSkillPath: string | null;
  pluginPath: string | null;
  skillIrDigest: string | null;
  autoPromote: false;
  status: 'preview' | 'applied' | 'partial' | 'blocked';
  findings: string[];
};

export type SkillPromoteInput = {
  projectRoot: string;
  userId?: string | null;
  draft: ExperienceSkillDraftSummary;
  kind?: SkillPromoteKind | string;
  dryRun?: boolean;
  /** Override skill pack id/name. */
  skillName?: string | null;
  now?: () => Date;
};

export type SkillPromoteResult = {
  ok: boolean;
  dryRun: boolean;
  kind: SkillPromoteKind;
  autoPromote: false;
  draftId: string;
  title: string;
  skillId: string | null;
  pluginId: string | null;
  skillPath: string | null;
  agentsSkillPath: string | null;
  pluginPath: string | null;
  skillIrDigest: string | null;
  receipt: SkillPromoteReceipt | null;
  receiptPath: string | null;
  loaderReady: boolean;
  pluginReady: boolean;
  text: string;
  skillMdPreview?: string;
  findings: string[];
};

export class SkillPromoteService {
  private readonly irNormalizer = new SkillIrNormalizerService();
  private readonly scaffold = new PluginScaffoldService();

  public promote(input: SkillPromoteInput): SkillPromoteResult {
    const root = path.resolve(input.projectRoot || process.cwd());
    const draft = input.draft;
    const kind = normalizePromoteKind(input.kind);
    const dryRun = input.dryRun === true;
    const now = input.now || (() => new Date());
    const generatedAt = now().toISOString();
    const findings: string[] = [];

    const skillName = String(input.skillName || '').trim() || `exp-${slugify(draft.title)}-${draft.id.slice(-8)}`;
    const pluginId = `promoted-${slugify(draft.title)}-${draft.id.slice(-8)}`.slice(0, 80);
    const agentsSkillPath = path.join(root, '.agents', 'skills', skillName);
    const skillPath = path.join(root, 'skills', skillName);
    const pluginPath = path.join(root, 'plugins', 'promoted', pluginId);
    const uid = cleanPathUser(input.userId);

    if (dryRun) {
      const skillMd = this.buildSkillPackMarkdown(draft, skillName);
      const preview = truncatePreview(skillMd);
      const moduleKind = inferModuleKindFromTools(draft.tools);
      const text = [
        `Dry-run promote for "${draft.title}" (${draft.id}).`,
        'No files written. autoPromote=false',
        `kind: ${kind}`,
        kind !== 'plugin' ? `Would write skill pack: ${skillPath}` : null,
        kind !== 'plugin' ? `Would write SkillLoader path: ${agentsSkillPath}` : null,
        kind !== 'skill' ? `Would scaffold plugin: ${pluginPath} (moduleKind=${moduleKind})` : null,
        '',
        kind !== 'plugin' ? '--- SKILL.md preview ---' : null,
        kind !== 'plugin' ? preview : null,
      ]
        .filter((line) => line != null)
        .join('\n');

      return {
        ok: true,
        dryRun: true,
        kind,
        autoPromote: false,
        draftId: draft.id,
        title: draft.title,
        skillId: kind !== 'plugin' ? skillName : null,
        pluginId: kind !== 'skill' ? pluginId : null,
        skillPath: kind !== 'plugin' ? skillPath : null,
        agentsSkillPath: kind !== 'plugin' ? agentsSkillPath : null,
        pluginPath: kind !== 'skill' ? pluginPath : null,
        skillIrDigest: null,
        receipt: null,
        receiptPath: null,
        loaderReady: false,
        pluginReady: false,
        text,
        skillMdPreview: kind !== 'plugin' ? preview : undefined,
        findings: ['dry_run'],
      };
    }

    let skillIrDigest: string | null = null;
    let loaderReady = false;
    let pluginReady = false;
    let wroteSkill = false;
    let wrotePlugin = false;

    // --- Skill pack ---
    if (kind === 'skill' || kind === 'both') {
      try {
        const skillMd = this.buildSkillPackMarkdown(draft, skillName);
        for (const target of [skillPath, agentsSkillPath]) {
          fs.mkdirSync(target, { recursive: true });
          atomicWrite(path.join(target, 'SKILL.md'), skillMd.endsWith('\n') ? skillMd : `${skillMd}\n`);
          const description = redact(String(draft.title || skillName).slice(0, 200));
          atomicWrite(
            path.join(target, 'manifest.json'),
            `${JSON.stringify(
              {
                name: skillName,
                version: '1.0.0',
                description,
                author: 'experience-skill-learning-loop',
                fromDraftId: draft.id,
                promotedAt: generatedAt,
                tools: (draft.tools || []).map((name) => ({ name })),
              },
              null,
              2,
            )}\n`,
          );
          const metaSrc = path.join(draft.path, 'skill.meta.json');
          if (fs.existsSync(metaSrc)) {
            fs.copyFileSync(metaSrc, path.join(target, 'skill.meta.json'));
          }
          const provenance = {
            fromDraftId: draft.id,
            userId: uid,
            promotedAt: generatedAt,
            title: draft.title,
            skillName,
            kind: 'skill-promote',
          };
          atomicWrite(path.join(target, 'promoted.meta.json'), `${JSON.stringify(provenance, null, 2)}\n`);
          atomicWrite(
            path.join(target, 'ORIGIN.json'),
            `${JSON.stringify(
              {
                kind: 'experience-skill-learning-loop',
                ...provenance,
              },
              null,
              2,
            )}\n`,
          );
        }

        // Normalize SkillIR from the library pack (skills/)
        const ir = this.irNormalizer.normalizeFromDir({
          skillDir: skillPath,
          sourceUri: draft.path,
          sourceKind: 'experience-draft-promote',
          skillId: skillName,
          now,
        });
        skillIrDigest = ir.skillIrDigest;
        atomicWrite(
          path.join(skillPath, 'skill.ir.json'),
          `${JSON.stringify(
            {
              skillIr: ir.skillIr,
              skillIrDigest: ir.skillIrDigest,
              fromDraftId: draft.id,
              promotedAt: generatedAt,
            },
            null,
            2,
          )}\n`,
        );
        atomicWrite(
          path.join(agentsSkillPath, 'skill.ir.json'),
          `${JSON.stringify(
            {
              skillIr: ir.skillIr,
              skillIrDigest: ir.skillIrDigest,
              fromDraftId: draft.id,
              promotedAt: generatedAt,
            },
            null,
            2,
          )}\n`,
        );
        wroteSkill = true;
        loaderReady = true;
        findings.push(`skill_pack=${skillPath}`);
        findings.push(`agents_skill=${agentsSkillPath}`);
        findings.push(`skillIrDigest=${skillIrDigest.slice(0, 16)}…`);
      } catch (error) {
        findings.push(`skill_promote_failed=${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // --- Plugin scaffold ---
    if (kind === 'plugin' || kind === 'both') {
      try {
        const moduleKind = inferModuleKindFromTools(draft.tools);
        const scaffolded = this.scaffold.scaffold({
          root,
          id: pluginId,
          targetDir: pluginPath,
          moduleKind,
          kind: moduleKindToScaffoldKind(moduleKind),
          withTools: true,
          withHooks: false,
          language: 'js',
        });
        // Provenance overlay on plugin package
        atomicWrite(
          path.join(pluginPath, 'PROMOTE.json'),
          `${JSON.stringify(
            {
              fromDraftId: draft.id,
              skillId: kind === 'both' ? skillName : null,
              pluginId: scaffolded.id,
              promotedAt: generatedAt,
              tools: draft.tools || [],
              moduleKind: scaffolded.moduleKind,
              autoPromote: false,
            },
            null,
            2,
          )}\n`,
        );
        // Ensure schemaVersion present on manifest (scaffold already sets it)
        const manifestPath = path.join(pluginPath, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          try {
            const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
            if (!raw.schemaVersion) {
              raw.schemaVersion = 'zavorth.plugin-os.v1';
              atomicWrite(manifestPath, `${JSON.stringify(raw, null, 2)}\n`);
            }
          } catch {
            /* soft */
          }
        }
        wrotePlugin = true;
        pluginReady = true;
        findings.push(`plugin_pack=${pluginPath}`);
        findings.push(`plugin_moduleKind=${scaffolded.moduleKind}`);
      } catch (error) {
        findings.push(`plugin_promote_failed=${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const ok =
      (kind === 'skill' && wroteSkill) ||
      (kind === 'plugin' && wrotePlugin) ||
      (kind === 'both' && (wroteSkill || wrotePlugin));

    const receiptId = `promote-${generatedAt.replace(/[:.]/g, '-')}-${draft.id.slice(-8)}`;
    const receipt: SkillPromoteReceipt = {
      schemaVersion: 'zavorth.skill-promote-receipt.v1',
      id: receiptId,
      generatedAt,
      draftId: draft.id,
      skillId: wroteSkill ? skillName : null,
      pluginId: wrotePlugin ? pluginId : null,
      kind,
      skillPath: wroteSkill ? skillPath : null,
      agentsSkillPath: wroteSkill ? agentsSkillPath : null,
      pluginPath: wrotePlugin ? pluginPath : null,
      skillIrDigest,
      autoPromote: false,
      status: ok
        ? wroteSkill &&
          (kind !== 'both' || wrotePlugin) &&
          (kind !== 'plugin' || wrotePlugin) &&
          (kind !== 'both' || (wroteSkill && wrotePlugin))
          ? 'applied'
          : wroteSkill || wrotePlugin
            ? 'partial'
            : 'blocked'
        : 'blocked',
      findings: [...findings],
    };
    // Clarify status for both
    if (kind === 'both') {
      receipt.status = wroteSkill && wrotePlugin ? 'applied' : wroteSkill || wrotePlugin ? 'partial' : 'blocked';
    } else if (kind === 'skill') {
      receipt.status = wroteSkill ? 'applied' : 'blocked';
    } else {
      receipt.status = wrotePlugin ? 'applied' : 'blocked';
    }

    let receiptPath: string | null = null;
    try {
      const receiptsDir = path.join(root, 'data', 'runtime', 'learning', 'users', uid, 'promote-receipts');
      fs.mkdirSync(receiptsDir, { recursive: true });
      receiptPath = path.join(receiptsDir, `${receiptId}.json`);
      atomicWrite(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
      findings.push(`receipt=${receiptPath}`);
    } catch (error) {
      findings.push(`receipt_write_failed=${error instanceof Error ? error.message : String(error)}`);
    }

    const textParts = [
      `Promoted draft "${draft.title}" (kind=${kind}).`,
      `draftId → skillId → pluginId: ${draft.id} → ${receipt.skillId || '—'} → ${receipt.pluginId || '—'}`,
      `autoPromote=false status=${receipt.status}`,
    ];
    if (wroteSkill) {
      textParts.push(`Skill pack: ${skillPath}`);
      textParts.push(`SkillLoader: ${agentsSkillPath}`);
      if (skillIrDigest) textParts.push(`SkillIR digest: ${skillIrDigest.slice(0, 24)}…`);
    }
    if (wrotePlugin) {
      textParts.push(`Plugin pack: ${pluginPath}`);
      textParts.push(`Enable: zavorth plugins enable ${pluginId} --yes`);
    }
    if (receiptPath) textParts.push(`Receipt: ${receiptPath}`);
    if (!ok) textParts.push(...findings.filter((f) => f.includes('failed')));

    return {
      ok,
      dryRun: false,
      kind,
      autoPromote: false,
      draftId: draft.id,
      title: draft.title,
      skillId: receipt.skillId,
      pluginId: receipt.pluginId,
      skillPath: receipt.skillPath,
      agentsSkillPath: receipt.agentsSkillPath,
      pluginPath: receipt.pluginPath,
      skillIrDigest,
      receipt,
      receiptPath,
      loaderReady,
      pluginReady,
      text: textParts.join('\n'),
      findings,
    };
  }

  /**
   * SkillIR-friendly SKILL.md: name, description, tools frontmatter + procedure body.
   */
  public buildSkillPackMarkdown(draft: ExperienceSkillDraftSummary, skillName: string): string {
    const srcSkill = path.join(draft.path, 'SKILL.md');
    let body = fs.existsSync(srcSkill)
      ? redact(fs.readFileSync(srcSkill, 'utf8'))
      : `# ${draft.title}\n\n> Promoted experience skill draft.\n`;
    // Strip existing frontmatter so we rewrite a single block
    if (/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/.test(body)) {
      body = body.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, '');
    }
    const description = redact(
      String(draft.title || 'Promoted experience skill')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200) || 'Promoted experience skill',
    ).replace(/"/g, "'");
    const safeName =
      String(skillName || 'skill')
        .replace(/[^\w.-]+/g, '-')
        .slice(0, 80) || 'skill';
    const tools = (draft.tools || []).map((t) => String(t || '').trim()).filter(Boolean);
    const toolsYaml = tools.length > 0 ? ['tools:', ...tools.map((t) => `  - name: ${t}`)].join('\n') : 'tools: []';
    return [
      '---',
      `name: ${safeName}`,
      `description: ${description}`,
      toolsYaml,
      '---',
      '',
      body.replace(/^\uFEFF/, '').trimStart(),
    ].join('\n');
  }
}

export function normalizePromoteKind(value?: string | null): SkillPromoteKind {
  const raw = String(value || 'skill')
    .trim()
    .toLowerCase();
  if (raw === 'plugin' || raw === 'plugins' || raw === 'pack') return 'plugin';
  if (raw === 'both' || raw === 'all' || raw === 'skill+plugin') return 'both';
  return 'skill';
}

export function inferModuleKindFromTools(tools: string[] | undefined): ZavorthPluginModuleKind {
  const list = (tools || []).map((t) => t.toLowerCase());
  const blob = list.join(' ');
  if (list.some((t) => t.includes('memory') || t.includes('recall') || t.includes('remember'))) {
    return 'memory';
  }
  if (
    list.some(
      (t) =>
        t.includes('channel') ||
        t.includes('telegram') ||
        t.includes('discord') ||
        t.includes('slack') ||
        t.includes('whatsapp'),
    )
  ) {
    return 'channel';
  }
  if (
    list.some((t) => t.includes('web_search') || t.includes('search') || t.includes('browse')) ||
    /\bsearch\b/.test(blob)
  ) {
    return 'search';
  }
  if (list.some((t) => t.includes('llm') || t.includes('provider') || t.includes('model'))) {
    return 'provider';
  }
  if (list.some((t) => t.includes('agent') || t.includes('worker') || t.includes('mesh'))) {
    return 'agent';
  }
  if (list.length >= 4) return 'tool';
  return 'tool';
}

function moduleKindToScaffoldKind(
  moduleKind: ZavorthPluginModuleKind,
): 'tool' | 'channel' | 'memory' | 'provider' | 'agent' | 'diagnostics' {
  switch (moduleKind) {
    case 'channel':
      return 'channel';
    case 'memory':
      return 'memory';
    case 'provider':
      return 'provider';
    case 'agent':
      return 'agent';
    case 'diagnostics':
      return 'diagnostics';
    default:
      return 'tool';
  }
}

function cleanPathUser(userId?: string | null): string {
  const raw = String(userId || '').trim();
  if (!raw) return 'local-user';
  return (
    raw
      .replace(/[^a-zA-Z0-9._@+-]+/g, '_')
      .replace(/\.{2}/g, '_')
      .slice(0, 120) || 'local-user'
  );
}

function atomicWrite(file: string, content: string): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

function truncatePreview(skillMd: string): string {
  const maxChars = 2000;
  const maxLines = 40;
  const lines = String(skillMd || '').split(/\r?\n/);
  let preview = lines.slice(0, maxLines).join('\n');
  let truncated = lines.length > maxLines;
  if (preview.length > maxChars) {
    preview = preview.slice(0, maxChars);
    truncated = true;
  }
  return truncated ? `${preview}\n…` : preview;
}
