export * from './sandbox/RemoteSandboxContract.js';

export const ZAVORTH_REMOTE_SANDBOX_CONTRACT_VERSION_PUBLIC_MARKER =
  'ZAVORTH_REMOTE_SANDBOX_CONTRACT_VERSION';

export type RemoteSandboxPublicAuditVocabulary = {
  mode: 'RemoteSandboxMode';
  mirrorMode: 'artifact-first-mirror';
  config: 'OpenShellRemoteSandboxConfig';
  lifecyclePlan: 'OpenShellLifecyclePlan';
  sshSessionPlan: 'OpenShellSshSessionPlan';
  workspaceSyncPlan: 'OpenShellWorkspaceSyncPlan';
  remoteCommandPlan: 'OpenShellRemoteCommandPlan';
  readinessSnapshot: 'OpenShellReadinessSnapshot';
  receiptEvent: 'sandbox.remote.receipt';
  policy: {
    mirrorBackToHost: false;
    secretValuesSerialized: false;
  };
};
