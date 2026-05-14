#!/usr/bin/env node
import {
  applySecurityOperationalPreset,
  formatApplySecurityOperationalPresetResult,
  formatSecurityOperationalPresetInspection,
  formatSecurityOperationalPresetList,
  getSecurityOperationalPreset,
  inspectSecurityOperationalPreset,
  listSecurityOperationalPresets,
} from '../src/security/SecurityOperationalPreset.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const apply = args.includes('--apply') || args.includes('apply');
const projectRoot = readFlag('project-root') || process.cwd();
const presetArg = args.find((arg) => !arg.startsWith('--') && arg !== 'apply' && arg !== 'list' && arg !== 'status');
const wantsList = args.includes('list') || args.includes('--list') || (!presetArg && !args.includes('status'));
const wantsStatus = args.includes('status') || args.includes('--status');

if (wantsList) {
  const presets = listSecurityOperationalPresets();
  if (asJson) {
    process.stdout.write(`${JSON.stringify({ presets }, null, 2)}\n`);
  } else {
    process.stdout.write(formatSecurityOperationalPresetList());
  }
  process.exit(0);
}

if (wantsStatus) {
  const inspection = inspectSecurityOperationalPreset({ projectRoot });
  if (asJson) {
    process.stdout.write(`${JSON.stringify(inspection, null, 2)}\n`);
  } else {
    process.stdout.write(formatSecurityOperationalPresetInspection(inspection));
  }
  process.exit(inspection.status === 'ready' ? 0 : 1);
}

const preset = getSecurityOperationalPreset(presetArg);
if (!preset) {
  process.stderr.write(`[zavorth-security] preset desconhecido: ${String(presetArg || 'n/d')}\n`);
  process.stderr.write(formatSecurityOperationalPresetList());
  process.exit(1);
}

if (!apply) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify({ preset }, null, 2)}\n`);
  } else {
    process.stdout.write([
      '[zavorth-security] preset preview',
      `[zavorth-security] ${preset.id}: ${preset.label}`,
      `[zavorth-security] perfil: ${preset.securityProfile} | MCP: ${preset.mcpPolicy.profile} | skills: ${preset.skillPolicy.defaultPolicy}`,
      `[zavorth-security] ${preset.summary}`,
      '',
      `Aplicar: zavorth security preset ${preset.id} --apply`,
    ].join('\n') + '\n');
  }
  process.exit(0);
}

const result = applySecurityOperationalPreset({
  preset: preset.id,
  projectRoot,
  appliedBy: 'security-preset-cli',
});

if (asJson) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  process.stdout.write(formatApplySecurityOperationalPresetResult(result));
}

process.exit(0);

function readFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] || null : null;
}
