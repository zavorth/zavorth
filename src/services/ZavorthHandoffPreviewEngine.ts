import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { config } from '../config/index.js';
import {
  ZAVORTH_HANDOFF_ENVELOPE_VERSION,
  ZAVORTH_HANDOFF_ENVELOPE_SECTION_TITLES,
  ZAVORTH_HANDOFF_ENVELOPE_SECTION_ORDER,
  type ZavorthHandoffEnvelopeInput,
  type ZavorthHandoffEnvelopeSnapshot,
  type ZavorthHandoffEnvelopeSection,
  type ZavorthHandoffEnvelopeSectionId,
} from '../contracts/ZavorthHandoffEnvelopeContract.js';
import { ZavorthMnemosCompilerService } from './ZavorthMnemosCompilerService.js';
import { logger } from '../logger.js';

type HandoffFsRuntime = Pick<
  typeof fs,
  'existsSync' | 'readFileSync' | 'writeFileSync' | 'mkdirSync'
>;

export type ZavorthHandoffPreviewEngineRuntime = Partial<HandoffFsRuntime> & {
  now?: () => Date;
  projectRoot?: string;
};

export class ZavorthHandoffPreviewEngine {
  private readonly fsRuntime: HandoffFsRuntime;
  private readonly now: () => Date;
  private readonly projectRoot: string;

