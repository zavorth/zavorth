"use client";

import PropTypes from "prop-types";
import Modal from "./Modal";
import { OAuthModalDeviceCodeStep } from "./oauth-modal/OAuthModalDeviceCodeStep";
import { OAuthModalErrorStep } from "./oauth-modal/OAuthModalErrorStep";
import { OAuthModalManualStep } from "./oauth-modal/OAuthModalManualStep";
import { OAuthModalSuccessStep } from "./oauth-modal/OAuthModalSuccessStep";
import { OAuthModalWaitingStep } from "./oauth-modal/OAuthModalWaitingStep";
import { useOAuthModal } from "./oauth-modal/useOAuthModal";
import type { OAuthModalProps } from "./oauth-modal/oauthModalTypes";

/**
 * OAuth Modal Component
 * - Localhost: Auto callback via popup message
 * - Remote: Manual paste callback URL
 */
export default function OAuthModal({
  isOpen,
  provider,
  providerInfo,
  onSuccess,
  onClose,
  idcConfig,
}: OAuthModalProps) {
  const {
    authData,
    callbackUrl,
    copied,
    deviceData,
    error,
    handleCopy,
    handleManualSubmit,
    isDeviceCode,
    isTrueLocalhost,
    placeholderUrl,
    polling,
    setCallbackUrl,
    startOAuthFlow,
    step,
    switchToManualInput,
  } = useOAuthModal({
    idcConfig,
    isOpen,
    onSuccess,
    provider,
  });

  if (!provider || !providerInfo) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} title={`Connect ${providerInfo.name}`} onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        {step === "waiting" && !isDeviceCode && (
          <OAuthModalWaitingStep onEnterManualMode={switchToManualInput} />
        )}

        {step === "waiting" && isDeviceCode && deviceData && (
          <OAuthModalDeviceCodeStep
            copied={copied}
            deviceData={deviceData}
            onCopy={handleCopy}
            polling={polling}
          />
        )}

        {step === "input" && !isDeviceCode && (
          <OAuthModalManualStep
            authReady={Boolean(authData)}
            authUrl={typeof authData?.authUrl === "string" ? authData.authUrl : undefined}
            callbackUrl={callbackUrl}
            copied={copied}
            isTrueLocalhost={isTrueLocalhost}
            onCancel={onClose}
            onCallbackUrlChange={setCallbackUrl}
            onConnect={handleManualSubmit}
            onCopy={handleCopy}
            placeholderUrl={placeholderUrl}
            provider={provider}
          />
        )}

        {step === "success" && (
          <OAuthModalSuccessStep onClose={onClose} providerName={providerInfo.name} />
        )}

        {step === "error" && (
          <OAuthModalErrorStep error={error} onClose={onClose} onRetry={startOAuthFlow} />
        )}
      </div>
    </Modal>
  );
}

OAuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  provider: PropTypes.string,
  providerInfo: PropTypes.shape({
    name: PropTypes.string,
  }),
  onSuccess: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};
