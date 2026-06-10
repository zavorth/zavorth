import { ZavorthMemoryEncryptionStatusService, type ZavorthMemoryEncryptionMode } from '../services/ZavorthMemoryEncryptionStatusService.js';

export async function runZavorthMemoryEncryptionCommand(rawArgs: string[]): Promise<number> {
  const args = rawArgs.filter(Boolean);
  const json = args.includes('--json');
  const subcommand = normalizeSubcommand(args[0]);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(formatHelp());
    return 0;
  }

  const service = new ZavorthMemoryEncryptionStatusService();
  const input = {
    dbPath: readStringFlag(args, 'db') || readStringFlag(args, 'db-path'),
    mode: readModeFlag(args),
    key: readStringFlag(args, 'key'),
    keyPath: readStringFlag(args, 'key-path'),
    keyStore: readKeyStoreFlag(args),
    backupPath: readStringFlag(args, 'backup') || readStringFlag(args, 'backup-path'),
    driverPackages: readDrivers(args),
  };

  if (subcommand === 'status') {
    const status = service.buildStatus(input);
    process.stdout.write(json ? `${JSON.stringify(status, null, 2)}\n` : `${service.formatStatusText(status)}\n`);
    return status.safeForDailyUse ? 0 : 1;
  }

  if (subcommand === 'preview') {
    const receipt = service.previewMigration(input);
    process.stdout.write(json ? `${JSON.stringify(receipt, null, 2)}\n` : `${service.formatMigrationText(receipt)}\n`);
    return receipt.status === 'preview' ? 0 : 1;
  }

  if (subcommand === 'apply') {
    const receipt = service.applyMigration(input);
    process.stdout.write(json ? `${JSON.stringify(receipt, null, 2)}\n` : `${service.formatMigrationText(receipt)}\n`);
    return receipt.status === 'applied' ? 0 : 1;
  }

  if (subcommand === 'rollback') {
    const receipt = service.rollbackMigration(input);
    process.stdout.write(json ? `${JSON.stringify(receipt, null, 2)}\n` : `${service.formatMigrationText(receipt)}\n`);
    return receipt.status === 'rolled-back' ? 0 : 1;
  }

  process.stdout.write(formatHelp());
  return 1;
}

function normalizeSubcommand(value: unknown): 'status' | 'preview' | 'apply' | 'rollback' | 'help' {
  const text = String(value || 'status').trim().toLowerCase();
  if (text === 'migrate' || text === 'migration') return 'preview';
  if (text === 'preview' || text === 'plan') return 'preview';
  if (text === 'apply' || text === 'enable') return 'apply';
  if (text === 'rollback' || text === 'restore') return 'rollback';
  if (text === 'help') return 'help';
  return 'status';
}

function readModeFlag(args: string[]): ZavorthMemoryEncryptionMode | null {
  const raw = String(readStringFlag(args, 'mode') || '').trim().toLowerCase();
  if (raw === 'off' || raw === 'opportunistic' || raw === 'required') return raw;
  return null;
}

function readKeyStoreFlag(args: string[]): 'auto' | 'file' | 'os' | null {
  const raw = String(readStringFlag(args, 'key-store') || '').trim().toLowerCase();
  if (raw === 'auto' || raw === 'file' || raw === 'os') return raw;
  return null;
}

function readDrivers(args: string[]): string[] | undefined {
  const value = readStringFlag(args, 'driver') || readStringFlag(args, 'drivers');
  return value ? value.split(',').map((entry) => entry.trim()).filter(Boolean) : undefined;
}

function readStringFlag(args: string[], name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

function formatHelp(): string {
  return [
    'Zavorth memory encryption',
    '',
    'Usage:',
    '  zavorth memory encryption status [--json]',
    '  zavorth memory encryption preview --mode required',
    '  zavorth memory encryption apply --mode required',
    '  zavorth memory encryption rollback --backup <path>',
    '',
    'Options:',
    '  --db <path>             Memory SQLite path',
    '  --mode <mode>           off, opportunistic or required',
    '  --key <value>           Full-file encryption key; env is recommended instead',
    '  --key-path <path>       Key file path',
    '  --key-store <store>     auto, file or os',
    '  --driver <package>      Optional SQLCipher driver package',
    '  --backup <path>         Explicit backup path for rollback',
    '  --json                  Emit machine-readable JSON',
    '',
  ].join('\n');
}
