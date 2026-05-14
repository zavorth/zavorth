import { ZavorthTrustPlaneActionService } from '../src/services/ZavorthTrustPlaneActionService.js';
import { ZavorthTrustPlaneService } from '../src/services/ZavorthTrustPlaneService.js';

function readFlag(argv: string[], name: string): string | null {
  const inline = argv.find((entry) => entry.startsWith(`${name}=`));
  if (inline) {
    return inline.split('=').slice(1).join('=').trim() || null;
  }
  const index = argv.findIndex((entry) => entry === name);
  if (index >= 0 && argv[index + 1] && !String(argv[index + 1]).startsWith('--')) {
    return String(argv[index + 1]).trim() || null;
  }
  return null;
}

function readListFlag(argv: string[], name: string): string[] {
  const value = readFlag(argv, name);
  if (!value) {
    return [];
  }
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

async function silenceConsoleForJson<T>(asJson: boolean, fn: () => Promise<T>): Promise<T> {
  if (!asJson) {
    return fn();
  }
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (...args: unknown[]) => console.error(...args);
  console.warn = (...args: unknown[]) => console.error(...args);
  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const trustPlane = new ZavorthTrustPlaneService();
  const actions = new ZavorthTrustPlaneActionService({
    trustPlaneService: trustPlane,
  });
  const approvalScope = readFlag(argv, '--scope') || readFlag(argv, '--approval-scope');
  const applyPlan = readFlag(argv, '--apply-plan') || readFlag(argv, '--plan');
  const rollbackLedger = readFlag(argv, '--rollback') || readFlag(argv, '--rollback-ledger');
  const profile = readFlag(argv, '--mcp-profile');
  const allowTool = readFlag(argv, '--allow-tool');
  const removeTool = readFlag(argv, '--remove-tool');
  const skillDefault = readFlag(argv, '--skill-default');
  const sourceId = readFlag(argv, '--source-id');
  const sourceMode = readFlag(argv, '--source-mode');
  const skillNames = readListFlag(argv, '--skills');

  const actionResult = await silenceConsoleForJson(asJson, async () => {
    if (applyPlan) {
      return actions.apply({
        planId: applyPlan,
        requestedBy: 'cli',
      });
    }
    if (rollbackLedger) {
      return actions.rollback({
        ledgerId: rollbackLedger,
        requestedBy: 'cli',
        sourceSurface: 'cli',
      });
    }
    if (profile) {
      return actions.execute({
        actionId: 'set-mcp-profile',
        profile,
        requestedBy: 'cli',
        sourceSurface: 'cli',
        approvalScope,
      });
    }
    if (allowTool) {
      return actions.execute({
        actionId: 'allow-mcp-tool',
        toolName: allowTool,
        requestedBy: 'cli',
        sourceSurface: 'cli',
        approvalScope,
      });
    }
    if (removeTool) {
      return actions.execute({
        actionId: 'remove-mcp-tool',
        toolName: removeTool,
        requestedBy: 'cli',
        sourceSurface: 'cli',
        approvalScope,
      });
    }
    if (skillDefault) {
      return actions.execute({
        actionId: 'set-skill-default',
        defaultPolicy: skillDefault,
        requestedBy: 'cli',
        sourceSurface: 'cli',
        approvalScope,
      });
    }
    if (sourceId && sourceMode) {
      return actions.execute({
        actionId: 'set-skill-source-mode',
        sourceId,
        mode: sourceMode,
        skillNames,
        requestedBy: 'cli',
        sourceSurface: 'cli',
        approvalScope,
      });
    }
    return null;
  });

  const snapshot = trustPlane.buildSnapshot();
  if (asJson) {
    process.stdout.write(`${JSON.stringify({
      ok: true,
      action: actionResult,
      summary: snapshot.summary,
      trustPlane: snapshot,
    }, null, 2)}\n`);
  } else {
    console.log('[trust-plane] leitura oficial de perfis, allowlists e superficies sensiveis');
    if (actionResult) {
      console.log(actionResult.summary);
      for (const detail of actionResult.details || []) {
        console.log(`- ${detail}`);
      }
      if (actionResult.diffPreview?.entries?.length) {
        console.log('');
        console.log('Diff preview:');
        for (const entry of actionResult.diffPreview.entries) {
          console.log(`- ${entry.path}: ${entry.summary}`);
        }
      }
      if (actionResult.rollbackPlan?.available && actionResult.rollbackPlan.ledgerId) {
        console.log(`Rollback: npm run ops:trust-plane -- --rollback ${actionResult.rollbackPlan.ledgerId}`);
      }
      console.log('');
    }
    console.log(trustPlane.renderReport());
  }

  if (snapshot.summary.posture === 'critical') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[trust-plane] falhou:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
