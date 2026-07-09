import fs from 'fs';
import path from 'path';
import { config } from '../../../../config/index.js';
import {
  RuntimeOfficialAccessService,
  type RuntimeOfficialAccessReport,
} from './RuntimeOfficialAccessService.js';
import {
  LocalCloudflareRolloutService,
  type LocalCloudflareRolloutSnapshot,
} from '../../../../services/LocalCloudflareRolloutService.js';
import {
  OracleCloudflareRolloutService,
  type OracleCloudflareRolloutSnapshot,
} from '../../../../services/OracleCloudflareRolloutService.js';
import { RuntimeOfficialRemoteAccessActionSupport } from './runtime-official-remote-access/RuntimeOfficialRemoteAccessActionSupport.js';



import { RuntimeOfficialRemoteAccessCache } from './runtime-official-remote-access/RuntimeOfficialRemoteAccessCache.js';
import { buildRemoteRolloutCandidates } from './runtime-official-remote-access/RuntimeOfficialRemoteAccessCandidates.js';
import { RuntimeOfficialRemoteAccessReportBuilder } from './runtime-official-remote-access/RuntimeOfficialRemoteAccessReportBuilder.js';
import { RuntimeOfficialRemoteAccessStateStore } from './runtime-official-remote-access/RuntimeOfficialRemoteAccessStateStore.js';
import type {
  RuntimeOfficialRemoteAccessAction,
  RuntimeOfficialRemoteAccessOptions,
  RuntimeOfficialRemoteAccessReport,
  RuntimeOfficialRemoteActionOptions,
} from './runtime-official-remote-access/RuntimeOfficialRemoteAccessTypes.js';

export type {
  RuntimeOfficialRemoteAccessAction,
  RuntimeOfficialRemoteAccessOptions,
  RuntimeOfficialRemoteAccessReport,
  RuntimeOfficialRemoteRolloutCandidate,
  RuntimeOfficialRemoteRolloutCandidateId,
  RuntimeOfficialRemoteRolloutState,
  RuntimeOfficialRemoteRolloutStateStatus,
} from './runtime-official-remote-access/RuntimeOfficialRemoteAccessTypes.js';

type RuntimeOfficialRemoteAccessDeps = {
  officialAccessService?: Pick<RuntimeOfficialAccessService, 'prepare'>;
  localCloudflareRolloutService?: Pick<LocalCloudflareRolloutService, 'inspect'>;
  oracleCloudflareRolloutService?: Pick<OracleCloudflareRolloutService, 'inspect'>;
  now?: () => Date;
  stateFilePath?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

export class RuntimeOfficialRemoteAccessService {
  private readonly officialAccessService: Pick<RuntimeOfficialAccessService, 'prepare'>;
  private readonly localCloudflareRolloutService: Pick<LocalCloudflareRolloutService, 'inspect'>;
  private readonly oracleCloudflareRolloutService: Pick<OracleCloudflareRolloutService, 'inspect'>;
  private readonly now: () => Date;
  private readonly cache = new RuntimeOfficialRemoteAccessCache();
  private readonly stateStore: RuntimeOfficialRemoteAccessStateStore;
  private readonly reportBuilder: RuntimeOfficialRemoteAccessReportBuilder;
  private readonly actionSupport: RuntimeOfficialRemoteAccessActionSupport;

  constructor(deps: RuntimeOfficialRemoteAccessDeps = {}) {
    this.officialAccessService = deps.officialAccessService || new RuntimeOfficialAccessService();
    this.localCloudflareRolloutService = deps.localCloudflareRolloutService || new LocalCloudflareRolloutService();
    this.oracleCloudflareRolloutService =
      deps.oracleCloudflareRolloutService
      || new OracleCloudflareRolloutService();
    this.now = deps.now || (() => new Date());

    this.stateStore = new RuntimeOfficialRemoteAccessStateStore({
      stateFilePath: deps.stateFilePath || path.join(config.dataDir, 'runtime', 'official-remote-access.json'),
      existsSync: deps.existsSync || fs.existsSync.bind(fs),
      readFileSync: deps.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: deps.writeFileSync || fs.writeFileSync.bind(fs),
      mkdirSync: deps.mkdirSync || fs.mkdirSync.bind(fs),
    });
    this.reportBuilder = new RuntimeOfficialRemoteAccessReportBuilder({ now: this.now });
    this.actionSupport = new RuntimeOfficialRemoteAccessActionSupport({
      now: this.now,
      stateStore: this.stateStore,
      reportBuilder: this.reportBuilder,
    });
  }

  public async inspect(options: RuntimeOfficialRemoteAccessOptions = {}): Promise<RuntimeOfficialRemoteAccessReport> {
    return this.prepare(options);
  }

  public async prepare(options: RuntimeOfficialRemoteAccessOptions = {}): Promise<RuntimeOfficialRemoteAccessReport> {
    const nowMs = this.now().getTime();
    const cacheKey = this.cache.buildInspectCacheKey(options);
    const cached = this.cache.get(cacheKey, nowMs);
    if (cached) {
      return cached;
    }

    const official = await this.officialAccessService.prepare(options);
    const report = this.reportBuilder.buildReport({
      official,
      candidates: this.buildCandidates(),
      persistedState: this.stateStore.readState(),
    });
    this.cache.set(cacheKey, nowMs, report);
    return report;
  }

  public async apply(options: RuntimeOfficialRemoteActionOptions = {}): Promise<RuntimeOfficialRemoteAccessReport> {
    return this.executeAction('apply', options);
  }

  public async verify(options: RuntimeOfficialRemoteActionOptions = {}): Promise<RuntimeOfficialRemoteAccessReport> {
    return this.executeAction('verify', options);
  }

  public async rollback(options: RuntimeOfficialRemoteActionOptions = {}): Promise<RuntimeOfficialRemoteAccessReport> {
    return this.executeAction('rollback', options);
  }

  public async go(options: RuntimeOfficialRemoteActionOptions = {}): Promise<RuntimeOfficialRemoteAccessReport> {
    return this.executeAction('go', options);
  }

  public async runAction(
    action: RuntimeOfficialRemoteAccessAction,
    options: RuntimeOfficialRemoteActionOptions = {},
  ): Promise<RuntimeOfficialRemoteAccessReport> {
    return this.executeAction(action, options);
  }

  private async executeAction(
    action: RuntimeOfficialRemoteAccessAction,
    options: RuntimeOfficialRemoteActionOptions,
  ): Promise<RuntimeOfficialRemoteAccessReport> {
    const official = await this.officialAccessService.prepare(options);
    const candidates = this.buildCandidates();
    const persistedState = this.stateStore.readState();
    const nextState = this.actionSupport.runAction(action, {
      official,
      candidates,
      persistedState,
      options,
    });

    this.cache.clear();
    return this.reportBuilder.buildReport({
      official,
      candidates,
      persistedState: nextState,
    });
  }

  private buildCandidates() {
    return buildRemoteRolloutCandidates(
      this.localCloudflareRolloutService.inspect() as LocalCloudflareRolloutSnapshot,
      this.oracleCloudflareRolloutService.inspect() as OracleCloudflareRolloutSnapshot,
    );
  }
}

