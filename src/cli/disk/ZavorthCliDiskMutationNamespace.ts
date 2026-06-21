import { readFileSync } from 'fs';
import * as path from 'path';
import type { DiskMutationGateRequestedOperation } from '../../contracts/DiskMutationGateContract.js';

export async function runDiskMutationGateCommand(rawArgs: string[]): Promise<number> {
  const { DiskMutationGateService } = await import('../../services/DiskMutationGateService.js');
  const service = new DiskMutationGateService();
  const asJson = rawArgs.includes('--json');
  const workspaceRoot = readFlexibleStringFlag(rawArgs, 'workspace') || readFlexibleStringFlag(rawArgs, 'workspaceRoot') || process.cwd();
  const action = String(rawArgs.find((arg) => !arg.startsWith('--')) || 'preview').trim().toLowerCase();

  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    return printCliPanel('Zavorth disk gate', [
      'Usage: zavorth disk preview --write <path> --content "..."',
      '',
      'Creates a governed disk mutation preview. Apply requires the exact approval phrase and writes a receipt.',
      '',
      'Commands:',
      '  status                         Show disk mutation receipts',
      '  preview --write <path>         Preview file replacement',
      '  preview --append <path>        Preview append',
      '  preview --delete <path>        Preview file deletion',
      '  preview --mkdir <path>         Preview directory creation',
      '  preview --apply --yes          Preview and apply with local owner approval',
      '  apply <previewId>              Apply an existing preview with its approval phrase',
    ], 'info');
  }

  if (action === 'status') {
    const status = service.buildStatus({
      workspaceRoot,
      limit: readNumberFlag(rawArgs, 'limit'),
    });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    } else {
      await printCliPanel('Disk mutation gate', [
        `workspace: ${status.workspaceRoot}`,
        `receipt: ${status.receiptPath}`,
        `receipts: ${status.receiptCount}`,
        status.receipts.length
          ? `latest: ${status.receipts[0].summary}`
          : 'latest: none',
      ], 'info');
    }
    return 0;
  }

  if (action === 'apply') {
    const previewId = rawArgs.find((arg, index) => index > 0 && !arg.startsWith('--')) || readFlexibleStringFlag(rawArgs, 'preview') || '';
    const approvalPhrase = readFlexibleStringFlag(rawArgs, 'approval-phrase') || readFlexibleStringFlag(rawArgs, 'approvalPhrase') || '';
    const result = service.applyPreview({
      workspaceRoot,
      previewId,
      approvalPhrase,
      approvedBy: readFlexibleStringFlag(rawArgs, 'by') || 'zavorth-cli',
    });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      await printCliPanel('Disk mutation applied', [
        result.receipt.summary,
        `receipt: ${result.receipt.receiptId}`,
        `operations: ${result.receipt.operations.map((operation) => `${operation.kind}:${operation.relativePath}`).join(', ') || 'none'}`,
      ], result.status === 'applied' ? 'success' : 'info');
    }
    return 0;
  }

  const operation = buildDiskMutationOperation(rawArgs, action);
  if (!operation) {
    if (asJson) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: 'operation_required' }, null, 2)}\n`);
    } else {
      await printCliPanel('Disk mutation gate', [
        'Informe uma operacao: --write, --append, --delete ou --mkdir.',
        'Example: zavorth disk preview --write output/example.txt --content "hello"',
      ], 'warning');
    }
    return 1;
  }

  const preview = service.createPreview({
    workspaceRoot,
    operations: [operation],
    requestedBy: readFlexibleStringFlag(rawArgs, 'by') || 'zavorth-cli',
    sourceSurface: 'zavorth-cli:disk',
    reason: readFlexibleStringFlag(rawArgs, 'reason'),
  });
  const shouldApply = rawArgs.includes('--apply');
  if (shouldApply) {
    if (!rawArgs.includes('--yes')) {
      if (asJson) {
        process.stdout.write(`${JSON.stringify({ ok: false, preview, error: 'approval_required' }, null, 2)}\n`);
      } else {
        await printCliPanel('Approval required', [
          preview.summary,
          `approval phrase: ${preview.approval.phrase}`,
          'Re-run with --apply --yes to apply this preview, or use zavorth disk apply <previewId> --approval-phrase "...".',
        ], 'warning');
      }
      return 1;
    }
    const result = service.applyPreview({
      workspaceRoot,
      previewId: preview.previewId,
      approvalPhrase: preview.approval.phrase,
      approvedBy: readFlexibleStringFlag(rawArgs, 'by') || 'zavorth-cli',
    });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      await printCliPanel('Disk mutation applied', [
        result.receipt.summary,
        `receipt: ${result.receipt.receiptId}`,
        `operations: ${result.receipt.operations.map((entry) => `${entry.kind}:${entry.relativePath}`).join(', ') || 'none'}`,
      ], result.status === 'applied' ? 'success' : 'info');
    }
    return result.status === 'applied' || result.status === 'noop' ? 0 : 1;
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
  } else {
    await printCliPanel('Disk mutation preview', [
      preview.summary,
      `preview: ${preview.previewId}`,
      `status: ${preview.status}`,
      `operations: ${preview.operations.map((entry) => `${entry.kind}:${entry.relativePath}`).join(', ') || 'none'}`,
      `findings: ${preview.findings.length}`,
      `approval phrase: ${preview.approval.phrase}`,
      `apply: zavorth disk apply ${preview.previewId} --approval-phrase "${preview.approval.phrase}"`,
    ], preview.status === 'preview_ready' ? 'warning' : preview.status === 'blocked' ? 'error' : 'info');
  }
  return preview.status === 'blocked' ? 1 : 0;
}

function buildDiskMutationOperation(
  rawArgs: string[],
  action: string,
): DiskMutationGateRequestedOperation | null {
  const writePath = readFlexibleStringFlag(rawArgs, 'write');
  const appendPath = readFlexibleStringFlag(rawArgs, 'append');
  const deletePath = readFlexibleStringFlag(rawArgs, 'delete') || readFlexibleStringFlag(rawArgs, 'remove');
  const mkdirPath = readFlexibleStringFlag(rawArgs, 'mkdir') || readFlexibleStringFlag(rawArgs, 'dir');
  const positionalPath = rawArgs.find((arg, index) => index > 0 && !arg.startsWith('--')) || '';
  const content = readDiskMutationContent(rawArgs);
  const reason = readFlexibleStringFlag(rawArgs, 'reason');

  if (writePath || action === 'write') {
    const targetPath = writePath || positionalPath;
    return targetPath ? { kind: 'write_file', path: targetPath, content, reason } : null;
  }
  if (appendPath || action === 'append') {
    const targetPath = appendPath || positionalPath;
    return targetPath ? { kind: 'append_file', path: targetPath, content, reason } : null;
  }
  if (deletePath || action === 'delete' || action === 'remove' || action === 'rm') {
    const targetPath = deletePath || positionalPath;
    return targetPath ? { kind: 'delete_file', path: targetPath, reason } : null;
  }
  if (mkdirPath || action === 'mkdir' || action === 'dir') {
    const targetPath = mkdirPath || positionalPath;
    return targetPath ? { kind: 'mkdir', path: targetPath, reason } : null;
  }
  return null;
}

function readDiskMutationContent(rawArgs: string[]): string {
  const contentFile = readFlexibleStringFlag(rawArgs, 'content-file');
  if (contentFile) {
    return readFileSync(path.resolve(contentFile), 'utf8');
  }
  return String(readFlexibleStringFlag(rawArgs, 'content') || '');
}

// Local helpers copied to keep modular structure self-contained and avoid circular imports
function readStringFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function readFlexibleStringFlag(argv: string[], name: string): string | null {
  const inline = readStringFlag(argv, name);
  if (inline !== null) {
    return inline;
  }
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

function readNumberFlag(argv: string[], name: string): number | null {
  const raw = readFlexibleStringFlag(argv, name);
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function printCliPanel(title: string, lines: string[], type: 'default' | 'info' | 'success' | 'warning' | 'error' = 'default'): Promise<number> {
  const content = lines.join('\n');
  if (!process.argv.includes('--json')) {
    const { TerminalPanel } = await import('../presentation/TerminalPanel.js');
    process.stdout.write(`${TerminalPanel.render(content, {
      title,
      type,
      padding: 1,
      width: Math.max(58, Math.min(88, Number(process.stdout.columns || 90) - 4)),
    })}\n`);
  } else {
    process.stdout.write([title, '', content, ''].join('\n'));
  }
  return 0;
}
