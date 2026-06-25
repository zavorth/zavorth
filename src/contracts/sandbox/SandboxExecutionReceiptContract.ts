export type SandboxExecutionReceipt = {
  contractVersion: 'sandbox-execution-receipt/1';
  id: string;
  createdAt: string;
  backend: 'docker' | 'wsl' | 'ssh' | 'wasm' | 'firecracker' | 'gvisor' | 'preview-only' | string;
  command: string;
  commandDigest: string;
  limits: {
    timeoutMs: number;
    memoryMb: number | null;
    cpuCount: number | null;
    pidsLimit: number | null;
  };
  networkPolicy: 'none' | 'allowlist' | 'default-deny' | 'host' | string;
  mountPolicy: 'none' | 'readonly' | 'workspace-readonly' | 'tmp-only' | string;
  exitCode: number | null;
  cleanupStatus: 'not_started' | 'completed' | 'failed' | 'preview_only';
  approvalId: string | null;
  receiptId: string;
  safety: {
    sandboxFirst: true;
    previewOnlyFallback: boolean;
    hostEscapeDenied: true;
    unsafeMountsBlocked: true;
  };
};
