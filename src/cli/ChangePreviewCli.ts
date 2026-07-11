/**
 * Change Preview CLI (Trust Loop counterfactual product face).
 *
 *   zavorth change-preview
 *   zavorth change-preview demo
 *   zavorth change-preview from-json --file path
 *   zavorth change-preview --help
 *
 * Aliases: preview-change, what-changes
 */

import fs from 'node:fs';
import path from 'node:path';
import { CHANGE_PREVIEW_CONTRACT_VERSION } from '../contracts/preview/ChangePreviewContract.js';
import {
  ChangePreviewPresenter,
  createChangePreviewDemoImpact,
  createChangePreviewDemoPlanSteps,
  type ChangePreviewImpactLike,
  type ChangePreviewPlanStepInput,
} from '../services/preview/ChangePreviewPresenter.js';
import {
  paintCliBadge,
  paintCliTone,
  renderCliWordmarkStrip,
} from './ZavorthCliVisualTheme.js';

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function readOption(args: string[], name: string): string | null {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1] && !String(args[idx + 1]).startsWith('--')) {
    return args[idx + 1];
  }
  const pref = `${name}=`;
  const hit = args.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : null;
}

function printHelp(): void {
  console.log([
    `${paintCliBadge('CHANGE PREVIEW', 'brand')} ${paintCliTone('Zavorth Change Preview (Trust Loop)', 'brand')}`,
    paintCliTone('Counterfactual / "If you approve, what changes?" product face.', 'muted'),
    paintCliTone('Productizes ImpactSimulatorService + UniversalPreviewModeService.', 'muted'),
    paintCliTone('Never claims a full world twin when data is insufficient.', 'muted'),
    '',
    paintCliTone('Usage:', 'info'),
    '  zavorth change-preview',
    '  zavorth change-preview demo [--json] [--markdown]',
    '  zavorth change-preview from-json --file <path> [--json] [--markdown]',
    '  zavorth change-preview status',
    '  zavorth change-preview --help',
    '',
    paintCliTone('Aliases: preview-change, what-changes', 'muted'),
    `${paintCliTone('Contract:', 'info')} ${CHANGE_PREVIEW_CONTRACT_VERSION}`,
    '',
    paintCliTone('Examples:', 'info'),
    '  zavorth change-preview demo',
    '  zavorth what-changes demo --markdown',
    '  zavorth change-preview from-json --file ./preview.json',
  ].join('\n'));
}

function printCardHuman(presenter: ChangePreviewPresenter, card: ReturnType<ChangePreviewPresenter['fromPlanSteps']>): void {
  console.log(card.title);
  console.log(`  confidence: ${card.confidence}`);
  console.log(`  honesty: ${card.confidenceReason}`);
  console.log('');
  console.log('  What changes:');
  for (const b of card.bullets) {
    const mark = b.severity === 'risk' ? 'RISK' : b.severity === 'warning' ? 'WARN' : 'info';
    console.log(`    [${mark}] ${b.text}`);
  }
  console.log('');
  console.log(`  requiresApproval: ${card.requiresApproval ? 'yes' : 'no'}`);
  console.log(`  requiresSandbox: ${card.requiresSandbox ? 'yes' : 'no'}`);
  console.log(`  rollbackAvailable: ${card.rollbackAvailable === null ? 'unknown' : card.rollbackAvailable ? 'yes' : 'no'}`);
  console.log(`  sources: ${card.sourceServices.join(', ') || 'none'}`);
  console.log(`  contract: ${card.contractVersion}`);
  console.log(`  id: ${card.id}`);
}

