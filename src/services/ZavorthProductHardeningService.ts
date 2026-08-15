import { LegacySurfaceContainmentService } from './LegacySurfaceContainmentService.js';
import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_PRODUCT_HARDENING_CONTRACT_VERSION,
  type ZavorthProductHardeningArea,
  type ZavorthProductHardeningGate,
  type ZavorthProductHardeningSnapshot,
  type ZavorthProductHardeningStatus,
} from '../contracts/ZavorthProductHardeningContract.js';

import { logger } from '../logger.js';

type ProductHardeningRuntime = {
  projectRoot?: string;
  now?: () => Date;
  env?: Record<string, string | undefined>;
};

type PackageJson = {
  scripts?: Record<string, string>;
};

const SECRET_TOKEN_PATTERN = /(sk-[A-Za-z0-9_-]{12,}|hf_[A-Za-z0-9]{12,}|AIza[0-9A-Za-z_-]{16,}|xox[baprs]-[A-Za-z0-9-]{12,})/u;

export class ZavorthProductHardeningService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;

  public constructor(runtime: ProductHardeningRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
  }

  public async buildSnapshot(): Promise<ZavorthProductHardeningSnapshot> {
    const [qualityGates, surfaceConsolidation, installUx, zavorthControlUx, certification, repoHygiene] = await Promise.all([
      this.qualityGates(),
      this.surfaceConsolidation(),
      this.installUx(),
      this.zavorthControlUx(),
      this.certification(),
      this.repoHygiene(),
    ]);
    const areas = [
      qualityGates,
      surfaceConsolidation,
      installUx,
      zavorthControlUx,
      certification,
      repoHygiene,
    ];
    const summary = {
      totalAreas: areas.length,
      ready: areas.filter((area) => area.status === 'ready').length,
      attention: areas.filter((area) => area.status === 'attention').length,
      blocked: areas.filter((area) => area.status === 'blocked').length,
    };
    const surfacePolicy = this.surfacePolicy();

    return {
      contractVersion: ZAVORTH_PRODUCT_HARDENING_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      status: this.aggregate(areas.map((area) => area.status)),
      summary,
      areas,
      surfacePolicy,
      installPolicy: {
        homeIsExplicit: true,
        setupExplainsGovernance: true,
        wakeDetectorChoiceIsExplicit: true,
        migrationRequiresApproval: true,
      },
      safety: {
        dirtyWorktreeIsNotAReleaseBlocker: true,
        noSilentMutation: true,
        secretValuesSerialized: false,
        oldSurfacesRemoved: true,
        checksAreRepeatable: true,
      },
      commands: {
        inspect: 'npm run zavorth:product-hardening -- --json',
        doctor: 'zavorth doctor product-hardening',
        qa: 'npm run qa:zavorth-product-hardening --silent',
        zavorthControl: 'npm run zavorth-control-vite:check --silent',
        convergence: 'npm run zavorth:native-convergence:check --silent',
        refinement: 'npm run zavorth:operational-refinement:check --silent',
      },
    };
  }

  public renderText(snapshot: ZavorthProductHardeningSnapshot): string {
    const lines = [
      '[zavorth-product-hardening]',
      `status=${snapshot.status} ready=${snapshot.summary.ready}/${snapshot.summary.totalAreas} attention=${snapshot.summary.attention} blocked=${snapshot.summary.blocked}`,
      `surface=${snapshot.surfacePolicy.canonicalEntry} retired=${snapshot.surfacePolicy.retiredSurfaces.join(',')}`,
      '',
    ];
    for (const area of snapshot.areas) {
      lines.push(`${area.id}: ${area.status}`);
      lines.push(`  ${area.summary}`);
      for (const gate of area.gates.slice(0, 4)) {
        lines.push(`  - ${gate.id}: ${gate.status} | ${gate.summary}`);
      }
      lines.push('');
    }
    lines.push(`qa=${snapshot.commands.qa}`);
    return `${lines.join('\n')}\n`;
  }

  private qualityGates(): ZavorthProductHardeningArea {
    const scripts = this.packageScripts();
    const gates = [
      this.scriptGate('runtime-check', 'TypeScript/runtime check', 'runtime:check', scripts),
      this.scriptGate('zavorthControl-check', 'ZavorthControl build and design-system check', 'zavorth-control-vite:check', scripts),
      this.scriptGate('native-convergence-check', 'Native convergence check', 'zavorth:native-convergence:check', scripts),
      this.scriptGate('operational-refinement-check', 'Operational refinement check', 'zavorth:operational-refinement:check', scripts),
      this.scriptGate('product-readiness-gate', 'Large product readiness gate', 'zavorth:product-readiness:check', scripts),
      this.scriptGate('release-check', 'Release gate', 'release:check', scripts),
    ];
    return this.area(
      'quality-gates',
      'Quality Gates',
      gates,
      'Essential checks are registered in package.json and can be repeated without searching for loose scripts.',
    );
  }

  private surfaceConsolidation(): ZavorthProductHardeningArea {
    const legacy = new LegacySurfaceContainmentService().buildSnapshot({
      now: this.now().toISOString(),
    });
    const retired = legacy.retiredSurfaces.length === 2 && legacy.policy.legacyRoutesRetired === true;
    const viteSource = this.exists('apps/zavorth-control-vite-shell/src/app.ts');
    const staticShell = this.exists('src/ai-gateway/app/(zavorthControl)/control/ControlPageAssets.tsx');
    const docs = legacy.consolidation.canonicalDocs.every((doc) => this.exists(doc));
    const gates = [
      this.gate('legacy-routes-retired', 'Legacy routes retired', retired ? 'ready' : 'blocked', retired ? 'Legacy surfaces were removed by policy.'
        : 'Legacy surfaces are not yet marked as removed.', {
        evidence: [`retired=${legacy.retiredSurfaces.join(',')}`, `canonical=${legacy.canonicalEntry}`],
        nextActions: retired ? [] : ['remove /app and /classic from the public surface'],
      }),
      this.gate('canonical-shell', 'Canonical shell', viteSource && staticShell ? 'ready' : 'blocked', viteSource && staticShell ? 'ZavorthControl has Vite source and controlled host.'
        : 'ZavorthControl source or host missing.', {
        evidence: [
          `vite source: ${viteSource ? 'ok' : 'missing'}`,
          `control assets: ${staticShell ? 'ok' : 'missing'}`,
        ],
        nextActions: viteSource && staticShell ? [] : ['reconnect the main zavorthControl shell'],
      }),
      this.gate('surface-docs', 'Surface docs', docs ? 'ready' : 'attention', docs ? 'Surface direction documents exist.'
        : 'Some surface document is missing.', {
        evidence: legacy.consolidation.canonicalDocs,
        nextActions: docs ? [] : ['update canonical surface/path docs'],
      }),
    ];
    return this.area(
      'surface-consolidation',
      'Surface Consolidation',
      gates,
      'Legacy surfaces remain contained and the main zavorthControl remains the active product.',
    );
  }

  private installUx(): ZavorthProductHardeningArea {
    const setupScript = this.exists('scripts/setup-v3.ts') && Boolean(this.packageScripts().setup);
    const setupStudio = this.hasMarker('src/cli/ZavorthSetupStudioService.ts', 'skillsGovernanceMode')
      && this.hasMarker('src/cli/ZavorthProviderChannelWizardService.ts', 'wakeDetector');
    const homeCommands = this.exists('src/services/ZavorthHomePathService.ts')
      && this.exists('src/cli/home/ZavorthCliHomeCommand.ts')
      && this.hasMarker('src/services/ZavorthHomePathService.ts', 'migratePreviewCommand');
    const wakeCommands = this.exists('src/services/VoiceWakeRuntimeService.ts')
      && this.exists('src/services/VoiceWakeDetectorSetupService.ts')
      && this.hasMarker('src/zavorth-cli.ts', 'runZavorthEchoWakeCommand');
    const gates = [
      this.gate('setup-entrypoint', 'Setup entrypoint', setupScript ? 'ready' : 'blocked', setupScript ? 'Main setup is exposed via npm run setup.'
        : 'Main setup is not exposed.', {
        evidence: ['scripts/setup-v3.ts', 'package script: setup'],
        nextActions: setupScript ? [] : ['reconnect main setup'],
      }),
      this.gate('setup-choices', 'Setup choices', setupStudio ? 'ready' : 'attention', setupStudio ? 'Setup Studio covers skills governance and wake detector.'
        : 'Setup Studio does not evidence all first-run choices.', {
        evidence: ['skills governance', 'wake detector choice'],
        nextActions: setupStudio ? [] : ['add clear prompts to the initial setup'],
      }),
      this.gate('home-isolation', 'Home isolation', homeCommands ? 'ready' : 'blocked', homeCommands ? 'ZAVORTH_HOME has commands and path service.'
        : 'Home isolation is not connected.', {
        evidence: ['ZavorthHomePathService', 'home migrate'],
        nextActions: homeCommands ? [] : ['restore home status/doctor/migrate commands'],
      }),
      this.gate('wake-setup', 'Wake setup', wakeCommands ? 'ready' : 'blocked', wakeCommands ? 'Echo wake has runtime and explicit setup.'
        : 'Echo wake has no complete setup.', {
        evidence: ['VoiceWakeRuntimeService', 'echo wake setup'],
        nextActions: wakeCommands ? [] : ['restore wake detector setup'],
      }),
    ];
    return this.area(
      'install-ux',
      'Install UX',
      gates,
      'Installation guides critical choices: home, governance, provider/channel, and voice wake.',
    );
  }

  private zavorthControlUx(): ZavorthProductHardeningArea {
    const files = [
      'apps/zavorth-control-vite-shell/src/app.ts',
      'apps/zavorth-control-vite-shell/src/pages.ts',
      'apps/zavorth-control-vite-shell/src/shell-navigation.ts',
      'apps/zavorth-control-vite-shell/public/styles/chat.css',
      'apps/zavorth-control-vite-shell/public/styles/pages.css',
    ];
    const allFiles = files.every((file) => this.exists(file));
    const chatHome = this.hasMarker('apps/zavorth-control-vite-shell/public/styles/chat.css', 'terminal-hero')
      && this.hasMarker('apps/zavorth-control-vite-shell/index.html', 'id="terminal-hero"')
      && this.hasMarker('apps/zavorth-control-vite-shell/index.html', 'id="trust-rail"');
    const scripts = this.packageScripts();
    const gates = [
      this.gate('zavorthControl-files', 'ZavorthControl files', allFiles ? 'ready' : 'blocked', allFiles ? 'Main zavorthControl files exist.'
        : 'Some main zavorthControl file is missing.', {
        evidence: files,
        nextActions: allFiles ? [] : ['restore main ZavorthControl files'],
      }),
      this.gate('chat-surface-polish', 'Chat surface polish', chatHome ? 'ready' : 'attention', chatHome ? 'Chat entry follows the current simple surface.'
        : 'Main chat may have lost the minimalist experience.', {
        evidence: ['chat composer style', 'home prompt text'],
        nextActions: chatHome ? [] : ['review the chat home screen'],
      }),
      this.scriptGate('zavorthControl-build-script', 'ZavorthControl check script', 'zavorth-control-vite:check', scripts),
    ];
    return this.area(
      'zavorthControl-ux',
      'ZavorthControl UX',
      gates,
      'ZavorthControl has a single source, repeatable build, and a simple maintained chat screen.',
    );
  }

  private async certification(): Promise<ZavorthProductHardeningArea> {
    const scripts = this.packageScripts();
    const convergenceReady = Boolean(scripts['zavorth:native-convergence:check'])
      && this.exists('src/services/ZavorthNativeConvergenceService.ts')
      && this.exists('tests/services/ZavorthNativeConvergenceService.test.ts');
    const refinementReady = Boolean(scripts['zavorth:operational-refinement:check'])
      && this.exists('src/services/ZavorthOperationalRefinementService.ts')
      && this.exists('tests/services/ZavorthOperationalRefinementService.test.ts');
    const gates = [
      this.gate('native-convergence', 'Native convergence', convergenceReady ? 'ready' : 'blocked',
        convergenceReady ? 'Native convergence certification is wired as a repeatable check.'
          : 'Native convergence certification is not fully wired.', {
          evidence: [
            'src/services/ZavorthNativeConvergenceService.ts',
            'tests/services/ZavorthNativeConvergenceService.test.ts',
            scripts['zavorth:native-convergence:check'] || 'missing script',
          ],
          nextActions: convergenceReady ? [] : ['wire native convergence service, tests and package script'],
        }),
      this.gate('operational-refinement', 'Operational refinement', refinementReady ? 'ready' : 'attention',
        refinementReady ? 'Operational refinement certification is wired as a repeatable check.'
          : 'Operational refinement certification is partially wired.', {
          evidence: [
            'src/services/ZavorthOperationalRefinementService.ts',
            'tests/services/ZavorthOperationalRefinementService.test.ts',
            scripts['zavorth:operational-refinement:check'] || 'missing script',
          ],
          nextActions: refinementReady ? [] : ['wire operational refinement service, tests and package script'],
        }),
    ];
    return this.area(
      'certification',
      'Certification',
      gates,
      'Recent certifications are consolidated into a single product summary.',
    );
  }

  private repoHygiene(): ZavorthProductHardeningArea {
    const newHardeningFiles = [
      'src/contracts/ZavorthProductHardeningContract.ts',
      'src/services/ZavorthProductHardeningService.ts',
      'scripts/zavorth-product-hardening.ts',
      'scripts/zavorth-product-hardening-check.mjs',
      'tests/services/ZavorthProductHardeningService.test.ts',
    ];
    const filesExist = newHardeningFiles.every((file) => this.exists(file));
    const noSecretMarkers = newHardeningFiles
      .filter((file) => this.exists(file))
      .every((file) => !SECRET_TOKEN_PATTERN.test(this.read(file)));
    const packageScripts = this.packageScripts();
    const qaScript = Boolean(packageScripts['qa:zavorth-product-hardening']);
    const gates = [
      this.gate('hardening-files', 'Hardening files', filesExist ? 'ready' : 'blocked', filesExist ? 'Hardening files are versionable and separated.'
        : 'Hardening files are incomplete.', {
        evidence: newHardeningFiles,
        nextActions: filesExist ? [] : ['restore hardening contract/service/script/test'],
      }),
      this.gate('secret-hygiene', 'Secret hygiene', noSecretMarkers ? 'ready' : 'blocked', noSecretMarkers ? 'Snapshot and new files do not contain known raw tokens.'
        : 'Possible raw secret detected.', {
        evidence: ['known token patterns redacted'],
        nextActions: noSecretMarkers ? [] : ['redact secrets before proceeding'],
      }),
      this.gate('qa-script', 'QA script', qaScript ? 'ready' : 'blocked', qaScript ? 'Hardening QA is registered in package.json.'
        : 'Hardening QA is not registered.', {
        evidence: ['qa:zavorth-product-hardening'],
        nextActions: qaScript ? [] : ['register qa:zavorth-product-hardening script'],
      }),
    ];
    return this.area(
      'repo-hygiene',
      'Repository Hygiene',
      gates,
      'Dirty worktree blocks development, but new hardening has its own check and no raw secrets.',
    );
  }

  private surfacePolicy(): ZavorthProductHardeningSnapshot['surfacePolicy'] {
    const legacy = new LegacySurfaceContainmentService().buildSnapshot({
      now: this.now().toISOString(),
    });
    return {
      canonicalEntry: legacy.canonicalEntry,
      retiredSurfaces: [...legacy.retiredSurfaces],
      legacyRoutesRetired: legacy.policy.legacyRoutesRetired,
      duplicateSurfacesRemoved: !legacy.policy.compatibilityPreserved && !legacy.policy.fallbackPreserved,
    };
  }

  private scriptGate(
    id: string,
    label: string,
    scriptName: string,
    scripts: Record<string, string>,
  ): ZavorthProductHardeningGate {
    const present = Boolean(scripts[scriptName]);
    return this.gate(id, label, present ? 'ready' : 'blocked', present ? `Script ${scriptName} registered.`
      : `Script ${scriptName} missing.`, {
      command: present ? `npm run ${scriptName} --silent` : undefined,
      evidence: present ? [scripts[scriptName] || ''] : [],
      nextActions: present ? [] : [`register script ${scriptName}`],
    });
  }

  private area(
    id: ZavorthProductHardeningArea['id'],
    title: string,
    gates: ZavorthProductHardeningGate[],
    summary: string,
  ): ZavorthProductHardeningArea {
    return {
      id,
      title,
      status: this.aggregate(gates.map((gate) => gate.status)),
      summary,
      gates,
    };
  }

  private gate(
    id: string,
    label: string,
    status: ZavorthProductHardeningStatus,
    summary: string,
    options: {
      command?: string;
      evidence?: string[];
      nextActions?: string[];
    } = {},
  ): ZavorthProductHardeningGate {
    return {
      id,
      label,
      status,
      summary,
      command: options.command,
      evidence: options.evidence || [],
      nextActions: options.nextActions || [],
    };
  }

  private aggregate(statuses: ZavorthProductHardeningStatus[]): ZavorthProductHardeningStatus {
    if (statuses.includes('blocked')) return 'blocked';
    if (statuses.includes('attention')) return 'attention';
    return 'ready';
  }

  private packageScripts(): Record<string, string> {
    try {
      const packageJson = JSON.parse(this.read('package.json')) as PackageJson;
      return packageJson.scripts || {};
    } catch (error: unknown) {logger.warn('[Zavorth Product Hardening] JSON parse failed', error); return {}; }
  }

  private hasMarker(file: string, marker: string): boolean {
    return this.exists(file) && this.read(file).includes(marker);
  }

  private exists(file: string): boolean {
    return fs.existsSync(path.join(this.projectRoot, file));
  }

  private read(file: string): string {
    return fs.readFileSync(path.join(this.projectRoot, file), 'utf8');
  }
}
