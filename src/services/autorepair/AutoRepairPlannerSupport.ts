import type { ChatMessage } from '../../providers/ILlmProvider.js';
import type { RuntimeBootstrapRepairReport } from '../../runtime/access/RuntimeBootstrapRepairService.js';
import type { AutoRepairAttempt, AutoRepairGoal, AutoRepairPlan, AutoRepairRunInput } from './AutoRepairTypes.js';
import {
  MAX_LOG_EXCERPT_CHARACTERS,
  readAutoRepairConfidence,
  readAutoRepairString,
  readAutoRepairStringArray,
  trimAutoRepairOutput,
  tryParseAutoRepairJson,
} from './AutoRepairTextUtils.js';

export function parseAutoRepairPlannerResponse(rawContent: string): AutoRepairPlan {
  const parsed = tryParseAutoRepairJson(rawContent);
  if (!parsed || typeof parsed !== 'object') {
    return {
      needsCodeChange: false,
      targetFile: null,
      instruction: '',
      summary: 'O planejador nao retornou JSON valido; o autoreparo de codigo foi abortado por seguranca.',
      confidence: 0,
      warnings: ['Resposta do planejador fora do formato JSON esperado.'],
      validationHints: [],
    };
  }

  const targetFile = readAutoRepairString(parsed.targetFile).replace(/\\/g, '/').trim() || null;
  const instruction = readAutoRepairString(parsed.instruction).trim();
  return {
    needsCodeChange: Boolean(parsed.needsCodeChange) && Boolean(targetFile) && Boolean(instruction),
    targetFile,
    instruction,
    summary: readAutoRepairString(parsed.summary).trim() || 'Plano de autoreparo gerado sem resumo adicional.',
    confidence: readAutoRepairConfidence(parsed.confidence),
    warnings: readAutoRepairStringArray(parsed.warnings),
    validationHints: readAutoRepairStringArray(parsed.validationHints),
  };
}

export function buildAutoRepairPlannerMessages(input: {
  runInput: AutoRepairRunInput;
  goal: AutoRepairGoal;
  bootstrapRepair: RuntimeBootstrapRepairReport;
  previousAttempts: AutoRepairAttempt[];
  runtimeSummary: string;
  incidentMemorySummary: string;
  rawReloadReport: string;
  runtimeDiagnostics: string;
  launcherLog: string;
  candidateFiles: string[];
}): ChatMessage[] {
  const previousAttemptLines =
    input.previousAttempts.length === 0
      ? 'Nenhuma tentativa anterior nesta execucao.'
      : input.previousAttempts
          .map((attempt) => {
            return [
              `Tentativa ${attempt.attemptNumber}: ${attempt.status}`,
              `Arquivo: ${attempt.targetFile || 'indefinido'}`,
              `Erro: ${attempt.error || 'sem erro registrado'}`,
              `Rollback: ${attempt.rollbackReason || 'nao houve'}`,
            ].join(' | ');
          })
          .join('\n');

  return [
    {
      role: 'system',
      content: [
        'Voce e o planejador de autoreparo seguro do Zavorth.',
        'Analise o estado atual e responda APENAS com JSON valido.',
        'Escolha no maximo um arquivo seguro por tentativa.',
        'Priorize correcao minima, segura e altamente local.',
        'So proponha arquivos dentro de src/, tests/, config/, scripts/ ou os arquivos package.json e tsconfig.json.',
        'Arquivos .ps1 em scripts/ sao permitidos, desde que a mudanca seja local, segura e validavel.',
        'Se nao houver confianca suficiente, devolva needsCodeChange=false.',
        'Em goal=improve, voce pode propor uma pequena melhoria segura mesmo sem erro aberto, mas continue conservador.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Goal: ${input.goal}`,
        `Reason: ${input.runInput.reason}`,
        `RequestedBy: ${input.runInput.requestedBy}`,
        `DryRun: ${input.runInput.dryRun === true}`,
        `Force: ${input.runInput.force === true}`,
        '',
        '=== RESUMO DO RUNTIME ===',
        input.runtimeSummary,
        '',
        '=== REPARO AMBIENTAL ===',
        trimAutoRepairOutput(JSON.stringify(input.bootstrapRepair, null, 2), MAX_LOG_EXCERPT_CHARACTERS),
        '',
        '=== MEMORIA OPERACIONAL ===',
        input.incidentMemorySummary,
        '',
        '=== RELATORIO DE RELOAD ===',
        input.rawReloadReport || '(sem relatorio salvo)',
        '',
        '=== RUNTIME DIAGNOSTICS ===',
        input.runtimeDiagnostics || '(sem runtime-diagnostics.json disponivel)',
        '',
        '=== LOG RECENTE DO LAUNCHER ===',
        input.launcherLog || '(sem log recente do launcher)',
        '',
        '=== ARQUIVOS CANDIDATOS ===',
        input.candidateFiles.length > 0 ? input.candidateFiles.join('\n') : '(nenhum arquivo candidato explicito)',
        '',
        '=== TENTATIVAS ANTERIORES ===',
        previousAttemptLines,
        '',
        'Responda no formato JSON:',
        '{',
        '  "needsCodeChange": true,',
        '  "targetFile": "src/arquivo.ts ou scripts/arquivo.ps1",',
        '  "instruction": "instrucao objetiva e segura para reescrever o arquivo inteiro",',
        '  "summary": "resumo curto da decisao",',
        '  "confidence": 0.0,',
        '  "warnings": ["riscos"],',
        '  "validationHints": ["tests/arquivo.test.ts"]',
        '}',
      ].join('\n'),
    },
  ];
}