export async function runChangePreviewCli(rawArgs: string[] = []): Promise<number> {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    return 0;
  }

  const first = String(rawArgs[0] || '').trim().toLowerCase();
  const json = hasFlag(rawArgs, '--json');
  const markdown = hasFlag(rawArgs, '--markdown') || hasFlag(rawArgs, '--md');
  const presenter = new ChangePreviewPresenter();

  if (!first || first.startsWith('--') || first === 'status' || first === 'summary') {
    console.log(`${renderCliWordmarkStrip()} ${paintCliTone('Change preview', 'muted')}`);
    console.log(paintCliTone('Change Preview (Trust Loop)', 'brand'));
    console.log(`  contract: ${CHANGE_PREVIEW_CONTRACT_VERSION}`);
    console.log('  honesty: never claims a full world twin without plan + impact data');
    console.log('');
    console.log('  Try: zavorth change-preview demo');
    console.log('  Help: zavorth change-preview --help');
    return 0;
  }

  if (first === 'help') {
    printHelp();
    return 0;
  }

  if (first === 'demo' || first === 'seed-demo' || first === 'sample') {
    const plan = createChangePreviewDemoPlanSteps();
    const impact = createChangePreviewDemoImpact();
    const fromPlan = presenter.fromPlanSteps(plan, { runId: 'run-demo-change-preview' });
    const fromImpact = presenter.fromImpactSimulation(impact, { runId: 'run-demo-change-preview' });
    const card = presenter.mergeSources(fromPlan, fromImpact);

    if (json) {
      console.log(JSON.stringify(card, null, 2));
      return 0;
    }
    if (markdown) {
      console.log(presenter.toMarkdown(card));
      return 0;
    }

    console.log('=== Change Preview demo ===');
    console.log('(sample plan: write file + shell; merged with impact simulation)');
    console.log('');
    printCardHuman(presenter, card);
    console.log('');
    console.log('Honesty line:');
    console.log(`  ${card.confidenceReason}`);
    return 0;
  }

  if (first === 'from-json' || first === 'json' || first === 'from-file') {
    const file = readOption(rawArgs, '--file') || readOption(rawArgs, '-f');
    if (!file) {
      console.log('Usage: zavorth change-preview from-json --file <path>');
      return 1;
    }
    const abs = path.resolve(process.cwd(), file);
    if (!fs.existsSync(abs)) {
      console.log(`File not found: ${abs}`);
      return 1;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch (err) {
      console.log(`Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }

    const card = cardFromJsonPayload(presenter, raw);
    if (json) {
      console.log(JSON.stringify(card, null, 2));
      return 0;
    }
    if (markdown) {
      console.log(presenter.toMarkdown(card));
      return 0;
    }
    printCardHuman(presenter, card);
    return 0;
  }

  console.log(`Unknown change-preview subcommand: ${first}`);
  console.log('');
  printHelp();
  return 1;
}

function cardFromJsonPayload(
  presenter: ChangePreviewPresenter,
  raw: unknown,
): ReturnType<ChangePreviewPresenter['fromPlanSteps']> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    if (Array.isArray(raw)) {
      // treat as plan steps or actions
      const first = raw[0] as Record<string, unknown> | undefined;
      if (first && ('label' in first || 'requiresApproval' in first || 'toolId' in first)) {
        return presenter.fromPlanSteps(raw as ChangePreviewPlanStepInput[]);
      }
      return presenter.fromLooseActions(raw as Array<{ kind?: string }>);
    }
    return presenter.fromPlanSteps([]);
  }

  const obj = raw as Record<string, unknown>;
  const parts: Array<ReturnType<ChangePreviewPresenter['fromPlanSteps']>> = [];

  if (Array.isArray(obj.planSteps) || Array.isArray(obj.steps)) {
    parts.push(
      presenter.fromPlanSteps(
        (obj.planSteps || obj.steps) as ChangePreviewPlanStepInput[],
        {
          runId: obj.runId != null ? String(obj.runId) : null,
          approvalCardId: obj.approvalCardId != null ? String(obj.approvalCardId) : null,
        },
      ),
    );
  }
  if (obj.impact || obj.simulation || obj.impactSimulation) {
    parts.push(
      presenter.fromImpactSimulation(
        (obj.impact || obj.simulation || obj.impactSimulation) as ChangePreviewImpactLike,
        {
          runId: obj.runId != null ? String(obj.runId) : null,
        },
      ),
    );
  }
  if (Array.isArray(obj.actions)) {
    parts.push(presenter.fromLooseActions(obj.actions as Array<{ kind?: string }>));
  }

  if (parts.length === 0) {
    // Maybe the object itself is an impact sim
    if (obj.status || obj.affectedTargets || obj.blockers) {
      return presenter.fromImpactSimulation(obj as ChangePreviewImpactLike);
    }
    return presenter.fromPlanSteps([]);
  }
  if (parts.length === 1) return parts[0];
  return presenter.mergeSources(...parts);
}
