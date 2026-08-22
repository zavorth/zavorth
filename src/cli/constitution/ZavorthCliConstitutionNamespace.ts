
export async function runProjectConstitutionCommand(rawArgs: string[]): Promise<number> {
  const { ProjectConstitutionImportService } = await import('../../services/ProjectConstitutionImportService.js');
  const service = new ProjectConstitutionImportService();
  const asJson = rawArgs.includes('--json');
  const workspaceRoot = readFlexibleStringFlag(rawArgs, 'workspace') || readFlexibleStringFlag(rawArgs, 'workspaceRoot') || process.cwd();
  const action = String(rawArgs.find((arg) => !arg.startsWith('--')) || 'import').trim().toLowerCase();

  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    return printCliPanel('Zavorth constitution', [
      'Usage: zavorth constitution import [--apply --yes]',
      '',
      'Imports local AGENTS.md and CLAUDE.md into ZAVORTH_PROJECT.md as advisory context.',
      'No instruction is executed, secrets are redacted, and apply requires explicit approval.',
      '',
      'Commands:',
      '  status                  Show import status and receipts',
      '  import                  Create preview only',
      '  import --apply --yes    Preview and apply with local owner approval',
      '  apply <previewId>       Apply an existing preview with its approval phrase',
    ], 'info');
  }

  if (action === 'status') {
    const status = service.buildStatus({ workspaceRoot });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    } else {
      await printCliPanel('Project constitution', [
        `workspace: ${status.workspaceRoot}`,
        `target: ${status.targetExists ? 'found' : 'missing'} ${status.targetPath}`,
        `sources: ${status.candidateSources.filter((source) => source.exists).map((source) => source.fileName).join(', ') || 'none'}`,
        `receipts: ${status.receipts.length}`,
        status.importedSources.length ? `imported: ${status.importedSources.map((source) => source.sourcePath).join(', ')}`
          : 'imported: none',
      ], status.targetExists ? 'success' : 'warning');
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
      await printCliPanel('Constitution import applied', [
        result.receipt.summary,
        `receipt: ${result.receipt.receiptId}`,
        `target: ${result.receipt.targetPath}`,
      ], 'success');
    }
    return 0;
  }

  const sourcePaths = rawArgs
    .filter((arg) => arg.startsWith('--source='))
    .map((arg) => arg.slice('--source='.length).trim())
    .filter(Boolean);
  const preview = service.createPreview({
    workspaceRoot,
    sourcePaths: sourcePaths.length ? sourcePaths : null,
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
          'Re-run with --apply --yes to apply this preview, or use zavorth constitution apply <previewId> --approval-phrase "...".',
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
      await printCliPanel('Constitution import applied', [
        result.receipt.summary,
        `receipt: ${result.receipt.receiptId}`,
        `target: ${result.receipt.targetPath}`,
      ], 'success');
    }
    return 0;
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
  } else {
    await printCliPanel('Constitution import preview', [
      preview.summary,
      `preview: ${preview.previewId}`,
      `target: ${preview.targetPath}`,
      `sources: ${preview.sources.map((source) => source.relativePath).join(', ') || 'none'}`,
      `findings: ${preview.findings.length}`,
      `approval phrase: ${preview.approval.phrase}`,
      `apply: zavorth constitution apply ${preview.previewId} --approval-phrase "${preview.approval.phrase}"`,
    ], preview.status === 'preview_ready' ? 'warning' : 'info');
  }
  return preview.status === 'preview_ready' ? 0 : 1;
}

// local helpers copied to keep modular structure self-contained and avoid circular imports
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
