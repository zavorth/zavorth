import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';
import type { ZavorthMutationPlan } from '../../contracts/ZavorthMutationPlaneContract.js';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';
import { asErrorLike } from '../../utils/errorLike.js';

export type AgentRunIntelligenceFabricDraftWorkspaceWrite = {
  path: string;
  content: string;
  actionId?: string | null;
  description?: string | null;
};

export type AgentRunIntelligenceFabricDraftWorkspacePatchHunk = {
  search: string;
  replace: string;
  description?: string | null;
};

export type AgentRunIntelligenceFabricDraftWorkspacePatch = {
  path: string;
  search?: string | null;
  replace?: string | null;
  hunks: AgentRunIntelligenceFabricDraftWorkspacePatchHunk[];
  actionId?: string | null;
  description?: string | null;
};

export type AgentRunIntelligenceFabricDraftWorkspacePatchPreview = {
  status: 'passed' | 'blocked';
  summary: string;
  files: Array<{
    path: string;
    status: 'passed' | 'blocked';
    hunkCount: number;
    beforeHash: string | null;
    afterHash: string | null;
    reasons: string[];
  }>;
  blockedReasons: string[];
  ambiguous: boolean;
  sideEffectsApplied: false;
};

export type AgentRunIntelligenceFabricDraftWorkspaceDiffReceipt = {
  id: string;
  title: string;
  summary: string;
  riskLevel: 3;
  approvalRequired: boolean;
  applyRequiresRequest: true;
  rollbackAvailable: true;
  verifier: {
    status: AgentRunIntelligenceFabricDraftWorkspacePatchPreview['status'];
    summary: string;
    ambiguous: boolean;
    sideEffectsApplied: false;
  };
  files: Array<{
    path: string;
    operation: 'write' | 'patch';
    status: 'passed' | 'blocked';
    hunkCount: number;
    beforeHash: string | null;
    afterHash: string | null;
    reasons: string[];
    hunks: Array<{
      index: number;
      searchPreview: string | null;
      replacePreview: string;
      searchBytes: number;
      replaceBytes: number;
    }>;
  }>;
  receipts: string[];
};

export type AgentRunIntelligenceFabricDraftExecutionResult = {
  status: 'applied' | 'blocked' | 'failed';
  ok: boolean;
  summary: string;
  appliedActions: string[];
  rollbackAvailable: boolean;
  rollbackArtifactPath: string | null;
  touchedFiles: string[];
  blockedReasons: string[];
};

type RollbackRecord = {
  targetPath: string;
  relativePath: string;
  existedBefore: boolean;
  previousContent: string | null;
  previousHash: string | null;
  newHash: string;
  actionLabel: string;
};

type ProposedActionRecord = {
  id: string;
  kind: string;
  target: string;
  reversible: boolean;
  insideWorkspace: boolean;
  riskLevel: number;
};

type DraftWorkspaceExecutorRuntime = {
  rollbackRoot?: string | null;
};

const MAX_WRITE_BYTES = 2 * 1024 * 1024;

export class AgentRunIntelligenceFabricDraftWorkspaceExecutor {
  private readonly rollbackRoot: string;

  constructor(runtime: DraftWorkspaceExecutorRuntime = {}) {
    this.rollbackRoot = runtime.rollbackRoot || path.resolve(config.projectRoot, 'data', 'runtime', 'intelligence-fabric-rollbacks');
  }

