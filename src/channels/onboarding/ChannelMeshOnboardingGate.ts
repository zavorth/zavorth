import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import { FirstRunPersonalizationService } from '../../services/FirstRunPersonalizationService.js';
import { ZavorthFirstRunHumanOnboardingService } from '../../services/ZavorthFirstRunHumanOnboardingService.js';

export type ChannelMeshPersonaPlatform = string;

export type ChannelMeshOnboardingTarget = {
  platform: ChannelMeshPersonaPlatform;
  userId: string;
  chatId: string;
};

export type ChannelMeshOnboardingInterception =
  | { handled: false }
  | { handled: true; replies: string[]; completedNow: boolean };

type OnboardingServiceFactory = (input: {
  platform: ChannelMeshPersonaPlatform;
  scopedUserId: string;
  stateFilePath: string;
}) => ZavorthFirstRunHumanOnboardingService;

type ChannelMeshOnboardingGateDeps = {
  projectRoot?: string;
  onboardingFactory?: OnboardingServiceFactory;
  /** When the installation-wide profile is already complete, chats skip the interview. */
  isGlobalProfileComplete?: () => boolean;
  now?: () => Date;
};

/**
 * Intercepts the first contact of a channel-mesh surface and drives the
 * first-run interview over plain text turns. Each platform+chat pair gets
 * its own onboarding state file, so one pending interview never blocks a
 * different chat, and completed chats pass straight through to the agent.
 */
export class ChannelMeshOnboardingGate {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly onboardingFactory: OnboardingServiceFactory;
  private readonly isGlobalProfileComplete: () => boolean;

  constructor(deps: ChannelMeshOnboardingGateDeps = {}) {
    this.projectRoot = path.resolve(deps.projectRoot || process.env.ZAVORTH_PROJECT_ROOT || process.cwd());
    this.now = deps.now || (() => new Date());
    this.onboardingFactory =
      deps.onboardingFactory ||
      ((input) =>
        new ZavorthFirstRunHumanOnboardingService({
          projectRoot: this.projectRoot,
          userId: input.scopedUserId,
          stateFilePath: input.stateFilePath,
          now: this.now,
        }));
    this.isGlobalProfileComplete =
      deps.isGlobalProfileComplete ||
      (() => !new FirstRunPersonalizationService({ projectRoot: this.projectRoot }).getStatus().pending);
  }

  public async intercept(target: ChannelMeshOnboardingTarget, text: string): Promise<ChannelMeshOnboardingInterception> {
    if (this.isGlobalProfileComplete()) {
      return { handled: false };
    }
    const service = this.onboardingFactory({
      platform: target.platform,
      scopedUserId: this.buildScopedUserId(target),
      stateFilePath: this.resolveStateFilePath(target),
    });
    if (!service.needsOnboarding()) {
      return { handled: false };
    }

    const hasStartedState = fs.existsSync(this.resolveStateFilePath(target));
    if (!hasStartedState) {
      const snapshot = service.buildSnapshot();
      service.applyStep({});
      const welcome = snapshot.welcomeLines.length > 0 ? snapshot.welcomeLines.join('\n') : '';
      const nextPrompt = snapshot.nextPrompt || '';
      const opening = [welcome, nextPrompt].filter((part) => part.trim().length > 0).join('\n\n');
      return { handled: true, replies: [opening], completedNow: false };
    }

    const result = service.answer(text);
    return {
      handled: true,
      replies: [result.summary],
      completedNow: result.completedNow,
    };
  }

  private buildScopedUserId(target: ChannelMeshOnboardingTarget): string {
    return `${target.platform}:${target.chatId}`;
  }

  private resolveStateFilePath(target: ChannelMeshOnboardingTarget): string {
    const scopeHash = createHash('sha256').update(`${target.platform}:${target.chatId}`).digest('hex').slice(0, 32);
    const directory = path.join(this.projectRoot, 'data', 'channel-mesh', 'onboarding');
    fs.mkdirSync(directory, { recursive: true });
    return path.join(directory, `${target.platform}-${scopeHash}.json`);
  }
}
