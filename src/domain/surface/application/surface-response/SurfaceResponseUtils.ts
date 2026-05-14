import type {
  SurfaceBlock,
  SurfaceProgress,
  SurfaceReceipt,
  SurfaceRenderedAction,
  SurfaceRenderedActionRow,
  SurfaceRenderOptions,
  SurfaceResponse,
  SurfaceResponseAction,
  SurfaceTable,
  SurfaceTableCell,
} from './SurfaceResponseContract.js';

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function normalizeSurfaceText(value: unknown): string {
  return String(value ?? '')
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

export function compactSurfaceLine(value: unknown): string {
  return normalizeSurfaceText(value).replace(/\s+/g, ' ').trim();
}

export function truncateSurfaceText(value: unknown, maxLength: number): string {
  const text = normalizeSurfaceText(value);
  if (!Number.isFinite(maxLength) || maxLength <= 0 || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

export function formatSurfaceCell(value: SurfaceTableCell): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }
  return compactSurfaceLine(value);
}

export function renderSurfaceTable(table: SurfaceTable): string[] {
  if (table.rows.length === 0) {
    return [compactSurfaceLine(table.emptyText || 'Nenhum registro.')];
  }

  const columns = table.columns.filter((column) => compactSurfaceLine(column.key));
  if (columns.length === 0) {
    return [];
  }

  const widths = columns.map((column) => {
    const labelWidth = compactSurfaceLine(column.label || column.key).length;
    const rowWidth = table.rows.reduce((max, row) => {
      return Math.max(max, formatSurfaceCell(row[column.key]).length);
    }, 0);
    return Math.min(Math.max(column.width || 0, labelWidth, rowWidth, 3), 36);
  });

  const renderCell = (value: string, width: number, align: 'left' | 'right' = 'left') => {
    const clipped = value.length > width ? `${value.slice(0, Math.max(1, width - 1))}.` : value;
    return align === 'right' ? clipped.padStart(width, ' ') : clipped.padEnd(width, ' ');
  };

  const header = columns
    .map((column, index) => renderCell(compactSurfaceLine(column.label || column.key), widths[index]))
    .join(' | ')
    .trimEnd();
  const divider = widths.map((width) => '-'.repeat(width)).join('-|-');
  const rows = table.rows.map((row) => columns
    .map((column, index) => renderCell(formatSurfaceCell(row[column.key]), widths[index], column.align || 'left'))
    .join(' | ')
    .trimEnd());

  return [header, divider, ...rows];
}

export function renderSurfaceProgress(progress: SurfaceProgress): string {
  const label = compactSurfaceLine(progress.label) || 'Progresso';
  const detail = compactSurfaceLine(progress.detail || '');
  const hasRatio = Number.isFinite(progress.current || null) && Number.isFinite(progress.total || null) && Number(progress.total) > 0;
  const ratio = hasRatio ? `${progress.current}/${progress.total}` : null;
  return [
    `${label}: ${progress.status}${ratio ? ` (${ratio})` : ''}`,
    detail || null,
  ].filter(Boolean).join(' - ');
}

export function renderSurfaceReceipt(receipt: SurfaceReceipt): string[] {
  const lines = [
    `${compactSurfaceLine(receipt.title)} [${receipt.status}]`,
    `- id: ${compactSurfaceLine(receipt.id)}`,
    `- reason: ${compactSurfaceLine(receipt.reason)}`,
  ];

  if (receipt.policyProfile) {
    lines.push(`- policy: ${compactSurfaceLine(receipt.policyProfile)}`);
  }
  if (typeof receipt.redacted === 'boolean') {
    lines.push(`- redacted: ${receipt.redacted ? 'yes' : 'no'}`);
  }
  if (typeof receipt.riskBlocked === 'boolean') {
    lines.push(`- risk blocked: ${receipt.riskBlocked ? 'yes' : 'no'}`);
  }
  if (receipt.createdAt) {
    lines.push(`- created at: ${compactSurfaceLine(receipt.createdAt)}`);
  }

  return lines;
}

export function renderSurfaceBlock(block: SurfaceBlock): string[] {
  switch (block.kind) {
    case 'text': {
      const lines = normalizeSurfaceText(block.text).split('\n').filter(Boolean);
      return [
        block.title ? compactSurfaceLine(block.title) : null,
        ...lines,
      ].filter(Boolean) as string[];
    }
    case 'list':
      return [
        block.title ? compactSurfaceLine(block.title) : null,
        ...block.items.map((item) => `- ${compactSurfaceLine(item)}`).filter((item) => item !== '- '),
      ].filter(Boolean) as string[];
    case 'table':
      return [
        block.table.title ? compactSurfaceLine(block.table.title) : null,
        ...renderSurfaceTable(block.table),
      ].filter(Boolean) as string[];
    case 'progress':
      return [renderSurfaceProgress(block.progress)];
    case 'receipt':
      return renderSurfaceReceipt(block.receipt);
    case 'actions':
      return [
        block.title ? compactSurfaceLine(block.title) : 'Acoes',
        ...block.actions.map((action) => renderSurfaceActionLine(action)),
      ].filter(Boolean);
    default:
      return [];
  }
}

export function renderSurfaceActionLine(action: SurfaceResponseAction): string {
  const label = compactSurfaceLine(action.label || action.id);
  const command = compactSurfaceLine(action.command || '');
  const callbackData = compactSurfaceLine(action.callbackData || '');
  const href = compactSurfaceLine(action.href || '');
  const target = command || href || (callbackData ? `callback:${callbackData}` : action.id);
  const suffix = action.disabled ? ' [disabled]' : action.confirmationRequired ? ' [confirm]' : '';
  return `- ${label}: ${target}${suffix}`;
}

export function collectSurfaceActions(
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
): SurfaceRenderedAction[] {
  const actions = [
    ...(response.actions || []),
    ...response.blocks.flatMap((block) => block.kind === 'actions' ? block.actions : []),
  ];
  const seen = new Set<string>();
  const rendered: SurfaceRenderedAction[] = [];

  for (const action of actions) {
    const id = compactSurfaceLine(action.id || action.label);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    if (action.disabled && !options.includeDisabledActions) {
      continue;
    }
    rendered.push({
      id,
      label: truncateSurfaceText(action.label || id, 80),
      style: action.style || 'secondary',
      kind: action.kind || (action.href ? 'url' : action.callbackData ? 'callback' : action.command ? 'command' : 'submit'),
      command: compactSurfaceLine(action.command || '') || null,
      callbackData: compactSurfaceLine(action.callbackData || '') || null,
      href: compactSurfaceLine(action.href || '') || null,
      disabled: Boolean(action.disabled),
      confirmationRequired: Boolean(action.confirmationRequired),
    });
  }

  return rendered;
}

export function groupSurfaceActions(
  actions: SurfaceRenderedAction[],
  options: SurfaceRenderOptions = {},
): SurfaceRenderedActionRow[] {
  const perRow = Math.max(1, Math.min(options.maxActionsPerRow || 2, 5));
  const rows: SurfaceRenderedActionRow[] = [];
  for (let index = 0; index < actions.length; index += perRow) {
    rows.push({ actions: actions.slice(index, index + perRow) });
  }
  return rows;
}

export function buildSurfaceText(response: SurfaceResponse, options: SurfaceRenderOptions = {}): string {
  const lines: string[] = [
    compactSurfaceLine(response.title),
    response.summary ? compactSurfaceLine(response.summary) : '',
  ].filter((line) => line.length > 0);

  for (const block of response.blocks) {
    const blockLines = renderSurfaceBlock(block);
    if (blockLines.length > 0) {
      if (lines.length > 0) {
        lines.push('');
      }
      lines.push(...blockLines);
    }
  }

  for (const receipt of response.receipts || []) {
    if (lines.length > 0) {
      lines.push('');
    }
    lines.push(...renderSurfaceReceipt(receipt));
  }

  const actions = collectSurfaceActions(response, options);
  if (actions.length > 0) {
    if (lines.length > 0) {
      lines.push('');
    }
    lines.push('Acoes');
    lines.push(...actions.map((action) => renderSurfaceActionLine(action)));
  }

  const text = lines.join('\n');
  return options.maxTextLength ? truncateSurfaceText(text, options.maxTextLength) : text;
}

export function buildDeterministicSurfaceId(value: string, prefix: string, maxLength: number): string {
  const normalized = compactSurfaceLine(value);
  const base = normalized || prefix;
  if (base.length <= maxLength) {
    return base;
  }

  let hash = 0;
  for (let index = 0; index < base.length; index += 1) {
    hash = ((hash << 5) - hash + base.charCodeAt(index)) | 0;
  }
  const suffix = Math.abs(hash).toString(36);
  return `${prefix}:${suffix}`.slice(0, maxLength);
}

export function renderSurfaceResponseCore(
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
) {
  const actions = collectSurfaceActions(response, options);
  return {
    text: buildSurfaceText(response, options),
    actionRows: groupSurfaceActions(actions, options),
  };
}
