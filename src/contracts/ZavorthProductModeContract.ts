export const ZAVORTH_PRODUCT_DAILY_MODES = ['personal', 'governed'] as const;
export const ZAVORTH_PRODUCT_DETAIL_MODES = ['simple', 'advanced'] as const;

export type ZavorthProductDailyMode = typeof ZAVORTH_PRODUCT_DAILY_MODES[number];
export type ZavorthProductDetailMode = typeof ZAVORTH_PRODUCT_DETAIL_MODES[number];

export type ZavorthProductModeContract = {
  schemaVersion: 1;
  surface: 'product-mode';
  dailyModes: Array<{
    id: ZavorthProductDailyMode;
    label: string;
    defaultDetailMode: ZavorthProductDetailMode;
    summary: string;
    guardrail: string;
  }>;
  detailModes: Array<{
    id: ZavorthProductDetailMode;
    label: string;
    summary: string;
  }>;
  selected: {
    dailyMode: ZavorthProductDailyMode;
    detailMode: ZavorthProductDetailMode;
  };
  invariants: string[];
};

export function normalizeZavorthProductDailyMode(
  value: unknown,
  fallback: ZavorthProductDailyMode = 'personal',
): ZavorthProductDailyMode {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ZAVORTH_PRODUCT_DAILY_MODES.includes(normalized as ZavorthProductDailyMode)
    ? normalized as ZavorthProductDailyMode
    : fallback;
}

export function normalizeZavorthProductDetailMode(
  value: unknown,
  fallback: ZavorthProductDetailMode = 'simple',
): ZavorthProductDetailMode {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ZAVORTH_PRODUCT_DETAIL_MODES.includes(normalized as ZavorthProductDetailMode)
    ? normalized as ZavorthProductDetailMode
    : fallback;
}

export function buildZavorthProductModeContract(input: {
  dailyMode?: unknown;
  detailMode?: unknown;
} = {}): ZavorthProductModeContract {
  const dailyMode = normalizeZavorthProductDailyMode(input.dailyMode);
  const detailMode = normalizeZavorthProductDetailMode(
    input.detailMode,
    dailyMode === 'governed' ? 'advanced' : 'simple',
  );

  return {
    schemaVersion: 1,
    surface: 'product-mode',
    dailyModes: [
      {
        id: 'personal',
        label: 'Personal',
        defaultDetailMode: 'simple',
        summary: 'Daily local use with clear language and low-friction approvals.',
        guardrail: 'Personal mode never bypasses Policy Broker decisions.',
      },
      {
        id: 'governed',
        label: 'Governed',
        defaultDetailMode: 'advanced',
        summary: 'Audit-heavy operation with policy, receipts and technical trace details visible.',
        guardrail: 'Governed mode exposes more evidence, not more privilege.',
      },
    ],
    detailModes: [
      {
        id: 'simple',
        label: 'Simple',
        summary: 'Human wording, short next steps and safe defaults.',
      },
      {
        id: 'advanced',
        label: 'Advanced',
        summary: 'Policy Broker, tool ids, receipt ids, rollback and sandbox details.',
      },
    ],
    selected: {
      dailyMode,
      detailMode,
    },
    invariants: [
      'Product mode changes presentation and approval friction, not execution authority.',
      'Every sensitive action still flows through policy, approval and receipts.',
      'Command Center projections are read-only and never become an execution authority.',
    ],
  };
}