  public executePlan(input: {
    run: UniversalAgentRun;
    plan: ZavorthMutationPlan;
  }): AgentRunIntelligenceFabricDraftExecutionResult {
    const payload = readRecord(input.plan.payload);
    if (payload.source !== 'IntelligenceFabricCanary' || payload.applyRequiresRiskGate !== true) {
      return blocked('Plano nao pertence ao fluxo governado do Intelligence Fabric.');
    }
    if (payload.liveActionApplied === true) {
      return blocked('Plano rejeitado porque declara impacto live anterior.');
    }
    const proposedActions = parseProposedActions(payload.proposedActions);
    const unsafeAction = proposedActions.find((action) => !isSafeRisk3WorkspaceWriteAction(action));
    if (unsafeAction) {
      return blocked(`Acao ${unsafeAction.id || unsafeAction.kind} nao e write/edit reversivel de Risk 3 dentro do workspace.`);
    }
    const workspaceRoot = stringOrNull(payload.workspaceRoot) || input.run.workspace || null;
    if (!workspaceRoot) {
      return blocked('Workspace root ausente; nao ha alvo controlado para aplicar o rascunho.');
    }
    const writes = parseWorkspaceWrites(payload.workspaceWrites);
    const patches = parseWorkspacePatches(payload.workspacePatches);
    if (writes.length === 0 && patches.length === 0) {
      return blocked('Nenhuma workspaceWrites explicita ou workspacePatches explicito foi encontrado; o executor nao inventa conteudo.');
    }
    const patchVerifier = readRecord(payload.workspacePatchVerifier);
    if (patches.length > 0 && patchVerifier.status === 'blocked') {
      return blocked(stringOrNull(patchVerifier.summary) || 'Preview/verifier de workspacePatches bloqueou o apply.');
    }

    try {
      const normalizedRoot = path.resolve(workspaceRoot);
      const materialized = this.materializeWorkspaceEdits({
        root: normalizedRoot,
        writes,
        patches,
      });
      if (materialized.blockedReason) {
        return blocked(materialized.blockedReason);
      }
      const records: RollbackRecord[] = [];
      for (const entry of materialized.entries) {
        const { write, actionLabel } = entry;
        const targetPath = WorkspaceResolver.ensurePathInsideWorkspace(normalizedRoot, write.path);
        const relativePath = path.relative(normalizedRoot, targetPath).replace(/\\/g, '/');
        const blockedReason = validateWrite(write, relativePath);
        if (blockedReason) {
          return blocked(blockedReason);
        }
        const existedBefore = fs.existsSync(targetPath);
        const previousContent = existedBefore ? fs.readFileSync(targetPath, 'utf8') : null;
        records.push({
          targetPath,
          relativePath,
          existedBefore,
          previousContent,
          previousHash: previousContent === null ? null : sha256(previousContent),
          newHash: sha256(write.content),
          actionLabel,
        });
      }

      const rollbackArtifactPath = this.writeRollbackArtifact(input.plan.id, records);
      try {
        materialized.entries.forEach((entry, index) => {
          const { write } = entry;
          const record = records[index];
          fs.mkdirSync(path.dirname(record.targetPath), { recursive: true });
          fs.writeFileSync(record.targetPath, write.content, 'utf8');
        });
      } catch (error: unknown) {
        const err = asErrorLike(error);
        this.restoreRollback(records);
        return {
          status: 'failed',
          ok: false,
          summary: `Falha ao aplicar rascunho; rollback local executado: ${error instanceof Error ? err.message : String(error)}`,
          appliedActions: [],
          rollbackAvailable: true,
          rollbackArtifactPath,
          touchedFiles: records.map((record) => record.relativePath),
          blockedReasons: [],
        };
      }

      return {
        status: 'applied',
        ok: true,
        summary: `${records.length} edicao(oes) reversivel(is) aplicada(s) dentro do workspace.`,
        appliedActions: records.map((record) => actionLabel(record)),
        rollbackAvailable: true,
        rollbackArtifactPath,
        touchedFiles: records.map((record) => record.relativePath),
        blockedReasons: [],
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      return blocked(error instanceof Error ? err.message : String(error));
    }
  }

  public restoreFromArtifact(rollbackArtifactPath: string): AgentRunIntelligenceFabricDraftExecutionResult {
    try {
      const absolute = path.resolve(rollbackArtifactPath);
      if (!absolute.startsWith(path.resolve(this.rollbackRoot))) {
        return blocked('Rollback artifact fora da raiz controlada.');
      }
      const records = JSON.parse(fs.readFileSync(absolute, 'utf8')) as RollbackRecord[];
      this.restoreRollback(records);
      return {
        status: 'applied',
        ok: true,
        summary: `${records.length} arquivo(s) restaurado(s) a partir do rollback artifact.`,
        appliedActions: records.map((record) => `workspace-rollback:${record.relativePath}`),
        rollbackAvailable: true,
        rollbackArtifactPath: absolute,
        touchedFiles: records.map((record) => record.relativePath),
        blockedReasons: [],
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      return {
        status: 'failed',
        ok: false,
        summary: `Falha ao restaurar rollback artifact: ${error instanceof Error ? err.message : String(error)}`,
        appliedActions: [],
        rollbackAvailable: false,
        rollbackArtifactPath: rollbackArtifactPath || null,
        touchedFiles: [],
        blockedReasons: [],
      };
    }
  }

  private writeRollbackArtifact(planId: string, records: RollbackRecord[]): string {
    const safePlanId = String(planId || 'plan').replace(/[^a-zA-Z0-9_.:-]/g, '-');
    const dir = path.join(this.rollbackRoot, safePlanId);
    fs.mkdirSync(dir, { recursive: true });
    const artifactPath = path.join(dir, 'rollback.json');
    fs.writeFileSync(artifactPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    return artifactPath;
  }

  private restoreRollback(records: RollbackRecord[]): void {
    for (const record of records.slice().reverse()) {
      if (record.existedBefore) {
        fs.mkdirSync(path.dirname(record.targetPath), { recursive: true });
        fs.writeFileSync(record.targetPath, record.previousContent || '', 'utf8');
      } else if (fs.existsSync(record.targetPath)) {
        fs.unlinkSync(record.targetPath);
      }
    }
  }

  private materializeWorkspaceEdits(input: {
    root: string;
    writes: AgentRunIntelligenceFabricDraftWorkspaceWrite[];
    patches: AgentRunIntelligenceFabricDraftWorkspacePatch[];
  }): {
    entries: Array<{ write: AgentRunIntelligenceFabricDraftWorkspaceWrite; actionLabel: string }>;
    blockedReason: string | null;
  } {
    const entries = input.writes.map((write) => ({
      write,
      actionLabel: `workspace-write:${write.path.replace(/\\/g, '/')}`,
    }));
    for (const patch of input.patches) {
      const targetPath = WorkspaceResolver.ensurePathInsideWorkspace(input.root, patch.path);
      const relativePath = path.relative(input.root, targetPath).replace(/\\/g, '/');
      const blockedReason = validatePatch(patch, relativePath);
      if (blockedReason) {
        return { entries: [], blockedReason };
      }
      if (!fs.existsSync(targetPath)) {
        return { entries: [], blockedReason: `Patch bloqueado porque o arquivo alvo nao existe: ${relativePath}.` };
      }
      const currentContent = fs.readFileSync(targetPath, 'utf8');
      const patchResult = applyStructuredPatch(currentContent, patch, relativePath);
      if (patchResult.blockedReason) {
        return { entries: [], blockedReason: patchResult.blockedReason };
      }
      entries.push({
        write: {
          path: relativePath,
          content: patchResult.content,
          actionId: patch.actionId,
          description: patch.description || 'Patch estruturado materializado pelo Intelligence Fabric.',
        },
        actionLabel: `workspace-patch:${relativePath}`,
      });
    }
    return { entries, blockedReason: null };
  }
}

export function extractDraftWorkspaceWrites(value: unknown): AgentRunIntelligenceFabricDraftWorkspaceWrite[] {
  return parseWorkspaceWrites(value).filter((write) => !looksLikeSecret(write.path) && !looksLikeSecret(write.content));
}

export function extractDraftWorkspacePatches(value: unknown): AgentRunIntelligenceFabricDraftWorkspacePatch[] {
  return parseWorkspacePatches(value).filter((patch) => (
    !looksLikeSecret(patch.path)
    && patch.hunks.every((hunk) => !looksLikeSecret(hunk.search) && !looksLikeSecret(hunk.replace))
  ));
}

export function previewDraftWorkspacePatches(input: {
  workspaceRoot?: string | null;
  patches: AgentRunIntelligenceFabricDraftWorkspacePatch[];
}): AgentRunIntelligenceFabricDraftWorkspacePatchPreview {
  if (input.patches.length === 0) {
    return {
      status: 'passed',
      summary: 'Nenhum workspacePatch para verificar.',
      files: [],
      blockedReasons: [],
      ambiguous: false,
      sideEffectsApplied: false,
    };
  }
  const workspaceRoot = stringOrNull(input.workspaceRoot);
  if (!workspaceRoot) {
    return patchPreviewBlocked('Workspace root ausente; nao ha alvo controlado para verificar patches.');
  }
  const root = path.resolve(workspaceRoot);
  const files: AgentRunIntelligenceFabricDraftWorkspacePatchPreview['files'] = [];
  const blockedReasons: string[] = [];
  let ambiguous = false;
  for (const patch of input.patches) {
    try {
      const targetPath = WorkspaceResolver.ensurePathInsideWorkspace(root, patch.path);
      const relativePath = path.relative(root, targetPath).replace(/\\/g, '/');
      const validation = validatePatch(patch, relativePath);
      if (validation) {
        files.push(patchPreviewFile(relativePath, patch, 'blocked', null, null, [validation]));
        blockedReasons.push(validation);
        ambiguous = ambiguous || validation.includes('inequivoco') || validation.includes('aparece');
        continue;
      }
      if (!fs.existsSync(targetPath)) {
        const reason = `Patch bloqueado porque o arquivo alvo nao existe: ${relativePath}.`;
        files.push(patchPreviewFile(relativePath, patch, 'blocked', null, null, [reason]));
        blockedReasons.push(reason);
        continue;
      }
      const currentContent = fs.readFileSync(targetPath, 'utf8');
      const patchResult = applyStructuredPatch(currentContent, patch, relativePath);
      if (patchResult.blockedReason) {
        files.push(patchPreviewFile(relativePath, patch, 'blocked', sha256(currentContent), null, [patchResult.blockedReason]));
        blockedReasons.push(patchResult.blockedReason);
        ambiguous = ambiguous || patchResult.blockedReason.includes('inequivoco') || patchResult.blockedReason.includes('aparece');
        continue;
      }
      files.push(patchPreviewFile(relativePath, patch, 'passed', sha256(currentContent), sha256(patchResult.content), []));
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const reason = error instanceof Error ? err.message : String(error);
      files.push(patchPreviewFile(patch.path, patch, 'blocked', null, null, [reason]));
      blockedReasons.push(reason);
    }
  }
  const status = blockedReasons.length > 0 ? 'blocked' : 'passed';
  return {
    status,
    summary: status === 'passed'
      ? `${files.length} arquivo(s) verificado(s) para patch multi-hunk sem side effect.`
      : `${blockedReasons.length} problema(s) bloquearam o preview de patch multi-hunk.`,
    files,
    blockedReasons,
    ambiguous,
    sideEffectsApplied: false,
  };
}

export function buildDraftWorkspaceDiffReceipt(input: {
  id: string;
  workspaceWrites: AgentRunIntelligenceFabricDraftWorkspaceWrite[];
  workspacePatches: AgentRunIntelligenceFabricDraftWorkspacePatch[];
  patchPreview: AgentRunIntelligenceFabricDraftWorkspacePatchPreview;
  approvalRequired: boolean;
}): AgentRunIntelligenceFabricDraftWorkspaceDiffReceipt {
  const patchFiles = new Map(input.patchPreview.files.map((file) => [file.path, file]));
  const writeFiles = input.workspaceWrites.map((write) => ({
    path: write.path.replace(/\\/g, '/'),
    operation: 'write' as const,
    status: 'passed' as const,
    hunkCount: 1,
    beforeHash: null,
    afterHash: sha256(write.content),
    reasons: [],
    hunks: [
      {
        index: 1,
        searchPreview: null,
        replacePreview: previewText(write.content),
        searchBytes: 0,
        replaceBytes: Buffer.byteLength(write.content, 'utf8'),
      },
    ],
  }));
  const patchReceiptFiles = input.workspacePatches.map((patch) => {
    const normalizedPath = patch.path.replace(/\\/g, '/');
    const preview = patchFiles.get(normalizedPath);
    return {
      path: normalizedPath,
      operation: 'patch' as const,
      status: preview?.status || 'blocked' as const,
      hunkCount: patch.hunks.length,
      beforeHash: preview?.beforeHash || null,
      afterHash: preview?.afterHash || null,
      reasons: preview?.reasons || [],
      hunks: patch.hunks.map((hunk, index) => ({
        index: index + 1,
        searchPreview: previewText(hunk.search),
        replacePreview: previewText(hunk.replace),
        searchBytes: Buffer.byteLength(hunk.search, 'utf8'),
        replaceBytes: Buffer.byteLength(hunk.replace, 'utf8'),
      })),
    };
  });
  const fileCount = writeFiles.length + patchReceiptFiles.length;
  const hunkCount = [...writeFiles, ...patchReceiptFiles].reduce((sum, file) => sum + file.hunkCount, 0);
  return {
    id: input.id,
    title: 'Intelligence Fabric diff receipt',
    summary: `${fileCount} arquivo(s), ${hunkCount} hunk(s), Risk 3 reversivel, apply pendente de pedido explicito.`,
    riskLevel: 3,
    approvalRequired: input.approvalRequired,
    applyRequiresRequest: true,
    rollbackAvailable: true,
    verifier: {
      status: input.patchPreview.status,
      summary: input.patchPreview.summary,
      ambiguous: input.patchPreview.ambiguous,
      sideEffectsApplied: false,
    },
    files: [...writeFiles, ...patchReceiptFiles],
    receipts: [
      'workspace-diff-receipt',
      'diff-receipt-no-live-action',
      'diff-receipt-risk-3',
      ...(input.patchPreview.status === 'blocked' ? ['diff-receipt-verifier-blocked'] : ['diff-receipt-verifier-passed']),
    ],
  };
}

export function planDraftWorkspaceWritesFromRun(input: {
  run: UniversalAgentRun;
}): AgentRunIntelligenceFabricDraftWorkspaceWrite[] {
  const text = String(input.run.input || '').trim();
  if (!/\b(notas?|notes?)\b/i.test(text) || !/\b(escreva|crie|salve|write|create|save)\b/i.test(text)) {
    return [];
  }
  return [
    {
      path: 'notes/intelligence-fabric-draft.txt',
      content: [
        'Rascunho preparado pelo Intelligence Fabric.',
        '',
        `Pedido original: ${text}`,
        '',
      ].join('\n'),
      actionId: 'action-workspace-impact',
      description: 'Nota simples planejada a partir do draft Risk 3.',
    },
  ];
}

export function planDraftWorkspacePatchesFromRun(input: {
  run: UniversalAgentRun;
}): AgentRunIntelligenceFabricDraftWorkspacePatch[] {
  const text = String(input.run.input || '').trim();
  const patch = parseNaturalPatchRequest(text);
  return patch ? [patch] : [];
}

function parseWorkspaceWrites(value: unknown): AgentRunIntelligenceFabricDraftWorkspaceWrite[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => readRecord(entry))
    .map((entry) => ({
      path: stringOrNull(entry.path) || stringOrNull(entry.target) || '',
      content: typeof entry.content === 'string' ? entry.content : typeof entry.newContent === 'string' ? entry.newContent : '',
      actionId: stringOrNull(entry.actionId),
      description: stringOrNull(entry.description),
    }))
    .filter((entry) => entry.path && entry.content !== '');
}

function parseWorkspacePatches(value: unknown): AgentRunIntelligenceFabricDraftWorkspacePatch[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const patches: AgentRunIntelligenceFabricDraftWorkspacePatch[] = [];
  for (const entryValue of value) {
    const entry = readRecord(entryValue);
    const pathValue = stringOrNull(entry.path) || stringOrNull(entry.target) || '';
    const hunks = parsePatchHunks(entry);
    if (pathValue && hunks.length > 0) {
      patches.push({
        path: pathValue,
        search: hunks[0].search,
        replace: hunks[0].replace,
        hunks,
        actionId: stringOrNull(entry.actionId),
        description: stringOrNull(entry.description),
      });
    }
  }
  return patches;
}

function parseProposedActions(value: unknown): ProposedActionRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => {
    const record = readRecord(entry);
    return {
      id: stringOrNull(record.id) || 'action',
      kind: stringOrNull(record.kind) || 'unknown',
      target: stringOrNull(record.target) || 'workspace',
      reversible: record.reversible === true,
      insideWorkspace: record.insideWorkspace === true,
      riskLevel: Number(record.riskLevel || 0),
    };
  });
}

