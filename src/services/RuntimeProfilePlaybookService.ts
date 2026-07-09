import {
  RUNTIME_PROFILE_PLAYBOOK_VERSION,
  type RuntimeDeploymentTarget,
  type RuntimeProfilePlaybook,
  type RuntimeProfilePlaybookSnapshot,
  type RuntimeProfilePlaybookStep,
} from '../contracts/RuntimeProfilePlaybookContract.js';
import { MinimalRuntimeProfileRegistry } from '../core/MinimalRuntimeProfileRegistry.js';

import type { RuntimeBudgetProfile } from './RuntimeResourceBudgetService.js';

type RuntimeProfilePlaybookDeps = {
  now?: () => Date;
  profileRegistry?: Pick<MinimalRuntimeProfileRegistry, 'load'>;
  profileDir?: string;
};

const TARGETS: Array<{
  id: RuntimeDeploymentTarget;
  label: string;
  recommendedProfile: RuntimeBudgetProfile;
  fallbackProfile: RuntimeBudgetProfile;
  alwaysOnReady: boolean;
  summary: string;
}> = [
  {
    id: 'vps-24-7',
    label: 'VPS 24/7 leve',
    recommendedProfile: 'chat',
    fallbackProfile: 'minimal',
    alwaysOnReady: true,
    summary: 'Mantem chat e canais sob demanda sem carregar browser/dev tools no boot.',
  },
  {
    id: 'safe-8gb-desktop',
    label: 'Desktop 8GB seguro',
    recommendedProfile: 'safe-8gb',
    fallbackProfile: 'minimal',
    alwaysOnReady: true,
    summary: 'Perfil enxuto para maquinas pequenas, com browser/gateway desligados ate pedido explicito.',
  },
  {
    id: 'developer-workstation',
    label: 'Estacao de desenvolvimento',
    recommendedProfile: 'dev',
    fallbackProfile: 'desktop',
    alwaysOnReady: false,
    summary: 'Mais ferramentas e sidecars para desenvolvimento, ainda com elevacao e receipts.',
  },
  {
    id: 'full-lab',
    label: 'Laboratorio completo',
    recommendedProfile: 'full',
    fallbackProfile: 'dev',
    alwaysOnReady: false,
    summary: 'Maxima disponibilidade funcional em maquina forte, sem liberar mutacao live por perfil.',
  },
];

export class RuntimeProfilePlaybookService {
  private readonly now: () => Date;
  private readonly profileRegistry: Pick<MinimalRuntimeProfileRegistry, 'load'>;

  constructor(deps: RuntimeProfilePlaybookDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.profileRegistry = deps.profileRegistry || new MinimalRuntimeProfileRegistry({
      profileDir: deps.profileDir || 'config/runtime-profiles',
    });
  }

  public buildSnapshot(input: { target?: string | null } = {}): RuntimeProfilePlaybookSnapshot {
    const selectedTarget = normalizeTarget(input.target);
    const profileSnapshot = this.profileRegistry.load(targetConfig(selectedTarget).recommendedProfile);
    const byId = new Map(profileSnapshot.profiles.map((profile) => [profile.id, profile]));
    const playbooks = TARGETS.map((target) => {
      const profile = byId.get(target.recommendedProfile) || profileSnapshot.selectedProfile;
      return {
        id: target.id,
        label: target.label,
        recommendedProfile: target.recommendedProfile,
        fallbackProfile: target.fallbackProfile,
        summary: target.summary,
        expectedPosture: profile.resourcePosture,
        alwaysOnReady: target.alwaysOnReady,
        maxActiveSidecars: profile.maxActiveSidecars,
        disabledOnBoot: Object.entries(profile.capabilityBootOverrides)
          .filter(([, mode]) => mode === 'disabled')
          .map(([id]) => id)
          .sort(),
        onDemandCapabilities: Object.entries(profile.capabilityBootOverrides)
          .filter(([, mode]) => mode === 'on-demand' || mode === 'sidecar')
          .map(([id]) => id)
          .sort(),
        steps: this.steps(target.recommendedProfile),
        commands: {
          inspect: 'zavorth runtime profile list',
          select: `zavorth runtime profile use ${target.recommendedProfile}`,
          budgetCheck: `zavorth runtime budget --profile ${target.recommendedProfile}`,
          temporaryElevate: `zavorth runtime mode elevate --from ${target.recommendedProfile} --to browser --capability browser --ttl 10m`,
        },
      } satisfies RuntimeProfilePlaybook;
    });
    const selected = playbooks.find((item) => item.id === selectedTarget) || playbooks[0]!;
    return {
      generatedAt: this.now().toISOString(),
      version: RUNTIME_PROFILE_PLAYBOOK_VERSION,
      status: profileSnapshot.invalid > 0 ? 'attention' : 'ready',
      selectedTarget,
      selected,
      playbooks,
      summary: {
        targets: playbooks.length,
        builtinProfiles: profileSnapshot.builtin,
        manifestProfiles: profileSnapshot.manifest,
        invalidProfiles: profileSnapshot.invalid,
        alwaysOnTargets: playbooks.filter((item) => item.alwaysOnReady).length,
      },
      safety: {
        profileSwitchIsExplicit: true,
        directMinimalToFullEscalationBlocked: true,
        heavySidecarsLazyByDefault: true,
        liveMutationUnaffectedByProfile: true,
      },
    };
  }

  public renderText(snapshot: RuntimeProfilePlaybookSnapshot): string {
    return [
      'Zavorth Runtime Profile Playbooks',
      '',
      `Status: ${snapshot.status}`,
      `Selected: ${snapshot.selected.label} -> ${snapshot.selected.recommendedProfile}`,
      snapshot.selected.summary,
      '',
      ...snapshot.selected.steps.map((step) =>
        `- [${step.status}] ${step.label}${step.command ? `: ${step.command}` : ''}`),
    ].join('\n');
  }

  private steps(profile: RuntimeBudgetProfile): RuntimeProfilePlaybookStep[] {
    return [
      step('inspect', 'Inspecionar perfis disponiveis', 'next', 'zavorth runtime profile list', [
        'Mostra perfis builtin e manifests sem iniciar sidecars.',
      ]),
      step('select', 'Selecionar perfil explicitamente', 'pending', `zavorth runtime profile use ${profile}`, [
        'Troca de perfil deve ser acao explicita do operador ou configuracao de instalacao.',
      ]),
      step('budget', 'Validar budget de processo', 'pending', `zavorth runtime budget --profile ${profile}`, [
        'Confirma RSS, heap, handles e modulos antes de manter always-on.',
      ]),
      step('elevate', 'Usar elevacao temporaria para sidecars pesados', 'pending', `zavorth runtime mode elevate --from ${profile} --to browser --capability browser --ttl 10m`, [
        'Browser/dev tools entram por lease temporario com retorno ao perfil leve.',
      ]),
    ];
  }
}

function step(
  id: string,
  label: string,
  status: RuntimeProfilePlaybookStep['status'],
  command: string | null,
  details: string[],
): RuntimeProfilePlaybookStep {
  return { id, label, status, command, details };
}

function normalizeTarget(value: string | null | undefined): RuntimeDeploymentTarget {
  const normalized = String(value || '').trim().toLowerCase();
  return TARGETS.some((item) => item.id === normalized) ? normalized as RuntimeDeploymentTarget : 'vps-24-7';
}

function targetConfig(id: RuntimeDeploymentTarget) {
  return TARGETS.find((item) => item.id === id) || TARGETS[0]!;
}
