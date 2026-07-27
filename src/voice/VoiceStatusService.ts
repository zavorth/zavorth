export type VoicePipelineState =
  | 'idle'
  | 'consent-pending'
  | 'device-provisioning'
  | 'ready'
  | 'recording'
  | 'transcribing'
  | 'error';

export type VoicePipelineStatus = {
  state: VoicePipelineState;
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
      state: 'idle',
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
    this.updateStatus({ state });
  }

  public setConsented(consented: boolean): void {
    const state: VoicePipelineState = consented
      ? this.currentStatus.hasDevice ? 'idle'
        : 'device-provisioning'
      : 'consent-pending';
    this.updateStatus({ consented, state });
  }

  public setHasDevice(hasDevice: boolean): void {
    const state: VoicePipelineState = hasDevice
      ? this.currentStatus.consented ? 'idle'
        : 'consent-pending'
      : 'device-provisioning';
    this.updateStatus({ hasDevice, state });
  }

  public setRecording(isRecording: boolean): void {
    const state: VoicePipelineState = isRecording ? 'recording' : 'idle';
    this.updateStatus({ isRecording, state });
  }

  public setError(error: string | null): void {
    this.updateStatus({
      lastError: error,
      state: error ? 'error' : 'idle',
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
