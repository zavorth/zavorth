import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { PlatformCapabilityService } from './PlatformCapabilityService.js';
import { applyChannelSetup } from '../domain/channels/infrastructure/setup-guide/ChannelSetupGuideApplySupport.js';
import { buildChannelSetupCatalog } from '../domain/channels/infrastructure/setup-guide/ChannelSetupGuideCatalog.js';
import { readEnvFileMap } from '../domain/channels/infrastructure/setup-guide/ChannelSetupGuideEnvSupport.js';
import type {
  ChannelSetupApplyInput,
  ChannelSetupApplyResult,
  ChannelSetupCatalogReport,
  ChannelSetupGuideRuntime,
} from '../domain/channels/domain/ChannelSetupGuideTypes.js';

export type {
  ChannelSetupApplyInput,
  ChannelSetupApplyResult,
  ChannelSetupCatalogEntry,
  ChannelSetupCatalogReport,
  ChannelSetupChannelId,
  ChannelSetupGuideRuntime,
  ChannelSetupMode,
} from '../domain/channels/domain/ChannelSetupGuideTypes.js';
export { readEnvFileMap, upsertEnvFileValues } from '../domain/channels/infrastructure/setup-guide/ChannelSetupGuideEnvSupport.js';

export class ChannelSetupGuideService {
  private readonly envFilePath: string;
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly capabilityService: Pick<PlatformCapabilityService, 'describe'>;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  constructor(runtime: ChannelSetupGuideRuntime = {}) {
    this.envFilePath = runtime.envFilePath || path.resolve(config.projectRoot, '.env');
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.now = runtime.now || (() => new Date());
    this.capabilityService = runtime.capabilityService || new PlatformCapabilityService();
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public buildCatalog(): ChannelSetupCatalogReport {
    return buildChannelSetupCatalog({
      capabilityService: this.capabilityService,
      now: this.now,
    });
  }

  public apply(input: ChannelSetupApplyInput): ChannelSetupApplyResult {
    return applyChannelSetup({
      envFilePath: this.envFilePath,
      projectRoot: this.projectRoot,
      input,
      existsSync: this.existsSync,
      readFileSync: this.readFileSync,
      writeFileSync: this.writeFileSync,
      mkdirSync: this.mkdirSync,
    });
  }
}
