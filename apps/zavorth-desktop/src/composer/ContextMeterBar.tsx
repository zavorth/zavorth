import { useMemo } from 'react';
import { buildContextMeter } from './contextMeter';
import { t } from '../i18n';

export function ContextMeterBar(props: {
  messages: Array<{ content?: string }>;
  toolPayloadChars?: number;
  limitTokens?: number;
}) {
  const meter = useMemo(
    () =>
      buildContextMeter({
        messages: props.messages,
        toolPayloadChars: props.toolPayloadChars,
        limitTokens: props.limitTokens,
      }),
    [props.messages, props.toolPayloadChars, props.limitTokens],
  );

  const levelClass =
    meter.level === 'critical'
      ? 'is-critical'
      : meter.level === 'warn'
        ? 'is-warn'
        : '';

  const fillPct = Math.round(meter.ratio * 100);

  return (
    <div
      className={`zvd-context-meter ${levelClass}`.trim()}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={meter.limitTokens}
      aria-valuenow={meter.usedTokens}
      aria-label={`${t('composer.contextMeter.aria')}: ${meter.label}`}
      title={meter.label}
    >
      <div className="zvd-context-meter__bar" aria-hidden="true">
        <div
          className="zvd-context-meter__fill"
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <span className="zvd-context-meter__label">{meter.label}</span>
    </div>
  );
}
