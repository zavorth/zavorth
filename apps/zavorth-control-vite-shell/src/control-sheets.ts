import { normalizeTraceSheetQuery } from './trace-utils';

type ControlSheetsOptions = {
  closeSkillPopover: () => void;
  escapeHtml: (value: unknown) => string;
  getOverlayShade: () => HTMLElement | null;
  getToolSheetState: () => {
    attachmentCount: number;
    hasMedia: boolean;
    hasVoice: boolean;
    isListening: boolean;
    selectedSkills: Array<{ id?: string; title?: string }>;
  };
  markOverlayOpened: () => void;
  onTraceQueryChange: (query: any) => void;
  renderTraceSheet: () => void;
  toolSheet: HTMLElement | null;
  toolSheetTrigger: HTMLElement | null;
  traceSheet: HTMLElement | null;
  traceSheetTrigger: HTMLElement | null;
};

export function createControlSheets({
  closeSkillPopover,
  escapeHtml,
  getOverlayShade,
  getToolSheetState,
  markOverlayOpened,
  onTraceQueryChange,
  renderTraceSheet,
  toolSheet,
  toolSheetTrigger,
  traceSheet,
  traceSheetTrigger,
}: ControlSheetsOptions) {
  function closeTraceSheet(clearShade = true) {
    if (!traceSheet) return;
    traceSheet.classList.remove('active');
    traceSheet.setAttribute('aria-hidden', 'true');
    if (traceSheetTrigger) {
      traceSheetTrigger.classList.remove('is-active');
      traceSheetTrigger.setAttribute('aria-expanded', 'false');
    }
    if (clearShade) getOverlayShade()?.classList.remove('active');
    setTimeout(() => {
      if (!traceSheet.classList.contains('active')) traceSheet.classList.add('hidden');
    }, 180);
  }

  function closeToolSheet(clearShade = true) {
    if (!toolSheet) return;
    toolSheet.classList.remove('active');
    toolSheet.setAttribute('aria-hidden', 'true');
    if (toolSheetTrigger) {
      toolSheetTrigger.classList.toggle('is-active', getToolSheetState().attachmentCount > 0);
      toolSheetTrigger.setAttribute('aria-expanded', 'false');
    }
    if (clearShade) getOverlayShade()?.classList.remove('active');
    setTimeout(() => {
      if (!toolSheet.classList.contains('active')) toolSheet.classList.add('hidden');
    }, 180);
  }

  function updateToolSheetState() {
    if (!toolSheet) return;
    const state = getToolSheetState();
    const activeMap = {
      attach: state.attachmentCount > 0,
      media: state.hasMedia,
      skills: state.selectedSkills.length > 0,
      voice: state.hasVoice || state.isListening,
      terminal: state.selectedSkills.some((skill) => /terminal|shell|command/i.test(`${skill.id} ${skill.title}`)),
      docs: state.selectedSkills.some((skill) => /doc|file|read/i.test(`${skill.id} ${skill.title}`)),
      mcp: state.selectedSkills.some((skill) => /mcp|remote/i.test(`${skill.id} ${skill.title}`)),
    };
    toolSheet.querySelectorAll('[data-tool-sheet-action]').forEach((item) => {
      const action = item.getAttribute('data-tool-sheet-action') || '';
      const active = Boolean(activeMap[action as keyof typeof activeMap]);
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    let stateNode = toolSheet.querySelector('.tool-sheet__state');
    if (!stateNode) {
      stateNode = document.createElement('div');
      stateNode.className = 'tool-sheet__state';
      toolSheet.querySelector('.tool-sheet__header')?.after(stateNode);
    }
    const facts = [
      state.attachmentCount ? `${state.attachmentCount} file${state.attachmentCount === 1 ? '' : 's'} attached` : 'No files attached',
      state.selectedSkills.length ? `${state.selectedSkills.length} tool${state.selectedSkills.length === 1 ? '' : 's'} selected` : 'No tool selected',
      state.hasVoice ? 'Voice transcript ready' : state.isListening ? 'Voice listening' : 'Voice idle',
    ];
    stateNode.innerHTML = facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join('');
  }

  function openToolSheet() {
    if (!toolSheet || !toolSheetTrigger) return;
    closeTraceSheet(false);
    closeSkillPopover();
    updateToolSheetState();
    getOverlayShade()?.classList.add('active');
    markOverlayOpened();
    toolSheet.classList.remove('hidden');
    void toolSheet.offsetWidth;
    toolSheet.classList.add('active');
    toolSheet.setAttribute('aria-hidden', 'false');
    toolSheetTrigger.classList.add('is-active');
    toolSheetTrigger.setAttribute('aria-expanded', 'true');
  }

  function openTraceSheet(query: any = null) {
    if (!traceSheet || !traceSheetTrigger) return;
    if (query && typeof query === 'object') onTraceQueryChange(normalizeTraceSheetQuery(query));
    closeToolSheet(false);
    closeSkillPopover();
    renderTraceSheet();
    getOverlayShade()?.classList.add('active');
    markOverlayOpened();
    traceSheet.classList.remove('hidden');
    void traceSheet.offsetWidth;
    traceSheet.classList.add('active');
    traceSheet.setAttribute('aria-hidden', 'false');
    traceSheetTrigger.classList.add('is-active');
    traceSheetTrigger.setAttribute('aria-expanded', 'true');
  }

  return {
    closeToolSheet,
    closeTraceSheet,
    openToolSheet,
    openTraceSheet,
    updateToolSheetState,
  };
}
