#!/usr/bin/env node

import { CompanionWorkspaceOptimizerService } from '../src/services/CompanionWorkspaceOptimizerService.js';

function extractWorkspace(args: string[]): { workspaceHint: string | null; args: string[] } {
  const tokens = [...args];
  const index = tokens.indexOf('--workspace');
  if (index < 0) {
    return { workspaceHint: null, args: tokens };
  }
  const workspaceHint = String(tokens[index + 1] || '').trim() || null;
  tokens.splice(index, 2);
  return { workspaceHint, args: tokens };
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const filtered = argv.filter((entry) => entry !== '--json');
  const extracted = extractWorkspace(filtered);
  const tokens = extracted.args;
  const command = String(tokens[0] || 'doctor').trim().toLowerCase();
  const service = new CompanionWorkspaceOptimizerService();

  if (command === 'doctor' || command === 'status') {
    const profile = await service.buildLoadProfile({
      workspaceHint: extracted.workspaceHint,
    });
    process.stdout.write(asJson ? `${JSON.stringify(profile, null, 2)}\n` : `${service.renderLoadProfile(profile)}\n`);
    return;
  }

  if (command === 'optimize') {
    const presetId = String(tokens[1] || '').trim().toLowerCase();
    if (!presetId) {
      throw new Error('Uso: workspace-optimizer.ts optimize <zavorthBridge|vscode|vscode-derivative> [apply <planId>] [--workspace <path>]');
    }
    const subcommand = String(tokens[2] || '').trim().toLowerCase();
    if (subcommand === 'apply') {
      const planId = String(tokens[3] || '').trim();
      if (!planId) {
        throw new Error('Uso: workspace-optimizer.ts optimize <preset> apply <planId>');
      }
      const result = await service.applyOptimization({
        planId,
        requestedBy: 'ops-cli',
        sourceSurface: 'ops-cli',
      });
      process.stdout.write(asJson ? `${JSON.stringify(result, null, 2)}\n` : `${service.renderApplyResult(result)}\n`);
      if (!result.ok) {
        process.exitCode = result.waitingApproval ? 2 : 1;
      }
      return;
    }

    const preview = await service.previewOptimization({
      presetId: presetId as any,
      workspaceHint: extracted.workspaceHint,
      requestedBy: 'ops-cli',
      sourceSurface: 'ops-cli',
    });
    process.stdout.write(asJson ? `${JSON.stringify(preview, null, 2)}\n` : `${service.renderPreview(preview)}\n`);
    if (preview.blocked) {
      process.exitCode = 1;
    } else if (preview.waitingApproval) {
      process.exitCode = 2;
    }
    return;
  }

  throw new Error('Uso: workspace-optimizer.ts <doctor|optimize>');
}

main().catch((error) => {
  console.error('[zavorth-ops] workspace optimizer falhou.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
