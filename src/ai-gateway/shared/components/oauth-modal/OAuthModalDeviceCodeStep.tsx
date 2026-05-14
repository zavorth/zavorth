import Button from "../Button";
import type { OAuthCopyHandler, OAuthDeviceCodeData } from "./oauthModalTypes";

type OAuthModalDeviceCodeStepProps = {
  copied: string | null;
  deviceData: OAuthDeviceCodeData;
  onCopy: OAuthCopyHandler;
  polling: boolean;
};

export function OAuthModalDeviceCodeStep({
  copied,
  deviceData,
  onCopy,
  polling,
}: OAuthModalDeviceCodeStepProps) {
  return (
    <>
      <div className="text-center py-4">
        <p className="text-sm text-text-muted mb-4">Visit the URL below and enter the code:</p>
        <div className="bg-sidebar p-4 rounded-lg mb-4">
          <p className="text-xs text-text-muted mb-1">Verification URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm break-all">{deviceData.verification_uri}</code>
            <Button
              size="sm"
              variant="ghost"
              icon={copied === "verify_url" ? "check" : "content_copy"}
              onClick={() => onCopy(deviceData.verification_uri, "verify_url")}
            />
          </div>
        </div>
        <div className="bg-primary/10 p-4 rounded-lg">
          <p className="text-xs text-text-muted mb-1">Your Code</p>
          <div className="flex items-center justify-center gap-2">
            <p className="text-2xl font-mono font-bold text-primary">{deviceData.user_code}</p>
            <Button
              size="sm"
              variant="ghost"
              icon={copied === "user_code" ? "check" : "content_copy"}
              onClick={() => onCopy(deviceData.user_code, "user_code")}
            />
          </div>
        </div>
      </div>
      {polling && (
        <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          Waiting for authorization...
        </div>
      )}
    </>
  );
}
