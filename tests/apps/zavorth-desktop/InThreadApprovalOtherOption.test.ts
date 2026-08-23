import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InThreadApprovalCard } from '../../../apps/zavorth-desktop/src/thread/InThreadApprovalCard';
import {
  resolveApproval,
  type ApprovalDecisionOptions,
} from '../../../apps/zavorth-desktop/src/apiClient';

type CapturedApiRequest = {
  path: string;
  method?: string;
  body?: Record<string, unknown>;
};

function stubDesktopBridge() {
  const captured: CapturedApiRequest[] = [];
  const existing = (global as Record<string, unknown>).window;
  (global as Record<string, unknown>).window = {
    zavorthDesktop: {
      apiRequest: async (request: CapturedApiRequest) => {
        captured.push(request);
        return { ok: true, data: {} };
      },
    },
    ...((existing as Record<string, unknown>) || {}),
  };
  return {
    captured,
    restore() {
      (global as Record<string, unknown>).window = existing;
    },
  };
}

describe('desktop approval card "other" free-text parity', () => {
  it('renders the Other affordance only when a free-text decision sink is wired', () => {
    const baseProps = {
      id: 'approval-1',
      title: 'run npm test',
      risk: 'high',
      onDecide: () => undefined,
      onOpenReview: () => undefined,
    };

    const withoutSink = renderToStaticMarkup(React.createElement(InThreadApprovalCard, baseProps));
    expect(withoutSink).not.toContain('Other…');

    const withSink = renderToStaticMarkup(
      React.createElement(InThreadApprovalCard, {
        ...baseProps,
        onDecideOther: () => undefined,
      }),
    );
    expect(withSink).toContain('Other…');
    expect(withSink).toContain('Zavorth denies the action and relays it to the agent');
  });

  it('relays the typed answer as a fail-closed deny with the reason attached', async () => {
    const harness = stubDesktopBridge();
    try {
      const options: ApprovalDecisionOptions = { reason: 'not while production is frozen' };
      await resolveApproval('approval-1', 'reject', options);

      const request = harness.captured[0];
      expect(request.method).toBe('POST');
      expect(request.path).toBe('/api/experience/approvals/approval-1/decision');
      expect(request.body?.decision).toBe('reject');
      expect(request.body?.choice).toBe('deny');
      expect(request.body?.reason).toBe('not while production is frozen');
      expect((request.body?.metadata as Record<string, unknown>)?.operatorReason).toBe(
        'not while production is frozen',
      );
    } finally {
      harness.restore();
    }
  });
});
