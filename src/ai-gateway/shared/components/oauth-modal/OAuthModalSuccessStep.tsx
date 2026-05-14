import Button from "../Button";

type OAuthModalSuccessStepProps = {
  onClose: () => void;
  providerName: string;
};

export function OAuthModalSuccessStep({
  onClose,
  providerName,
}: OAuthModalSuccessStepProps) {
  return (
    <div className="text-center py-6">
      <div className="size-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl text-green-600">check_circle</span>
      </div>
      <h3 className="text-lg font-semibold mb-2">Connected Successfully!</h3>
      <p className="text-sm text-text-muted mb-4">Your {providerName} account has been connected.</p>
      <Button onClick={onClose} fullWidth>
        Done
      </Button>
    </div>
  );
}
