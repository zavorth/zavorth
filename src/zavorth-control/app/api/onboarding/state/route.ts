import { ZavorthFirstBootDetectionService } from '../../../../../services/ZavorthFirstBootDetectionService.js';
import type { FirstBootSnapshot } from '../../../../../services/ZavorthFirstBootDetectionService.js';

export type OnboardingPhase = 'ready' | 'wizard_required' | 'conversation_pending';

export type OnboardingStateResponse = {
  phase: OnboardingPhase;
  detection: FirstBootSnapshot;
};

export async function GET(): Promise<Response> {
  try {
    const service = new ZavorthFirstBootDetectionService();
    const detection = service.detect();
    const phase = resolvePhase(detection);
    return Response.json({ phase, detection });
  } catch (error) {
    return Response.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Onboarding state check failed',
          type: 'onboarding_state_failed',
        },
      },
      { status: 500 }
    );
  }
}

function resolvePhase(detection: FirstBootSnapshot): OnboardingPhase {
  if (detection.status === 'ready') return 'ready';
  // If env vars detected but provider not yet configured in the system, still need wizard
  return 'wizard_required';
}
