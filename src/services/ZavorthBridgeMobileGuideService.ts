type BuildReadyGuideInput = {
  accessUrl: string;
  mode: 'public' | 'lan';
  expiresAt: string | null;
  requiresPassword: boolean;
  secret: string | null;
  limitations: string[];
};

type BuildBlockedGuideInput = {
  recommendations: string[];
  limitations: string[];
  manualSteps?: string[];
};

export type ZavorthBridgeMobileGuide = {
  headline: string;
  summary: string;
  steps: string[];
  notes: string[];
};

export class ZavorthBridgeMobileGuideService {
  public buildReadyGuide(input: BuildReadyGuideInput): ZavorthBridgeMobileGuide {
    const accessKind = input.mode === 'public' ? 'public link' : 'link da rede local';
    const steps = [
      input.mode === 'public'
        ? `Open ${input.accessUrl} in the phone browser.`
        : `Connect the phone to the same network as the host and open ${input.accessUrl}.`,
      input.requiresPassword ? `Use the current remote password: ${input.secret || 'password configured on the host'}.`
        : 'Enter directly; the current remote does not require an extra password.',
      'Keep the Windows session unlocked while using ZavorthBridge remotely.',
      'When finished, ask Zavorth to close access with /agmobile stop.',
    ];
    const notes = [
      input.expiresAt ? `Current access expires at ${input.expiresAt}.` : 'This access remains active until you close it manually.',
      ...input.limitations,
    ];
    return {
      headline: `ZavorthBridge ready for mobile via ${accessKind}.`,
      summary: input.mode === 'public'
        ? 'ZavorthBridge remote has an active public route.'
        : 'ZavorthBridge remote is ready, but limited to devices on the same network.',
      steps,
      notes,
    };
  }

  public buildBlockedGuide(input: BuildBlockedGuideInput): ZavorthBridgeMobileGuide {
    const steps = [
      ...(input.manualSteps || []),
      ...input.recommendations,
    ].filter(Boolean);
    return {
      headline: 'ZavorthBridge is not ready for mobile use yet.',
      summary: steps[0] || 'There are still pending items before mobile access can be released.',
      steps: steps.length > 0 ? steps : ['Review the ZavorthBridge remote doctor before trying again.'],
      notes: input.limitations,
    };
  }
}
