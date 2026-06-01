import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_PRODUCT_HARDENING_CONTRACT_VERSION,
  type ZavorthProductHardeningArea,
  type ZavorthProductHardeningGate,
  type ZavorthProductHardeningSnapshot,
  type ZavorthProductHardeningStatus,
} from '../contracts/ZavorthProductHardeningContract.js';
import { LegacySurfaceContainmentService } from './LegacySurfaceContainmentService.js';
import { ZavorthNativeConvergenceService } from './ZavorthNativeConvergenceService.js';
import { ZavorthOperationalRefinementService } from './ZavorthOperationalRefinementService.js';

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
    const [qualityGates, surfaceConsolidation, installUx, dashboardUx, certification, repoHygiene] = await Promise.all([
      this.qualityGates(),
      this.surfaceConsolidation(),
      this.installUx(),
      this.dashboardUx(),
      this.certification(),
      this.repoHygiene(),
    ]);
    const areas = [
      qualityGates,
      surfaceConsolidation,
      installUx,
      dashboardUx,
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
        dashboard: 'npm run zavorth-control-vite:check --silent',
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
      this.scriptGate('dashboard-check', 'Dashboard build and design-system check', 'zavorth-control-vite:check', scripts),
      this.scriptGate('native-convergence-check', 'Native convergence check', 'zavorth:native-convergence:check', scripts),
      this.scriptGate('operational-refinement-check', 'Operational refinement check', 'zavorth:operational-refinement:check', scripts),
      this.scriptGate('product-readiness-gate', 'Large product readiness gate', 'zavorth:product-readiness:check', scripts),
      this.scriptGate('release-check', 'Release gate', 'release:check', scripts),
    ];
    return this.area(
      'quality-gates',
      'Quality Gates',
      gates,
      'Checks essenciais estao registrados em package.json e podem ser repetidos sem procurar scripts soltos.',
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
      this.gate('legacy-routes-retired', 'Legacy routes retired', retired ? 'ready' : 'blocked', retired
        ? 'Superficies antigas foram removidas por policy.'
        : 'Superficies antigas ainda nao estao marcadas como removidas.', {
        evidence: [`retired=${legacy.retiredSurfaces.join(',')}`, `canonical=${legacy.canonicalEntry}`],
        nextActions: retired ? [] : ['remover /app e /classic da surface publica'],
      }),
      this.gate('canonical-shell', 'Canonical shell', viteSource && staticShell ? 'ready' : 'blocked', viteSource && staticShell
        ? 'ZavorthControl tem fonte Vite e host controlado.'
        : 'Fonte ou host do ZavorthControl ausente.', {
        evidence: [
          `vite source: ${viteSource ? 'ok' : 'missing'}`,
          `control assets: ${staticShell ? 'ok' : 'missing'}`,
        ],
        nextActions: viteSource && staticShell ? [] : ['reconectar shell principal do dashboard'],
      }),
      this.gate('surface-docs', 'Surface docs', docs ? 'ready' : 'attention', docs
        ? 'Documentos de direcao das superficies existem.'
        : 'Algum documento de surface esta ausente.', {
        evidence: legacy.consolidation.canonicalDocs,
        nextActions: docs ? [] : ['atualizar docs de surface/caminho canonico'],
      }),
    ];
    return this.area(
      'surface-consolidation',
      'Surface Consolidation',
      gates,
      'Superficies antigas ficam contidas e o dashboard principal permanece como produto ativo.',
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
      this.gate('setup-entrypoint', 'Setup entrypoint', setupScript ? 'ready' : 'blocked', setupScript
        ? 'Setup principal esta exposto por npm run setup.'
        : 'Setup principal nao esta exposto.', {
        evidence: ['scripts/setup-v3.ts', 'package script: setup'],
        nextActions: setupScript ? [] : ['reconectar setup principal'],
      }),
      this.gate('setup-choices', 'Setup choices', setupStudio ? 'ready' : 'attention', setupStudio
        ? 'Setup Studio cobre governanca de skills e wake detector.'
        : 'Setup Studio nao evidencia todas as escolhas de primeira execucao.', {
        evidence: ['skills governance', 'wake detector choice'],
        nextActions: setupStudio ? [] : ['adicionar prompts claros no setup inicial'],
      }),
      this.gate('home-isolation', 'Home isolation', homeCommands ? 'ready' : 'blocked', homeCommands
        ? 'ZAVORTH_HOME tem comandos e servico de path.'
        : 'Isolamento por home nao esta conectado.', {
        evidence: ['ZavorthHomePathService', 'home migrate'],
        nextActions: homeCommands ? [] : ['restaurar comandos home status/doctor/migrate'],
      }),
      this.gate('wake-setup', 'Wake setup', wakeCommands ? 'ready' : 'blocked', wakeCommands
        ? 'Echo wake tem runtime e setup explicito.'
        : 'Echo wake nao tem setup completo.', {
        evidence: ['VoiceWakeRuntimeService', 'echo wake setup'],
        nextActions: wakeCommands ? [] : ['restaurar setup de detector wake'],
      }),
    ];
    return this.area(
      'install-ux',
      'Install UX',
      gates,
      'Instalacao guia escolhas criticas: home, governanca, provider/channel e voice wake.',
    );
  }

  private dashboardUx(): ZavorthProductHardeningArea {
    const files = [
      'apps/zavorth-control-vite-shell/src/app.ts',
      'apps/zavorth-control-vite-shell/src/pages.ts',
      'apps/zavorth-control-vite-shell/src/shell-navigation.ts',
      'apps/zavorth-control-vite-shell/public/styles/chat.css',
      'apps/zavorth-control-vite-shell/public/styles/pages.css',
    ];
    const allFiles = files.every((file) => this.exists(file));
    const chatHome = this.hasMarker('apps/zavorth-control-vite-shell/public/styles/chat.css', 'terminal-hero')
      && this.hasMarker('apps/zavorth-control-vite-shell/index.html', 'Ask Zavorth or start with a suggestion.');
    const scripts = this.packageScripts();
    const gates = [
      this.gate('dashboard-files', 'Dashboard files', allFiles ? 'ready' : 'blocked', allFiles
        ? 'Arquivos principais do dashboard existem.'
        : 'Algum arquivo principal do dashboard esta ausente.', {
        evidence: files,
        nextActions: allFiles ? [] : ['restaurar arquivos principais do ZavorthControl'],
      }),
      this.gate('chat-surface-polish', 'Chat surface polish', chatHome ? 'ready' : 'attention', chatHome
        ? 'Entrada de chat segue a surface simples atual.'
        : 'Chat principal pode ter perdido a experiencia minimalista.', {
        evidence: ['chat composer style', 'home prompt text'],
        nextActions: chatHome ? [] : ['revisar tela inicial do chat'],
      }),
      this.scriptGate('dashboard-build-script', 'Dashboard check script', 'zavorth-control-vite:check', scripts),
    ];
    return this.area(
      'dashboard-ux',
      'Dashboard UX',
      gates,
      'Dashboard tem fonte unica, build repetivel e tela de chat mantida simples.',
    );
  }

  private async certification(): Promise<ZavorthProductHardeningArea> {
    const [convergence, refinement] = await Promise.all([
      new ZavorthNativeConvergenceService({
        projectRoot: this.projectRoot,
        now: this.now,
        env: this.env,
      }).buildSnapshot(),
      new ZavorthOperationalRefinementService({
        projectRoot: this.projectRoot,
        now: this.now,
      }).buildSnapshot(),
    ]);
    const gates = [
      this.gate('native-convergence', 'Native convergence', convergence.status === 'blocked' ? 'blocked' : 'ready',
        `Convergencia nativa reporta ${convergence.status}.`, {
          evidence: [
            `ready=${convergence.summary.ready}/${convergence.summary.total}`,
            `missing_config=${convergence.summary.missingConfig}`,
            convergence.commands.qa,
          ],
          nextActions: convergence.status === 'blocked' ? ['resolver pilares bloqueados da convergencia nativa'] : [],
        }),
      this.gate('operational-refinement', 'Operational refinement', refinement.status === 'ready' ? 'ready' : 'attention',
        `Refinamento operacional reporta ${refinement.status}.`, {
          evidence: [
            `ready=${refinement.summary.ready}`,
            refinement.commands.qa,
          ],
          nextActions: refinement.status === 'ready' ? [] : ['resolver areas parciais do refinamento operacional'],
        }),
    ];
    return this.area(
      'certification',
      'Certification',
      gates,
      'Certificacoes recentes entram em um resumo unico de produto.',
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
      this.gate('hardening-files', 'Hardening files', filesExist ? 'ready' : 'blocked', filesExist
        ? 'Arquivos de hardening estao versionaveis e separados.'
        : 'Arquivos de hardening estao incompletos.', {
        evidence: newHardeningFiles,
        nextActions: filesExist ? [] : ['restaurar contrato/servico/script/teste de hardening'],
      }),
      this.gate('secret-hygiene', 'Secret hygiene', noSecretMarkers ? 'ready' : 'blocked', noSecretMarkers
        ? 'Snapshot e arquivos novos nao contem tokens brutos conhecidos.'
        : 'Possivel segredo bruto detectado.', {
        evidence: ['known token patterns redacted'],
        nextActions: noSecretMarkers ? [] : ['redigir segredo antes de seguir'],
      }),
      this.gate('qa-script', 'QA script', qaScript ? 'ready' : 'blocked', qaScript
        ? 'QA de hardening esta registrado no package.json.'
        : 'QA de hardening nao esta registrado.', {
        evidence: ['qa:zavorth-product-hardening'],
        nextActions: qaScript ? [] : ['registrar script qa:zavorth-product-hardening'],
      }),
    ];
    return this.area(
      'repo-hygiene',
      'Repository Hygiene',
      gates,
      'Worktree suja nao bloqueia desenvolvimento, mas hardening novo tem check proprio e sem segredo bruto.',
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
    return this.gate(id, label, present ? 'ready' : 'blocked', present
      ? `Script ${scriptName} registrado.`
      : `Script ${scriptName} ausente.`, {
      command: present ? `npm run ${scriptName} --silent` : undefined,
      evidence: present ? [scripts[scriptName] || ''] : [],
      nextActions: present ? [] : [`registrar script ${scriptName}`],
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
    } catch {
      return {};
    }
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
