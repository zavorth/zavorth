export type VoicePipelineState =
  | 'idle'
  | 'consent-pending'
  | 'device-provisioning'
  | 'ready'
  | 'recording'
  | 'transcribing'
  | 'error';

export type VoicePipelineStatus = {
  phase: VoicePipelineState;
  consented: boolean;
  hasDevice: boolean;
  isRecording: boolean;
  lastError: string | null;
  updatedAt: string;
};

export type StatusListener = (status: VoicePipelineStatus) => void;

export class VoiceStatusService {
  private currentStatus: VoicePipelineStatus;
  private readonly listeners: Set<StatusListener> = new Set();

  constructor() {
    this.currentStatus = {
      phase: 'idle',
      consented: false,
      hasDevice: false,
      isRecording: false,
      lastError: null,
      updatedAt: new Date().toISOString(),
    };
  }

  public getStatus(): VoicePipelineStatus {
    return { ...this.currentStatus };
  }

  public updateStatus(partial: Partial<VoicePipelineStatus>): void {
    this.currentStatus = {
      ...this.currentStatus,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    this.notify();
  }

  public setState(state: VoicePipelineState): void {
    this.updateStatus({ phase: state });
  }

  public setConsented(consented: boolean): void {
    const phase: VoicePipelineState = consented
      ? this.currentStatus.hasDevice ? 'idle'
        : 'device-provisioning'
      : 'consent-pending';
    this.updateStatus({ consented, phase });
  }

  public setHasDevice(hasDevice: boolean): void {
    const phase: VoicePipelineState = hasDevice
      ? this.currentStatus.consented ? 'idle'
        : 'consent-pending'
      : 'device-provisioning';
    this.updateStatus({ hasDevice, phase });
  }

  public setRecording(isRecording: boolean): void {
    const phase: VoicePipelineState = isRecording ? 'recording' : 'idle';
    this.updateStatus({ isRecording, phase });
  }

  public setError(error: string | null): void {
    this.updateStatus({
      lastError: error,
      phase: error ? 'error' : 'idle',
    });
  }

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getStatus();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
