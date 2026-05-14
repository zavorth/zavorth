"use client";

import { Button } from "@/shared/components";
import type { UpdatePhase, UpdateStep } from "./updateProgress";

const stepLabels: Record<string, string> = {
  install: "Install Package",
  rebuild: "Rebuild Native Modules",
  restart: "Restart Service",
  complete: "Complete",
  error: "Error",
};

type UpdateProgressOverlayProps = {
  updatePhase: UpdatePhase;
  updateSteps: UpdateStep[];
  onClose: () => void;
  onRetry: () => void;
};

export function UpdateProgressOverlay({
  updatePhase,
  updateSteps,
  onClose,
  onRetry,
}: UpdateProgressOverlayProps) {
  if (updatePhase === "idle") {
    return null;
  }

  const errorStep = updateSteps.find((step) => step.step === "error");
  const completeStep = updateSteps.find((step) => step.step === "complete");

  return (
    <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-bg-main border border-border rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="material-symbols-outlined text-primary text-[28px] animate-spin">
            progress_activity
          </span>
          <div>
            <h3 className="text-lg font-bold">
              {updatePhase === "done"
                ? "Zavorth update complete"
                : updatePhase === "failed"
                  ? "Zavorth update failed"
                  : "Updating Zavorth..."}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {updatePhase === "done"
                ? "The page will reload automatically in a few seconds."
                : updatePhase === "failed"
                  ? "Please try again or update manually via the CLI."
                  : "Do not close this page. The control plane will restart automatically."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {updateSteps
            .filter((step) => step.step !== "complete" && step.step !== "error")
            .map((step) => (
              <div
                key={step.step}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                  step.status === "running"
                    ? "border-primary/40 bg-primary/5"
                    : step.status === "done"
                      ? "border-green-500/30 bg-green-500/5"
                      : step.status === "failed"
                        ? "border-red-500/30 bg-red-500/5"
                        : "border-border bg-bg-subtle"
                }`}
              >
                {step.status === "running" ? (
                  <span className="material-symbols-outlined text-primary text-[18px] animate-spin">
                    progress_activity
                  </span>
                ) : step.status === "done" ? (
                  <span className="material-symbols-outlined text-green-500 text-[18px]">
                    check_circle
                  </span>
                ) : step.status === "failed" ? (
                  <span className="material-symbols-outlined text-red-500 text-[18px]">
                    error
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-yellow-500 text-[18px]">
                    warning
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{stepLabels[step.step] || step.step}</p>
                  <p className="text-xs text-text-muted truncate">{step.message}</p>
                </div>
              </div>
            ))}

          {errorStep && (
            <div className="mt-1 px-3 py-2.5 rounded-lg border border-red-500/30 bg-red-500/5 text-red-500">
              <p className="text-xs font-mono break-all">{errorStep.message}</p>
            </div>
          )}

          {updatePhase === "done" && (
            <div className="mt-1 px-3 py-2.5 rounded-lg border border-green-500/30 bg-green-500/5">
              <p className="text-sm font-semibold text-green-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {completeStep?.message || "Update complete!"}
              </p>
              <p className="text-xs text-text-muted mt-1">Reloading page automatically...</p>
            </div>
          )}
        </div>

        {(updatePhase === "failed" || updatePhase === "done") && (
          <div className="flex gap-2 mt-4">
            <Button size="sm" fullWidth onClick={onClose}>
              {updatePhase === "done" ? "Reload Now" : "Close"}
            </Button>
            {updatePhase === "failed" && (
              <Button size="sm" variant="secondary" fullWidth onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
