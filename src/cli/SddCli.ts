import { SddOrchestratorService } from '../services/SddOrchestratorService.js';
import type { SddAgentRole, SddRunLifecycle } from '../services/SddFeatureWorkspaceService.js';

export type SddCliFlags = {
  featureId: string;
  title: string;
  action: 'inspect' | 'init' | 'handoff';
  actor: string;
  role: SddAgentRole;
  summary: string;
  lifecycle: SddRunLifecycle | null;
  json: boolean;
};

export function parseSddCliFlags(argv: string[]): SddCliFlags {
  const flags: SddCliFlags = {
    featureId: '',
    title: '',
    action: 'inspect',
    actor: process.env.USERNAME || process.env.USER || 'cli',
    role: 'review',
    summary: '',
    lifecycle: null,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    if (!token) {
      continue;
    }

    if (token === '--feature' && argv[index + 1]) {
      flags.featureId = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (token === '--title' && argv[index + 1]) {
      flags.title = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (token === '--init') {
      flags.action = 'init';
      continue;
    }
    if (token === '--handoff') {
      flags.action = 'handoff';
      continue;
    }
    if (token === '--actor' && argv[index + 1]) {
      flags.actor = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (token === '--role' && argv[index + 1]) {
      flags.role = String(argv[index + 1] || '').trim().toLowerCase() as SddAgentRole;
      index += 1;
      continue;
    }
    if (token === '--summary' && argv[index + 1]) {
      flags.summary = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (token === '--lifecycle' && argv[index + 1]) {
      flags.lifecycle = String(argv[index + 1] || '').trim().toLowerCase() as SddRunLifecycle;
      index += 1;
      continue;
    }
    if (token === '--json') {
      flags.json = true;
    }
  }

  return flags;
}

export async function runSddCli(argv: string[]): Promise<number> {
  const flags = parseSddCliFlags(argv);
  if (!flags.featureId) {
    console.error('Usage: npm run sdd:loop -- --feature <domain/feature> [--init --title "Title"] [--json]');
    return 1;
  }

  const orchestrator = new SddOrchestratorService();
  let result;

  if (flags.action === 'init') {
    if (!flags.title) {
      console.error('Use --title with --init to scaffold the feature.');
      return 1;
    }
    result = orchestrator.scaffoldAndInspect(flags.featureId, flags.title);
  } else if (flags.action === 'handoff') {
    if (!flags.summary) {
      console.error('Use --summary with --handoff to record the handoff.');
      return 1;
    }
    result = orchestrator.handoff(flags.featureId, {
      role: flags.role,
      actor: flags.actor,
      summary: flags.summary,
      lifecycle: flags.lifecycle || undefined,
      note: flags.summary,
    });
  } else {
    result = orchestrator.inspect(flags.featureId);
  }

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  console.log(`[sdd] feature: ${result.featureId}`);
  console.log(`[sdd] title: ${result.title}`);
  console.log(`[sdd] lifecycle: ${result.lifecycle}`);
  console.log(`[sdd] next role: ${result.nextRole}`);
  console.log(`[sdd] current task: ${result.currentTask || 'none'}`);
  console.log(`[sdd] tasks: ${result.completedTaskCount} completed | ${result.openTaskCount} open`);
  console.log(`[sdd] spec: ${result.paths.specFile}`);
  console.log(`[sdd] plan: ${result.paths.planFile}`);
  console.log(`[sdd] tasks: ${result.paths.tasksFile}`);
  console.log(`[sdd] run-state: ${result.paths.runStateFile}`);
  console.log(`[sdd] handoff: ${result.paths.handoffFile}`);
  console.log('[sdd] checklist do papel:');
  for (const item of result.brief.checklist) {
    console.log(`- ${item}`);
  }
  console.log('[sdd] write scope:');
  for (const filePath of result.brief.writeScope) {
    console.log(`- ${filePath}`);
  }

  return 0;
}
