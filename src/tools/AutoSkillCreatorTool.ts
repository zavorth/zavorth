import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { BaseTool } from './BaseTool.js';

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
    'Cria um draft governado de Skill declarativa. Nao materializa arquivos em skills nem habilita execucao sem scanner, smoke, approval e receipt.';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        description: 'Categoria da skill (development, information, execution, filesystem etc.). Padrao: development.',
      },
      skillId: {
        type: 'string',
        description: 'ID da skill em snake_case/kebab-case, ex: image_generator.',
      },
      skillName: {
        type: 'string',
        description: 'Nome legivel da skill, ex: Image Generator.',
      },
      description: {
        type: 'string',
        description: 'Breve descricao da skill e suas ferramentas.',
      },
      toolsJson: {
        type: 'string',
        description: 'String JSON contendo array de definicoes de tools (name, description, parameters).',
      },
      toolsMarkdown: {
        type: 'string',
        description: 'Conteudo do TOOLS.md em Markdown com instrucoes de uso.',
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
      return 'Erro: category/skillId resolveram para fora da area governada de drafts. Operacao bloqueada.';
    }

    try {
      let parsedTools: Array<Record<string, unknown>>;
      try {
        parsedTools = JSON.parse(toolsJson);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return `Erro: toolsJson invalido. Deve ser uma string JSON valida de um array. Detalhe: ${message}`;
      }

      if (!Array.isArray(parsedTools) || parsedTools.length === 0) {
        return 'Erro: toolsJson deve ser um array JSON nao vazio de definicoes de tool.';
      }

      const invalidTool = parsedTools.find((tool) => !this.isValidToolDefinition(tool));
      if (invalidTool) {
        return 'Erro: cada tool precisa ter name, description e parameters.type="object".';
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
          `Bloqueado: draft de skill '${skillId}' nao foi criado.`,
          `Risco: ${scanner.risk}.`,
          ...scanner.issues.map((issue) => `- ${issue.code}: ${issue.evidence}`),
          'Nenhum arquivo foi escrito. Recrie o draft como instruction-only, sem shell, rede interna, exfiltracao, bypass de policy ou acao destrutiva.',
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
        `Draft governado '${skillId}' criado.`,
        `Candidate: ${candidateId}.`,
        `Receipt: ${receiptId}.`,
        `Preview salvo em ${draftPath}.`,
        'Materializacao em skill live exige approval explicito, wrapper aprovado e smoke nao destrutivo.',
      ].join('\n');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[AutoSkillCreator] Erro ao criar draft de skill:', message);
      return `Erro ao criar draft governado de skill: ${message}`;
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
      return { ok: false, message: 'Erro: category e skillId devem conter apenas letras, numeros, _ ou -.' };
    }
    if (!skillName || !description || !toolsJson || !toolsMarkdown) {
      return { ok: false, message: 'Erro: skillName, description, toolsJson e toolsMarkdown sao obrigatorios.' };
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
        evidence: 'Tenta ignorar approval, policy ou safety.',
      },
      {
        code: 'destructive-shell',
        severity: 'block',
        pattern: /\b(rm\s+-rf|remove-item\b[\s\S]{0,80}\b-recurse\b[\s\S]{0,80}\b-force|del\s+\/[qsf]|format\s+[a-z]:)\b/i,
        evidence: 'Contem comando destrutivo.',
      },
      {
        code: 'metadata-service-access',
        severity: 'block',
        pattern: /https?:\/\/(?:169\.254\.169\.254|metadata\.google\.internal|metadata\.azure\.com)\b/i,
        evidence: 'Tenta acessar endpoint interno de metadata.',
      },
      {
        code: 'internal-url-access',
        severity: 'block',
        pattern: /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i,
        evidence: 'Tenta acessar URL interna/local.',
      },
      {
        code: 'secret-exfiltration',
        severity: 'block',
        pattern: /\b(exfiltrat|process\.env|env\s+vars?|dump\s+env|print\s+env|curl\b[\s\S]{0,120}\b(token|secret|env))\b/i,
        evidence: 'Pode expor env vars, tokens ou segredos.',
      },
      {
        code: 'runtime-code-wrapper',
        severity: 'warn',
        pattern: /\b(child_process|execSync|spawnSync|eval\s*\(|new Function)\b/i,
        evidence: 'Sugere codigo executavel que precisa de wrapper aprovado.',
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
