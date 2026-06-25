import Button from "../Button";

type OAuthModalErrorStepProps = {
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
};

export function OAuthModalErrorStep({ error, onClose, onRetry }: OAuthModalErrorStepProps) {
  return (
    <div className="text-center py-6">
      <div className="size-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl text-red-600">error</span>
      </div>
      <h3 className="text-lg font-semibold mb-2">Connection Failed</h3>
      <p className="text-sm text-red-600 mb-4">{error}</p>
      <div className="flex gap-2">
        <Button onClick={onRetry} variant="secondary" fullWidth>
          Try Again
        </Button>
        <Button onClick={onClose} variant="ghost" fullWidth>
          Cancel
        </Button>
      </div>
    </div>
  );
}