function isSafeRisk3WorkspaceWriteAction(action: ProposedActionRecord): boolean {
  return ['write', 'edit'].includes(action.kind)
    && action.reversible
    && action.insideWorkspace
    && action.riskLevel <= 3
    && !looksLikeSecret(action.target);
}

function validateWrite(write: AgentRunIntelligenceFabricDraftWorkspaceWrite, relativePath: string): string | null {
  if (!write.path || !relativePath || relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
    return 'Caminho de escrita invalido ou fora do workspace.';
  }
  if (looksLikeSecret(relativePath) || looksLikeSecret(write.content)) {
    return 'Escrita bloqueada porque o alvo ou conteudo parece conter segredo.';
  }
  if (Buffer.byteLength(write.content, 'utf8') > MAX_WRITE_BYTES) {
    return 'Escrita bloqueada porque excede o limite de tamanho do draft reversivel.';
  }
  return null;
}

function validatePatch(patch: AgentRunIntelligenceFabricDraftWorkspacePatch, relativePath: string): string | null {
  if (!patch.path || !relativePath || relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
    return 'Caminho de patch invalido ou fora do workspace.';
  }
  if (!Array.isArray(patch.hunks) || patch.hunks.length === 0) {
    return 'Patch bloqueado porque nao ha hunks estruturados.';
  }
  if (patch.hunks.length > 12) {
    return 'Patch bloqueado porque excede 12 hunks em um unico arquivo.';
  }
  for (const hunk of patch.hunks) {
    if (!hunk.search) {
      return 'Patch bloqueado porque um hunk tem search vazio.';
    }
    if (looksLikeSecret(relativePath) || looksLikeSecret(hunk.search) || looksLikeSecret(hunk.replace)) {
      return 'Patch bloqueado porque o alvo ou conteudo parece conter segredo.';
    }
    if (Buffer.byteLength(hunk.search, 'utf8') > MAX_WRITE_BYTES || Buffer.byteLength(hunk.replace, 'utf8') > MAX_WRITE_BYTES) {
      return 'Patch bloqueado porque excede o limite de tamanho do draft reversivel.';
    }
  }
  return null;
}

