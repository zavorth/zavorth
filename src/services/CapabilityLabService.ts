import type { IntelligenceCapabilityManifest } from '../contracts/native/IntelligenceFabricContract.js';
import type { CapabilityLabCheck, CapabilityLabSnapshot } from '../contracts/PracticalAgencyContract.js';

export class CapabilityLabService {
  public simulate(input: { manifest: IntelligenceCapabilityManifest | null }): CapabilityLabSnapshot {
    if (!input.manifest) {
      return {
        source: 'CapabilityLabService',
        status: 'passed',
        simulated: false,
        activationAllowed: false,
        checks: [
          { id: 'capability-lab.not-needed', status: 'passed', message: 'No new capability draft needs lab simulation.' },
        ],
      };
    }

    const manifest = input.manifest;
    const checks: CapabilityLabCheck[] = [
      this.check('capability-lab.default-disabled', manifest.defaultEnabled === false, 'New capability starts disabled.'),
      this.check('capability-lab.no-live-default', manifest.liveAllowedByDefault === false, 'Live activation is disabled by default.'),
      this.check('capability-lab.secret-names-only', manifest.requiredSecrets.every((secret) => !looksLikeSecret(secret)), 'Required secrets are references, not raw values.'),
      this.check('capability-lab.manifest-text-redacted', !looksLikeSecret(`${manifest.name} ${manifest.description}`), 'Capability manifest text must not contain raw secrets.'),
      this.check('capability-lab.scoped-files', manifest.allowedFileScopes.length > 0, 'Capability declares allowed file scopes.'),
      this.check('capability-lab.tests-declared', manifest.tests.length > 0, 'Capability declares tests before activation.'),
      this.check('capability-lab.approval-for-risk', manifest.riskLevel < 3 || manifest.approvalRequiredFor.includes('activate-live'), 'Risk 3+ activation requires owner approval.'),
      this.check('capability-lab.network-governed', manifest.networkAccess !== 'open' || manifest.approvalRequiredFor.includes('network-access'), 'Open network access requires approval.'),
    ];
    const blockers = checks.filter((check) => check.status === 'blocked');
    const warnings = checks.filter((check) => check.status === 'warning');
    return {
      source: 'CapabilityLabService',
      status: blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'passed',
      simulated: true,
      activationAllowed: false,
      checks,
    };
  }

  private check(id: string, passed: boolean, message: string): CapabilityLabCheck {
    return {
      id,
      status: passed ? 'passed' : 'blocked',
      message,
    };
  }
}

function looksLikeSecret(value: string): boolean {
  return /\b(sk-|gh[pousr]_|xox[baprs]-|AIza|token\s*[:=]|secret\s*[:=]|password\s*[:=])\b/i.test(String(value || ''));
}
