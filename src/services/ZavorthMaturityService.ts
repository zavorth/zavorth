import fs from 'node:fs';
import path from 'node:path';
import type {
  ZavorthMaturityGate,
  ZavorthMaturitySnapshot,
  ZavorthMaturityStatus,
} from '../contracts/ZavorthMaturityContract.js';
import { OperationalMaturityService } from '../domain/platform-ecosystem/application/OperationalMaturityService.js';
import { ChannelExperienceCertificationService } from './ChannelExperienceCertificationService.js';
import { LiveReadinessCertificationService } from './LiveReadinessCertificationService.js';
import { ZavorthDashboardVisualQaService } from './ZavorthDashboardVisualQaService.js';
import { ZavorthDataLifecyclePolicyService } from './ZavorthDataLifecyclePolicyService.js';
import { ZavorthHostLiveCertificationService } from './ZavorthHostLiveCertificationService.js';

type ChannelExperienceCertificationReader = Pick<ChannelExperienceCertificationService, 'buildSnapshot'>;
type LiveReadinessCertificationReader = Pick<LiveReadinessCertificationService, 'buildSnapshot'>;
type OperationalMaturityReader = Pick<OperationalMaturityService, 'validate'>;
type ZavorthHostLiveCertificationReader = Pick<ZavorthHostLiveCertificationService, 'buildSnapshot'>;
type ZavorthDataLifecyclePolicyReader = Pick<ZavorthDataLifecyclePolicyService, 'buildSnapshot'>;
type ZavorthDashboardVisualQaReader = Pick<ZavorthDashboardVisualQaService, 'buildSnapshot'>;