function applyStructuredPatch(
  currentContent: string,
  patch: AgentRunIntelligenceFabricDraftWorkspacePatch,
  relativePath: string,
): { content: string; blockedReason: string | null } {
  let content = currentContent;
  for (const [index, hunk] of patch.hunks.entries()) {
    const occurrenceCount = countOccurrences(content, hunk.search);
    if (occurrenceCount === 0) {
      return { content: currentContent, blockedReason: `Patch bloqueado porque o hunk ${index + 1} nao foi encontrado em ${relativePath}.` };
    }
    if (occurrenceCount > 1) {
      return { content: currentContent, blockedReason: `Patch bloqueado porque o hunk ${index + 1} aparece ${occurrenceCount} vezes em ${relativePath}; o patch precisa ser inequivoco.` };
    }
    content = content.replace(hunk.search, hunk.replace);
  }
  if (looksLikeSecret(content)) {
    return { content: currentContent, blockedReason: 'Patch bloqueado porque o conteudo resultante parece conter segredo.' };
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_WRITE_BYTES) {
    return { content: currentContent, blockedReason: 'Patch bloqueado porque o arquivo resultante excede o limite do draft reversivel.' };
  }
  return { content, blockedReason: null };
}

function countOccurrences(value: string, search: string): number {
  if (!search) {
    return 0;
  }
  let count = 0;
  let index = value.indexOf(search);
  while (index >= 0) {
    count += 1;
    index = value.indexOf(search, index + search.length);
  }
  return count;
}

