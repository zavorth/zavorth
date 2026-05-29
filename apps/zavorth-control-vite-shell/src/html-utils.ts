const ALLOWED_MARKDOWN_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'hr', 'i', 'iframe',
  'img', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'table', 'tbody', 'td',
  'th', 'thead', 'tr', 'u', 'ul',
]);
const DROP_MARKDOWN_TAGS = new Set([
  'base', 'embed', 'form', 'input', 'link', 'meta', 'object', 'script', 'style', 'template',
]);
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const SAFE_EMBED_PROTOCOLS = new Set(['blob:']);
const TRUSTED_UI_TAGS = new Set(['button', 'form', 'input', 'label', 'option', 'select', 'textarea']);

function isSafeUrl(value: unknown, allowedProtocols: Set<string>) {
  try {
    const parsed = new URL(String(value || ''), window.location.origin);
    return allowedProtocols.has(parsed.protocol);
  } catch {
    return false;
  }
}

function sanitizeClassName(value: unknown) {
  return String(value || '')
    .split(/\s+/)
    .map((entry) => entry.replace(/[^\w:-]/g, ''))
    .filter(Boolean)
    .join(' ');
}

export function sanitizeRenderedHtml(html: unknown, options: { allowTrustedUi?: boolean } = {}) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  const nodes = Array.from(template.content.querySelectorAll('*'));
  const allowedTags = options.allowTrustedUi
    ? new Set([...ALLOWED_MARKDOWN_TAGS, ...TRUSTED_UI_TAGS])
    : ALLOWED_MARKDOWN_TAGS;

  for (const node of nodes) {
    const tag = node.tagName.toLowerCase();
    if (DROP_MARKDOWN_TAGS.has(tag) && !(options.allowTrustedUi && TRUSTED_UI_TAGS.has(tag))) {
      node.remove();
      continue;
    }
    if (!allowedTags.has(tag)) {
      node.replaceWith(...Array.from(node.childNodes));
      continue;
    }

    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      const keepGlobal =
        name === 'title'
        || name === 'aria-label'
        || name === 'aria-pressed'
        || name === 'role'
        || (name === 'class' && sanitizeClassName(value));

      if (name.startsWith('on') || name === 'style' || name === 'srcdoc') {
        node.removeAttribute(attr.name);
        continue;
      }

      if (name === 'class') {
        const safeClassName = sanitizeClassName(value);
        if (safeClassName) node.setAttribute('class', safeClassName);
        else node.removeAttribute(attr.name);
        continue;
      }

      if (tag === 'a' && name === 'href') {
        if (isSafeUrl(value, SAFE_LINK_PROTOCOLS)) {
          node.setAttribute('href', value);
          node.setAttribute('rel', 'noopener noreferrer');
          node.setAttribute('target', '_blank');
        } else {
          node.removeAttribute(attr.name);
        }
        continue;
      }

      if (tag === 'img' && name === 'src') {
        if (isSafeUrl(value, SAFE_EMBED_PROTOCOLS)) node.setAttribute('src', value);
        else node.removeAttribute(attr.name);
        continue;
      }

      if (tag === 'iframe' && name === 'src') {
        if (isSafeUrl(value, SAFE_EMBED_PROTOCOLS)) node.setAttribute('src', value);
        else node.removeAttribute(attr.name);
        continue;
      }

      if (tag === 'img' && ['alt', 'loading'].includes(name)) continue;
      if (tag === 'iframe' && ['title', 'allowfullscreen'].includes(name)) continue;
      if (options.allowTrustedUi && name === 'id') continue;
      if (options.allowTrustedUi && ['form', 'input', 'label', 'textarea', 'button', 'select', 'option'].includes(tag)) {
        if (['id', 'name', 'type', 'placeholder', 'autocomplete', 'for', 'value', 'disabled', 'selected'].includes(name)) continue;
      }
      if (keepGlobal) continue;

      node.removeAttribute(attr.name);
    }
  }

  return template.innerHTML;
}

function normalizeUiText(value: unknown) {
  if (typeof value === 'number' && !Number.isFinite(value)) return '';
  const text = String(value ?? '');
  if (/^(nan|null|undefined)$/i.test(text.trim())) return '';
  return text;
}

export function escapeHtml(value: unknown) {
  return normalizeUiText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderMarkdown(text: unknown) {
  if (window.marked) return sanitizeRenderedHtml(marked.parse(String(text ?? '')));
  return sanitizeRenderedHtml(String(text ?? '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>'));
}
