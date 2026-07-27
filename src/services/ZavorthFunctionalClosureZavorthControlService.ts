import type {
  ZavorthFunctionalClosureZavorthControlSnapshot,
  ZavorthFunctionalClosureItem,
} from '../contracts/native/ZavorthFunctionalClosureContract.js';

type Runtime = {
  now?: () => Date;
};

export class ZavorthFunctionalClosureZavorthControlService {
  private readonly now: () => Date;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(items: ZavorthFunctionalClosureItem[]): ZavorthFunctionalClosureZavorthControlSnapshot {
    const categoryRows = items.map((item) => ({
      category: item.category,
      gate: item.gate,
      status: item.status,
      priority: item.priority,
      decision: item.decision,
      receipts: item.receiptCount,
      risk: item.risk,
    }));
    const riskRows = items
      .filter((item) => item.risk !== 'none')
      .map((item) => ({
        itemId: item.id,
        risk: item.risk,
        reason: item.notes.join(' ') || item.observed,
      }));
    const receiptRows = items.map((item) => ({
      itemId: item.id,
      receipts: item.receiptCount,
      command: item.command,
    }));
    const status = items.some((item) => item.status === 'fail') ? 'fail'
      : items.some((item) => item.status === 'warn') ? 'warn'
        : 'pass';

    return {
      status,
      generatedAt: this.now().toISOString(),
      title: 'Zavorth Functional Closure ZavorthControl',
      categoryRows,
      riskRows,
      receiptRows,
      report: this.formatReport({ items, categoryRows, riskRows, receiptRows }),
    };
  }

  private formatReport(input: {
    items: ZavorthFunctionalClosureItem[];
    categoryRows: ZavorthFunctionalClosureZavorthControlSnapshot['categoryRows'];
    riskRows: ZavorthFunctionalClosureZavorthControlSnapshot['riskRows'];
    receiptRows: ZavorthFunctionalClosureZavorthControlSnapshot['receiptRows'];
  }): string {
    const lines = [
      'Zavorth Functional Closure ZavorthControl',
      `Items: ${input.items.length}`,
      `P0: ${input.items.filter((item) => item.priority === 'P0').length}`,
      `P1: ${input.items.filter((item) => item.priority === 'P1').length}`,
      `P2: ${input.items.filter((item) => item.priority === 'P2').length}`,
      `Receipts: ${input.receiptRows.reduce((total: number, row: { receipts: number }) => total + row.receipts, 0)}`,
      'Categories:',
      ...input.categoryRows.map((row: { gate: number; category: string; status: string; priority: string; decision: string; receipts: number }) => (
        `- phase ${row.gate} ${row.category}: ${row.status}, ${row.priority}, decision=${row.decision}, receipts=${row.receipts}`
      )),
    ];

    if (input.riskRows.length > 0) {
      lines.push('Risks:');
      for (const risk of input.riskRows) {
        lines.push(`- ${risk.risk} ${risk.itemId}: ${risk.reason}`);
      }
    }

    return lines.join('\n');
  }
}