function parseNaturalPatchRequest(text: string): AgentRunIntelligenceFabricDraftWorkspacePatch | null {
  const match = /(?:substitua|troque|replace)\s+["']([^"']+)["']\s+(?:por|with)\s+["']([^"']*)["']\s+(?:em|no|na|in)\s+([^\s,;]+)/i.exec(text);
  if (!match) {
    return null;
  }
  return {
    path: match[3],
    search: match[1],
    replace: match[2],
    hunks: [{ search: match[1], replace: match[2] }],
    actionId: 'action-workspace-impact',
    description: 'Patch estruturado planejado a partir do draft Risk 3.',
  };
}

function parsePatchHunks(entry: Record<string, unknown>): AgentRunIntelligenceFabricDraftWorkspacePatchHunk[] {
  const structured = Array.isArray(entry.hunks)
    ? entry.hunks.map((hunk) => readRecord(hunk))
    : [];
  const hunks: AgentRunIntelligenceFabricDraftWorkspacePatchHunk[] = [];
  for (const hunk of structured) {
    const replace = resolveReplacement(hunk);
    const search = typeof hunk.search === 'string' ? hunk.search : typeof hunk.oldText === 'string' ? hunk.oldText : '';
    if (typeof replace === 'string' && search) {
      hunks.push({
        search,
        replace,
        description: stringOrNull(hunk.description),
      });
    }
  }
  if (hunks.length > 0) {
    return hunks;
  }
  const replace = resolveReplacement(entry);
  const search = typeof entry.search === 'string' ? entry.search : typeof entry.oldText === 'string' ? entry.oldText : '';
  return typeof replace === 'string' && search
    ? [{ search, replace, description: stringOrNull(entry.description) }]
    : [];
}

