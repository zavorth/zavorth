import { escapeHtml } from './html-utils';

export type A2UIComponent = {
  type: string;
  id: string;
  props?: Record<string, any>;
  children?: A2UIComponent[];
};

export type A2UISurfaceState = {
  surfaceId: string;
  components: A2UIComponent[];
  dataModel?: Record<string, any>;
  lastUpdated?: string;
  metadata?: Record<string, unknown>;
};

export type A2UIEventRecord = {
  id: string;
  surfaceId: string;
  eventType: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export type A2UISnapshot = {
  generatedAt: string;
  protocolVersion: 'a2ui.v1';
  capabilities?: string[];
  allowedComponents?: string[];
  surfaceId?: string | null;
  surfaces?: A2UISurfaceState[];
  commands?: {
    snapshot?: string;
    action?: string;
    events?: string;
    stream?: string;
    assets?: string;
  };
};

export type A2UIStreamSnapshot = {
  generatedAt: string;
  protocolVersion: 'a2ui.v1';
  surfaceId?: string | null;
  items?: A2UIEventRecord[];
};

export type A2UIRenderState = {
  snapshot: A2UISnapshot;
  stream?: A2UIStreamSnapshot | null;
  activeSurfaceId?: string | null;
};

const COMPONENTS_WITH_CHILDREN = new Set(['stack', 'panel', 'section', 'form']);

export function selectA2UISurface(snapshot: A2UISnapshot | null | undefined, preferredSurfaceId?: string | null): A2UISurfaceState | null {
  const surfaces = Array.isArray(snapshot?.surfaces) ? snapshot?.surfaces || [] : [];
  if (surfaces.length === 0) return null;
  const preferred = String(preferredSurfaceId || snapshot?.surfaceId || '').trim();
  return surfaces.find((surface) => surface.surfaceId === preferred) || surfaces[0] || null;
}

export function countA2UIComponents(components: A2UIComponent[] = []): number {
  return components.reduce((total, component) => total + 1 + countA2UIComponents(component.children || []), 0);
}

export function renderA2UICanvasHtml(state: A2UIRenderState): string | null {
  const surface = selectA2UISurface(state.snapshot, state.activeSurfaceId);
  if (!surface) return null;

  const surfaces = state.snapshot.surfaces || [];
  const streamItems = state.stream?.items || [];
  const componentCount = countA2UIComponents(surface.components || []);
  const capabilityText = (state.snapshot.capabilities || []).join(', ') || 'snapshot';

  return `
    <div class="z-canvas-topbar z-a2ui-topbar">
      <div>
        <span>${escapeHtml('Z-Canvas A2UI')}</span>
        <strong>${escapeHtml(surface.surfaceId)} · ${escapeHtml(state.snapshot.protocolVersion || 'a2ui.v1')}</strong>
        <small>${escapeHtml(`Declarative surface updated ${formatShortDate(surface.lastUpdated || state.snapshot.generatedAt)}.`)}</small>
      </div>
      <div class="z-a2ui-surfaces" aria-label="A2UI surfaces">
        ${surfaces.map((item) => `
          <button type="button" class="${item.surfaceId === surface.surfaceId ? 'is-active' : ''}" data-a2ui-surface="${escapeHtml(item.surfaceId)}">
            ${escapeHtml(item.surfaceId)}
          </button>
        `).join('')}
      </div>
      <div class="z-canvas-actions">
        <button type="button" data-a2ui-refresh>${escapeHtml('Refresh A2UI')}</button>
        <button type="button" data-canvas-create-attempt>${escapeHtml('New sandbox attempt')}</button>
      </div>
    </div>
    <div class="z-canvas-story z-a2ui-story" aria-label="A2UI status">
      <span><strong>${surfaces.length}</strong>${escapeHtml('surfaces')}</span>
      <span><strong>${componentCount}</strong>${escapeHtml('components')}</span>
      <span><strong>${streamItems.length}</strong>${escapeHtml('events')}</span>
      <span><strong>${escapeHtml(capabilityText)}</strong>${escapeHtml('capabilities')}</span>
    </div>
    <div class="z-canvas-layout z-a2ui-layout">
      <aside class="z-canvas-side z-a2ui-side">
        <section>
          <span>${escapeHtml('Surface')}</span>
          <h2>${escapeHtml(surface.metadata?.title || surface.metadata?.label || surface.surfaceId)}</h2>
        </section>
        <section>
          <span>${escapeHtml('Data model')}</span>
          <pre>${escapeHtml(formatRecord(surface.dataModel || {}))}</pre>
        </section>
        <section>
          <span>${escapeHtml('Recent A2UI events')}</span>
          <ul>${renderA2UIEventList(streamItems)}</ul>
        </section>
      </aside>
      <div class="z-canvas-preview z-a2ui-preview" data-a2ui-preview-surface="${escapeHtml(surface.surfaceId)}">
        ${(surface.components || []).length > 0
          ? renderA2UIChildren(surface.components, surface)
          : `<div class="z-canvas-preview__empty">${escapeHtml('A2UI surface is live, but no components were published yet.')}</div>`}
      </div>
    </div>
  `;
}

function renderA2UIChildren(components: A2UIComponent[], surface: A2UISurfaceState): string {
  return components.map((component) => renderA2UIComponent(component, surface)).join('');
}

function renderA2UIComponent(component: A2UIComponent, surface: A2UISurfaceState): string {
  const type = normalizeComponentType(component.type);
  const props = component.props || {};
  const children = Array.isArray(component.children) ? component.children : [];
  const childHtml = children.length > 0 ? renderA2UIChildren(children, surface) : '';
  const id = sanitizeDomId(component.id);
  const tone = sanitizeToken(props.tone || props.status || props.variant || 'neutral');
  const className = `z-a2ui-component z-a2ui-${type} z-a2ui-tone-${tone}`;

  if (type === 'stack') {
    const direction = sanitizeToken(props.direction || props.orientation || 'column');
    return `<div id="${id}" class="${className} z-a2ui-stack--${direction}">${childHtml}</div>`;
  }

  if (type === 'panel' || type === 'section') {
    const title = resolveText(props.title || props.label || props.heading, surface);
    const description = resolveText(props.description || props.summary, surface);
    return `
      <section id="${id}" class="${className}">
        ${title ? `<header><strong>${escapeHtml(title)}</strong>${description ? `<span>${escapeHtml(description)}</span>` : ''}</header>` : ''}
        <div class="z-a2ui-children">${childHtml || renderTextValue(props, surface)}</div>
      </section>
    `;
  }

  if (type === 'text') {
    return `<p id="${id}" class="${className}">${renderTextValue(props, surface)}</p>`;
  }

  if (type === 'badge') {
    return `<span id="${id}" class="${className}">${escapeHtml(resolveText(props.text || props.label || props.value || component.id, surface))}</span>`;
  }

  if (type === 'button') {
    const actionId = String(props.actionId || props.action || component.id || '').trim();
    const disabled = props.disabled === true ? ' disabled aria-disabled="true"' : '';
    return `
      <button id="${id}" class="${className}" type="button" data-a2ui-action="${escapeHtml(actionId)}" data-a2ui-surface-id="${escapeHtml(surface.surfaceId)}" data-a2ui-component-id="${escapeHtml(component.id)}"${disabled}>
        ${escapeHtml(resolveText(props.text || props.label || actionId || 'Action', surface))}
      </button>
    `;
  }

  if (type === 'list') {
    const items = normalizeItems(props.items || props.value);
    return `<ul id="${id}" class="${className}">${items.map((item) => `<li>${renderItem(item, surface)}</li>`).join('') || childHtml}</ul>`;
  }

  if (type === 'table') {
    return renderTable(component, surface, className, id);
  }

  if (type === 'image') {
    return renderImage(component, surface, className, id);
  }

  if (type === 'metric') {
    const label = resolveText(props.label || props.title || component.id, surface);
    const value = resolveText(props.value ?? props.metric ?? '', surface);
    const delta = resolveText(props.delta || props.detail || '', surface);
    return `
      <article id="${id}" class="${className}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        ${delta ? `<small>${escapeHtml(delta)}</small>` : ''}
      </article>
    `;
  }

  if (type === 'timeline') {
    const items = normalizeItems(props.items || props.events || props.value);
    return `<ol id="${id}" class="${className}">${items.map((item) => `<li>${renderItem(item, surface)}</li>`).join('') || childHtml}</ol>`;
  }

  if (type === 'form') {
    const actionId = String(props.actionId || props.action || component.id || 'submit').trim();
    const fields = normalizeItems(props.fields || props.inputs);
    return `
      <form id="${id}" class="${className}" data-a2ui-form data-a2ui-action="${escapeHtml(actionId)}" data-a2ui-surface-id="${escapeHtml(surface.surfaceId)}" data-a2ui-component-id="${escapeHtml(component.id)}">
        ${fields.map((field) => renderFormField(field, surface)).join('') || childHtml}
        <button type="submit">${escapeHtml(resolveText(props.submitLabel || props.label || 'Submit', surface))}</button>
      </form>
    `;
  }

  if (type === 'input') {
    return renderFormField({ ...props, id: component.id }, surface);
  }

  return `
    <div id="${id}" class="${className}">
      ${COMPONENTS_WITH_CHILDREN.has(type) ? childHtml : renderTextValue(props, surface)}
    </div>
  `;
}

function renderTextValue(props: Record<string, any>, surface: A2UISurfaceState): string {
  const text = resolveText(props.markdown || props.text || props.body || props.value || props.label || '', surface);
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function renderTable(component: A2UIComponent, surface: A2UISurfaceState, className: string, id: string): string {
  const props = component.props || {};
  const rows = normalizeItems(props.rows || props.items || props.value);
  const columns = normalizeColumns(props.columns, rows);
  return `
    <div id="${id}" class="${className}">
      <table>
        <thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(resolveText(readPath(row, column.key), surface))}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderImage(component: A2UIComponent, surface: A2UISurfaceState, className: string, id: string): string {
  const props = component.props || {};
  const src = String(props.src || props.url || props.contentUrl || '').trim();
  const alt = resolveText(props.alt || props.label || component.id, surface);
  if (!isSafeImageSource(src)) {
    return `<figure id="${id}" class="${className}"><div class="z-canvas-preview__empty">${escapeHtml('Image source unavailable or blocked by the dashboard renderer.')}</div><figcaption>${escapeHtml(alt)}</figcaption></figure>`;
  }
  return `<figure id="${id}" class="${className}"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy"><figcaption>${escapeHtml(alt)}</figcaption></figure>`;
}

function renderFormField(field: any, surface: A2UISurfaceState): string {
  const record = field && typeof field === 'object' ? field : { name: String(field || 'field') };
  const name = String(record.name || record.id || 'field').trim();
  const label = resolveText(record.label || record.title || name, surface);
  const type = ['email', 'number', 'password', 'search', 'text', 'url'].includes(String(record.type || '').toLowerCase())
    ? String(record.type).toLowerCase()
    : 'text';
  return `
    <label class="z-a2ui-input">
      <span>${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(resolveText(record.value || '', surface))}" placeholder="${escapeHtml(resolveText(record.placeholder || '', surface))}">
    </label>
  `;
}

function renderA2UIEventList(items: A2UIEventRecord[]): string {
  return items.slice(-8).reverse().map((event) => `
    <li>
      <strong>${escapeHtml(event.eventType || 'event')}</strong>
      <span>${escapeHtml(`${event.surfaceId || 'surface'} · ${formatShortDate(event.createdAt)}`)}</span>
    </li>
  `).join('') || `<li>${escapeHtml('No A2UI events yet')}</li>`;
}

function renderItem(item: any, surface: A2UISurfaceState): string {
  if (item && typeof item === 'object') {
    const title = resolveText(item.title || item.label || item.name || item.id || '', surface);
    const detail = resolveText(item.detail || item.description || item.summary || item.value || '', surface);
    if (title || detail) {
      return `${title ? `<strong>${escapeHtml(title)}</strong>` : ''}${detail ? `<span>${escapeHtml(detail)}</span>` : ''}`;
    }
    return `<code>${escapeHtml(formatRecord(item))}</code>`;
  }
  return `<span>${escapeHtml(resolveText(item, surface))}</span>`;
}

function normalizeItems(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function normalizeColumns(value: any, rows: any[]): Array<{ key: string; label: string }> {
  if (Array.isArray(value) && value.length > 0) {
    return value.map((entry) => {
      if (typeof entry === 'string') return { key: entry, label: entry };
      return {
        key: String(entry?.key || entry?.id || entry?.name || entry?.label || 'value'),
        label: String(entry?.label || entry?.title || entry?.key || entry?.id || 'Value'),
      };
    });
  }
  const first = rows.find((row) => row && typeof row === 'object' && !Array.isArray(row));
  if (first) {
    return Object.keys(first).slice(0, 6).map((key) => ({ key, label: key }));
  }
  return [{ key: 'value', label: 'Value' }];
}

function readPath(row: any, key: string): any {
  if (row && typeof row === 'object' && key in row) return row[key];
  return key === 'value' ? row : '';
}

function resolveText(value: any, surface: A2UISurfaceState): string {
  if (typeof value === 'string') {
    const dataModel = surface.dataModel || {};
    const direct = value.match(/^\$\{...([\w.-]+)\}...$/);
    if (direct) return String(readDataPath(dataModel, direct[1]) ?? '');
    return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key) => String(readDataPath(dataModel, key) ?? ''));
  }
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return formatRecord(value);
}

function readDataPath(data: Record<string, any>, key: string): any {
  return String(key || '').split('.').reduce((current, part) => {
    if (current && typeof current === 'object' && part in current) return current[part];
    return undefined;
  }, data);
}

function formatRecord(value: any): string {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return String(value || '');
  }
}

function normalizeComponentType(value: unknown): string {
  return String(value || 'section').trim().toLowerCase().replace(/[^\w-]/g, '') || 'section';
}

function sanitizeToken(value: unknown): string {
  return String(value || 'neutral').trim().toLowerCase().replace(/[^\w-]/g, '') || 'neutral';
}

function sanitizeDomId(value: unknown): string {
  const text = String(value || `a2ui-${Math.random().toString(36).slice(2)}`).trim().replace(/[^\w:-]/g, '-');
  return escapeHtml(text || 'a2ui-component');
}

function isSafeImageSource(value: string): boolean {
  return /^(https?:|blob:|data:image\/|\/|\.)/i.test(value);
}

function formatShortDate(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return 'now';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
