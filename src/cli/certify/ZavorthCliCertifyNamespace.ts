import { ZavorthProductExcellenceService } from '../../services/ZavorthProductExcellenceService.js';
import { ZavorthNativeCapabilityCertificationService } from '../../services/ZavorthNativeCapabilityCertificationService.js';
import { ZavorthOperationalReadinessService } from '../../services/ZavorthOperationalReadinessService.js';
import { firstArg, readFlag } from '../ZavorthCliSharedHelpers.js';

export async function runCertify(root: string, args: string[]): Promise<{ exitCode: number; output: string }> {
  const target = firstArg(args, 'operational');
  const operationalTargets = new Set(['operational', 'readiness', 'ops']);
  if (['product-excellence', 'product', 'excellence'].includes(target)) {
    const service = new ZavorthProductExcellenceService({
      projectRoot: root,
      ...(readFlag(args, 'evidence-root') ? { evidenceRoot: readFlag(args, 'evidence-root') } : {}),
      env: process.env,
    });
    const snapshot = await service.buildSnapshot();
    const output = args.includes('--json')
      ? `${JSON.stringify(snapshot, null, 2)}\n`
      : `${service.renderText(snapshot)}\n`;
    return {
      exitCode: args.includes('--strict') && snapshot.status !== 'ready' ? 1 : 0,
      output,
    };
  }
  if (['native-capability', 'native', 'capability'].includes(target)) {
    const service = new ZavorthNativeCapabilityCertificationService({
      projectRoot: root,
      ...(readFlag(args, 'evidence-root') ? { evidenceRoot: readFlag(args, 'evidence-root') } : {}),
      env: process.env,
    });
    const snapshot = await service.buildSnapshot();
    const output = args.includes('--json')
      ? `${JSON.stringify(snapshot, null, 2)}\n`
      : `${service.renderText(snapshot)}\n`;
    return {
      exitCode: args.includes('--strict') && snapshot.status !== 'ready' ? 1 : 0,
      output,
    };
  }
  if (!operationalTargets.has(target)) {
    const payload = {
      ok: false,
      error: `Unknown certify target: ${target}`,
      allowedTargets: ['operational', 'product-excellence', 'native-capability'],
    };
    if (args.includes('--json')) {
      return {
        exitCode: 1,
        output: `${JSON.stringify(payload, null, 2)}\n`,
      };
    }
    return {
      exitCode: 1,
      output: [
        `Unknown certify target: ${target}`,
        'Allowed targets: operational, product-excellence, native-capability',
      ].join('\n') + '\n',
    };
  }
  const service = new ZavorthOperationalReadinessService();
  const snapshot = service.buildSnapshot(root);
  const output = args.includes('--json')
    ? `${JSON.stringify(snapshot, null, 2)}\n`
    : `${service.renderText(snapshot)}\n`;
  return {
    exitCode: args.includes('--strict') && snapshot.status !== 'pass' ? 1 : 0,
    output,
  };
}