function resolveReplacement(entry: Record<string, unknown>): string | null {
  return typeof entry.replace === 'string'
    ? entry.replace
    : typeof entry.newText === 'string'
      ? entry.newText
      : typeof entry.newContent === 'string'
        ? entry.newContent
        : null;
}

function patchPreviewBlocked(reason: string): AgentRunIntelligenceFabricDraftWorkspacePatchPreview {
  return {
    status: 'blocked',
    summary: reason,
    files: [],
    blockedReasons: [reason],
    ambiguous: false,
    sideEffectsApplied: false,
  };
}

function patchPreviewFile(
  pathValue: string,
  patch: AgentRunIntelligenceFabricDraftWorkspacePatch,
  status: 'passed' | 'blocked',
  beforeHash: string | null,
  afterHash: string | null,
  reasons: string[],
): AgentRunIntelligenceFabricDraftWorkspacePatchPreview['files'][number] {
  return {
    path: pathValue,
    status,
    hunkCount: patch.hunks.length,
    beforeHash,
    afterHash,
    reasons,
  };
}

function blocked(reason: string): AgentRunIntelligenceFabricDraftExecutionResult {
  return {
    status: 'blocked',
    ok: false,
    summary: reason,
    appliedActions: [],
    rollbackAvailable: false,
    rollbackArtifactPath: null,
    touchedFiles: [],
    blockedReasons: [reason],
  };
}

function looksLikeSecret(value: string): boolean {
  return /\b(?:\.env|id_rsa|credentials\.json|secrets?\.json|token|secret|password|api[_-]?key|sk-[a-z0-9_-]{12,})\b/i.test(value);
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function previewText(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 140
    ? `${normalized.slice(0, 137)}...`
    : normalized;
}

function actionLabel(record: RollbackRecord): string {
  return record.actionLabel || `workspace-write:${record.relativePath}`;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringOrNull(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}
