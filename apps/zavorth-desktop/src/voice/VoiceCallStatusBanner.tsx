import { resolveVoiceCallStatus, type VoiceCallStatusModel } from './voiceCallStatus';

export function VoiceCallStatusBanner(props: {
  active: boolean;
  phase?: string | null;
  webrtcState?: string | null;
  mediaMode?: string | null;
  mediaPlane?: string | null;
  busy?: boolean;
  lastError?: string | null;
  rms?: number;
  interim?: string;
  onEnd: () => void;
  endLabel: string;
  titleLabel: string;
}) {
  const status: VoiceCallStatusModel = resolveVoiceCallStatus({
    active: props.active,
    phase: props.phase,
    webrtcState: props.webrtcState,
    mediaMode: props.mediaMode,
    mediaPlane: props.mediaPlane,
    busy: props.busy,
    lastError: props.lastError,
    rms: props.rms,
  });

  if (!props.active) return null;

  return (
    <div
      className="zvd-settings-card"
      role="status"
      aria-live="polite"
      style={{
        margin: '0 12px 8px',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        borderLeft: `3px solid ${status.color}`,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: status.color,
              boxShadow: status.tone === 'active' ? `0 0 0 3px ${status.color}33` : undefined,
              flexShrink: 0,
            }}
          />
          <span>{props.titleLabel}</span>
          <span style={{ opacity: 0.85 }}>· {status.label}</span>
        </div>
        <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
          {status.detail}
          {props.interim ? ` · “${props.interim}”` : ''}
          {props.mediaPlane ? ` · ${props.mediaPlane}` : ''}
          {typeof props.rms === 'number' && props.rms > 0
            ? ` · rms ${props.rms.toFixed(2)}`
            : ''}
        </div>
        {props.lastError - (
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{props.lastError}</div>
        ) : null}
      </div>
      <button type="button" className="zvd-btn zvd-btn-ghost" onClick={props.onEnd}>
        {props.endLabel}
      </button>
    </div>
  );
}
