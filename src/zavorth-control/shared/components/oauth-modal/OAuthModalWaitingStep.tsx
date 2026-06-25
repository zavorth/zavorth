import Button from "../Button";

type OAuthModalWaitingStepProps = {
  onEnterManualMode: () => void;
};

export function OAuthModalWaitingStep({ onEnterManualMode }: OAuthModalWaitingStepProps) {
  return (
    <div className="text-center py-6">
      <div className="size-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl text-primary animate-spin">
          progress_activity
        </span>
      </div>
      <h3 className="text-lg font-semibold mb-2">Waiting for Authorization</h3>
      <p className="text-sm text-text-muted mb-2">Complete the authorization in the popup window.</p>
      <p className="text-xs text-text-muted mb-4 opacity-70">
        If the popup closes without redirecting back (e.g. Qoder), this dialog will automatically
        switch to manual URL input mode.
      </p>
      <Button variant="ghost" onClick={onEnterManualMode}>
        Popup blocked? Enter URL manually
      </Button>
    </div>
  );
}
