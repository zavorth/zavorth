"use client";

import {
  CursorAuthModal,
  KiroOAuthWrapper,
  OAuthModal,
  ProxyConfigModal,
} from "@/shared/components";
import {
  AddApiKeyModal,
  EditCompatibleNodeModal,
  EditConnectionModal,
} from "../provider-detail-modals";
import { ProviderDetailBatchTestResultsModal } from "./BatchTestResultsModal";
import { ProviderDetailImportProgressModal } from "./ImportProgressModal";
import type { ProviderDetailPageModel } from "../useProviderDetailPageModel";

type LayoutModalsProps = Pick<
  ProviderDetailPageModel,
  | "providerId"
  | "providerInfo"
  | "showOAuthModal"
  | "handleOAuthSuccess"
  | "setShowOAuthModal"
  | "showAddApiKeyModal"
  | "isCompatible"
  | "isAnthropicProtocolCompatible"
  | "isCcCompatible"
  | "handleSaveApiKey"
  | "setShowAddApiKeyModal"
  | "showEditModal"
  | "selectedConnection"
  | "handleUpdateConnection"
  | "setShowEditModal"
  | "showEditNodeModal"
  | "providerNode"
  | "handleUpdateNode"
  | "setShowEditNodeModal"
  | "batchTestResults"
  | "setBatchTestResults"
  | "t"
  | "proxyTarget"
  | "setProxyTarget"
  | "loadConnProxies"
  | "connections"
  | "showImportModal"
  | "setShowImportModal"
  | "importProgress"
>;

export function ProviderDetailLayoutModals({
  providerId,
  providerInfo,
  showOAuthModal,
  handleOAuthSuccess,
  setShowOAuthModal,
  showAddApiKeyModal,
  isCompatible,
  isAnthropicProtocolCompatible,
  isCcCompatible,
  handleSaveApiKey,
  setShowAddApiKeyModal,
  showEditModal,
  selectedConnection,
  handleUpdateConnection,
  setShowEditModal,
  showEditNodeModal,
  providerNode,
  handleUpdateNode,
  setShowEditNodeModal,
  batchTestResults,
  setBatchTestResults,
  t,
  proxyTarget,
  setProxyTarget,
  loadConnProxies,
  connections,
  showImportModal,
  setShowImportModal,
  importProgress,
}: LayoutModalsProps) {
  if (!providerInfo) {
    return null;
  }

  return (
    <>
      {providerId === "kiro" ? (
        <KiroOAuthWrapper
          isOpen={showOAuthModal}
          providerInfo={providerInfo}
          onSuccess={handleOAuthSuccess}
          onClose={() => {
            setShowOAuthModal(false);
          }}
        />
      ) : providerId === "cursor" ? (
        <CursorAuthModal
          isOpen={showOAuthModal}
          onSuccess={handleOAuthSuccess}
          onClose={() => {
            setShowOAuthModal(false);
          }}
        />
      ) : (
        <OAuthModal
          isOpen={showOAuthModal}
          provider={providerId}
          providerInfo={providerInfo}
          onSuccess={handleOAuthSuccess}
          onClose={() => {
            setShowOAuthModal(false);
          }}
        />
      )}

      <AddApiKeyModal
        isOpen={showAddApiKeyModal}
        provider={providerId}
        providerName={providerInfo.name}
        isCompatible={isCompatible}
        isAnthropic={isAnthropicProtocolCompatible}
        isCcCompatible={isCcCompatible}
        onSave={handleSaveApiKey}
        onClose={() => setShowAddApiKeyModal(false)}
      />

      <EditConnectionModal
        isOpen={showEditModal}
        connection={selectedConnection}
        onSave={handleUpdateConnection}
        onClose={() => setShowEditModal(false)}
      />

      {isCompatible && (
        <EditCompatibleNodeModal
          isOpen={showEditNodeModal}
          node={providerNode}
          onSave={handleUpdateNode}
          onClose={() => setShowEditNodeModal(false)}
          isAnthropic={isAnthropicProtocolCompatible}
          isCcCompatible={isCcCompatible}
        />
      )}

      <ProviderDetailBatchTestResultsModal
        batchTestResults={batchTestResults}
        setBatchTestResults={setBatchTestResults}
        providerInfo={providerInfo}
        providerId={providerId}
        t={t}
      />

      {proxyTarget && (
        <ProxyConfigModal
          isOpen={!!proxyTarget}
          onClose={() => setProxyTarget(null)}
          level={proxyTarget.level}
          levelId={proxyTarget.id}
          levelLabel={proxyTarget.label}
          onSaved={() => void loadConnProxies(connections)}
        />
      )}

      <ProviderDetailImportProgressModal
        showImportModal={showImportModal}
        setShowImportModal={setShowImportModal}
        importProgress={importProgress}
        t={t}
      />
    </>
  );
}
