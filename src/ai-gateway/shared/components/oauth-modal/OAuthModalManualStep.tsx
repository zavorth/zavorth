import Button from "../Button";
import Input from "../Input";
import { OAuthModalProviderHint } from "./OAuthModalProviderHint";
import type { OAuthCopyHandler } from "./oauthModalTypes";

type OAuthModalManualStepProps = {
  authReady: boolean;
  authUrl?: string;
  callbackUrl: string;
  copied: string | null;
  isTrueLocalhost: boolean;
  onCancel: () => void;
  onCallbackUrlChange: (value: string) => void;
  onConnect: () => void;
  onCopy: OAuthCopyHandler;
  placeholderUrl: string;
  provider?: string;
};

function getManualInputPlaceholder(provider: string | undefined, placeholderUrl: string) {
  if (provider === "claude" || provider === "cline") {
    return "code#state or /callback?code=...";
  }

  return placeholderUrl;
}

export function OAuthModalManualStep({
  authReady,
  authUrl,
  callbackUrl,
  copied,
  isTrueLocalhost,
  onCancel,
  onCallbackUrlChange,
  onConnect,
  onCopy,
  placeholderUrl,
  provider,
}: OAuthModalManualStepProps) {
  return (
    <>
      <div className="space-y-4">
        <OAuthModalProviderHint isTrueLocalhost={isTrueLocalhost} provider={provider} />

        <div>
          <p className="text-sm font-medium mb-2">Step 1: Open this URL in your browser</p>
          <div className="flex gap-2">
            <Input value={authUrl || ""} readOnly className="flex-1 font-mono text-xs" />
            <Button
              variant="secondary"
              icon={copied === "auth_url" ? "check" : "content_copy"}
              onClick={() => onCopy(authUrl, "auth_url")}
            >
              Copy
            </Button>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Step 2: Paste the callback URL or auth code here</p>
          <p className="text-xs text-text-muted mb-2">
            After authorization, paste the full callback URL. For Claude Code and Cline, you can
            also paste the Authentication Code directly, for example <code>code#state</code>.
          </p>
          <Input
            value={callbackUrl}
            onChange={(event) => onCallbackUrlChange(event.target.value)}
            placeholder={getManualInputPlaceholder(provider, placeholderUrl)}
            className="font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={onConnect} fullWidth disabled={!callbackUrl || !authReady}>
          Connect
        </Button>
        <Button onClick={onCancel} variant="ghost" fullWidth>
          Cancel
        </Button>
      </div>
    </>
  );
}
