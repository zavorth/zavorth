import type { ZavorthSetupStudioPlan } from '../../ZavorthSetupStudioService.js';
import type {
  ZavorthSetupStudioControlUiReadiness,
  ZavorthSetupStudioExistingConfig,
  ZavorthSetupStudioGatewayReadiness,
  ZavorthSetupStudioHooksReadiness,
  ZavorthSetupStudioSkillReadiness,
  ZavorthSetupStudioStep,
  ZavorthSetupStudioWebSearchReadiness,
} from '../ZavorthSetupStudioSchema.js';

export function buildZavorthSetupStudioSteps(input: {
  existingConfig: ZavorthSetupStudioExistingConfig;
  plan: ZavorthSetupStudioPlan;
  dryRun: boolean;
  webSearch?: ZavorthSetupStudioWebSearchReadiness;
  skills?: ZavorthSetupStudioSkillReadiness;
  hooks?: ZavorthSetupStudioHooksReadiness;
  gateway?: ZavorthSetupStudioGatewayReadiness;
  controlUi?: ZavorthSetupStudioControlUiReadiness;
}): ZavorthSetupStudioStep[] {
  const { existingConfig, plan, dryRun, webSearch, skills, hooks, gateway, controlUi } = input;
  return [
    {
      id: 'security',
      title: 'Security disclaimer',
      status: 'ready',
      detail: 'preview, approval and receipts stay enabled',
    },
    {
      id: 'existing-config',
      title: 'Existing config',
      status: existingConfig.envExists || existingConfig.profileExists ? 'ready' : 'waiting',
      detail: existingConfig.envExists || existingConfig.profileExists ? 'detected' : 'fresh setup',
    },
    {
      id: 'setup-mode',
      title: 'Setup mode',
      status: dryRun ? 'waiting' : 'running',
      detail: dryRun ? 'preview only' : 'interactive',
    },
    {
      id: 'provider',
      title: 'Model provider',
      status: plan.provider.id === 'deferred' ? 'waiting' : plan.provider.secretStored || !plan.provider.secretEnvKey ? 'ready' : 'warning',
      detail: `${plan.provider.id}/${plan.provider.modelId}`,
    },
    {
      id: 'channels',
      title: 'Channels',
      status: plan.channels.telegram === 'skip' ? 'waiting' : 'ready',
      detail: `telegram: ${plan.channels.telegram}`,
    },
    {
      id: 'web-search',
      title: 'Web/search',
      status: webSearch?.status === 'ready' ? 'ready' : 'waiting',
      detail: webSearch ? `${webSearch.provider} (${webSearch.status})` : 'not inspected',
    },
    {
      id: 'skills',
      title: 'Skills status',
      status: skills && skills.missingRequirements === 0 ? 'ready' : 'warning',
      detail: skills
        ? `${skills.eligible} eligible, ${skills.missingRequirements} missing`
        : 'not inspected',
    },
    {
      id: 'hooks',
      title: 'Automation templates',
      status: hooks?.configured ? 'ready' : 'waiting',
      detail: hooks?.configured ? 'configured' : 'available later',
    },
    {
      id: 'gateway',
      title: 'Gateway runtime',
      status: gateway?.installed ? 'ready' : 'warning',
      detail: gateway?.recommendedRuntime || 'node',
    },
    {
      id: 'control-ui',
      title: 'Dashboard',
      status: controlUi?.tokenStatus === 'missing' ? 'warning' : 'ready',
      detail: controlUi?.url || 'not inspected',
    },
    {
      id: 'memory',
      title: 'Mnemos scope',
      status: plan.memory.vaultScope === 'whole-pc' ? 'warning' : 'ready',
      detail: `${plan.memory.mode}/${plan.memory.vaultScope}`,
    },
    {
      id: 'trust',
      title: 'Trust mode',
      status: plan.safety.warnings.length > 0 ? 'warning' : 'ready',
      detail: plan.safety.warnings.length > 0 ? `${plan.safety.warnings.length} warning(s)` : 'governed',
    },
    {
      id: 'doctor',
      title: 'Doctor',
      status: 'waiting',
      detail: 'runs after setup',
    },
    {
      id: 'hatch',
      title: 'Hatch agent',
      status: 'waiting',
      detail: 'first LLM/tool probe',
    },
  ];
}
