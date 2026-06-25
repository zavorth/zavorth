export type UpdateStep = {
  step: string;
  status: string;
  message: string;
};

export type UpdatePhase = "idle" | "running" | "done" | "failed";

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function mergeUpdateStep(steps: UpdateStep[], nextStep: UpdateStep) {
  const idx = steps.findIndex((step) => step.step === nextStep.step);
  if (idx === -1) {
    return [...steps, nextStep];
  }

  const next = [...steps];
  next[idx] = nextStep;
  return next;
}
