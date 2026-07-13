import type { SkillGitRegistry } from '../skills/marketplace/SkillGitRegistry.js';
import type { SkillExecutorBindingOptions } from './SkillExecutorBindingService.js';
import type { SkillToolRegistryLike } from './SkillToolRegistryBridge.js';
import type {
  SkillTrustProfileId,
  SkillTrustScoreService,
} from './SkillTrustScoreService.js';

export type SkillInstallPipelineRuntime = {
  projectRoot?: string;
  skillsDir?: string;
  receiptsDir?: string;
  now?: () => Date;
  gitRegistry?: SkillGitRegistry;
  trustService?: SkillTrustScoreService;
  trustProfile?: SkillTrustProfileId | string | null;
  toolRegistry?: SkillToolRegistryLike | null;
};

export type SkillInstallPreviewInput = {
  source: string;
  skillId?: string | null;
};

export type SkillInstallApplyInput = {
  source: string;
  skillId?: string | null;
  consent: boolean;
  force?: boolean;
};

export type SkillInstallBindingOptions = SkillExecutorBindingOptions;

export type DiscoveredSkill = {
  dir: string;
  name: string;
  version: string;
  description: string;
};
