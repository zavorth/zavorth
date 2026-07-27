export interface AutonomyIntentResult {
  isAutonomyRequest: boolean;
  confidence: number;
  method: 'structured' | 'llm';
}

export async function classifyAutonomyIntent(
  originalMessage: string,
  autonomousPayload: string,
): Promise<AutonomyIntentResult> {
  const original = String(originalMessage || '').trim();
  const payload = String(autonomousPayload || '').trim();
  const hasStructuredAutonomySignal = Boolean(payload && payload !== original);

  return {
    isAutonomyRequest: hasStructuredAutonomySignal,
    confidence: hasStructuredAutonomySignal ? 0.65 : 0,
    method: 'structured',
  };
}