type ZavorthMaturityRuntime = {
  now?: () => Date;
  projectRoot?: string;
  channelExperienceCertificationService?: ChannelExperienceCertificationReader;
  liveReadinessCertificationService?: LiveReadinessCertificationReader;
  operationalMaturityService?: OperationalMaturityReader;
  hostLiveCertificationService?: ZavorthHostLiveCertificationReader;
  dataLifecyclePolicyService?: ZavorthDataLifecyclePolicyReader;
  dashboardVisualQaService?: ZavorthDashboardVisualQaReader;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

type PackageInfo = {
  scripts: Record<string, string>;
};

const REQUIRED_OPERATOR_SCRIPTS = [
  'channel-experience-certification',
  'channel-experience-certification:check',
  'security:doctor',
  'security:continuous',
  'security:preset',
  'zavorth:maturity',
  'zavorth:maturity:check',
  'zavorth:live-host',
  'zavorth:live-host:check',
  'zavorth:data-lifecycle',
  'zavorth:data-lifecycle:check',
  'zavorth:dashboard-visual-qa',
  'zavorth:dashboard-visual-qa:check',
];

export class ZavorthMaturityService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly channelExperience: ChannelExperienceCertificationReader;
  private readonly liveReadiness: LiveReadinessCertificationReader;
  private readonly operationalMaturity: OperationalMaturityReader;
  private readonly hostLive: ZavorthHostLiveCertificationReader;
  private readonly dataLifecycle: ZavorthDataLifecyclePolicyReader;
  private readonly dashboardVisualQa: ZavorthDashboardVisualQaReader;
  private readonly readFileSync: typeof fs.readFileSync;

  public constructor(runtime: ZavorthMaturityRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.channelExperience = runtime.channelExperienceCertificationService || new ChannelExperienceCertificationService();
    this.liveReadiness = runtime.liveReadinessCertificationService || new LiveReadinessCertificationService({ now: this.now });
    this.operationalMaturity = runtime.operationalMaturityService || new OperationalMaturityService({
      projectRoot: this.projectRoot,
      now: this.now,
    });
    this.hostLive = runtime.hostLiveCertificationService || new ZavorthHostLiveCertificationService({ now: this.now });
    this.dataLifecycle = runtime.dataLifecyclePolicyService || new ZavorthDataLifecyclePolicyService({
      projectRoot: this.projectRoot,
      now: this.now,
      existsSync: runtime.existsSync,
    });
    this.dashboardVisualQa = runtime.dashboardVisualQaService || new ZavorthDashboardVisualQaService({
      projectRoot: this.projectRoot,
      now: this.now,
      existsSync: runtime.existsSync,
    });
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public buildSnapshot(): ZavorthMaturitySnapshot {
    const channel = this.channelExperience.buildSnapshot();
    const live = this.liveReadiness.buildSnapshot({ profile: 'staging-live' });
    const operational = this.operationalMaturity.validate();
    const hostLive = this.hostLive.buildSnapshot();
    const dataLifecycle = this.dataLifecycle.buildSnapshot();
    const dashboardVisualQa = this.dashboardVisualQa.buildSnapshot();
    const packageInfo = this.readPackageInfo();
    const stubsOrPartials = channel.entries.filter((entry) =>
      ['partial', 'planned', 'missing'].includes(String(entry.readiness || '').toLowerCase())
      || ['stub', 'planned', 'missing'].includes(String(entry.transport || '').toLowerCase())
      || ['stub', 'partial', 'planned', 'missing'].includes(String(entry.implementationState || '').toLowerCase())).length;

    const gates = [
      this.channelExperienceGate(channel),
      this.liveBoundaryGate(live),
      this.hostLiveCertificationGate(hostLive),
      this.operationalMaturityGate(operational),
      this.stubTruthGate(stubsOrPartials, channel.entries.length),
      this.dashboardEvidenceGate(channel, dashboardVisualQa),
      this.dataLifecycleGate(dataLifecycle),
      this.operatorSimplicityGate(packageInfo),
    ];
    const requiredBlocked = gates.filter((gate) => gate.required && gate.status === 'blocked').length;
    const attention = gates.filter((gate) => gate.status === 'attention').length;
    const status = this.resolveStatus(requiredBlocked, attention);
    const productionLiveReady = String(live.statement?.productionLiveRelease || '') !== 'not-claimed-without-operator-live-receipts';
    const summary = {
      totalGates: gates.length,
      passed: gates.filter((gate) => gate.status === 'passed').length,
      attention,
      blocked: requiredBlocked,
      dailyUseReady: requiredBlocked === 0,
      productionLiveReady,
      channelContractsReleaseReady: channel.summary.releaseReady,
      channelContractsCertified: channel.summary.certified,
      channelContractsTotal: channel.summary.total,
      liveReadinessCertified: live.status === 'certified',
      hostLiveReadyChannels: hostLive.summary.liveReady,
      hostLiveTotalChannels: hostLive.summary.total,
      dataLifecycleReleaseReady: dataLifecycle.summary.releaseReady,
      dashboardVisualQaEvidenceReady: dashboardVisualQa.summary.evidenceReady,
      operationalMaturityOk: operational.ok,
      stubsOrPartials,
    };

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: 'zavorth-maturity.v1',
      phase: 'product-runtime-maturity',
      status,
      summary,
      gates,
      distinctions: {
        contractReady: channel.summary.releaseReady,
        dailyUseReady: summary.dailyUseReady,
        productionLiveReady,
        dashboardVisualQaClaimed: dashboardVisualQa.summary.evidenceReady,
        stubsAndPartialsExplicit: stubsOrPartials >= 0 && gates.some((gate) => gate.id === 'stub-partial-truth-ledger'),
        hostLiveCertificationHonest: hostLive.distinctions.contractReadyIsNotLive
          && hostLive.distinctions.noExternalSendDuringCertification,
        dataLifecycleComplete: dataLifecycle.summary.releaseReady,
      },
      commands: {
        report: 'npm run zavorth:maturity',
        json: 'npm run zavorth:maturity:json',
        check: 'npm run zavorth:maturity:check',
        focusedTests: ['npx jest tests/services/ZavorthMaturityService.test.ts --runInBand'],
        nextStep: this.buildNextStep(status, gates),
      },
      narrative: {
        headline: status === 'blocked'
          ? 'Maturidade do Zavorth bloqueada por gate obrigatorio.'
          : status === 'needs-attention'
            ? 'Zavorth pronto para uso diario, com atencoes operacionais explicitas.'
            : 'Zavorth maduro para uso diario e operacao local.',
        operatorSummary:
          `${summary.passed}/${summary.totalGates} gate(s) passaram, ${summary.attention} pedem atencao, `
          + `${summary.blocked} bloqueiam uso diario; producao live=${summary.productionLiveReady ? 'sim' : 'nao reivindicada'}.`,
      },
    };
  }

  public renderReport(snapshot: ZavorthMaturitySnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Product Maturity',
      `Status: ${snapshot.status}`,
      snapshot.narrative.operatorSummary,
      `Contratos de canais: ${snapshot.summary.channelContractsCertified}/${snapshot.summary.channelContractsTotal} certificados.`,
      `Stubs/partials explicitos: ${snapshot.summary.stubsOrPartials}.`,
      `Live de producao: ${snapshot.summary.productionLiveReady ? 'reivindicado' : 'nao reivindicado sem recibos do operador'}.`,
      `Host live: ${snapshot.summary.hostLiveReadyChannels}/${snapshot.summary.hostLiveTotalChannels} canal(is) live-ready.`,
      `Data lifecycle: ${snapshot.summary.dataLifecycleReleaseReady ? 'release-ready' : 'bloqueado'}.`,
      `Dashboard QA visual: ${snapshot.summary.dashboardVisualQaEvidenceReady ? 'evidencia pronta' : 'plano/preview pendente'}.`,
      '',
      'Gates:',
      ...snapshot.gates.map((gate) => `- ${gate.status.toUpperCase()} ${gate.label}: ${gate.summary}`),
      '',
      `Next: ${snapshot.commands.nextStep}`,
    ].join('\n');
  }

  private channelExperienceGate(channel: ReturnType<ChannelExperienceCertificationService['buildSnapshot']>): ZavorthMaturityGate {
    return this.gate({
      id: 'channel-experience-contract',
      label: 'Contratos de experiencia por canal',
      status: channel.summary.releaseReady ? 'passed' : 'blocked',
      required: true,
      summary: `${channel.summary.certified}/${channel.summary.total} canais certificados; blockers=${channel.summary.blockers}.`,
      evidence: [
        `contractVersion=${channel.contractVersion}`,
        `dashboard=${channel.dashboardEvidence.status}`,
        `requirements=${channel.summary.requiredPassed}/${channel.summary.requiredTotal}`,
      ],
      commands: ['npm run channel-experience-certification -- --require-pass'],
      nextAction: channel.summary.releaseReady
        ? 'Manter a certificacao de canais no QA.'
        : 'Fechar blockers de canal antes de dizer que a experiencia esta pronta.',
    });
  }

  private liveBoundaryGate(live: ReturnType<LiveReadinessCertificationService['buildSnapshot']>): ZavorthMaturityGate {
    const productionNotClaimed = String(live.statement?.productionLiveRelease || '') === 'not-claimed-without-operator-live-receipts';
    const ok = live.status === 'certified'
      && live.policy.noLiveIoDuringCertification === true
      && productionNotClaimed;
    return this.gate({
      id: 'contract-vs-live-boundary',
      label: 'Separacao entre contrato e live real',
      status: ok ? 'passed' : 'blocked',
      required: true,
      summary: ok
        ? 'Certificacao staging-live passa sem fingir producao live.'
        : 'Contrato/live estao ambiguos ou producao live foi reivindicada sem recibo.',
      evidence: [
        `status=${live.status}`,
        `productionLiveRelease=${live.statement?.productionLiveRelease || 'n/d'}`,
        `noLiveIoDuringCertification=${String(live.policy.noLiveIoDuringCertification)}`,
      ],
      commands: ['npm run live-readiness-certify -- --profile staging-live'],
      nextAction: ok
        ? 'Promover producao live somente com recibos reais do operador.'
        : 'Separar staging-live, contract-ready e production-live no relatorio.',
    });
  }

  private hostLiveCertificationGate(
    hostLive: ReturnType<ZavorthHostLiveCertificationService['buildSnapshot']>,
  ): ZavorthMaturityGate {
    const honest = hostLive.distinctions.contractReadyIsNotLive
      && hostLive.distinctions.noExternalSendDuringCertification
      && hostLive.distinctions.stubsAndPartialsAreVisible;
    return this.gate({
      id: 'host-live-certification',
      label: 'Certificacao live deste host',
      status: honest ? (hostLive.summary.liveReady > 0 ? 'passed' : 'attention') : 'blocked',
      required: true,
      summary: `${hostLive.summary.liveReady}/${hostLive.summary.total} canais live-ready neste host; stubs/partials=${hostLive.summary.stubOrPartial}.`,
      evidence: [
        `contractVersion=${hostLive.contractVersion}`,
        `productionLiveCertified=${String(hostLive.summary.productionLiveCertified)}`,
        `contractReadyIsNotLive=${String(hostLive.distinctions.contractReadyIsNotLive)}`,
        `noExternalSendDuringCertification=${String(hostLive.distinctions.noExternalSendDuringCertification)}`,
      ],
      commands: ['npm run zavorth:live-host', 'npm run zavorth:live-host:check'],
      nextAction: hostLive.summary.liveReady > 0
        ? 'Guardar receipts de provider real, webhook e allowlist para canais live.'
        : hostLive.commands.nextStep,
    });
  }

  private operationalMaturityGate(report: ReturnType<OperationalMaturityService['validate']>): ZavorthMaturityGate {
    return this.gate({
      id: 'operational-maturity-matrix',
      label: 'Matriz operacional canonica',
      status: report.ok ? 'passed' : 'blocked',
      required: true,
      summary: report.ok
        ? `${report.snapshot.summary.total} capacidades com invariantes preservadas.`
        : `${report.issues.length} issue(s) de maturidade operacional.`,
      evidence: [
        `schema=${report.snapshot.schemaVersion}`,
        `nexusSurfaceOnly=${String(report.snapshot.invariants.nexusIsSurfaceOnly)}`,
        `echoEdgeOnly=${String(report.snapshot.invariants.echoIsEdgeLayerOnly)}`,
        ...report.issues.slice(0, 3).map((issue) => `${issue.id}: ${issue.message}`),
      ],
      commands: ['node scripts/operational-maturity-check.mjs'],
      nextAction: report.ok
        ? 'Manter a matriz como fonte de verdade publica de maturidade.'
        : 'Corrigir evidencias/invariantes da matriz operacional.',
    });
  }

  private stubTruthGate(stubsOrPartials: number, totalChannels: number): ZavorthMaturityGate {
    return this.gate({
      id: 'stub-partial-truth-ledger',
      label: 'Stubs, partials e providers locais explicitos',
      status: stubsOrPartials > 0 ? 'attention' : 'passed',
      required: false,
      summary: stubsOrPartials > 0
        ? `${stubsOrPartials}/${totalChannels} canais ainda precisam configuracao/provedor/ambiente real, mas estao visiveis.`
        : 'Nenhum canal aparece como stub/partial no snapshot atual.',
      evidence: [
        `stubsOrPartials=${stubsOrPartials}`,
        `totalChannels=${totalChannels}`,
      ],
      commands: ['npm run channel-experience-certification'],
      nextAction: stubsOrPartials > 0
        ? 'Promover canal por canal com doctor, provider real e allowlist antes de chamar de live.'
        : 'Continuar bloqueando qualquer status ambiguo no Channel Mesh.',
    });
  }

  private dashboardEvidenceGate(
    channel: ReturnType<ChannelExperienceCertificationService['buildSnapshot']>,
    dashboard: ReturnType<ZavorthDashboardVisualQaService['buildSnapshot']>,
  ): ZavorthMaturityGate {
    const contractReady = channel.dashboardEvidence.status === 'contract-ready';
    const evidenceReady = dashboard.summary.evidenceReady;
    return this.gate({
      id: 'dashboard-contract-and-visual-qa',
      label: 'Dashboard: contrato pronto, QA visual separado',
      status: contractReady ? (evidenceReady ? 'passed' : 'attention') : 'blocked',
      required: true,
      summary: contractReady && evidenceReady
        ? 'Backend entrega contrato e screenshots/manifest de QA visual existem.'
        : contractReady
        ? 'Backend entrega status/actions/QR, mas screenshot QA visual continua separado por aprovacao.'
        : 'Dashboard nao recebe contrato suficiente para operar canais.',
      evidence: [
        `dashboardEvidence=${channel.dashboardEvidence.status}`,
        `visualQa=${dashboard.status}`,
        `visualArtifacts=${dashboard.summary.artifactsPresent}/${dashboard.summary.artifactsExpected}`,
        `routes=${channel.dashboardEvidence.routes.join(',')}`,
        `dashboardVisualQaClaimed=${String(evidenceReady)}`,
      ],
      commands: [
        'npm run channel-experience-certification',
        'npm run qa:dashboard-browser-preview',
        'npm run zavorth:dashboard-visual-qa -- --capture',
      ],
      nextAction: contractReady
        ? dashboard.commands.nextStep
        : 'Fechar rotas/actions/status rows antes de mexer no visual.',
    });
  }

  private dataLifecycleGate(
    dataLifecycle: ReturnType<ZavorthDataLifecyclePolicyService['buildSnapshot']>,
  ): ZavorthMaturityGate {
    return this.gate({
      id: 'privacy-data-lifecycle',
      label: 'Privacidade, retencao e dados sensiveis',
      status: dataLifecycle.summary.releaseReady ? 'passed' : 'blocked',
      required: true,
      summary: dataLifecycle.summary.releaseReady
        ? `${dataLifecycle.summary.covered}/${dataLifecycle.summary.total} dataset(s) com retention/export/delete/redaction definidos.`
        : `${dataLifecycle.issues.length} issue(s) de ciclo de dados ausente(s).`,
      evidence: dataLifecycle.summary.releaseReady
        ? [
          `contractVersion=${dataLifecycle.contractVersion}`,
          `exportable=${dataLifecycle.summary.exportable}`,
          `deletable=${dataLifecycle.summary.deletable}`,
          `redactionCovered=${dataLifecycle.summary.redactionCovered}`,
        ]
        : dataLifecycle.issues.slice(0, 6).map((issue) => `${issue.datasetId}.${issue.field}: ${issue.message}`),
      commands: ['npm run zavorth:data-lifecycle', 'npm run zavorth:data-lifecycle:check'],
      nextAction: dataLifecycle.summary.releaseReady
        ? 'Adicionar todo novo armazenamento ao data lifecycle antes do merge.'
        : dataLifecycle.commands.nextStep,
    });
  }

  private operatorSimplicityGate(packageInfo: PackageInfo): ZavorthMaturityGate {
    const missing = REQUIRED_OPERATOR_SCRIPTS.filter((scriptName) => !packageInfo.scripts[scriptName]);
    return this.gate({
      id: 'operator-simplicity',
      label: 'Comandos simples para usuario comum e operador avancado',
      status: missing.length === 0 ? 'passed' : 'blocked',
      required: true,
      summary: missing.length === 0
        ? 'Scripts de maturidade, seguranca e canais estao descobriveis no package.json.'
        : `${missing.length} script(s) operacional(is) faltando.`,
      evidence: missing.length === 0 ? REQUIRED_OPERATOR_SCRIPTS : missing,
      commands: ['npm run zavorth:maturity', 'npm run security:doctor', 'npm run security:preset'],
      nextAction: missing.length === 0
        ? 'Manter esses scripts como o caminho curto para suporte diario.'
        : 'Adicionar scripts antes de depender de comandos internos ou docs longas.',
    });
  }

  private readPackageInfo(): PackageInfo {
    const packagePath = path.resolve(this.projectRoot, 'package.json');
    try {
      const parsed = JSON.parse(this.readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, string> };
      return {
        scripts: parsed.scripts || {},
      };
    } catch {
      return { scripts: {} };
    }
  }

  private resolveStatus(blocked: number, attention: number): ZavorthMaturityStatus {
    if (blocked > 0) {
      return 'blocked';
    }
    if (attention > 0) {
      return 'needs-attention';
    }
    return 'mature';
  }

  private buildNextStep(status: ZavorthMaturityStatus, gates: ZavorthMaturityGate[]): string {
    const firstBlock = gates.find((gate) => gate.status === 'blocked');
    if (firstBlock) {
      return firstBlock.nextAction;
    }
    const firstAttention = gates.find((gate) => gate.status === 'attention');
    if (firstAttention) {
      return firstAttention.nextAction;
    }
    return 'Manter zavorth:maturity:check no QA e evitar novas features antes de fechar regressao visual.';
  }

  private gate(input: ZavorthMaturityGate): ZavorthMaturityGate {
    return {
      ...input,
      evidence: input.evidence.filter(Boolean),
      commands: input.commands.filter(Boolean),
    };
  }
}
