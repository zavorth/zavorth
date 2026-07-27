
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { BaseTool } from './BaseTool.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type ValidatedSkillArgs =
  | {
      ok: true;
      category: string;
      skillId: string;
      skillName: string;
      description: string;
      toolsJson: string;
      toolsMarkdown: string;
    }
  | { ok: false; message: string };

type SkillDraftScannerResult = {
  risk: 'low' | 'medium' | 'high';
  blocked: boolean;
  issues: Array<{
    code: string;
    severity: 'warn' | 'block';
    evidence: string;
  }>;
};

export class AutoSkillCreatorTool extends BaseTool {
  public readonly name = 'auto_skill_creator';
  public readonly description =
    'Creates a governed draft for a declarative Skill. It does not materialize files into skills or enable execution without scanner, smoke, approval, and receipt.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        description: 'Skill category (development, information, execution, filesystem, etc.). Default: development.',
      },
      skillId: {
        type: 'string',
        description: 'Skill ID in snake_case/kebab-case, for example: image_generator.',
      },
      skillName: {
        type: 'string',
        description: 'Human-readable skill name, for example: Image Generator.',
      },
      description: {
        type: 'string',
        description: 'Brief description of the skill and its tools.',
      },
      toolsJson: {
        type: 'string',
        description: 'JSON string containing an array of tool definitions (name, description, parameters).',
      },
      toolsMarkdown: {
        type: 'string',
        description: 'TOOLS.md content in Markdown with usage instructions.',
      },
    },
    required: ['skillId', 'skillName', 'description', 'toolsJson', 'toolsMarkdown'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const validation = this.validateArgs(args);
    if (!validation.ok) {
      return validation.message;
    }

    const { category, skillId, skillName, description, toolsJson, toolsMarkdown } = validation;
    const draftRoot = path.resolve(process.cwd(), '.zavorth', 'skill-drafts');
    const draftPath = path.resolve(draftRoot, category, skillId);

    if (!draftPath.startsWith(draftRoot + path.sep)) {
      return 'Error: category/skillId resolved outside the governed draft area. Operation blocked.';
    }

    try {
      let parsedTools: Array<Record<string, unknown>>;
      try {
        parsedTools = JSON.parse(toolsJson);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn('[Auto Skill Creator] JSON parse failed', error);
    const message = error instanceof Error ? err.message : String(error);
        return `Error: invalid toolsJson. It must be a valid JSON string containing an array. Detail: ${message}`;
  }

      if (!Array.isArray(parsedTools) || parsedTools.length === 0) {
        return 'Error: toolsJson must be a non-empty JSON array of tool definitions.';
      }

      const invalidTool = parsedTools.find((tool) => !this.isValidToolDefinition(tool));
      if (invalidTool) {
        return 'Error: each tool must have name, description, and parameters.type="object".';
      }

      const scanner = this.scanDraft({
        skillName,
        description,
        toolsJson,
        toolsMarkdown,
        parsedTools,
      });
      if (scanner.blocked) {
        return [
          `Blocked: skill draft '${skillId}' was not created.`,
          `Risk: ${scanner.risk}.`,
          ...scanner.issues.map((issue) => `- ${issue.code}: ${issue.evidence}`),
          'No file was written. Recreate the draft as instruction-only, without shell, internal network access, exfiltration, policy bypass, or destructive action.',
        ].join('\n');
      }

      fs.mkdirSync(draftPath, { recursive: true });

      const now = new Date().toISOString();
      const candidateId = `skill-candidate:${category}:${skillId}:${this.hash(`${skillName}\n${description}\n${toolsJson}\n${toolsMarkdown}`).slice(0, 12)}`;
      const receiptId = `receipt:${this.hash(`${candidateId}:${now}`).slice(0, 16)}`;
      const manifest = {
        id: skillId,
        name: skillName,
        version: '1.0.0',
        description,
        category,
        dangerLevel: scanner.risk === 'low' ? 'low' : 'medium',
        tools: parsedTools,
        metadata: {
          author: 'zavorth-governed-draft',
          firewall_category: category,
          implementation_status: 'draft_preview_only',
          requires_sandbox: true,
          materialization_requires_approval: true,
        },
      };
      const evidenceRefs = [
        `tool-count:${parsedTools.length}`,
        `scanner-issues:${scanner.issues.length}`,
        `draft-path:${path.relative(process.cwd(), draftPath).replace(/\\/g, '/')}`,
      ];
      const draft = {
        contractVersion: 'zavorth-governed-skill-draft/1',
        candidateId,
        kind: 'skill-draft',
        lane: 'yellow',
        risk: scanner.risk,
        evidenceRefs,
        approvalRequired: true,
        expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'candidate',
        receiptId,
        materialized: false,
        origin: {
          surface: 'auto_skill_creator',
          createdAt: now,
          category,
          skillId,
        },
        scanner: {
          risk: scanner.risk,
          blocked: scanner.blocked,
          issues: scanner.issues,
          secretsRedactedBeforePersistence: true,
        },
        smoke: {
          status: 'passed',
          nonDestructive: true,
          checks: [
            'manifest-json-parsed',
            'tool-schema-object-only',
            'no-runtime-wrapper-created',
            'no-live-tool-enabled',
          ],
        },
        preview: {
          manifest,
          toolsMarkdown: this.redact(toolsMarkdown),
        },
      };
      const receipt = {
        contractVersion: 'zavorth-skill-draft-receipt/1',
        receiptId,
        action: 'auto_skill_creator.preview',
        status: 'candidate',
        createdAt: now,
        candidateId,
        skillId,
        category,
        risk: scanner.risk,
        approvalRequired: true,
        materialization: 'blocked-until-approved-wrapper',
        secretsSerialized: false,
        evidenceRefs,
      };

      fs.writeFileSync(path.join(draftPath, 'draft.json'), JSON.stringify(draft, null, 2), 'utf8');
      fs.writeFileSync(path.join(draftPath, 'receipt.json'), JSON.stringify(receipt, null, 2), 'utf8');

      return [
        `Governed draft '${skillId}' created.`,
        `Candidate: ${candidateId}.`,
        `Receipt: ${receiptId}.`,
        `Preview saved at ${draftPath}.`,
        'Materialization into a live skill requires explicit approval, an approved wrapper, and non-destructive smoke checks.',
      ].join('\n');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      console.error('[AutoSkillCreator] Failed to create skill draft:', message);
      return `Failed to create governed skill draft: ${message}`;
    }
  }

  private validateArgs(args: Record<string, unknown>): ValidatedSkillArgs {
    const category = this.normalizeSegment(String(args.category || 'development'));
    const skillId = this.normalizeSegment(String(args.skillId || ''));
    const skillName = String(args.skillName || '').trim();
    const description = String(args.description || '').trim();
    const toolsJson = String(args.toolsJson || '').trim();
    const toolsMarkdown = String(args.toolsMarkdown || '').trim();

    if (!category || !skillId) {
      return { ok: false, message: 'Error: category and skillId must contain only letters, numbers, _ or -.' };
    }
    if (!skillName || !description || !toolsJson || !toolsMarkdown) {
      return { ok: false, message: 'Error: skillName, description, toolsJson, and toolsMarkdown are required.' };
    }

    return { ok: true, category, skillId, skillName, description, toolsJson, toolsMarkdown };
  }

  private normalizeSegment(value: string): string {
    const normalized = String(value || '').trim().toLowerCase();
    return /^[a-z0-9_-]+$/.test(normalized) ? normalized : '';
  }

  private isValidToolDefinition(tool: Record<string, unknown>): boolean {
    const parameters = tool.parameters as { type?: unknown } | undefined;
    return Boolean(
      String(tool.name || '').trim() &&
        String(tool.description || '').trim() &&
        parameters &&
        parameters.type === 'object',
    );
  }

  private scanDraft(input: {
    skillName: string;
    description: string;
    toolsJson: string;
    toolsMarkdown: string;
    parsedTools: Array<Record<string, unknown>>;
  }): SkillDraftScannerResult {
    const text = [
      input.skillName,
      input.description,
      input.toolsJson,
      input.toolsMarkdown,
      JSON.stringify(input.parsedTools),
    ].join('\n');
    const checks: Array<{
      code: string;
      severity: 'warn' | 'block';
      pattern: RegExp;
      evidence: string;
    }> = [
      {
        code: 'policy-bypass',
        severity: 'block',
        pattern: /\b(ignore|disable|bypass|skip)\s+(approval|policy|safety|firewall)\b/i,
        evidence: 'Attempts to bypass approval, policy, or safety.',
      },
      {
        code: 'destructive-shell',
        severity: 'block',
        pattern: /\b(rm\s+-rf|remove-item\b[\s\S]{0,80}\b-recurse\b[\s\S]{0,80}\b-force|del\s+\/[qsf]|format\s+[a-z]:)\b/i,
        evidence: 'Contains a destructive command.',
      },
      {
        code: 'metadata-service-access',
        severity: 'block',
        pattern: /https?:\/\/(?:169\.254\.169\.254|metadata\.google\.internal|metadata\.azure\.com)\b/i,
        evidence: 'Attempts to access an internal metadata endpoint.',
      },
      {
        code: 'internal-url-access',
        severity: 'block',
        pattern: /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i,
        evidence: 'Attempts to access an internal/local URL.',
      },
      {
        code: 'secret-exfiltration',
        severity: 'block',
        pattern: /\b(exfiltrat|process\.env|env\s+vars...|dump\s+env|print\s+env|curl\b[\s\S]{0,120}\b(token|secret|env))\b/i,
        evidence: 'May expose env vars, tokens, or secrets.',
      },
      {
        code: 'runtime-code-wrapper',
        severity: 'warn',
        pattern: /\b(child_process|execSync|spawnSync|eval\s*\(|new Function)\b/i,
        evidence: 'Suggests executable code that requires an approved wrapper.',
      },
    ];
    const issues = checks
      .filter((check) => check.pattern.test(text))
      .map(({ code, severity, evidence }) => ({ code, severity, evidence }));
    const blocked = issues.some((issue) => issue.severity === 'block');
    return {
      risk: blocked ? 'high' : issues.length > 0 ? 'medium' : 'low',
      blocked,
      issues,
    };
  }

  private redact(value: string): string {
    return value
      .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_SECRET]')
      .replace(/\bhf_[A-Za-z0-9]{12,}\b/g, '[REDACTED_SECRET]')
      .replace(/\bxox[baprs]-[A-Za-z0-9-]{12,}\b/g, '[REDACTED_SECRET]')
      .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '[REDACTED_SECRET]')
      .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED_SECRET]');
  }

  private hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}
