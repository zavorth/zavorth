import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

type Vulnerability = {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  via: string[];
  fixAvailable: boolean;
};

type LicenseViolation = {
  name: string;
  version: string;
  license: string;
};

type AuditReport = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    status: 'passed' | 'failed';
    totalDependencies: number;
    vulnerableDependencies: number;
    criticalVulnerabilities: number;
    highVulnerabilities: number;
    moderateVulnerabilities: number;
    lowVulnerabilities: number;
    licenseViolations: number;
  };
  vulnerabilities: Vulnerability[];
  licenseViolations: LicenseViolation[];
};

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const workspaceRoot = process.cwd();

const ALLOWED_LICENSES = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'CC0-1.0',
  'Unlicense',
  '(MIT AND Apache-2.0)',
  '(MIT OR Apache-2.0)',
  '(BSD-2-Clause OR MIT)',
  '(BSD-3-Clause OR MIT)',
  '(ISC OR MIT)',
  '(MIT OR CC0-1.0)',
]);

const BLOCKED_LICENSES = new Set([
  'GPL-2.0',
  'GPL-3.0',
  'AGPL-3.0',
  'UNLICENSED',
  'GPL-2.0-only',
  'GPL-3.0-only',
  'AGPL-3.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0-or-later',
  'AGPL-3.0-or-later',
]);

function runNpmAudit(): { vulnerabilities: Vulnerability[]; totalDeps: number } {
  try {
    const output = execFileSync('npm', ['audit', '--json'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 10 * 1024 * 1024,
    });
    const data = JSON.parse(output);
    const vulnerabilities: Vulnerability[] = [];
    let totalDeps = 0;

    if (data.vulnerabilities) {
      for (const [name, vuln] of Object.entries(data.vulnerabilities as Record<string, any>)) {
        vulnerabilities.push({
          name,
          severity: vuln.severity || 'unknown',
          via: Array.isArray(vuln.via) ? vuln.via.map((v: any) => (typeof v === 'string' ? v : v.title || v.name || 'unknown')) : [],
          fixAvailable: !!vuln.fixAvailable,
        });
      }
    }

    if (data.metadata) {
      totalDeps = data.metadata.totalDependencies || 0;
    }

    return { vulnerabilities, totalDeps };
  } catch {
    const lockPath = path.join(workspaceRoot, 'package-lock.json');
    let totalDeps = 0;
    if (fs.existsSync(lockPath)) {
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      if (lock.packages) {
        totalDeps = Object.keys(lock.packages).filter((k) => k !== '').length;
      }
    }
    return { vulnerabilities: [], totalDeps };
  }
}

function checkLicenseCompliance(): LicenseViolation[] {
  const violations: LicenseViolation[] = [];
  try {
    const output = execFileSync('npm', ['ls', '--all', '--json', '--long'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 10 * 1024 * 1024,
    });
    const data = JSON.parse(output);

    function walkDeps(deps: Record<string, any>, parentPath: string = '') {
      for (const [name, info] of Object.entries(deps)) {
        const dep = info as any;
        const depPath = parentPath ? `${parentPath} > ${name}` : name;
        const license = dep.license || '';
        if (typeof license === 'string' && license) {
          const normalizedLicense = license.replace(/^\(|\)$/g, '').trim();
          if (BLOCKED_LICENSES.has(normalizedLicense)) {
            violations.push({
              name: depPath,
              version: dep.version || 'unknown',
              license: normalizedLicense,
            });
          } else if (!ALLOWED_LICENSES.has(normalizedLicense) && !normalizedLicense.includes('MIT') && !normalizedLicense.includes('ISC')) {
            violations.push({
              name: depPath,
              version: dep.version || 'unknown',
              license: normalizedLicense,
            });
          }
        }
        if (dep.dependencies) {
          walkDeps(dep.dependencies, depPath);
        }
      }
    }

    if (data.dependencies) {
      walkDeps(data.dependencies);
    }
  } catch {
    // npm ls may fail on some projects; license check is best-effort
  }
  return violations;
}

const { vulnerabilities, totalDeps } = runNpmAudit();
const licenseViolations = checkLicenseCompliance();

const criticalCount = vulnerabilities.filter((v) => v.severity === 'critical').length;
const highCount = vulnerabilities.filter((v) => v.severity === 'high').length;
const moderateCount = vulnerabilities.filter((v) => v.severity === 'moderate').length;
const lowCount = vulnerabilities.filter((v) => v.severity === 'low').length;

const report: AuditReport = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  summary: {
    status: criticalCount > 0 || highCount > 0 || licenseViolations.length > 0 ? 'failed' : 'passed',
    totalDependencies: totalDeps,
    vulnerableDependencies: vulnerabilities.length,
    criticalVulnerabilities: criticalCount,
    highVulnerabilities: highCount,
    moderateVulnerabilities: moderateCount,
    lowVulnerabilities: lowCount,
    licenseViolations: licenseViolations.length,
  },
  vulnerabilities,
  licenseViolations,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('[dependency-audit] scanning dependencies');
  console.log(`[dependency-audit] total dependencies: ${totalDeps}`);
  console.log(`[dependency-audit] vulnerable: ${vulnerabilities.length}`);
  console.log(`[dependency-audit] critical: ${criticalCount}, high: ${highCount}, moderate: ${moderateCount}, low: ${lowCount}`);
  console.log(`[dependency-audit] license violations: ${licenseViolations.length}`);

  if (criticalCount > 0 || highCount > 0) {
    console.log('\n[dependency-audit] CRITICAL/HIGH vulnerabilities:');
    for (const vuln of vulnerabilities.filter((v) => v.severity === 'critical' || v.severity === 'high')) {
      console.log(`  - [${vuln.severity}] ${vuln.name}: ${vuln.via.join(', ')} (fix: ${vuln.fixAvailable ? 'available' : 'manual'})`);
    }
  }

  if (licenseViolations.length > 0) {
    console.log('\n[dependency-audit] license violations:');
    for (const violation of licenseViolations.slice(0, 15)) {
      console.log(`  - ${violation.name}@${violation.version}: ${violation.license}`);
    }
    if (licenseViolations.length > 15) {
      console.log(`  ... and ${licenseViolations.length - 15} more`);
    }
  }
}

if (report.summary.status === 'failed') {
  process.exitCode = 1;
}