  constructor(runtime: ZavorthHandoffPreviewEngineRuntime = {}) {
    this.fsRuntime = {
      existsSync: runtime.existsSync || fs.existsSync.bind(fs),
      readFileSync: runtime.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: runtime.writeFileSync || fs.writeFileSync.bind(fs),
      mkdirSync: runtime.mkdirSync || fs.mkdirSync.bind(fs),
    };
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || config.projectRoot);
  }

  public buildSnapshot(input: ZavorthHandoffEnvelopeInput = {}): ZavorthHandoffEnvelopeSnapshot {
    const generatedAt = this.now().toISOString();
    const sessionId = input.sessionId || null;
    const workspace = input.workspace || this.projectRoot;
    const operator = input.operator || 'Zavorth Operator';

    // Initialize compiler to read event bus logs
    const compiler = new ZavorthMnemosCompilerService({
      existsSync: this.fsRuntime.existsSync,
      readFileSync: this.fsRuntime.readFileSync,
      writeFileSync: this.fsRuntime.writeFileSync,
      mkdirSync: this.fsRuntime.mkdirSync,
    });
    const events = compiler.readEvents(workspace);

    // 1. Active Mandate
    let activeMandate = input.activeMandate || null;
    if (!activeMandate) {
      const activeWorkflow = events.find((e) => e.type === 'workflow' && e.payload.status === 'in_progress');
      if (activeWorkflow) {
        activeMandate = activeWorkflow.payload.objective || null;
      }
    }
    if (!activeMandate) {
      activeMandate = 'Aguardando novo mandato consolidado do operador.';
    }

    // 2. Current Architecture Decisions
    let architectureDecisions = input.architectureDecisions || null;
    if (!architectureDecisions) {
      const archPath = path.join(workspace, '.zavorth', 'wiki', 'architecture.md');
      if (this.fsRuntime.existsSync(archPath)) {
        try {
          const content = String(this.fsRuntime.readFileSync(archPath, 'utf8'));
          const match = content.match(/## Decisions\s*\n([^#]+)/);
          if (match) {
            architectureDecisions = match[1]
              .split('\n')
              .map((line) => line.trim().replace(/^-\s*/, ''))
              .filter(Boolean);
          }
        } catch (error: any) {
      // Fallback if read fails
      logger.warn('[Zavorth Handoff Preview Engine] filesystem operation failed', error);
    }
      }
    }
    if (!architectureDecisions || architectureDecisions.length === 0) {
      architectureDecisions = ['Nenhuma decisao de arquitetura duravel catalogada nesta sessao.'];
    }

    // 3. Modified Paths
    let modifiedPaths = input.modifiedPaths || null;
    if (!modifiedPaths) {
      const touchedFiles = new Set<string>();
      events
        .filter((e) => e.type === 'tool' && Array.isArray(e.payload.filesTouched))
        .forEach((e) => {
          e.payload.filesTouched.forEach((file: string) => touchedFiles.add(file));
        });
      modifiedPaths = Array.from(touchedFiles);
    }
    if (modifiedPaths.length === 0) {
      modifiedPaths = ['Nenhum arquivo modificado ou tocado nesta sessao ativa.'];
    }

    // 4. Tool Failure Log
    const failedTools = events
      .filter((e) => e.type === 'tool' && e.payload.status === 'failed')
      .map((e) => `Tool: ${e.payload.toolName} (Run ID: ${e.payload.runId})`);
    
    // 5. Security Approvals Granted
    let securityApprovals = input.securityApprovals || null;
    if (!securityApprovals) {
      securityApprovals = events
        .filter((e) => e.type === 'permission' && e.payload.status === 'approved')
        .map((e) => `Scope: ${e.payload.scope || e.payload.kind} (Permission ID: ${e.payload.permissionId})`);
    }
    if (securityApprovals.length === 0) {
      securityApprovals = ['Nenhuma permissao de seguranca elevada foi aprovada ou concedida nesta sessao.'];
    }

    // 6. Verbatim User Directives
    const verbatimUserDirectives = events
      .filter((e) => e.type === 'message' && e.payload.role === 'user')
      .slice(-5)
      .map((e) => String(e.payload.content || '').trim());

    // 7. Remaining TODO Checklist
    let remainingTodos = input.remainingTodos || null;
    if (!remainingTodos) {
      const taskMdPath = path.join(workspace, '.zavorth', 'wiki', 'skills.md');
      if (this.fsRuntime.existsSync(taskMdPath)) {
        try {
          const content = String(this.fsRuntime.readFileSync(taskMdPath, 'utf8'));
          const match = content.match(/## Current Facts\s*\n([^#]+)/);
          if (match) {
            remainingTodos = match[1]
              .split('\n')
              .map((line) => line.trim().replace(/^-\s*/, ''))
              .filter(Boolean);
          }
        } catch (error: any) {
      // Fallback if read fails
      logger.warn('[Zavorth Handoff Preview Engine] filesystem operation failed', error);
    }
      }
    }
    if (!remainingTodos || remainingTodos.length === 0) {
      remainingTodos = ['Todas as tarefas da sessao ativa foram concluidas com sucesso.'];
    }

    // 8. Simulated State Preview
    let simulatedStatePreview = input.simulatedStatePreview || null;
    if (!simulatedStatePreview) {
      simulatedStatePreview = [
        `Captured Events: ${events.length}`,
        `Unique Files Touched: ${events.filter((e) => e.type === 'tool').length}`,
        `Security Permits Handled: ${events.filter((e) => e.type === 'permission').length}`,
        `Active Continuities: 1`,
      ];
    }

    // 9. Next Prescribed Action
    let nextPrescribedAction = input.nextPrescribedAction || null;
    if (!nextPrescribedAction) {
      const pendingTask = events.find((e) => e.type === 'task' && e.payload.status === 'pending');
      if (pendingTask) {
        nextPrescribedAction = `Retomar tarefa pendente: ${pendingTask.payload.taskId}`;
      } else {
        nextPrescribedAction = 'Sessao alinhada e finalizada. Pronto para o proximo briefing.';
      }
    }

    // Assemble sections
    const sections: ZavorthHandoffEnvelopeSection[] = ZAVORTH_HANDOFF_ENVELOPE_SECTION_ORDER.map((id) => {
      let items: string[] = [];
      if (id === 'active-mandate') items = [activeMandate!];
      else if (id === 'current-architecture-decisions') items = architectureDecisions!;
      else if (id === 'modified-paths') items = modifiedPaths!;
      else if (id === 'tool-failure-log') items = failedTools.length > 0 ? failedTools : ['Nenhuma falha de ferramenta registrada nesta sessao ativa.'];
      else if (id === 'security-approvals-granted') items = securityApprovals!;
      else if (id === 'verbatim-user-directives') items = verbatimUserDirectives.length > 0 ? verbatimUserDirectives : ['Nenhuma diretiva explicita capturada do operador.'];
      else if (id === 'remaining-todo-checklist') items = remainingTodos!;
      else if (id === 'simulated-state-preview') items = simulatedStatePreview!;
      else if (id === 'next-prescribed-action') items = [nextPrescribedAction!];

      return {
        id,
        title: ZAVORTH_HANDOFF_ENVELOPE_SECTION_TITLES[id],
        items: items.map((item) => redactSecrets(item)),
      };
    });

    const markdown = this.compileMarkdown(sessionId, generatedAt, operator, sections);

    return {
      version: ZAVORTH_HANDOFF_ENVELOPE_VERSION,
      generatedAt,
      status: 'preview-ready',
      sessionId,
      workspace,
      operator,
      sections,
      markdown,
      receipt: {
        id: `mnemos-handoff-${crypto.randomBytes(6).toString('hex')}`,
        providerCall: false,
        durableMutation: false,
        toolExecution: false,
        secretsRedacted: true,
        approvalRequiredToPersist: true,
      },
    };
  }

  public persistHandoff(workspaceRoot: string, snapshot: ZavorthHandoffEnvelopeSnapshot): string {
    const root = path.resolve(workspaceRoot || config.projectRoot);
    const filePath = path.join(root, '.zavorth', 'memory', 'handoff-envelope.md');
    this.fsRuntime.mkdirSync(path.dirname(filePath), { recursive: true });
    
    // Always double-ensure redaction before writing to disk
    const cleanMarkdown = redactSecrets(snapshot.markdown);
    this.fsRuntime.writeFileSync(filePath, cleanMarkdown, 'utf8');
    return filePath;
  }

  private compileMarkdown(
    sessionId: string | null,
    generatedAt: string,
    operator: string,
    sections: ZavorthHandoffEnvelopeSection[],
  ): string {
    const lines = [
      '# Zavorth Handoff Envelope',
      '',
      `> [!NOTE]`,
      `> **Session ID**: \`${sessionId || 'N/A'}\` | **Generated At**: \`${generatedAt}\` | **Operator**: \`${operator}\``,
      `> Esse envelope de handoff contem a consolidacao governada do ciclo de vida da sessao para portabilidade entre modelos de IA.`,
      '',
    ];

    for (const section of sections) {
      lines.push(`## ${section.title}`);
      lines.push('');
      if (section.items.length === 1 && (section.id === 'active-mandate' || section.id === 'next-prescribed-action')) {
        lines.push(`> ${section.items[0]}`);
      } else {
        section.items.forEach((item) => {
          lines.push(`- ${item}`);
        });
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('*Mnemos Memory OS · Native & Governed Local Continuity*');

    return lines.join('\n');
  }
}

function redactSecrets(value: string): string {
  return String(value || '')
    .replace(/\b(token|api[_ -]?key|secret|senha|password|chave)\s*[:=]\s*([^\s,;]+)/gi, '$1=[redacted-secret]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g, '[redacted-secret]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, '[redacted-secret]')
    .replace(/\bAIza[0-9A-Za-z_-]{16,}\b/g, '[redacted-secret]')
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, '[redacted-secret]');
}
