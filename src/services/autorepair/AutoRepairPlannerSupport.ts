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
      summary: 'The planner did not return valid JSON; code autorepair was aborted for safety.',
      confidence: 0,
      warnings: ['Planner response is outside the expected JSON format.'],
      validationHints: [],
    };
  }

  const targetFile = readAutoRepairString(parsed.targetFile).replace(/\\/g, '/').trim() || null;
  const instruction = readAutoRepairString(parsed.instruction).trim();
  return {
    needsCodeChange: Boolean(parsed.needsCodeChange) && Boolean(targetFile) && Boolean(instruction),
    targetFile,
    instruction,
    summary: readAutoRepairString(parsed.summary).trim() || 'Self-repair plan generated without additional summary.',
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
      ? 'No previous attempt in this execution.'
      : input.previousAttempts
          .map((attempt) => {
            return [
              `Tentactive ${attempt.attemptNumber}: ${attempt.status}`,
              `File: ${attempt.targetFile || 'undefined'}`,
              `error: ${attempt.error || 'without error registrado'}`,
              `Rollback: ${attempt.rollbackReason || 'none'}`,
            ].join(' | ');
          })
          .join('\n');

  return [
    {
      role: 'system',
      content: [
        'You are the safe self-repair planner for Zavorth.',
        'Analyze the current state and reply only with valid JSON.',
        'Escolha no maximo um file seguro por tentactive.',
        'Prioritize minimal, safe, highly local correction.',
        'Only propose files within src/, tests/, config/, scripts/, or the package.json and tsconfig.json files.',
        'PowerShell files under scripts/ are allowed when the change is local, safe, and verifiable.',
        'Se noner trust suficiente, devolva needsCodeChange=false.',
        'Em goal=improve, you pode propor uma pequena melhoria safe mesmo without error aberto, mas continue conservador.',
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
        '=== ENVIRONMENT REPAIR ===',
        trimAutoRepairOutput(JSON.stringify(input.bootstrapRepair, null, 2), MAX_LOG_EXCERPT_CHARACTERS),
        '',
        '=== MEMORIA OPERACIONAL ===',
        input.incidentMemorySummary,
        '',
        '=== RELOAD REPORT ===',
        input.rawReloadReport || '(without report salvo)',
        '',
        '=== RUNTIME DIAGNOSTICS ===',
        input.runtimeDiagnostics || '(without runtime-diagnostics.json available)',
        '',
        '=== LOG RECENTE DO LAUNCHER ===',
        input.launcherLog || '(without log recente do launcher)',
        '',
        '=== CANDIDATE FILES ===',
        input.candidateFiles.length > 0 ? input.candidateFiles.join('\n') : '(none file candidato explicit)',
        '',
        '=== attempts ANTERIORES ===',
        previousAttemptLines,
        '',
        'Reply in JSON format:',
        '{',
        '  "needsCodeChange": true,',
        '  "targetFile": "src/file.ts or scripts/file.ps1",',
        '  "instruction": "objective and safe instruction to rewrite the whole file",',
        '  "summary": "short decision summary",',
        '  "confidence": 0.0,',
        '  "warnings": ["risks"],',
        '  "validationHints": ["tests/file.test.ts"]',
        '}',
      ].join('\n'),
    },
  ];
}
